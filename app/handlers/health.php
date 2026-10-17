<?php
// =====================================================
// FireCheck — โซนสุขภาพ เฟส 1: สมุดบันทึกสุขภาพ
// แอดมินกรอกผลตรวจสุขภาพให้เจ้าหน้าที่ — เจ้าหน้าที่ดูของตัวเอง (อ่านอย่างเดียว)
// เกณฑ์จัดระดับเป็นค่าคงที่มาตรฐานการแพทย์ไทย (BMI เอเชีย / ความดัน สมาคมความดันฯ 2562 / รอบเอว / ชีพจร)
// =====================================================

// ---------- เกณฑ์จัดระดับ (Set 3 — ค่ามาตรฐาน ไม่ใช่ค่าที่แอดมินตั้งเอง) ----------
// ทุกฟังก์ชันคืน ['label'=>..., 'level'=>ok|warn|bad|info] หรือ null ถ้าข้อมูลไม่พอจัดระดับ

/** BMI จากน้ำหนัก(กก.)+ส่วนสูง(ซม.) — คืน float หรือ null */
function calc_bmi($weightKg, $heightCm): ?float {
    $w = (float)$weightKg; $h = (float)$heightCm;
    if ($w <= 0 || $h <= 0) return null;
    return round($w / (($h / 100) ** 2), 1);
}

/** จัดระดับ BMI ตามเกณฑ์เอเชีย/ไทย (กรมอนามัย) */
function grade_bmi(?float $bmi): ?array {
    if ($bmi === null) return null;
    if ($bmi < 18.5)  return ['label' => 'น้ำหนักน้อย/ผอม', 'level' => 'warn'];
    if ($bmi < 23.0)  return ['label' => 'ปกติ',            'level' => 'ok'];
    if ($bmi < 25.0)  return ['label' => 'ท้วม/น้ำหนักเกิน', 'level' => 'warn'];
    if ($bmi < 30.0)  return ['label' => 'อ้วนระดับ 1',     'level' => 'bad'];
    return ['label' => 'อ้วนระดับ 2', 'level' => 'bad'];
}

/** จัดระดับความดันโลหิต (สมาคมความดันโลหิตสูงแห่งประเทศไทย พ.ศ. 2562) — เอาระดับที่แย่กว่าระหว่าง SBP/DBP */
function grade_bp($sys, $dia): ?array {
    $s = (int)$sys; $d = (int)$dia;
    if ($s <= 0 || $d <= 0) return null;
    // ระดับยิ่งมากยิ่งแย่ — เทียบทั้งตัวบน/ล่างแล้วเอาค่าสูงสุด
    $lv = 0;
    if      ($s >= 180) $lv = max($lv, 5);
    elseif  ($s >= 160) $lv = max($lv, 4);
    elseif  ($s >= 140) $lv = max($lv, 3);
    elseif  ($s >= 130) $lv = max($lv, 2);
    elseif  ($s >= 120) $lv = max($lv, 1);
    if      ($d >= 110) $lv = max($lv, 5);
    elseif  ($d >= 100) $lv = max($lv, 4);
    elseif  ($d >= 90)  $lv = max($lv, 3);
    elseif  ($d >= 85)  $lv = max($lv, 2);
    elseif  ($d >= 80)  $lv = max($lv, 1);
    return [
        ['label' => 'เหมาะสม',       'level' => 'ok'],
        ['label' => 'ปกติ',          'level' => 'ok'],
        ['label' => 'ค่อนข้างสูง',    'level' => 'warn'],
        ['label' => 'สูงระดับ 1',     'level' => 'bad'],
        ['label' => 'สูงระดับ 2',     'level' => 'bad'],
        ['label' => 'สูงระดับ 3 (รุนแรง)', 'level' => 'bad'],
    ][$lv];
}

/** จัดระดับรอบเอว (อ้วนลงพุง — กรมอนามัย) — ต้องรู้เพศ ถ้า NULL คืน null */
function grade_waist($waistCm, ?string $gender): ?array {
    $w = (float)$waistCm;
    if ($w <= 0 || !in_array($gender, ['male', 'female'], true)) return null;
    $limit = $gender === 'male' ? 90 : 80;
    return $w > $limit
        ? ['label' => 'เกินเกณฑ์ (เสี่ยงอ้วนลงพุง)', 'level' => 'bad']
        : ['label' => 'ปกติ', 'level' => 'ok'];
}

/** จัดระดับชีพจรขณะพัก (ผู้ใหญ่ 60-100 ครั้ง/นาที) */
function grade_pulse($pulse): ?array {
    $p = (int)$pulse;
    if ($p <= 0) return null;
    if ($p < 60)  return ['label' => 'ต่ำกว่าเกณฑ์ (อาจเป็นคนออกกำลังสม่ำเสมอ)', 'level' => 'info'];
    if ($p > 100) return ['label' => 'สูงกว่าเกณฑ์', 'level' => 'warn'];
    return ['label' => 'ปกติ', 'level' => 'ok'];
}

/** เติมค่าที่คำนวณ/จัดระดับให้ 1 record (ใช้ทั้งฝั่งเจ้าหน้าที่/แอดมิน) — ต้องรู้เพศเพื่อจัดระดับรอบเอว */
function health_decorate(array $r, ?string $gender): array {
    $bmi = calc_bmi($r['weight_kg'] ?? null, $r['height_cm'] ?? null);
    $r['bmi']         = $bmi;
    $r['bmi_class']   = grade_bmi($bmi);
    $r['bp_class']    = grade_bp($r['bp_sys'] ?? null, $r['bp_dia'] ?? null);
    $r['waist_class'] = grade_waist($r['waist_cm'] ?? null, $gender);
    $r['pulse_class'] = grade_pulse($r['pulse'] ?? null);
    return $r;
}

/** อ่าน+ตรวจค่าตรวจจากฟอร์มแอดมิน — คืน [record_date, place, weight, height, waist, sys, dia, pulse, note] */
function health_validate_input(): array {
    $date = (string)param('record_date', '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || strtotime($date) === false) fail('วันที่ตรวจไม่ถูกต้อง');

    // ค่าตัวเลข: ว่าง = NULL, มีค่า = ต้องอยู่ในช่วงสมเหตุผล (กันพิมพ์ผิด)
    $num = function ($key, float $min, float $max) {
        $v = param($key);
        if ($v === null || $v === '') return null;
        $f = (float)$v;
        return ($f >= $min && $f <= $max) ? $f : null;
    };
    $weight = $num('weight_kg', 20, 300);
    $height = $num('height_cm', 100, 250);
    $waist  = $num('waist_cm', 40, 200);
    $sys    = $num('bp_sys', 60, 300);
    $dia    = $num('bp_dia', 30, 200);
    $pulse  = $num('pulse', 30, 250);
    $place  = mb_substr(trim((string)param('checkup_place', '')), 0, 200);
    $note   = mb_substr(trim((string)param('note', '')), 0, 500);

    return [$date, $place, $weight, $height, $waist,
            $sys === null ? null : (int)$sys, $dia === null ? null : (int)$dia,
            $pulse === null ? null : (int)$pulse, $note];
}

// ---------- ฝั่งเจ้าหน้าที่ (อ่านของตัวเอง) ----------

/** ประวัติผลตรวจสุขภาพของเจ้าหน้าที่คนที่ล็อกอิน + ค่าที่จัดระดับแล้ว */
function h_health_my(): never {
    $u = require_user();
    $st = db()->prepare(
        'SELECT id, record_date, checkup_place, weight_kg, height_cm, waist_cm, bp_sys, bp_dia, pulse, note, created_at
         FROM health_records WHERE user_id = ? ORDER BY record_date DESC, id DESC');
    $st->execute([$u['id']]);
    $rows = array_map(fn($r) => health_decorate($r, $u['gender'] ?? null), $st->fetchAll());
    ok(['records' => $rows, 'gender' => $u['gender'] ?? null]);
}

// ---------- ฝั่งแอดมิน (กรอกให้ทุกคน) ----------

/** ประวัติผลตรวจของเจ้าหน้าที่คนหนึ่ง (แอดมินเลือกดู/กรอก) */
function h_health_admin_list(): never {
    require_admin();
    $uid = (int)param('user_id');
    $user = db()->prepare("SELECT id, name, gender, birthdate FROM users WHERE id = ? AND role = 'staff'");
    $user->execute([$uid]);
    $user = $user->fetch();
    if (!$user) fail('ไม่พบเจ้าหน้าที่คนนี้');

    $st = db()->prepare(
        'SELECT id, record_date, checkup_place, weight_kg, height_cm, waist_cm, bp_sys, bp_dia, pulse, note, created_at
         FROM health_records WHERE user_id = ? ORDER BY record_date DESC, id DESC');
    $st->execute([$uid]);
    $rows = array_map(fn($r) => health_decorate($r, $user['gender']), $st->fetchAll());
    ok(['records' => $rows, 'user' => $user]);
}

/** แอดมินบันทึกผลตรวจให้เจ้าหน้าที่ (เพิ่มใหม่เสมอ — หลาย entry ต่อคน) */
function h_health_admin_add(): never {
    require_admin();
    $uid = (int)param('user_id');
    if (!db()->query("SELECT 1 FROM users WHERE id = $uid AND role = 'staff'")->fetch())
        fail('ไม่พบเจ้าหน้าที่คนนี้');
    [$date, $place, $weight, $height, $waist, $sys, $dia, $pulse, $note] = health_validate_input();

    db()->prepare(
        'INSERT INTO health_records
           (user_id, record_date, checkup_place, weight_kg, height_cm, waist_cm, bp_sys, bp_dia, pulse, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$uid, $date, $place, $weight, $height, $waist, $sys, $dia, $pulse, $note]);
    ok(['message' => 'บันทึกผลตรวจแล้ว']);
}

/** ลบผลตรวจ 1 รายการ (ลบจริง — ไม่ soft delete) */
function h_health_admin_del(): never {
    require_admin();
    db()->prepare('DELETE FROM health_records WHERE id = ?')->execute([(int)param('id')]);
    ok(['message' => 'ลบแล้ว']);
}

// =====================================================
// เฟส 2: ทดสอบสมรรถภาพ (grading engine — configurable)
// =====================================================

/** อายุ (ปี) ณ วันที่ทดสอบ จากวันเกิด — null ถ้าไม่มี/ผิดรูปแบบ */
function age_at(?string $birthdate, string $onDate): ?int {
    if (!$birthdate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$birthdate)) return null;
    $b = strtotime($birthdate); $d = strtotime($onDate);
    if ($b === false || $d === false) return null;
    $age = (int)date('Y', $d) - (int)date('Y', $b);
    if ((int)date('md', $d) < (int)date('md', $b)) $age--;   // ยังไม่ถึงวันเกิดปีนี้
    return ($age >= 0 && $age < 120) ? $age : null;
}

/** สีป้ายตามลำดับระดับ (best→worst): แรก=เขียว ท้าย=แดง กลาง=ส้ม */
function fitness_tone(int $idx, int $count): string {
    if ($count <= 1 || $idx === 0) return 'ok';
    if ($idx >= $count - 1) return 'bad';
    return 'warn';
}

/** จัดระดับผลทดสอบ 1 ท่า — คืน ['level'=>..,'tone'=>..] หรือ null (ยังไม่จัดระดับ: ไม่มีค่า/อายุ/เพศ/เกณฑ์)
 *  direction: cap = ผ่านภายในเพดาน (ไม่ต้องใช้อายุ/เพศ) · higher = มากยิ่งดี · lower = น้อย/เร็วยิ่งดี
 */
function grade_fitness(array $item, ?float $raw, ?int $age, ?string $gender): ?array {
    if ($raw === null) return null;
    $crit = json_decode((string)($item['criteria_json'] ?? ''), true);
    if (!is_array($crit)) return null;

    if ($item['direction'] === 'cap') {
        if (!isset($crit['cap'])) return null;
        return $raw <= (float)$crit['cap']
            ? ['level' => 'ผ่าน', 'tone' => 'ok']
            : ['level' => 'ไม่ผ่าน', 'tone' => 'bad'];
    }
    // higher/lower ต้องรู้อายุ+เพศ เพื่อเลือกช่วงเกณฑ์
    if ($age === null || !in_array($gender, ['male', 'female'], true)) return null;
    if (($crit['mode'] ?? '') === 'step') return grade_fitness_step($crit, $raw, $age, $gender);
    $levels = $crit['levels'] ?? [];
    $bands  = $crit['bands'] ?? [];
    if (!$levels || !$bands) return null;
    foreach ($bands as $b) {
        if ($age < (int)($b['min_age'] ?? 0) || $age > (int)($b['max_age'] ?? 999)) continue;
        $thr = $b[$gender] ?? null;
        if (!is_array($thr)) return null;
        $n = min(count($levels), count($thr));
        for ($i = 0; $i < $n; $i++) {
            $hit = $item['direction'] === 'higher' ? ($raw >= (float)$thr[$i]) : ($raw <= (float)$thr[$i]);
            if ($hit) return ['level' => (string)$levels[$i], 'tone' => fitness_tone($i, $n)];
        }
        return ['level' => (string)$levels[$n - 1], 'tone' => 'bad'];   // ต่ำกว่าเกณฑ์ต่ำสุด
    }
    return null;   // ไม่มีช่วงอายุตรง
}

/** mode=step (วิ่ง 2 กม.): raw = วินาที (ตัดเศษทิ้ง) · ≤ top_sec = เต็ม, ช้าลงทุก step_sec หัก 1 คะแนน
 *  ต่ำกว่า floor = ไม่ผ่าน · สี: ≥80 เขียว / floor-79 เหลือง / ไม่ผ่าน แดง
 */
function grade_fitness_step(array $crit, float $raw, int $age, string $gender): ?array {
    $step = max(1, (int)($crit['step_sec'] ?? 5));
    $top = (int)($crit['top'] ?? 100); $floor = (int)($crit['floor'] ?? 60);
    foreach ($crit['bands'] ?? [] as $b) {
        if ($age < (int)($b['min_age'] ?? 0) || $age > (int)($b['max_age'] ?? 999)) continue;
        if (!isset($b[$gender])) return null;
        $over = (int)floor($raw) - (int)$b[$gender];               // ช้ากว่าขอบเต็มกี่วินาที
        $score = $over <= 0 ? $top : $top - (int)ceil($over / $step);
        if ($score < $floor) return ['level' => 'ไม่ผ่าน', 'tone' => 'bad'];
        return ['level' => "{$score} คะแนน", 'tone' => $score >= 80 ? 'ok' : 'warn'];
    }
    return null;   // ไม่มีช่วงอายุตรง (เช่น ต่ำกว่า 17 ปี)
}

/** สถานะผล 1 แถว: pass/watch/fail/skip/none — ใช้ทั้งการ์ดภาพรวมและรายงาน (กฎเดียวกัน ห้ามแยกเขียน)
 *  ท่ามี levels ≥2: ระดับล่างสุด = fail · รองล่างสุด = watch · นอกนั้น pass (ไม่ใช้ tone ดิบ เพราะ "ดี"=warn จะ false-alarm)
 *  ไม่มี levels (cap / step): ตาม tone — bad = fail · warn = watch (step 60-79) · skip = ยกเว้น
 */
function fitness_status(string $criteriaJson, ?string $level, ?string $tone): string {
    if ($tone === 'skip') return 'skip';
    if ($level === null || $level === '') return 'none';       // ยังไม่จัดระดับ
    $crit = json_decode($criteriaJson, true);
    $levels = (is_array($crit) && !empty($crit['levels'])) ? $crit['levels'] : null;
    if (is_array($levels) && count($levels) >= 2) {
        $idx = array_search($level, $levels, true);
        $last = count($levels) - 1;
        if ($idx === $last) return 'fail';
        if ($idx === $last - 1) return 'watch';
        return 'pass';
    }
    if ($tone === 'bad') return 'fail';
    if ($tone === 'warn') return 'watch';
    return 'pass';
}

/** ท่าแบบ mode=step (เวลา นาที:วินาที, ไม่มีผล = ไม่ผ่าน, มีสถานะยกเว้น) */
function fitness_is_step(array $item): bool {
    $crit = json_decode((string)($item['criteria_json'] ?? ''), true);
    return is_array($crit) && ($crit['mode'] ?? '') === 'step';
}

// ---------- ฝั่งเจ้าหน้าที่ ----------

/** ผลทดสอบสมรรถภาพของเจ้าหน้าที่คนที่ล็อกอิน — จัดกลุ่มตามรอบ */
function h_fitness_my(): never {
    $u = require_user();
    $st = db()->prepare(
        'SELECT r.id round_id, r.title, r.test_date, i.name item_name, i.unit, i.direction, i.criteria_json,
                f.raw_value, f.level, f.tone, f.note
         FROM fitness_results f
         JOIN fitness_rounds r ON r.id = f.round_id
         JOIN fitness_items  i ON i.id = f.item_id
         WHERE f.user_id = ?
         ORDER BY r.test_date DESC, r.id DESC, i.sort_order, i.id');
    $st->execute([$u['id']]);
    $rounds = [];
    foreach ($st->fetchAll() as $row) {
        $rid = $row['round_id'];
        if (!isset($rounds[$rid])) $rounds[$rid] = ['round_id' => $rid, 'title' => $row['title'], 'test_date' => $row['test_date'], 'items' => []];
        $rounds[$rid]['items'][] = [
            'item_name' => $row['item_name'], 'unit' => $row['unit'], 'direction' => $row['direction'],
            'raw_value' => $row['raw_value'], 'level' => $row['level'], 'tone' => $row['tone'],
            'note' => $row['note'], 'is_time' => fitness_is_step($row),
        ];
    }
    ok(['rounds' => array_values($rounds)]);
}

// ---------- ฝั่งแอดมิน: จัดการท่าทดสอบ + เกณฑ์ ----------

/** รายการท่าทดสอบทั้งหมด (รวมที่ซ่อน) พร้อมเกณฑ์ (criteria_json string) */
function h_fitness_items_admin(): never {
    require_admin();
    $rows = db()->query('SELECT id, name, unit, direction, criteria_json, sort_order, is_active
                         FROM fitness_items ORDER BY is_active DESC, sort_order, id')->fetchAll();
    ok(['items' => $rows]);
}

/** เพิ่ม (ไม่มี id) หรือแก้ไข (มี id) ท่าทดสอบ + เกณฑ์ */
function h_fitness_item_save(): never {
    require_admin();
    $name = mb_substr(trim((string)param('name', '')), 0, 120);
    if ($name === '') fail('กรอกชื่อท่าทดสอบ');

    // ท่า mode=step (วิ่ง 2 กม.) เกณฑ์ระบบตั้งให้ — แก้ได้แค่ชื่อ (ฟอร์มเกณฑ์แบบระดับจะทับเกณฑ์จนพัง)
    $id = (int)param('id', 0);
    if ($id > 0) {
        $cur = db()->prepare('SELECT * FROM fitness_items WHERE id = ?');
        $cur->execute([$id]);
        $cur = $cur->fetch();
        if ($cur && fitness_is_step($cur)) {
            db()->prepare('UPDATE fitness_items SET name = ? WHERE id = ?')->execute([$name, $id]);
            ok(['message' => 'บันทึกชื่อท่าแล้ว (เกณฑ์คะแนนคงเดิม)']);
        }
    }
    $unit = mb_substr(trim((string)param('unit', '')), 0, 20);
    $dir  = in_array(param('direction'), ['higher', 'lower', 'cap'], true) ? param('direction') : 'higher';

    // criteria มาเป็น object/array จาก client — validate คร่าว ๆ ตาม direction
    $crit = param('criteria');
    if ($dir === 'cap') {
        if (!is_array($crit) || !isset($crit['cap']) || !is_numeric($crit['cap'])) fail('กรอกเพดาน (cap) เป็นตัวเลข');
        $crit = ['cap' => (float)$crit['cap']];
    } else {
        if (!is_array($crit) || empty($crit['levels']) || empty($crit['bands'])) fail('กรอกระดับและช่วงเกณฑ์ให้ครบ');
    }
    $critJson = json_encode($crit, JSON_UNESCAPED_UNICODE);

    if ($id > 0) {
        db()->prepare('UPDATE fitness_items SET name = ?, unit = ?, direction = ?, criteria_json = ? WHERE id = ?')
            ->execute([$name, $unit, $dir, $critJson, $id]);
        ok(['message' => 'บันทึกท่าทดสอบแล้ว']);
    }
    $sort = (int)db()->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM fitness_items')->fetchColumn();
    db()->prepare('INSERT INTO fitness_items (name, unit, direction, criteria_json, sort_order) VALUES (?, ?, ?, ?, ?)')
        ->execute([$name, $unit, $dir, $critJson, $sort]);
    ok(['message' => 'เพิ่มท่าทดสอบแล้ว', 'id' => (int)db()->lastInsertId()]);
}

/** ซ่อน/แสดงท่าทดสอบ (soft delete — เก็บผลเดิมไว้) */
function h_fitness_item_delete(): never {
    require_admin();
    $active = (int)param('active', 0) === 1 ? 1 : 0;
    db()->prepare('UPDATE fitness_items SET is_active = ? WHERE id = ?')->execute([$active, (int)param('id')]);
    ok(['message' => $active ? 'แสดงท่านี้อีกครั้งแล้ว' : 'ซ่อนท่านี้แล้ว']);
}

// ---------- ฝั่งแอดมิน: รอบทดสอบ + กรอกผล ----------

/** รายการรอบทดสอบ + จำนวนคนที่มีผล */
function h_fitness_rounds_list(): never {
    require_admin();
    $rows = db()->query(
        'SELECT r.*, (SELECT COUNT(DISTINCT user_id) FROM fitness_results f WHERE f.round_id = r.id) tested
         FROM fitness_rounds r ORDER BY r.test_date DESC, r.id DESC')->fetchAll();
    ok(['rounds' => $rows]);
}

/** สร้างรอบทดสอบใหม่ (แจ้ง LINE async) */
function h_fitness_round_add(): never {
    require_admin();
    $title = mb_substr(trim((string)param('title', '')), 0, 120);
    if ($title === '') fail('กรอกชื่อรอบทดสอบ');
    $date = (string)param('test_date', '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || strtotime($date) === false) fail('วันที่ทดสอบไม่ถูกต้อง');
    $note = mb_substr(trim((string)param('note', '')), 0, 255);
    $loc  = mb_substr(trim((string)param('location', '')), 0, 120);
    if ($loc === '') $loc = (string)setting('station_name');   // เว้นว่าง = ที่สถานี

    db()->prepare('INSERT INTO fitness_rounds (title, test_date, location, note) VALUES (?, ?, ?, ?)')->execute([$title, $date, $loc, $note]);
    $id = (int)db()->lastInsertId();
    line_enqueue("🏃 เปิดรอบทดสอบสมรรถภาพ\n• {$title}\n• วันที่ " . thai_date($date));
    ok(['message' => 'สร้างรอบทดสอบแล้ว', 'id' => $id]);
}

/** แก้สถานที่ของรอบทดสอบ (รอบเก่าก่อน v46 ยังไม่มีสถานที่) */
function h_fitness_round_location(): never {
    require_admin();
    $loc = mb_substr(trim((string)param('location', '')), 0, 120);
    if ($loc === '') fail('กรอกสถานที่');
    db()->prepare('UPDATE fitness_rounds SET location = ? WHERE id = ?')->execute([$loc, (int)param('round_id')]);
    ok(['message' => 'บันทึกสถานที่แล้ว']);
}

/** ลบรอบทดสอบ (cascade ผลทั้งรอบ) */
function h_fitness_round_del(): never {
    require_admin();
    db()->prepare('DELETE FROM fitness_rounds WHERE id = ?')->execute([(int)param('id')]);
    ok(['message' => 'ลบรอบทดสอบแล้ว']);
}

/** ข้อมูลสำหรับหน้ากรอกผล/ดูสรุปรอบ: รอบ + ท่าที่ใช้งาน + รายชื่อ จนท. (พร้อมอายุ ณ วันทดสอบ) + ผลที่มีอยู่ */
function h_fitness_round_get(): never {
    require_admin();
    $rid = (int)param('round_id');
    $round = db()->prepare('SELECT * FROM fitness_rounds WHERE id = ?');
    $round->execute([$rid]);
    $round = $round->fetch();
    if (!$round) fail('ไม่พบรอบทดสอบนี้');

    $items = db()->query('SELECT id, name, unit, direction, criteria_json FROM fitness_items WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
    foreach ($items as &$it) { $it['is_time'] = fitness_is_step($it); unset($it['criteria_json']); }
    unset($it);
    $staff = db()->query("SELECT id, name, position, gender, birthdate FROM users WHERE role = 'staff' AND status = 'active' ORDER BY name")->fetchAll();
    foreach ($staff as &$s) $s['age'] = age_at($s['birthdate'], $round['test_date']);
    unset($s);

    // ผลที่มีอยู่ → map "userId_itemId" => [raw_value, level, tone]
    $res = db()->prepare('SELECT user_id, item_id, raw_value, level, tone, note FROM fitness_results WHERE round_id = ?');
    $res->execute([$rid]);
    $results = [];
    foreach ($res->fetchAll() as $r) $results[$r['user_id'] . '_' . $r['item_id']] = $r;

    $withRes = array_values(array_unique(array_map(fn($r) => (int)$r['item_id'], $results)));
    ok(['round' => $round, 'items' => $items, 'staff' => $staff, 'results' => $results, 'items_with_results' => $withRes]);
}

/** บันทึกผลทดสอบแบบ batch (ทั้งทีมในรอบ) — คำนวณระดับตอนบันทึก, ค่าว่าง = ลบผลเดิม */
function h_fitness_result_save(): never {
    require_admin();
    $rid = (int)param('round_id');
    $round = db()->prepare('SELECT * FROM fitness_rounds WHERE id = ?');
    $round->execute([$rid]);
    $round = $round->fetch();
    if (!$round) fail('ไม่พบรอบทดสอบนี้');

    $entries = param('results');
    if (!is_array($entries)) fail('ไม่มีข้อมูลผลทดสอบ');

    // cache ท่า + ผู้ใช้ กันคิวรีซ้ำ
    $items = [];
    foreach (db()->query('SELECT * FROM fitness_items') as $it) $items[$it['id']] = $it;
    $users = [];
    foreach (db()->query("SELECT id, gender, birthdate FROM users WHERE role='staff'") as $u) $users[$u['id']] = $u;

    // ท่า step (วิ่ง 2 กม.) ที่รอบนี้ "ทดสอบจริง" = มีคนกรอกเวลาอย่างน้อย 1 คน
    // → เฉพาะท่าเหล่านี้ ช่องว่าง (ไม่ติ๊กยกเว้น) = ไม่ผ่าน · ทั้งทีมว่าง = รอบนี้ไม่ได้ทดสอบท่านั้น ไม่ปรับตก
    $tested = [];
    foreach ($entries as $e) {
        $iid = (int)($e['item_id'] ?? 0);
        if (isset($items[$iid]) && fitness_is_step($items[$iid]) && ($e['value'] ?? '') !== '' && ($e['value'] ?? null) !== null) $tested[$iid] = true;
    }

    $del = db()->prepare('DELETE FROM fitness_results WHERE round_id = ? AND item_id = ? AND user_id = ?');
    $ins = db()->prepare('INSERT INTO fitness_results (round_id, item_id, user_id, raw_value, level, tone, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $saved = 0;
    foreach ($entries as $e) {
        $uid = (int)($e['user_id'] ?? 0);
        $iid = (int)($e['item_id'] ?? 0);
        if (!isset($items[$iid]) || !isset($users[$uid])) continue;
        $del->execute([$rid, $iid, $uid]);                       // ล้างของเดิมก่อน (แก้ซ้ำได้)
        $note = mb_substr(trim((string)($e['note'] ?? '')), 0, 255);
        $note = $note === '' ? null : $note;
        $raw = $e['value'] ?? '';
        if (fitness_is_step($items[$iid]) && ($raw === '' || $raw === null)) {
            if (!empty($e['exempt'])) {                          // ยกเว้น (เช่น เจ้าหน้าที่คุมการทดสอบ) ไม่นับผ่าน/ไม่ผ่าน
                $ins->execute([$rid, $iid, $uid, null, 'ยกเว้น', 'skip', $note]);
                $saved++;
            } elseif (isset($tested[$iid])) {                    // ไม่มีผล = ไม่ผ่าน (เก็บหมายเหตุ เช่น บาดเจ็บ)
                $ins->execute([$rid, $iid, $uid, null, 'ไม่ผ่าน', 'bad', $note]);
                $saved++;
            }
            continue;
        }
        if ($raw === '' || $raw === null) continue;              // ค่าว่าง = แค่ลบ (เคลียร์ช่อง)
        $raw = (float)$raw;
        $age = age_at($users[$uid]['birthdate'], $round['test_date']);
        $g   = grade_fitness($items[$iid], $raw, $age, $users[$uid]['gender']);
        $ins->execute([$rid, $iid, $uid, $raw, $g['level'] ?? null, $g['tone'] ?? null, $note]);
        $saved++;
    }
    ok(['message' => "บันทึกผลแล้ว {$saved} รายการ"]);
}

/** แจ้งผลรายคน (กล่อง 📬 + push) — หัวหน้ากดเองหลังกรอกครบ ไม่ยิงตอนบันทึก
 *  (บันทึกครึ่งทีม = คนที่ยังไม่กรอกเป็น "ไม่ผ่าน" ชั่วคราว ถ้ายิงอัตโนมัติจะแจ้งผิดคน) · 1 คน = 1 ข้อความ รวมทุกท่าในรอบ
 */
function h_fitness_notify(): never {
    require_admin();
    $round = db()->prepare('SELECT * FROM fitness_rounds WHERE id = ?');
    $round->execute([(int)param('round_id')]);
    $round = $round->fetch();
    if (!$round) fail('ไม่พบรอบทดสอบนี้');

    $st = db()->prepare(
        "SELECT f.user_id, f.raw_value, f.level, f.tone, f.note, i.name item_name, i.unit, i.criteria_json
         FROM fitness_results f
         JOIN fitness_items i ON i.id = f.item_id
         JOIN users u ON u.id = f.user_id AND u.role = 'staff' AND u.status = 'active'
         WHERE f.round_id = ? ORDER BY f.user_id, i.sort_order, i.id");
    $st->execute([$round['id']]);
    $lines = [];
    $ST = ['pass' => 'ผ่าน', 'watch' => 'เฝ้าระวัง', 'fail' => 'ไม่ผ่าน', 'skip' => 'ยกเว้น', 'none' => 'ยังไม่จัดระดับ'];
    foreach ($st->fetchAll() as $r) {
        $status = fitness_status((string)$r['criteria_json'], $r['level'], $r['tone']);
        $isStep = fitness_is_step($r);
        $val = '';
        if ($r['raw_value'] !== null) {
            $v = (float)$r['raw_value'];
            $val = $isStep ? sprintf('%d:%02d น.', intdiv((int)$v, 60), (int)$v % 60)
                           : (fmod($v, 1.0) == 0.0 ? (string)(int)$v : (string)round($v, 1)) . ($r['unit'] !== '' ? " {$r['unit']}" : '');
        }
        if ($status === 'skip' || $r['raw_value'] === null) $res = $ST[$status];        // ยกเว้น / ไม่ผ่านเพราะไม่ได้ทดสอบ
        elseif ($r['level'] === null || $r['level'] === '') $res = "{$val} (ยังไม่จัดระดับ)";
        elseif ($r['level'] === $ST[$status]) $res = "{$val} → {$r['level']}";        // cap: ผ่าน/ไม่ผ่าน ไม่ต้องซ้ำ
        else $res = "{$val} → {$r['level']} ({$ST[$status]})";
        $lines[(int)$r['user_id']][] = "• {$r['item_name']}: {$res}" . ($r['note'] ? " · {$r['note']}" : '');
    }
    if (!$lines) fail('รอบนี้ยังไม่มีผลทดสอบ');

    $head = "{$round['title']} (" . thai_date($round['test_date'], false) . ")";
    foreach ($lines as $uid => $ls) {
        notify_push($uid, 'announcement', '🏃 ผลทดสอบสมรรถภาพของคุณ', $head . "\n" . implode("\n", $ls) . "\nดูรายละเอียด: เมนู 🩺 สุขภาพ → 🏃 สมรรถภาพ", (int)$round['id']);
    }
    db()->prepare('UPDATE fitness_rounds SET notified_at = NOW() WHERE id = ?')->execute([$round['id']]);
    ok(['message' => 'แจ้งผลแล้ว ' . count($lines) . ' คน', 'count' => count($lines)]);
}

/** รายงานผลทดสอบ 1 ท่า × 1 รอบ (ปริ้น/บันทึกรูป) — ทุกคนที่มีผลในท่านั้น · เรียงชื่อฝั่ง client (Intl ไทย ตัดคำนำหน้า) */
function h_fitness_report(): never {
    require_admin();
    $round = db()->prepare('SELECT * FROM fitness_rounds WHERE id = ?');
    $round->execute([(int)param('round_id')]);
    $round = $round->fetch();
    if (!$round) fail('ไม่พบรอบทดสอบนี้');
    $item = db()->prepare('SELECT * FROM fitness_items WHERE id = ?');
    $item->execute([(int)param('item_id')]);
    $item = $item->fetch();
    if (!$item) fail('ไม่พบท่าทดสอบนี้');

    $st = db()->prepare(
        'SELECT u.name, u.gender, u.birthdate, f.raw_value, f.level, f.tone, f.note
         FROM fitness_results f JOIN users u ON u.id = f.user_id
         WHERE f.round_id = ? AND f.item_id = ?');
    $st->execute([$round['id'], $item['id']]);
    $rows = []; $sum = ['pass' => 0, 'watch' => 0, 'fail' => 0, 'skip' => 0, 'none' => 0];
    $scores = [];
    $isStep = fitness_is_step($item);
    foreach ($st->fetchAll() as $r) {
        $status = fitness_status((string)$item['criteria_json'], $r['level'], $r['tone']);
        $sum[$status]++;
        if ($isStep && preg_match('/^(\d+) คะแนน$/u', (string)$r['level'], $m)) $scores[] = (int)$m[1];
        $rows[] = [
            'name' => $r['name'], 'gender' => $r['gender'], 'age' => age_at($r['birthdate'], $round['test_date']),
            'raw_value' => $r['raw_value'], 'level' => $r['level'], 'status' => $status, 'note' => $r['note'],
        ];
    }
    ok([
        'station_name' => setting('station_name'),
        'round' => ['title' => $round['title'], 'date_label' => thai_date($round['test_date']),
                    'location' => $round['location'], 'note' => $round['note']],
        'item' => ['name' => $item['name'], 'unit' => $item['unit'], 'is_time' => $isStep,
                   'criteria' => $isStep ? 'เกณฑ์การเลือกสรรพนักงานพิทักษ์ป่า ปี 2561 (คะแนนตามอายุและเพศ)' : ''],
        'rows' => $rows,
        'summary' => $sum + ['avg' => $scores ? round(array_sum($scores) / count($scores), 1) : null],
        'generated_at' => date('d/m/') . (date('Y') + 543) . ' ' . date('H:i'),
    ]);
}

// =====================================================
// แดชบอร์ดภาพรวม (แอดมิน) — สรุปคนต้องดูแล/เฝ้าระวัง แยกสุขภาพ & สมรรถภาพ
// ใช้ผลล่าสุดของแต่ละคน · ซ่อนคนที่ยังไม่มีข้อมูล · เฉพาะ จนท. active
// =====================================================
function h_health_dashboard(): never {
    require_admin();

    $staff = [];
    foreach (db()->query("SELECT id, name, position, gender FROM users WHERE role='staff' AND status='active'") as $s)
        $staff[$s['id']] = $s;

    // ---------- สุขภาพ: ผลตรวจล่าสุดต่อคน ----------
    $rows = db()->query(
        'SELECT h.user_id, h.weight_kg, h.height_cm, h.waist_cm, h.bp_sys, h.bp_dia, h.pulse
         FROM health_records h
         JOIN (SELECT user_id, MAX(record_date) md FROM health_records GROUP BY user_id) t
           ON t.user_id = h.user_id AND t.md = h.record_date
         ORDER BY h.id DESC')->fetchAll();
    $latest = [];                                          // เก็บ record แรก (id สูงสุด) ต่อคน
    foreach ($rows as $r) if (!isset($latest[$r['user_id']])) $latest[$r['user_id']] = $r;

    $hRed = []; $hYellow = []; $hGreen = 0;
    foreach ($latest as $uid => $r) {
        if (!isset($staff[$uid])) continue;               // ไม่ active แล้ว = ซ่อน
        $classes = [
            'ความดัน' => grade_bp($r['bp_sys'], $r['bp_dia']),
            'BMI'     => grade_bmi(calc_bmi($r['weight_kg'], $r['height_cm'])),
            'รอบเอว'  => grade_waist($r['waist_cm'], $staff[$uid]['gender'] ?? null),
            'ชีพจร'   => grade_pulse($r['pulse']),
        ];
        $bad = []; $warn = [];
        foreach ($classes as $name => $c) {
            if (!$c) continue;
            if ($c['level'] === 'bad')       $bad[]  = "$name: {$c['label']}";
            elseif ($c['level'] === 'warn')  $warn[] = "$name: {$c['label']}";
        }
        if ($bad)      $hRed[]    = ['id' => $uid, 'name' => $staff[$uid]['name'], 'issues' => array_merge($bad, $warn)];
        elseif ($warn) $hYellow[] = ['id' => $uid, 'name' => $staff[$uid]['name'], 'issues' => $warn];
        else           $hGreen++;
    }

    // ---------- สมรรถภาพ: รอบทดสอบล่าสุดต่อคน ----------
    $fr = db()->query(
        'SELECT f.user_id, f.level, f.tone, r.id round_id,
                i.name item_name, i.criteria_json
         FROM fitness_results f
         JOIN fitness_rounds r ON r.id = f.round_id
         JOIN fitness_items  i ON i.id = f.item_id
         ORDER BY f.user_id, r.test_date DESC, r.id DESC')->fetchAll();
    $byUser = [];                                          // เก็บเฉพาะแถวของ round ล่าสุด (round_id แรกที่เจอ)
    foreach ($fr as $row) {
        $uid = $row['user_id'];
        if (!isset($byUser[$uid])) $byUser[$uid] = ['round_id' => $row['round_id'], 'rows' => []];
        if ($byUser[$uid]['round_id'] === $row['round_id']) $byUser[$uid]['rows'][] = $row;
    }

    $fRed = []; $fYellow = []; $fGreen = 0;
    foreach ($byUser as $uid => $data) {
        if (!isset($staff[$uid])) continue;
        $data['rows'] = array_filter($data['rows'], fn($r) => $r['tone'] !== 'skip');   // ยกเว้น = ไม่นับในการ์ด
        if (!$data['rows']) continue;                       // ยกเว้นทุกท่าในรอบล่าสุด = ซ่อน (เหมือนคนไม่มีข้อมูล)
        $bad = []; $warn = [];
        foreach ($data['rows'] as $row) {
            $st = fitness_status((string)$row['criteria_json'], $row['level'], $row['tone']);
            if ($st === 'fail')      $bad[]  = "{$row['item_name']}: {$row['level']}";
            elseif ($st === 'watch') $warn[] = "{$row['item_name']}: {$row['level']}";
        }
        if ($bad)      $fRed[]    = ['id' => $uid, 'name' => $staff[$uid]['name'], 'issues' => array_merge($bad, $warn)];
        elseif ($warn) $fYellow[] = ['id' => $uid, 'name' => $staff[$uid]['name'], 'issues' => $warn];
        else           $fGreen++;
    }

    ok([
        'health'  => ['red' => $hRed, 'yellow' => $hYellow, 'green' => $hGreen,
                      'total' => count($hRed) + count($hYellow) + $hGreen],
        'fitness' => ['red' => $fRed, 'yellow' => $fYellow, 'green' => $fGreen,
                      'total' => count($fRed) + count($fYellow) + $fGreen],
    ]);
}
