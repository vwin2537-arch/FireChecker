<?php
// =====================================================
// FireCheck — Day-off / Leave handlers
// จองวันหยุดล่วงหน้าไม่ต้องอนุมัติ — เกินโควต้ารายเดือนจะ flag แจ้งเตือนแอดมิน
// =====================================================

const OFF_TYPES = ['dayoff' => 'วันหยุด', 'sick' => 'ลาป่วย', 'personal' => 'ลากิจ'];

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
    $quota  = (int)setting('off_quota_month', '10');
    $added = $skipped = $overQuota = [];

    foreach (array_unique((array)$dates) as $d) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$d)) { $skipped[] = [$d, 'รูปแบบวันที่ผิด']; continue; }
        // เจ้าหน้าที่จองได้ตั้งแต่วันนี้ขึ้นไป / แอดมินบันทึกย้อนหลังได้ (เช่น โทรมาลาป่วย)
        if (!$isAdmin && $d < $today)          { $skipped[] = [$d, 'เป็นวันที่ผ่านมาแล้ว']; continue; }
        if (is_station_holiday($d))            { $skipped[] = [$d, 'เป็นวันอาทิตย์ (หยุดอยู่แล้ว)']; continue; }

        $st = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND work_date = ?');
        $st->execute([$userId, $d]);
        if ($st->fetch())                      { $skipped[] = [$d, 'วันนั้นเช็คชื่อไปแล้ว']; continue; }

        $st = db()->prepare('SELECT id FROM day_offs WHERE user_id = ? AND off_date = ?');
        $st->execute([$userId, $d]);
        if ($st->fetch())                      { $skipped[] = [$d, 'จองไว้แล้ว']; continue; }

        // เกินโควต้าไหม (เฉพาะประเภท dayoff — ลาป่วย/ลากิจไม่นับโควต้า)
        $isOver = 0;
        if ($type === 'dayoff') {
            $ym = substr($d, 0, 7);
            if (dayoff_count($userId, $ym) + 1 > $quota) $isOver = 1;
        }

        db()->prepare('INSERT INTO day_offs (user_id, off_date, type, note, over_quota) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $d, $type, $note, $isOver]);
        $added[] = $d;
        if ($isOver) $overQuota[] = $d;
    }
    return ['added' => $added, 'skipped' => $skipped, 'over_quota' => $overQuota];
}

function h_dayoff_add(): never {
    $u = require_user();
    $r = dayoff_insert((int)$u['id'], (array)param('dates', []), (string)param('type', 'dayoff'),
                       mb_substr(trim((string)param('note', '')), 0, 255), false);
    if (!$r['added'] && $r['skipped']) fail('จองไม่สำเร็จ: ' . $r['skipped'][0][1]);

    $msg = 'บันทึกแล้ว ' . count($r['added']) . ' วัน';
    if ($r['over_quota']) $msg .= ' ⚠️ เกินโควต้าเดือนละ ' . setting('off_quota_month', '10') . ' วัน — ระบบแจ้งหัวหน้าสถานีแล้ว';
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
    ok(['message' => 'ยกเลิกวันหยุดแล้ว']);
}

/** ปฏิทินวันหยุดรวมทั้งสถานีของเดือนนั้น (เจ้าหน้าที่ทุกคนดูได้ — โปร่งใส) */
function h_dayoff_month(): never {
    require_user();
    $ym = preg_match('/^\d{4}-\d{2}$/', (string)param('ym')) ? param('ym') : date('Y-m');

    $st = db()->prepare(
        "SELECT o.id, o.user_id, o.off_date, o.type, o.note, o.over_quota, u.name
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
