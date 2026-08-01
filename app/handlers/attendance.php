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

    // เวรกลางคืน "คืนนี้" (ถ้าลงแล้ว) — ใช้โชว์สถานะบนหน้าหลัก
    $st = db()->prepare('SELECT * FROM night_shifts WHERE user_id = ? AND duty_date = ?');
    $st->execute([$u['id'], tonight_duty_date()]);
    $nightToday = $st->fetch() ?: null;

    gdrive_kick_if_stale();   // ถือโอกาสไล่คิวรูปค้าง (ทำหลังส่ง response, ไม่หน่วงหน้าแอป)

    ok([
        'user'     => public_user($u),
        'today'    => [
            'date'        => $today,
            'thai_date'   => thai_date($today),
            'is_holiday'  => is_station_holiday($today),
            'day_off'     => $offToday,
            'attendance'  => $att,
            'night'       => $nightToday,
            'offsite'     => offsite_for($today),                    // ทั้งสถานีนอกสถานที่ (null = วันปกติ)
            'offsite_user'=> offsite_user_for($u['id'], $today),     // อนุญาตรายคน (null = ไม่ได้รับอนุญาต)
        ],
        'quota'    => ['used' => $quotaUsed, 'max' => (int)setting('off_quota_month', '10')],
        'upcoming' => $upcoming,
        'history'  => $history,
        'library_unread' => $libUnread,
        'notif_unread'   => notify_unread_count($u['id']),   // จุดแดงกล่องข้อความ
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
        'night_shift_enabled' => setting('night_shift_enabled', '1') === '1',
        'night_checkin_open'  => setting('night_checkin_open', '18:00'),
        'sunday_work_enabled' => setting('sunday_work_enabled', '1') === '1',
    ];
}

/** duty_date ของ "คืนนี้" — ถ้าเวลาปัจจุบันก่อน 06:00 ถือเป็นเวรของเมื่อวาน */
function tonight_duty_date(): string {
    return (int)date('G') < 6 ? date('Y-m-d', strtotime('-1 day')) : date('Y-m-d');
}

/** วันเช็คชื่อนอกสถานที่ของวันที่ระบุ (row {off_date,start_time,end_time,reason} หรือ null) */
function offsite_for(string $date): ?array {
    $st = db()->prepare('SELECT off_date, start_time, end_time, reason FROM offsite_days WHERE off_date = ?');
    $st->execute([$date]);
    return $st->fetch() ?: null;
}

/** อนุญาตเช็คนอกสถานที่รายคน ของ user+วันนี้ (row {off_date,reason,no_late} หรือ null) — ข้าม GPS; no_late=1 = ไม่นับสาย */
function offsite_user_for(int $uid, string $date): ?array {
    $st = db()->prepare('SELECT off_date, reason, no_late FROM offsite_users WHERE user_id = ? AND off_date = ?');
    $st->execute([$uid, $date]);
    return $st->fetch() ?: null;
}

function h_checkin(): never {
    $u     = require_user();
    $today = date('Y-m-d');

    $isHoliday = is_station_holiday($today);
    $offsite   = offsite_for($today);   // วันเช็คชื่อนอกสถานที่ทั้งสถานี (ข้าม GPS + ใช้ช่วงเวลาของวันนั้น); null = วันปกติ
    $offsiteUser = offsite_user_for($u['id'], $today);   // อนุญาตนอกสถานที่รายคน (ข้าม GPS อย่างเดียว เวลา/สายปกติ)
    if ($isHoliday && !$offsite && setting('sunday_work_enabled', '1') !== '1')
        fail('วันนี้เป็นวันหยุดสถานี (วันอาทิตย์) ไม่ต้องเช็คชื่อค่ะ');

    $st = db()->prepare('SELECT type FROM day_offs WHERE user_id = ? AND off_date = ?');
    $st->execute([$u['id'], $today]);
    if ($off = $st->fetch()) {
        $label = ['dayoff' => 'วันหยุด', 'sick' => 'ลาป่วย', 'personal' => 'ลากิจ'][$off['type']] ?? 'วันหยุด';
        fail("วันนี้คุณแจ้ง{$label}ไว้ — หากมาทำงาน ให้ยกเลิกวันหยุดก่อนเช็คชื่อ");
    }

    $st = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND work_date = ?');
    $st->execute([$u['id'], $today]);
    if ($st->fetch()) fail('วันนี้เช็คชื่อไปแล้ว');

    // เวลาเปิดเช็ค: offsite ใช้ช่วงเวลาของวันนั้น / วันทำงานปกติใช้ checkin_open / วันหยุด (งานวันอาทิตย์) เช็คได้ทั้งวัน
    if ($offsite || !$isHoliday) {
        $openStr = $offsite ? $offsite['start_time'] : setting('checkin_open', '08:05');
        if (now_min() < hm_to_min($openStr)) fail("ยังไม่ถึงเวลาเช็คชื่อ (เปิด {$openStr} น.)");
    }

    // ---- GPS ----
    $lat = param('lat') !== null ? (float)param('lat') : null;
    $lng = param('lng') !== null ? (float)param('lng') : null;
    $dist = null;
    if ($lat !== null && $lng !== null) {
        $dist = distance_m($lat, $lng, (float)setting('gps_lat'), (float)setting('gps_lng'));
    }
    if (!$offsite && !$offsiteUser && setting('gps_enforce', '1') === '1') {   // นอกสถานที่ (ทั้งสถานี/รายคน) ข้ามการบังคับรัศมี (ยังเก็บพิกัด/ระยะไว้ดู)
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

    // คิดสาย: offsite ใช้ end_time ของวันนั้น / วันทำงานปกติใช้ late_cutoff (+ยกเว้นเวรกลางคืน) / วันหยุด (งานวันอาทิตย์) ไม่นับสาย
    $late = 0; $exempted = false;
    if ($offsite) {
        $late = now_min() > hm_to_min($offsite['end_time']) ? 1 : 0;
    } elseif (!$isHoliday) {
        $late = now_min() > hm_to_min(setting('late_cutoff', '08:15')) ? 1 : 0;
        if ($late) {   // ยกเว้นสายถ้าเมื่อคืนลงเวรกลางคืน (duty_date = เมื่อวาน; รวมคืนวันอาทิตย์)
            $st = db()->prepare('SELECT 1 FROM night_shifts WHERE user_id = ? AND duty_date = ?');
            $st->execute([$u['id'], date('Y-m-d', strtotime('-1 day'))]);
            if ($st->fetch()) { $late = 0; $exempted = true; }
        }
    }
    if ($offsiteUser && (int)$offsiteUser['no_late']) $late = 0;   // วันไปราชการ (รายคน) ไม่นับสาย
    $note = mb_substr(trim((string)param('note', '')), 0, 255) ?: null;

    db()->prepare('INSERT INTO attendance (user_id, work_date, time_in, late, lat, lng, distance_m, selfie_path, note)
                   VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)')
        ->execute([$u['id'], $today, $late, $lat, $lng, $dist, $selfiePath, $note]);

    // สำเนารูปขึ้น Google Drive เบื้องหลัง (ไม่หน่วงเช็คอิน — คิว retry จนสำเร็จ)
    if ($selfiePath) gdrive_enqueue($selfiePath, $u['name'], $today);

    $msg = 'เช็คชื่อแล้ว ตรงเวลา 🎉';
    if ($offsite)         $msg = $late ? 'เช็คชื่อแล้ว (นอกสถานที่ · สาย) 📍' : 'เช็คชื่อแล้ว (นอกสถานที่) 📍';
    elseif ($offsiteUser) $msg = (int)$offsiteUser['no_late'] ? 'เช็คชื่อแล้ว (นอกพื้นที่ · ไปราชการ ไม่นับสาย) 📍'
                                : ($late ? 'เช็คชื่อแล้ว (นอกพื้นที่ · สาย) 📍' : 'เช็คชื่อแล้ว (นอกพื้นที่ · ได้รับอนุญาต) 📍');
    elseif ($late)      $msg = 'เช็คชื่อแล้ว (สาย)';
    elseif ($exempted)  $msg = 'เช็คชื่อแล้ว — ยกเว้นสาย (มาจากเวรกลางคืน) 🌙';
    elseif ($isHoliday) $msg = 'เช็คชื่อแล้ว (ทำงานวันหยุด) 🎉';

    ok([
        'late'     => (bool)$late,
        'exempted' => $exempted,
        'holiday'  => $isHoliday,
        'time_in'  => date('H:i:s'),
        'message'  => $msg,
    ]);
}

function h_night_checkin(): never {
    $u = require_user();
    if (setting('night_shift_enabled', '1') !== '1') fail('ระบบเวรกลางคืนยังไม่เปิดใช้งาน');
    if (($u['gender'] ?? null) !== 'male') {
        fail(($u['gender'] ?? null) === 'female'
            ? 'เวรกลางคืนสำหรับเจ้าหน้าที่ชายเท่านั้นค่ะ'
            : 'แอดมินยังไม่ได้ระบุเพศของคุณ — แจ้งหัวหน้าตั้งค่าก่อนลงเวรค่ะ');
    }

    $open = hm_to_min(setting('night_checkin_open', '18:00'));
    if (now_min() < $open) fail('ยังไม่ถึงเวลาลงเวรกลางคืน (เปิด ' . setting('night_checkin_open', '18:00') . ' น.)');

    $dutyDate = tonight_duty_date();
    $st = db()->prepare('SELECT id FROM night_shifts WHERE user_id = ? AND duty_date = ?');
    $st->execute([$u['id'], $dutyDate]);
    if ($st->fetch()) fail('คืนนี้ลงเวรไปแล้วค่ะ');

    // ---- GPS (เหมือนเช็คชื่อ) ----
    $lat = param('lat') !== null ? (float)param('lat') : null;
    $lng = param('lng') !== null ? (float)param('lng') : null;
    $dist = ($lat !== null && $lng !== null)
        ? distance_m($lat, $lng, (float)setting('gps_lat'), (float)setting('gps_lng')) : null;
    if (setting('gps_enforce', '1') === '1') {
        if ($dist === null) fail('ไม่พบพิกัด GPS — กรุณาเปิดตำแหน่งแล้วลองใหม่');
        $radius = (int)setting('gps_radius_m', '1000');
        if ($dist > $radius) fail("คุณอยู่ห่างสถานี {$dist} ม. (เกินรัศมี {$radius} ม.) ลงเวรไม่ได้");
    }

    // ---- เซลฟี่ (ใช้สวิตช์ selfie_required เดียวกับเช็คชื่อ) ----
    $selfiePath = null;
    $selfie = param('selfie');
    if (setting('selfie_required', '0') === '1') {
        if (!$selfie) fail('กรุณาถ่ายรูปเซลฟี่ยืนยันตัวตน');
        $selfiePath = save_photo($selfie, 'night_u' . $u['id']);
        if (!$selfiePath) fail('บันทึกรูปเซลฟี่ไม่สำเร็จ กรุณาลองใหม่');
    } elseif ($selfie) {
        $selfiePath = save_photo($selfie, 'night_u' . $u['id']);
    }

    db()->prepare('INSERT INTO night_shifts (user_id, duty_date, time_in, lat, lng, distance_m, selfie_path)
                   VALUES (?, ?, NOW(), ?, ?, ?, ?)')
        ->execute([$u['id'], $dutyDate, $lat, $lng, $dist, $selfiePath]);

    if ($selfiePath) gdrive_enqueue($selfiePath, $u['name'] . ' (เวรกลางคืน)', $dutyDate);

    ok([
        'time_in'   => date('H:i:s'),
        'duty_date' => $dutyDate,
        'message'   => 'ลงเวรกลางคืนแล้ว 🌙 ขอบคุณที่เฝ้าสถานีค่ะ',
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

    $st = db()->prepare("SELECT * FROM night_shifts WHERE user_id = ? AND DATE_FORMAT(duty_date,'%Y-%m') = ? ORDER BY duty_date DESC");
    $st->execute([$u['id'], $ym]);
    $nights = $st->fetchAll();

    ok(['ym' => $ym, 'attendance' => $att, 'day_offs' => $offs, 'night_shifts' => $nights]);
}
