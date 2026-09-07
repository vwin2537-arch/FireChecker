<?php
// =====================================================
// FireCheck — Day-off / Leave handlers
// จองวันหยุดล่วงหน้าไม่ต้องอนุมัติ — เกินโควต้ารายเดือนจะ flag แจ้งเตือนแอดมิน
// =====================================================

const OFF_TYPES = ['dayoff' => 'วันหยุด', 'sick' => 'ลาป่วย', 'personal' => 'ลากิจ'];

// ---------- เส้นแบ่งอนุมัติลา (นิยามครั้งเดียว ใช้ทั้ง insert / auto-approve / reject) ----------
// คำขอลา (ป่วย/กิจ) ที่ off_date ตั้งแต่ "วันนี้+2" ขึ้นไป = ยัง pending ปฏิเสธได้
// ต่ำกว่านั้น = เลย deadline "00:00 ของวันก่อนวันลา" → อนุมัติอัตโนมัติ ปฏิเสธไม่ได้
function leave_lock_cutoff(): string { return date('Y-m-d', strtotime('+2 day')); }
function leave_still_pending(string $offDate): bool { return $offDate >= leave_lock_cutoff(); }

/** สถานะเริ่มต้นของรายการลาตามประเภท+วันที่ (dayoff = approved เสมอ) */
function leave_initial_status(string $type, string $offDate): string {
    return ($type === 'dayoff' || !leave_still_pending($offDate)) ? 'approved' : 'pending';
}

/** ล็อกคำขอที่เลย deadline แล้ว → approved (ปฏิเสธไม่ได้อีก) — เรียกก่อนสร้างรายการ pending เสมอ
 *  ยกเว้นวันหยุดเกินโควต้า (over_quota=1) ที่ต้องรอหัวหน้าอนุมัติเสมอ ไม่มี auto-approve */
function leave_auto_approve(): void {
    db()->prepare("UPDATE day_offs SET status = 'approved'
                   WHERE status = 'pending' AND off_date < ? AND over_quota = 0")
        ->execute([leave_lock_cutoff()]);
}

/** รายการลาที่รออนุมัติ (เรียงตามวันลา) — เติม off_thai ให้ frontend/LINE ใช้
 *  กรอง off_date >= วันนี้: คำขอเกินโควต้าที่เลยวันไปแล้ว (ไม่ auto-approve) จะตกจากคิว/badge
 *  ไม่ให้สะสม — row ยังอยู่ (roster นับเป็นลาตามเดิม) แค่ไม่ต้องกดอนุมัติย้อนหลัง */
function leave_pending_list(): array {
    $rows = db()->query(
        "SELECT o.id, o.user_id, o.off_date, o.type, o.note, u.name
         FROM day_offs o JOIN users u ON u.id = o.user_id
         WHERE o.status = 'pending' AND u.status = 'active' AND o.off_date >= CURDATE()
         ORDER BY o.off_date, u.name")->fetchAll();
    foreach ($rows as &$r) $r['off_thai'] = thai_date($r['off_date'], false);
    return $rows;
}

/** นับวันหยุดประเภท dayoff ของ user ในเดือนที่กำหนด */
function dayoff_count(int $userId, string $ym): int {
    $st = db()->prepare("SELECT COUNT(*) c FROM day_offs
                         WHERE user_id = ? AND type = 'dayoff' AND DATE_FORMAT(off_date,'%Y-%m') = ?");
    $st->execute([$userId, $ym]);
    return (int)$st->fetch()['c'];
}

/**
 * เพิ่มวันหยุด/ลาให้ user — ใช้ร่วมกันทั้งฝั่งเจ้าหน้าที่และแอดมิน
 * คืน ['added'=>[], 'skipped'=>[], 'over_quota'=>[]]
 */
function dayoff_insert(int $userId, array $dates, string $type, string $note, bool $isAdmin): array {
    if (!isset(OFF_TYPES[$type])) fail('ประเภทวันหยุดไม่ถูกต้อง');

    $today  = date('Y-m-d');
    $added = $skipped = $overQuota = $pending = [];

    foreach (array_unique((array)$dates) as $d) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$d)) { $skipped[] = [$d, 'รูปแบบวันที่ผิด']; continue; }
        // เจ้าหน้าที่จองได้ตั้งแต่วันนี้ขึ้นไป / แอดมินบันทึกย้อนหลังได้ (เช่น โทรมาลาป่วย)
        if (!$isAdmin && $d < $today)          { $skipped[] = [$d, 'เป็นวันที่ผ่านมาแล้ว']; continue; }
        if (is_station_holiday($d))            { $skipped[] = [$d, 'เป็นวันหยุดสถานีอยู่แล้ว']; continue; }
        // ลากิจต้องแจ้งล่วงหน้าอย่างน้อย 2 วัน (เฉพาะเจ้าหน้าที่ — แอดมินบันทึกแทน/ย้อนหลังได้)
        if (!$isAdmin && $type === 'personal' && !leave_still_pending($d)) {
            $skipped[] = [$d, 'ลากิจต้องแจ้งล่วงหน้าอย่างน้อย 2 วัน']; continue;
        }

        $st = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND work_date = ?');
        $st->execute([$userId, $d]);
        if ($st->fetch())                      { $skipped[] = [$d, 'วันนั้นเช็คชื่อไปแล้ว']; continue; }

        $st = db()->prepare('SELECT id FROM day_offs WHERE user_id = ? AND off_date = ?');
        $st->execute([$userId, $d]);
        if ($st->fetch())                      { $skipped[] = [$d, 'จองไว้แล้ว']; continue; }

        // เกินโควต้าไหม (เฉพาะประเภท dayoff — ลาป่วย/ลากิจไม่นับโควต้า)
        // โควต้าเดือน = จำนวนวันหยุดสถานีของเดือนนั้น (อาทิตย์ + นักขัตฯวันธรรมดา)
        $isOver = 0;
        if ($type === 'dayoff') {
            $ym = substr($d, 0, 7);
            if (dayoff_count($userId, $ym) + 1 > station_holidays_in_month($ym)) $isOver = 1;
        }

        // แอดมินบันทึกลาแทน = อนุมัติในตัวทันที (ไม่ต้องรออนุมัติเอง) / เจ้าหน้าที่ยื่นเอง = ตามกฎ deadline
        $status = $isAdmin ? 'approved' : leave_initial_status($type, $d);
        // เจ้าหน้าที่จองวันหยุดเกินโควต้า = ต้องรอหัวหน้าอนุมัติเสมอ (แม้ผ่านเส้น deadline)
        if (!$isAdmin && $isOver) $status = 'pending';
        db()->prepare('INSERT INTO day_offs (user_id, off_date, type, status, note, over_quota) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$userId, $d, $type, $status, $note, $isOver]);
        $added[] = $d;
        if ($isOver) $overQuota[] = $d;
        if ($status === 'pending') $pending[] = $d;
    }
    return ['added' => $added, 'skipped' => $skipped, 'over_quota' => $overQuota, 'pending' => $pending];
}

function h_dayoff_add(): never {
    $u    = require_user();
    $type = (string)param('type', 'dayoff');
    $note = mb_substr(trim((string)param('note', '')), 0, 255);
    // ลาป่วย/ลากิจ ต้องระบุเหตุผลเสมอ (วันหยุดจองล่วงหน้าไม่บังคับ)
    if (($type === 'sick' || $type === 'personal') && $note === '') fail('กรุณาระบุเหตุผลการลา');
    $r = dayoff_insert((int)$u['id'], (array)param('dates', []), $type, $note, false);
    if (!$r['added'] && $r['skipped']) fail('จองไม่สำเร็จ: ' . $r['skipped'][0][1]);

    // แจ้งเข้ากลุ่ม LINE ทันที (async ผ่านคิว) — หัวหน้ารู้ทันทีไม่ต้องรอรายงานเช้า/เย็น
    // ลาป่วย/ลากิจ = แจ้งทุกวันที่ยื่น / วันหยุด = แจ้งเฉพาะที่เกินโควต้า (รออนุมัติ) — dayoff ในโควต้าไม่รบกวนกลุ่ม
    $lineDates = ($type === 'sick' || $type === 'personal') ? $r['added'] : $r['over_quota'];
    if ($lineDates) {
        $dates = implode(', ', array_map(fn($d) => thai_date($d, false), $lineDates));
        $head  = ($type === 'dayoff') ? '🔔 ขอใช้วันหยุดเกินโควต้า' : '🔔 มีคำขอลา';
        line_enqueue("{$head}\n• {$u['name']} — " . OFF_TYPES[$type] . " {$dates}"
                   . ($note !== '' ? "\n📝 {$note}" : '')
                   . ($r['pending'] ? "\n⏳ รออนุมัติจากหัวหน้าสถานี" : ''));
    }

    // เด้ง push หาหัวหน้า "ทุกครั้ง" ที่เจ้าหน้าที่ลงวันหยุด/ลา (รวม dayoff ในโควต้าที่ LINE เงียบ) — พี่วินขอรู้ทุกรายการ
    // push อย่างเดียว ไม่เขียนกล่องข้อความ (หัวหน้ามีปฏิทิน+คิวอนุมัติในแอปอยู่แล้ว)
    if ($r['added']) {
        $dates = implode(', ', array_map(fn($d) => thai_date($d, false), $r['added']));
        if ($type !== 'dayoff')      $head = '🔔 มีคำขอลา';
        elseif ($r['over_quota'])    $head = '🔔 ขอใช้วันหยุดเกินโควต้า';
        else                         $head = '📅 ลงวันหยุด';
        $admins = db()->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
        push_to_users(array_map('intval', $admins), $head,
            "{$u['name']} — " . OFF_TYPES[$type] . " {$dates}" . ($r['pending'] ? ' (รออนุมัติ)' : ''), './');
    }

    $msg = 'บันทึกแล้ว ' . count($r['added']) . ' วัน';
    if ($r['over_quota'])   $msg .= ' ⚠️ เกินโควต้าวันหยุดเดือนนี้ — ต้องรอหัวหน้าอนุมัติ ' . count($r['over_quota']) . ' วัน';
    elseif ($r['pending'])  $msg .= ' ⏳ รออนุมัติจากหัวหน้าสถานี ' . count($r['pending']) . ' วัน';
    ok($r + ['message' => $msg]);
}

function h_dayoff_cancel(): never {
    $u  = require_user();
    $id = (int)param('id');
    $st = db()->prepare('SELECT * FROM day_offs WHERE id = ? AND user_id = ?');
    $st->execute([$id, $u['id']]);
    $off = $st->fetch();
    if (!$off)                          fail('ไม่พบรายการนี้');
    if ($off['off_date'] < date('Y-m-d')) fail('ยกเลิกวันที่ผ่านมาแล้วไม่ได้');

    db()->prepare('DELETE FROM day_offs WHERE id = ?')->execute([$id]);
    $line = "{$u['name']} — " . OFF_TYPES[$off['type']] . ' ' . thai_date($off['off_date'], false);
    // แจ้งเข้ากลุ่ม LINE เมื่อยกเลิกลาป่วย/ลากิจ (async) — หัวหน้ารู้ว่าคำขอถูกถอน (ยกเลิกวันหยุดธรรมดาไม่รบกวนกลุ่ม)
    if ($off['type'] === 'sick' || $off['type'] === 'personal') {
        line_enqueue("❌ ยกเลิกคำขอลา\n• {$line}");
    }
    // เด้ง push หาหัวหน้าทุกครั้งที่ยกเลิก (คู่กับตอนลง — พี่วินขอรู้ทุกรายการ) push อย่างเดียว ไม่เขียนกล่องข้อความ
    $admins = db()->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
    push_to_users(array_map('intval', $admins), $off['type'] === 'dayoff' ? '❌ ยกเลิกวันหยุด' : '❌ ยกเลิกคำขอลา', $line, './');
    ok(['message' => 'ยกเลิกวันหยุดแล้ว']);
}

/** ปฏิทินวันหยุดรวมทั้งสถานีของเดือนนั้น (เจ้าหน้าที่ทุกคนดูได้ — โปร่งใส) */
function h_dayoff_month(): never {
    require_user();
    $ym = preg_match('/^\d{4}-\d{2}$/', (string)param('ym')) ? param('ym') : date('Y-m');

    $st = db()->prepare(
        "SELECT o.id, o.user_id, o.off_date, o.type, o.status, o.note, o.over_quota, u.name
         FROM day_offs o JOIN users u ON u.id = o.user_id
         WHERE DATE_FORMAT(o.off_date,'%Y-%m') = ? AND u.status = 'active'
         ORDER BY o.off_date, u.name");
    $st->execute([$ym]);
    ok(['ym' => $ym, 'day_offs' => $st->fetchAll()]);
}

// ---------- ฝั่งแอดมิน ----------

/** แอดมินบันทึกลา/หยุดแทนเจ้าหน้าที่ (เช่น โทรมาลาป่วยตอนเช้า) — ย้อนหลังได้ */
function h_dayoff_admin_add(): never {
    require_admin();
    $userId = (int)param('user_id');
    $st = db()->prepare("SELECT id FROM users WHERE id = ? AND role = 'staff'");
    $st->execute([$userId]);
    if (!$st->fetch()) fail('ไม่พบเจ้าหน้าที่คนนี้');

    $r = dayoff_insert($userId, (array)param('dates', []), (string)param('type', 'sick'),
                       mb_substr(trim((string)param('note', '')), 0, 255), true);
    if (!$r['added'] && $r['skipped']) fail('บันทึกไม่สำเร็จ: ' . $r['skipped'][0][1]);
    ok($r + ['message' => 'บันทึกแล้ว ' . count($r['added']) . ' วัน']);
}

function h_dayoff_admin_del(): never {
    require_admin();
    $st = db()->prepare('DELETE FROM day_offs WHERE id = ?');
    $st->execute([(int)param('id')]);
    $st->rowCount() ? ok(['message' => 'ลบรายการแล้ว']) : fail('ไม่พบรายการนี้');
}

// ---------- อนุมัติลา (เฟส 2) ----------

/** รายการคำขอลารออนุมัติ — ล็อกรายการที่เลย deadline ก่อนคืน list เสมอ */
function h_leave_pending(): never {
    require_admin();
    leave_auto_approve();
    ok(['pending' => leave_pending_list()]);
}

function h_leave_approve(): never {
    require_admin();
    leave_auto_approve();
    $id = (int)param('id');
    $st = db()->prepare(
        "SELECT o.*, u.name FROM day_offs o JOIN users u ON u.id = o.user_id
         WHERE o.id = ? AND o.status = 'pending'");
    $st->execute([$id]);
    $off = $st->fetch();
    if (!$off) fail('ไม่พบคำขอ หรืออนุมัติ/เลยกำหนดไปแล้ว');

    db()->prepare("UPDATE day_offs SET status = 'approved' WHERE id = ?")->execute([$id]);

    // เด้งเข้ากล่องข้อความของเจ้าหน้าที่ที่ขอลา
    notify_push((int)$off['user_id'], 'leave_approved', '✅ อนุมัติการลาแล้ว',
        'หัวหน้าอนุมัติ' . OFF_TYPES[$off['type']] . ' วันที่ ' . thai_date($off['off_date'], false)
        . ($off['note'] !== '' ? "\nหมายเหตุ: " . $off['note'] : ''), $id);

    // แจ้งเข้ากลุ่ม LINE แบบ async (ไม่ push คาใน request — ผ่านคิว line_queue + worker)
    $text = "✅ อนุมัติการลา\n• {$off['name']} — " . OFF_TYPES[$off['type']] . ' ' . thai_date($off['off_date'], false)
          . ($off['note'] !== '' ? "\n📝 {$off['note']}" : '');
    line_enqueue($text);
    ok(['message' => 'อนุมัติแล้ว — แจ้งเข้ากลุ่ม LINE ให้เรียบร้อย']);
}

function h_leave_reject(): never {
    require_admin();
    leave_auto_approve();
    $id = (int)param('id');
    $st = db()->prepare("SELECT * FROM day_offs WHERE id = ? AND status = 'pending'");
    $st->execute([$id]);
    $off = $st->fetch();
    if (!$off) fail('ไม่พบคำขอ หรืออนุมัติไปแล้ว');
    // วันหยุดเกินโควต้า (over_quota) ปฏิเสธได้เสมอ ไม่มี deadline lock — ลาป่วย/ลากิจติดเส้น deadline เดิม
    if (!$off['over_quota'] && !leave_still_pending($off['off_date'])) {
        db()->prepare("UPDATE day_offs SET status = 'approved' WHERE id = ?")->execute([$id]);
        fail('เลยกำหนดปฏิเสธแล้ว (ระบบอนุมัติอัตโนมัติเมื่อ 00:00 ของวันก่อนวันลา)');
    }
    // เด้งเข้ากล่องข้อความก่อนลบ row (snapshot วันที่+ประเภท เพราะ ref จะ dangle หลังลบ)
    notify_push((int)$off['user_id'], 'leave_rejected', '❌ คำขอลาไม่ได้รับอนุมัติ',
        'หัวหน้าไม่อนุมัติ' . OFF_TYPES[$off['type']] . ' วันที่ ' . thai_date($off['off_date'], false)
        . ' — กลับเป็นวันทำงานตามปกติค่ะ');

    // ปฏิเสธ = ลบ row ทิ้ง → กลับเป็นวันทำงาน (เจ้าหน้าที่ขอใหม่วันเดิมได้)
    db()->prepare('DELETE FROM day_offs WHERE id = ?')->execute([$id]);
    ok(['message' => 'ปฏิเสธแล้ว — ลบคำขอออก กลับเป็นวันทำงาน']);
}
