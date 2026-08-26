<?php
// =====================================================
// FireCheck — ประวัติการฝึกอบรม (v35)
// แอดมินสร้าง "การอบรม 1 ครั้ง" (ชื่อ + ช่วงวันที่ + รายละเอียด) แล้วติ๊กชื่อเจ้าหน้าที่ใส่ลงไป
// เจ้าหน้าที่อ่านของตัวเองอย่างเดียว — เก็บเป็นประวัติล้วน ไม่มีระบบเตือนวันหมดอายุ
// งานหลักคือ "บันทึกย้อนหลัง" → วันที่ย้อนหลังต้องกรอกได้เสมอ (ห้ามใส่กฎห้ามย้อนหลัง)
// =====================================================

/** ชื่อเดือนย่อภาษาไทย (index 1-12) */
const TRAIN_TH_MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** ช่วงวันแบบไทยย่อ — "12 ส.ค. 2569" / "12-14 ส.ค. 2569" / "30 ส.ค. - 2 ก.ย. 2569"
 *  คิดที่ server ที่เดียว เพื่อให้ทั้งหน้า จนท. / หน้าแอดมิน / กระดาษปริ้น ใช้ข้อความเดียวกัน
 */
function train_date_label(string $start, string $end): string {
    [$ys, $ms, $ds] = array_map('intval', explode('-', $start));
    [$ye, $me, $de] = array_map('intval', explode('-', $end));
    $bs = $ys + 543;
    $be = $ye + 543;
    if ($start === $end)                 return "$ds " . TRAIN_TH_MONTHS[$ms] . " $bs";
    if ($ys === $ye && $ms === $me)      return "$ds-$de " . TRAIN_TH_MONTHS[$ms] . " $bs";
    if ($ys === $ye)                     return "$ds " . TRAIN_TH_MONTHS[$ms] . " - $de " . TRAIN_TH_MONTHS[$me] . " $bs";
    return "$ds " . TRAIN_TH_MONTHS[$ms] . " $bs - $de " . TRAIN_TH_MONTHS[$me] . " $be";
}

/** ตรวจรูปแบบวันที่ YYYY-MM-DD → คืน string ถ้าใช้ได้ / null ถ้าไม่ใช่ */
function train_valid_date($v): ?string {
    $v = trim((string)$v);
    return (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v) !== false) ? $v : null;
}

/** เติม date_label ให้ทุกแถวการอบรม */
function train_with_label(array $rows): array {
    foreach ($rows as &$r) $r['date_label'] = train_date_label($r['start_date'], $r['end_date']);
    return $rows;
}

/** การอบรมของ user คนหนึ่ง เรียงใหม่ → เก่า (ใช้ทั้งฝั่ง จนท. และหน้ารายคนของแอดมิน) */
function train_of_user(int $uid): array {
    $st = db()->prepare(
        'SELECT t.id, t.name, t.start_date, t.end_date, t.place, t.organizer, t.doc_no, t.note
         FROM training_attendees a JOIN trainings t ON t.id = a.training_id
         WHERE a.user_id = ? ORDER BY t.start_date DESC, t.id DESC');
    $st->execute([$uid]);
    return train_with_label($st->fetchAll());
}

// ---------- ฝั่งเจ้าหน้าที่ (อ่านของตัวเอง) ----------

/** ประวัติการฝึกอบรมของเจ้าหน้าที่คนที่ล็อกอิน */
function h_training_my(): never {
    $u = require_user();
    $items = train_of_user((int)$u['id']);
    ok(['items' => $items, 'count' => count($items)]);
}

// ---------- ฝั่งแอดมิน: รายการอบรม ----------

/** การอบรมทั้งหมด + จำนวนคนที่ผูกไว้ */
function h_training_list(): never {
    require_admin();
    $rows = db()->query(
        'SELECT t.*, (SELECT COUNT(*) FROM training_attendees a WHERE a.training_id = t.id) n_people
         FROM trainings t ORDER BY t.start_date DESC, t.id DESC LIMIT 300')->fetchAll();
    ok(['items' => train_with_label($rows)]);
}

/** เพิ่ม (id=0) หรือแก้ไข (id>0) การอบรม — ไม่แตะรายชื่อผู้เข้าอบรม จึงไม่แจ้งเตือนซ้ำ */
function h_training_save(): never {
    require_admin();
    $name = mb_substr(trim((string)param('name', '')), 0, 200);
    if ($name === '') fail('กรอกชื่อการฝึกอบรม');

    $start = train_valid_date(param('start_date', ''));
    $end   = train_valid_date(param('end_date', ''));
    if (!$start) fail('วันที่เริ่มไม่ถูกต้อง');
    if (!$end)   fail('วันที่สิ้นสุดไม่ถูกต้อง');
    if ($end < $start) fail('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    // ⚠️ ตั้งใจไม่มีกฎห้ามวันย้อนหลัง — ฟีเจอร์นี้มีไว้บันทึกอดีตเป็นหลัก
    if ((strtotime($end) - strtotime($start)) / 86400 > 366) fail('ช่วงวันอบรมยาวเกินไป (สูงสุด 1 ปี)');

    $place = mb_substr(trim((string)param('place', '')), 0, 200);
    $org   = mb_substr(trim((string)param('organizer', '')), 0, 200);
    $doc   = mb_substr(trim((string)param('doc_no', '')), 0, 120);
    $note  = mb_substr(trim((string)param('note', '')), 0, 500);

    $id = (int)param('id', 0);
    if ($id > 0) {
        db()->prepare('UPDATE trainings SET name = ?, start_date = ?, end_date = ?, place = ?, organizer = ?, doc_no = ?, note = ?
                       WHERE id = ?')
            ->execute([$name, $start, $end, $place, $org, $doc, $note, $id]);
        ok(['message' => 'บันทึกการแก้ไขแล้ว', 'id' => $id]);
    }
    db()->prepare('INSERT INTO trainings (name, start_date, end_date, place, organizer, doc_no, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$name, $start, $end, $place, $org, $doc, $note]);
    ok(['message' => 'เพิ่มการอบรมแล้ว', 'id' => (int)db()->lastInsertId()]);
}

/** ลบการอบรม (ลบจริง — ผู้เข้าอบรมหายตาม CASCADE) */
function h_training_del(): never {
    require_admin();
    db()->prepare('DELETE FROM trainings WHERE id = ?')->execute([(int)param('id')]);
    ok(['message' => 'ลบการอบรมแล้ว']);
}

/** รายละเอียดการอบรม 1 รายการ + id ผู้เข้าอบรมปัจจุบัน (สำหรับหน้าจัดคน) */
function h_training_get(): never {
    require_admin();
    $id = (int)param('id');
    $st = db()->prepare('SELECT * FROM trainings WHERE id = ?');
    $st->execute([$id]);
    $tr = $st->fetch();
    if (!$tr) fail('ไม่พบการอบรมนี้');
    $tr['date_label'] = train_date_label($tr['start_date'], $tr['end_date']);

    $st = db()->prepare('SELECT user_id FROM training_attendees WHERE training_id = ?');
    $st->execute([$id]);
    ok(['training' => $tr, 'user_ids' => array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN))]);
}

/** บันทึกรายชื่อผู้เข้าอบรม — เทียบของเดิมกับของใหม่ แล้วเพิ่ม/ถอนเฉพาะส่วนต่าง
 *  ⚠️ ห้ามลบทั้งชุดแล้ว insert ใหม่ ไม่งั้นแจ้ง LINE/กล่องข้อความซ้ำทุกครั้งที่แอดมินแก้รายชื่อ
 */
function h_training_attendees_save(): never {
    require_admin();
    $tid = (int)param('training_id');
    $st  = db()->prepare('SELECT * FROM trainings WHERE id = ?');
    $st->execute([$tid]);
    $tr = $st->fetch();
    if (!$tr) fail('ไม่พบการอบรมนี้');

    $raw  = param('user_ids', []);
    $want = is_array($raw) ? $raw : explode(',', (string)$raw);
    $want = array_values(array_unique(array_filter(array_map('intval', $want))));

    // กรองให้เหลือเฉพาะเจ้าหน้าที่จริง (ยังไม่อนุมัติ = ผูกไม่ได้)
    if ($want) {
        $in = implode(',', array_fill(0, count($want), '?'));
        $q  = db()->prepare("SELECT id FROM users WHERE role = 'staff' AND status <> 'pending' AND id IN ($in)");
        $q->execute($want);
        $want = array_map('intval', $q->fetchAll(PDO::FETCH_COLUMN));
    }

    $q = db()->prepare('SELECT user_id FROM training_attendees WHERE training_id = ?');
    $q->execute([$tid]);
    $have = array_map('intval', $q->fetchAll(PDO::FETCH_COLUMN));

    $added   = array_values(array_diff($want, $have));
    $removed = array_values(array_diff($have, $want));

    if ($added) {
        $ins = db()->prepare('INSERT IGNORE INTO training_attendees (training_id, user_id) VALUES (?, ?)');
        foreach ($added as $uid) $ins->execute([$tid, $uid]);
    }
    if ($removed) {
        $in = implode(',', array_fill(0, count($removed), '?'));
        db()->prepare("DELETE FROM training_attendees WHERE training_id = ? AND user_id IN ($in)")
            ->execute(array_merge([$tid], $removed));
    }

    // แจ้งเข้ากล่องข้อความ 📬 เฉพาะคนที่เพิ่งถูกเพิ่ม (คนเดิมกดบันทึกซ้ำ = เงียบ)
    if ($added) {
        $label = train_date_label($tr['start_date'], $tr['end_date']);
        $body  = "หลักสูตร: {$tr['name']}\nวันที่: {$label}";
        if ($tr['place'] !== '')     $body .= "\nสถานที่: {$tr['place']}";
        if ($tr['organizer'] !== '') $body .= "\nหน่วยงานที่จัด: {$tr['organizer']}";
        foreach ($added as $uid) notify_push($uid, 'announcement', '🎓 บันทึกประวัติการฝึกอบรม', $body, $tid);
    }

    $msg = 'บันทึกผู้เข้าอบรม ' . count($want) . ' คน';
    if ($added)   $msg .= ' · แจ้งใหม่ ' . count($added) . ' คน';
    if ($removed) $msg .= ' · ถอนออก ' . count($removed) . ' คน';
    ok(['message' => $msg, 'added' => count($added), 'removed' => count($removed), 'total' => count($want)]);
}

// ---------- ฝั่งแอดมิน: รายคน + ภาพรวม ----------

/** ประวัติการอบรมของเจ้าหน้าที่ 1 คน — ใช้ทั้ง sub-view รายคน และกระดาษปริ้น
 *  ไม่กรอง status: คนที่ลาออกไปแล้วยังต้องเปิดดู/ปริ้นประวัติย้อนหลังได้
 */
function h_training_person(): never {
    require_admin();
    $uid = (int)param('user_id');
    $st  = db()->prepare("SELECT id, name, position FROM users WHERE id = ? AND role = 'staff'");
    $st->execute([$uid]);
    $user = $st->fetch();
    if (!$user) fail('ไม่พบเจ้าหน้าที่คนนี้');

    $items = train_of_user($uid);
    ok([
        'user'         => $user,
        'items'        => $items,
        'count'        => count($items),
        'station_name' => setting('station_name'),
        'generated_at' => date('d/m/') . (date('Y') + 543) . ' ' . date('H:i'),
    ]);
}

/** ภาพรวมทั้งทีม — จำนวนหลักสูตรต่อคน (โชว์คนที่ยังไม่เคยอบรมด้วย เพราะหัวหน้าต้องเห็นคนตกหล่น)
 *  นับเฉพาะ staff active — คนที่ลาออกแล้วไม่ควรค้างในลิสต์ "ยังไม่เคยอบรม" ตลอดไป
 */
function h_training_overview(): never {
    require_admin();
    $rows = db()->query(
        "SELECT u.id, u.name, u.position,
                (SELECT COUNT(*) FROM training_attendees a WHERE a.user_id = u.id) n,
                (SELECT MAX(t.start_date) FROM training_attendees a JOIN trainings t ON t.id = a.training_id
                  WHERE a.user_id = u.id) last_date
         FROM users u WHERE u.role = 'staff' AND u.status = 'active' ORDER BY u.name")->fetchAll();

    $never = 0;
    foreach ($rows as &$r) {
        $r['id'] = (int)$r['id'];
        $r['n']  = (int)$r['n'];
        $r['last_label'] = $r['last_date'] ? train_date_label($r['last_date'], $r['last_date']) : null;
        if ($r['n'] === 0) $never++;
    }
    unset($r);

    ok(['people' => $rows, 'summary' => [
        'staff'     => count($rows),
        'trained'   => count($rows) - $never,
        'never'     => $never,
        'trainings' => (int)db()->query('SELECT COUNT(*) FROM trainings')->fetchColumn(),
    ]]);
}
