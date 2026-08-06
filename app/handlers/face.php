<?php
// =====================================================
// FireCheck — ยืนยันใบหน้าตอนเช็คชื่อ (v33)
//
// หลักการ: เบราว์เซอร์คำนวณ "descriptor" (เวกเตอร์ 128 มิติ) จากใบหน้าสด แล้วส่งมาแค่ตัวเลข
//          เซิร์ฟเวอร์เทียบระยะยุคลิดกับ descriptor ที่ลงทะเบียนไว้ของคนนั้น (1:1) แล้วตัดสินเอง
//          → ไม่มีรูปถูกเก็บบนเซิร์ฟเวอร์ ยกเว้นกรณีพลาดครบโควตา (เก็บให้หัวหน้าดู)
//
// ⚠️ เซิร์ฟเวอร์ตัดสินเสมอ — client ส่ง match:true มาไม่มีผล ไม่ถูกอ่านเลย
// ⚠️ ห้ามทำ L2-normalize เวกเตอร์ซ้ำ — โมเดล face_recognition_net ไม่ได้ normalize มา
//    (วัดจริง: norm 1.23-1.51) ถ้า normalize ใหม่ เกณฑ์ที่วัดมาจะใช้ไม่ได้
// =====================================================

// ขอบเขตค่าที่ยอมรับ — ได้จากการวัด descriptor 437 ตัวจากรูปจริง 460 ใบ (ดู PROGRESS v33)
// วัดได้ norm 1.2318-1.5123 / element -0.4841..0.5044 → เผื่อขอบไว้กว้างกันรุ่นโมเดล/แสงต่าง
const FACE_NORM_MIN = 0.90;
const FACE_NORM_MAX = 1.90;
const FACE_ELEM_MIN = -0.80;
const FACE_ELEM_MAX = 0.80;
const FACE_DIM      = 128;
const FACE_TICKET_SEC = 300;   // ตั๋วยืนยันสดได้ 5 นาที (เผื่อเวลาหา GPS + กดยืนยัน)
const FACE_MAX_PROBES = 20;    // เพดานยิง API ต่อคนต่อวัน — กันใช้ endpoint ไล่เดาเวกเตอร์
const FACE_MAX_ENROLL = 25;    // เพดาน descriptor ต่อคน (ฝั่ง UI ส่งมา 12)

/** float[128] → binary 512 ไบต์ (float32 LE) */
function face_pack(array $f): string {
    return pack('g*', ...$f);
}

/** binary 512 ไบต์ → float[128] */
function face_unpack(string $b): array {
    return array_values(unpack('g' . FACE_DIM, $b));
}

/** ตรวจ descriptor ที่รับจาก client (ข้อมูลไม่น่าเชื่อถือ) — คืน float[128] หรือ null ถ้าไม่ผ่าน */
function face_valid_descriptor($d): ?array {
    if (!is_array($d) || !array_is_list($d) || count($d) !== FACE_DIM) return null;
    $out = [];
    $sq  = 0.0;
    foreach ($d as $v) {
        if (!is_int($v) && !is_float($v)) return null;        // ตัด string/null/bool/array
        $v = (float)$v;
        if (!is_finite($v)) return null;                      // ตัด NAN / INF
        if ($v < FACE_ELEM_MIN || $v > FACE_ELEM_MAX) return null;
        $out[] = $v;
        $sq   += $v * $v;
    }
    $norm = sqrt($sq);
    if ($norm < FACE_NORM_MIN || $norm > FACE_NORM_MAX) return null;
    return $out;
}

/** ระยะยุคลิด — ต้องตรงกับ faceapi.euclideanDistance ฝั่ง JS เป๊ะ */
function face_distance(array $a, array $b): float {
    $s = 0.0;
    for ($i = 0; $i < FACE_DIM; $i++) { $d = $a[$i] - $b[$i]; $s += $d * $d; }
    return sqrt($s);
}

/** descriptor ที่ลงทะเบียนไว้ของคนนี้ — [[float×128], ...] */
function face_user_descriptors(int $uid): array {
    $st = db()->prepare('SELECT descriptor FROM face_descriptors WHERE user_id = ?');
    $st->execute([$uid]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $bin)
        if (strlen($bin) === FACE_DIM * 4) $out[] = face_unpack($bin);
    return $out;
}

function face_descriptor_count(int $uid): int {
    $st = db()->prepare('SELECT COUNT(*) FROM face_descriptors WHERE user_id = ?');
    $st->execute([$uid]);
    return (int)$st->fetchColumn();
}

/** ลงทะเบียนใบหน้าครบพอใช้งานแล้วหรือยัง (น้อยกว่า face_min_desc = ยังไม่พร้อม ข้ามการยืนยัน) */
function face_enrolled(int $uid): bool {
    return face_descriptor_count($uid) >= max(1, (int)setting('face_min_desc', '3'));
}

function face_threshold(): float {
    $t = (float)setting('face_match_threshold', '0.40');
    return ($t >= 0.20 && $t <= 0.90) ? $t : 0.40;
}

function face_max_attempts(): int {
    return max(1, min(5, (int)setting('face_max_attempts', '3')));
}

/** แถวสถานะยืนยันหน้าของ user+วัน+บริบท (ตั๋ว) หรือ null */
function face_state(int $uid, string $date, string $ctx): ?array {
    $st = db()->prepare('SELECT * FROM face_attempts WHERE user_id = ? AND attempt_date = ? AND context = ?');
    $st->execute([$uid, $date, $ctx]);
    return $st->fetch() ?: null;
}

/** สร้างแถวตั๋วถ้ายังไม่มี + นับ probe (จำนวนครั้งที่ยิง API) แล้วอ่านค่าใหม่กลับมา */
function face_touch(int $uid, string $date, string $ctx): array {
    db()->prepare('INSERT INTO face_attempts (user_id, attempt_date, context, probes)
                   VALUES (?, ?, ?, 1)
                   ON DUPLICATE KEY UPDATE probes = probes + 1')
        ->execute([$uid, $date, $ctx]);
    return face_state($uid, $date, $ctx);
}

/** +1 tries แบบ atomic แล้วอ่านค่าใหม่กลับมา
 *  ต้อง UPDATE-แล้ว-อ่าน ไม่ใช่อ่าน-แล้ว-เขียน เพราะกดสองแท็บพร้อมกันจะได้สิทธิ์เกินโควตา
 */
function face_add_try(int $id): array {
    db()->prepare('UPDATE face_attempts SET tries = tries + 1 WHERE id = ?')->execute([$id]);
    $st = db()->prepare('SELECT * FROM face_attempts WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch();
}

/** วันของตั๋วตามบริบท — night ต้องใช้ tonight_duty_date() ไม่ใช่วันนี้ (คนกดหลังเที่ยงคืน) */
function face_ctx_date(string $ctx): string {
    return $ctx === 'night' ? tonight_duty_date() : date('Y-m-d');
}

/** ประตูยืนยันใบหน้าที่ h_checkin / h_night_checkin เรียกก่อนบันทึก
 *  คืน [face_flag, face_dist, face_photo] — flag: 0=ผ่าน/ปิดระบบ · 1=ไม่ผ่านครบโควตา · 2=ยังไม่ลงทะเบียน
 *  ⚠️ fail() ถ้ายังไม่เคยยืนยัน/ตั๋วหมดอายุ — client ที่ "เลิกถาม" จะเช็คชื่อแบบไม่ติดธงไม่ได้
 *  ⚠️ ไม่มีใครถูกบล็อกถาวร: เผาโควตาครบ (หรือ skip) = ผ่านแบบติดธงเสมอ
 */
function face_gate_for(int $uid, string $date, string $ctx): array {
    if (setting('face_verify_enabled', '0') !== '1') return [0, null, null];
    if (!face_enrolled($uid)) return [2, null, null];   // ยังไม่ลงทะเบียน — ข้ามการยืนยัน ไม่บล็อก

    $fa = face_state($uid, $date, $ctx);
    if ($fa && $fa['verified_at'] && strtotime($fa['verified_at']) >= time() - FACE_TICKET_SEC)
        return [0, $fa['best_dist'], null];                                  // ผ่านสดๆ ภายใน 5 นาที
    if ($fa && (int)$fa['tries'] >= face_max_attempts())
        return [1, $fa['best_dist'], $fa['photo_path']];                      // ครบโควตา → ผ่านแต่ติดธง

    fail('กรุณายืนยันใบหน้าก่อนเช็คชื่อค่ะ');
}

/** ปิดตั๋วหลังเช็คชื่อสำเร็จ (กันเอาตั๋วใบเดิมไปใช้ซ้ำในบริบทอื่น) */
function face_mark_used(int $uid, string $date, string $ctx): void {
    db()->prepare('UPDATE face_attempts SET used_at = NOW()
                    WHERE user_id = ? AND attempt_date = ? AND context = ? AND used_at IS NULL')
        ->execute([$uid, $date, $ctx]);
}

// ============================================================
// ยืนยันใบหน้า (เจ้าหน้าที่) — action face_verify
// ============================================================
function h_face_verify(): never {
    $u = require_user();
    if (setting('face_verify_enabled', '0') !== '1') fail('ระบบยืนยันใบหน้ายังไม่เปิดใช้งาน');

    $ctx  = param('context') === 'night' ? 'night' : 'checkin';
    $date = face_ctx_date($ctx);
    $max  = face_max_attempts();

    // ยังไม่ลงทะเบียนใบหน้า → ข้ามการยืนยันไปเลย ไม่ถือว่าโกง (แอดมินยังไม่ได้ลงทะเบียนให้)
    if (!face_enrolled($u['id']))
        ok(['enrolled' => false, 'next' => 'checkin', 'message' => 'ยังไม่ได้ลงทะเบียนใบหน้า — เช็คชื่อได้เลยค่ะ']);

    $skip  = (bool)param('skip', false);
    $probe = $skip ? null : face_valid_descriptor(param('descriptor'));
    if (!$skip && $probe === null) fail('ข้อมูลใบหน้าไม่ถูกต้อง');

    $row = face_touch($u['id'], $date, $ctx);   // สร้างตั๋ว + นับ probe ก่อนเสมอ
    if ((int)$row['probes'] > FACE_MAX_PROBES) fail('ลองยืนยันใบหน้ามากเกินไปแล้ว แจ้งหัวหน้าค่ะ');

    // ผ่านแล้วสดๆ → ไม่ต้องคิดใหม่
    if ($row['verified_at'] && strtotime($row['verified_at']) >= time() - FACE_TICKET_SEC)
        ok(['enrolled' => true, 'match' => true, 'next' => 'checkin', 'attempts_used' => (int)$row['tries'],
            'attempts_left' => max(0, $max - (int)$row['tries']), 'message' => 'ยืนยันใบหน้าผ่านแล้ว ✅']);

    // ครบโควตาแล้ว → ไม่คำนวณต่อ (ไม่ให้ใช้เป็น oracle ไล่เดา)
    if ((int)$row['tries'] >= $max)
        ok(['enrolled' => true, 'match' => false, 'next' => 'checkin_flagged', 'attempts_used' => (int)$row['tries'],
            'attempts_left' => 0, 'message' => 'ยืนยันใบหน้าไม่ผ่าน — เช็คชื่อได้ แต่หัวหน้าจะเห็นหมายเหตุ']);

    $photo = (string)param('photo', '');
    $keepPhoto = function () use ($photo, $u) {
        return ($photo !== '') ? save_photo($photo, 'face_u' . $u['id']) : null;
    };

    // กล้อง/ไลบรารีใช้ไม่ได้ → ยอมข้าม แต่เผาโควตาทั้งหมด = ติดธง (ไม่ปล่อยผ่านเงียบ)
    if ($skip) {
        $reason = in_array(param('reason'), ['no_camera', 'no_lib', 'no_face'], true) ? param('reason') : 'no_face';
        db()->prepare('UPDATE face_attempts SET tries = ?, fail_reason = ?, photo_path = COALESCE(photo_path, ?) WHERE id = ?')
            ->execute([$max, $reason, $keepPhoto(), $row['id']]);
        ok(['enrolled' => true, 'match' => false, 'next' => 'checkin_flagged', 'attempts_used' => $max,
            'attempts_left' => 0, 'message' => 'ยืนยันใบหน้าไม่ได้ — เช็คชื่อได้ แต่หัวหน้าจะเห็นหมายเหตุ']);
    }

    // ---- เทียบจริง: ระยะที่ใกล้ที่สุดกับ descriptor ของตัวเอง ----
    $best = INF;
    foreach (face_user_descriptors($u['id']) as $e) {
        $d = face_distance($probe, $e);
        if ($d < $best) $best = $d;
    }
    $pass  = $best <= face_threshold();
    $row   = face_add_try((int)$row['id']);   // ครั้งนี้นับเป็น 1 try
    $tries = (int)$row['tries'];

    if ($pass) {
        db()->prepare('UPDATE face_attempts SET verified_at = NOW(), best_dist = ?, fail_reason = \'\' WHERE id = ?')
            ->execute([round($best, 4), $row['id']]);
        ok(['enrolled' => true, 'match' => true, 'distance' => round($best, 4), 'next' => 'checkin',
            'attempts_used' => $tries, 'attempts_left' => max(0, $max - $tries), 'message' => 'ยืนยันใบหน้าผ่าน ✅']);
    }

    $done = $tries >= $max;
    db()->prepare('UPDATE face_attempts SET best_dist = LEAST(COALESCE(best_dist, 99), ?), fail_reason = \'no_match\',
                          photo_path = COALESCE(photo_path, ?) WHERE id = ?')
        ->execute([round($best, 4), $done ? $keepPhoto() : null, $row['id']]);

    ok([
        'enrolled'      => true,
        'match'         => false,
        'distance'      => round($best, 4),
        'next'          => $done ? 'checkin_flagged' : 'retry',
        'attempts_used' => $tries,
        'attempts_left' => max(0, $max - $tries),
        'message'       => $done
            ? 'ยืนยันใบหน้าไม่ผ่าน — เช็คชื่อได้ แต่หัวหน้าจะเห็นหมายเหตุ'
            : 'ยังไม่ตรงกับใบหน้าที่ลงทะเบียนไว้ — ลองอีกครั้งค่ะ',
    ]);
}

// ============================================================
// ลงทะเบียนใบหน้า (แอดมิน)
// ============================================================

/** action face_enroll_save — บันทึก descriptor ของคนหนึ่ง (replace = ลบของเดิมก่อน) */
function h_face_enroll_save(): never {
    require_admin();
    $uid = (int)param('user_id');
    $st  = db()->prepare("SELECT name FROM users WHERE id = ? AND role = 'staff'");
    $st->execute([$uid]);
    $name = $st->fetchColumn();
    if ($name === false) fail('ไม่พบเจ้าหน้าที่คนนี้');

    $items = param('items');
    if (!is_array($items) || !count($items)) fail('ไม่มีข้อมูลใบหน้าที่จะบันทึก');
    if (count($items) > FACE_MAX_ENROLL) $items = array_slice($items, 0, FACE_MAX_ENROLL);

    $rows = [];
    foreach ($items as $it) {
        $d = face_valid_descriptor(is_array($it) ? ($it['descriptor'] ?? null) : null);
        if ($d === null) fail('ข้อมูลใบหน้าไม่ถูกต้อง (ตรวจแล้ว ' . count($rows) . ' รายการ)');
        $rows[] = [face_pack($d), mb_substr((string)($it['src_name'] ?? ''), 0, 255)];
    }

    db()->beginTransaction();
    try {
        if (param('replace')) db()->prepare('DELETE FROM face_descriptors WHERE user_id = ?')->execute([$uid]);
        $ins = db()->prepare('INSERT INTO face_descriptors (user_id, descriptor, src_name) VALUES (?, ?, ?)');
        foreach ($rows as $r) $ins->execute([$uid, $r[0], $r[1]]);
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        throw $e;
    }

    $n = face_descriptor_count($uid);
    ok(['count' => $n, 'ready' => $n >= max(1, (int)setting('face_min_desc', '3')),
        'message' => "บันทึกใบหน้า {$name} แล้ว ({$n} รายการ)"]);
}

/** action face_enroll_clear — ลบใบหน้าของคนนี้ทั้งหมด */
function h_face_enroll_clear(): never {
    require_admin();
    $uid = (int)param('user_id');
    db()->prepare('DELETE FROM face_descriptors WHERE user_id = ?')->execute([$uid]);
    ok(['message' => 'ลบข้อมูลใบหน้าแล้ว']);
}

/** action face_enroll_status — จำนวน descriptor ต่อคน (staff active) ให้หน้าแอดมินโชว์ว่าใครยังไม่ลงทะเบียน */
function h_face_enroll_status(): never {
    require_admin();
    $rows = db()->query(
        "SELECT u.id, u.name, u.status, COUNT(f.id) n, MAX(f.created_at) last_at
           FROM users u LEFT JOIN face_descriptors f ON f.user_id = u.id
          WHERE u.role = 'staff'
          GROUP BY u.id ORDER BY n, u.name")->fetchAll();
    ok(['items' => $rows, 'min_desc' => (int)setting('face_min_desc', '3'),
        'threshold' => face_threshold(), 'enabled' => setting('face_verify_enabled', '0') === '1']);
}
