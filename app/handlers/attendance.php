<?php
// =====================================================
// FireCheck — Attendance handlers (เช็คอิน / เช็คเอาท์ / ข้อมูลหน้าเจ้าหน้าที่)
// =====================================================

/** ข้อมูลตั้งต้นหน้าเจ้าหน้าที่ — เรียกครั้งเดียวได้ครบ */
function h_app_data(): never {
    $u     = require_user();
    $today = date('Y-m-d');

    $st = db()->prepare('SELECT * FROM attendance WHERE user_id = ? AND work_date = ?');
    $st->execute([$u['id'], $today]);
    $att = $st->fetch() ?: null;

    $st = db()->prepare('SELECT * FROM day_offs WHERE user_id = ? AND off_date = ?');
    $st->execute([$u['id'], $today]);
    $offToday = $st->fetch() ?: null;

    // โควต้าวันหยุดเดือนนี้ (นับเฉพาะ dayoff ที่จองเอง ไม่นับลาป่วย/ลากิจ)
    $st = db()->prepare("SELECT COUNT(*) c FROM day_offs
                         WHERE user_id = ? AND type = 'dayoff' AND DATE_FORMAT(off_date,'%Y-%m') = ?");
    $st->execute([$u['id'], date('Y-m')]);
    $quotaUsed = (int)$st->fetch()['c'];

    // วันหยุด/ลาที่จองไว้ล่วงหน้า (วันนี้ขึ้นไป)
    $st = db()->prepare('SELECT * FROM day_offs WHERE user_id = ? AND off_date >= ? ORDER BY off_date LIMIT 60');
    $st->execute([$u['id'], $today]);
    $upcoming = $st->fetchAll();

    // ประวัติ 30 รายการล่าสุด
    $st = db()->prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY work_date DESC LIMIT 30');
    $st->execute([$u['id']]);
    $history = $st->fetchAll();

    // เอกสารในคลังความรู้ที่ยังไม่เปิดดู (badge หน้าหลัก)
    $st = db()->prepare('SELECT COUNT(*) c FROM library_items i
                         LEFT JOIN library_reads r ON r.item_id = i.id AND r.user_id = ?
                         WHERE i.is_active = 1 AND r.id IS NULL');
    $st->execute([$u['id']]);
    $libUnread = (int)$st->fetch()['c'];

    ok([
        'user'     => public_user($u),
        'today'    => [
            'date'        => $today,
            'thai_date'   => thai_date($today),
            'is_holiday'  => is_station_holiday($today),
            'day_off'     => $offToday,
            'attendance'  => $att,
        ],
        'quota'    => ['used' => $quotaUsed, 'max' => (int)setting('off_quota_month', '10')],
        'upcoming' => $upcoming,
        'history'  => $history,
        'library_unread' => $libUnread,
        'settings' => client_settings(),
    ]);
}

/** settings เฉพาะที่ frontend ต้องรู้ */
function client_settings(): array {
    return [
        'station_name'     => setting('station_name'),
        'checkin_open'     => setting('checkin_open', '08:05'),
        'late_cutoff'      => setting('late_cutoff', '08:15'),
        'checkout_open'    => setting('checkout_open', '16:00'),
        'report_cutoff'    => setting('report_cutoff', '17:00'),
        'selfie_required'  => setting('selfie_required', '0') === '1',
        'checkout_enabled' => setting('checkout_enabled', '0') === '1',
        'gps_enforce'      => setting('gps_enforce', '1') === '1',
        'gps_lat'          => (float)setting('gps_lat'),
        'gps_lng'          => (float)setting('gps_lng'),
        'gps_radius_m'     => (int)setting('gps_radius_m', '1000'),
        'off_quota_month'  => (int)setting('off_quota_month', '10'),
        'sunday_off'       => setting('sunday_off', '1') === '1',
    ];
}

function h_checkin(): never {
    $u     = require_user();
    $today = date('Y-m-d');

    if (is_station_holiday($today)) fail('วันนี้เป็นวันหยุดสถานี (วันอาทิตย์) ไม่ต้องเช็คชื่อค่ะ');

    $st = db()->prepare('SELECT type FROM day_offs WHERE user_id = ? AND off_date = ?');
    $st->execute([$u['id'], $today]);
    if ($off = $st->fetch()) {
        $label = ['dayoff' => 'วันหยุด', 'sick' => 'ลาป่วย', 'personal' => 'ลากิจ'][$off['type']] ?? 'วันหยุด';
        fail("วันนี้คุณแจ้ง{$label}ไว้ — หากมาทำงาน ให้ยกเลิกวันหยุดก่อนเช็คชื่อ");
    }

    $st = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND work_date = ?');
    $st->execute([$u['id'], $today]);
    if ($st->fetch()) fail('วันนี้เช็คชื่อไปแล้ว');

    $open = hm_to_min(setting('checkin_open', '08:05'));
    if (now_min() < $open) fail('ยังไม่ถึงเวลาเช็คชื่อ (เปิด ' . setting('checkin_open', '08:05') . ' น.)');

    // ---- GPS ----
    $lat = param('lat') !== null ? (float)param('lat') : null;
    $lng = param('lng') !== null ? (float)param('lng') : null;
    $dist = null;
    if ($lat !== null && $lng !== null) {
        $dist = distance_m($lat, $lng, (float)setting('gps_lat'), (float)setting('gps_lng'));
    }
    if (setting('gps_enforce', '1') === '1') {
        if ($dist === null) fail('ไม่พบพิกัด GPS — กรุณาเปิดตำแหน่งแล้วลองใหม่');
        $radius = (int)setting('gps_radius_m', '1000');
        if ($dist > $radius) fail("คุณอยู่ห่างสถานี {$dist} ม. (เกินรัศมี {$radius} ม.) เช็คชื่อไม่ได้");
    }

    // ---- เซลฟี่ (เปิด/ปิดได้จากตั้งค่า) ----
    $selfiePath = null;
    $selfie = param('selfie');
    if (setting('selfie_required', '0') === '1') {
        if (!$selfie) fail('กรุณาถ่ายรูปเซลฟี่ยืนยันตัวตน');
        $selfiePath = save_photo($selfie, 'selfie_u' . $u['id']);
        if (!$selfiePath) fail('บันทึกรูปเซลฟี่ไม่สำเร็จ กรุณาลองใหม่');
    } elseif ($selfie) {
        $selfiePath = save_photo($selfie, 'selfie_u' . $u['id']); // ส่งมาก็เก็บให้ แม้ไม่บังคับ
    }

    $late = now_min() > hm_to_min(setting('late_cutoff', '08:15')) ? 1 : 0;

    db()->prepare('INSERT INTO attendance (user_id, work_date, time_in, late, lat, lng, distance_m, selfie_path)
                   VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)')
        ->execute([$u['id'], $today, $late, $lat, $lng, $dist, $selfiePath]);

    ok([
        'late'    => (bool)$late,
        'time_in' => date('H:i:s'),
        'message' => $late ? 'เช็คชื่อแล้ว (สาย)' : 'เช็คชื่อแล้ว ตรงเวลา 🎉',
    ]);
}

function h_checkout(): never {
    $u = require_user();
    if (setting('checkout_enabled', '0') !== '1') fail('ระบบเช็คเอาท์ยังไม่เปิดใช้งาน');

    $today = date('Y-m-d');
    $st = db()->prepare('SELECT * FROM attendance WHERE user_id = ? AND work_date = ?');
    $st->execute([$u['id'], $today]);
    $att = $st->fetch();
    if (!$att)            fail('วันนี้ยังไม่ได้เช็คชื่อเข้า');
    if ($att['time_out']) fail('วันนี้ส่งรายงานไปแล้ว');

    $open = hm_to_min(setting('checkout_open', '16:00'));
    if (now_min() < $open) fail('ยังไม่ถึงเวลาส่งรายงาน (เปิด ' . setting('checkout_open', '16:00') . ' น.)');

    $report = trim((string)param('report'));
    if ($report === '') fail('กรุณากรอกรายงานผลการปฏิบัติงาน');

    $paths = [];
    foreach ((array)param('photos', []) as $p) {
        if (count($paths) >= 6) break;
        if (is_string($p) && ($saved = save_photo($p, 'work_u' . $u['id']))) $paths[] = $saved;
    }

    $reportLate = now_min() > hm_to_min(setting('report_cutoff', '17:00')) ? 1 : 0;

    db()->prepare('UPDATE attendance SET time_out = NOW(), report_text = ?, report_late = ?, photos_json = ? WHERE id = ?')
        ->execute([$report, $reportLate, json_encode($paths, JSON_UNESCAPED_UNICODE), $att['id']]);

    ok([
        'report_late' => (bool)$reportLate,
        'message'     => $reportLate ? 'ส่งรายงานแล้ว (ล่าช้า)' : 'ส่งรายงานแล้ว เรียบร้อย 🎉',
    ]);
}

function h_my_history(): never {
    $u  = require_user();
    $ym = preg_match('/^\d{4}-\d{2}$/', (string)param('ym')) ? param('ym') : date('Y-m');

    $st = db()->prepare("SELECT * FROM attendance WHERE user_id = ? AND DATE_FORMAT(work_date,'%Y-%m') = ? ORDER BY work_date DESC");
    $st->execute([$u['id'], $ym]);
    $att = $st->fetchAll();

    $st = db()->prepare("SELECT * FROM day_offs WHERE user_id = ? AND DATE_FORMAT(off_date,'%Y-%m') = ? ORDER BY off_date DESC");
    $st->execute([$u['id'], $ym]);
    $offs = $st->fetchAll();

    ok(['ym' => $ym, 'attendance' => $att, 'day_offs' => $offs]);
}
