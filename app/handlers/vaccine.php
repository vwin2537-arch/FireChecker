<?php
// =====================================================
// FireCheck — โซนสุขภาพ เฟส 3: การ์ดวัคซีน
// แอดมินตั้งชนิดวัคซีน + อายุความคุ้มกันเอง แล้วกรอกวันที่ฉีดให้เจ้าหน้าที่
// เจ้าหน้าที่ดูของตัวเอง (อ่านอย่างเดียว) — สถานะคำนวณสดจากเข็มล่าสุด ไม่เก็บลง DB
// =====================================================

/** เหลือกี่วันก่อนครบรอบถึงจะขึ้นป้ายเหลือง (setting — แอดมินตั้งได้) */
function vaccine_warn_days(): int {
    return max(1, min(365, (int)setting('vaccine_warn_days', '60')));
}

/** สถานะวัคซีน 1 ชนิดของ 1 คน จากวันที่ฉีดล่าสุด — คืน ['due','days_left','level','label']
 *  level: none = ยังไม่มีข้อมูล · ok = ยังคุ้ม/ตลอดชีพ · warn = ใกล้ครบ · bad = เกินกำหนด
 */
function vaccine_status(?string $lastDate, ?int $validMonths, int $warnDays): array {
    if (!$lastDate) return ['due' => null, 'days_left' => null, 'level' => 'none', 'label' => 'ยังไม่มีข้อมูล'];
    if ($validMonths === null || $validMonths <= 0)
        return ['due' => null, 'days_left' => null, 'level' => 'ok', 'label' => 'ฉีดแล้ว'];

    $due  = date('Y-m-d', strtotime("$lastDate +$validMonths months"));
    $left = (int)floor((strtotime($due) - strtotime(date('Y-m-d'))) / 86400);
    if ($left < 0)          $lv = ['level' => 'bad',  'label' => 'เกินกำหนด ' . abs($left) . ' วัน'];
    elseif ($left <= $warnDays) $lv = ['level' => 'warn', 'label' => 'ใกล้ครบ (เหลือ ' . $left . ' วัน)'];
    else                    $lv = ['level' => 'ok',   'label' => 'ยังคุ้ม (อีก ' . $left . ' วัน)'];
    return ['due' => $due, 'days_left' => $left] + $lv;
}

/** ชนิดวัคซีนที่ใช้งานอยู่ (เรียงตามลำดับที่แอดมินตั้ง) */
function vaccine_active_types(): array {
    return db()->query('SELECT id, name, valid_months FROM vaccine_types WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
}

/** วันฉีดล่าสุดของแต่ละคน×ชนิด → map "userId_typeId" => 'YYYY-MM-DD' */
function vaccine_latest_map(?int $onlyUser = null): array {
    $sql = 'SELECT user_id, type_id, MAX(dose_date) last_date FROM vaccine_records';
    $params = [];
    if ($onlyUser !== null) { $sql .= ' WHERE user_id = ?'; $params[] = $onlyUser; }
    $sql .= ' GROUP BY user_id, type_id';
    $st = db()->prepare($sql);
    $st->execute($params);
    $map = [];
    foreach ($st->fetchAll() as $r) $map[$r['user_id'] . '_' . $r['type_id']] = $r['last_date'];
    return $map;
}

// ---------- ฝั่งเจ้าหน้าที่ (อ่านของตัวเอง) ----------

/** การ์ดวัคซีนของเจ้าหน้าที่คนที่ล็อกอิน — ทุกชนิดที่ใช้งานอยู่ (รวมชนิดที่ยังไม่เคยฉีด) + ประวัติทุกเข็ม */
function h_vaccine_my(): never {
    $u = require_user();
    $warn = vaccine_warn_days();

    // ประวัติทุกเข็มของตัวเอง (รวมชนิดที่ถูกซ่อนไปแล้ว — ประวัติต้องไม่หาย)
    $st = db()->prepare(
        'SELECT r.id, r.type_id, r.dose_date, r.note, t.name type_name, t.valid_months, t.is_active
         FROM vaccine_records r JOIN vaccine_types t ON t.id = r.type_id
         WHERE r.user_id = ? ORDER BY r.dose_date DESC, r.id DESC');
    $st->execute([$u['id']]);
    $doses = $st->fetchAll();

    $byType = [];
    foreach ($doses as $d) $byType[$d['type_id']][] = $d;

    // ชนิดที่ใช้งานอยู่ + ชนิดที่ถูกซ่อนแต่คนนี้เคยฉีด (ไม่ให้ประวัติหาย)
    $types = vaccine_active_types();
    $seen  = array_column($types, 'id');
    foreach ($doses as $d) {
        if (!in_array((int)$d['type_id'], array_map('intval', $seen), true)) {
            $types[] = ['id' => $d['type_id'], 'name' => $d['type_name'], 'valid_months' => $d['valid_months']];
            $seen[]  = $d['type_id'];
        }
    }

    $out = [];
    foreach ($types as $t) {
        $list = $byType[$t['id']] ?? [];
        $last = $list ? $list[0]['dose_date'] : null;
        $vm   = $t['valid_months'] === null ? null : (int)$t['valid_months'];
        $out[] = [
            'type_id'      => (int)$t['id'],
            'name'         => $t['name'],
            'valid_months' => $vm,
            'last_date'    => $last,
            'doses'        => array_map(fn($d) => ['dose_date' => $d['dose_date'], 'note' => $d['note']], $list),
        ] + vaccine_status($last, $vm, $warn);
    }
    ok(['types' => $out, 'warn_days' => $warn]);
}

// ---------- ฝั่งแอดมิน: ชนิดวัคซีน ----------

/** ชนิดวัคซีนทั้งหมด (รวมที่ซ่อน) + จำนวนการฉีดที่บันทึกไว้ */
function h_vaccine_types_admin(): never {
    require_admin();
    $rows = db()->query(
        'SELECT t.id, t.name, t.valid_months, t.sort_order, t.is_active,
                (SELECT COUNT(*) FROM vaccine_records r WHERE r.type_id = t.id) doses
         FROM vaccine_types t ORDER BY t.is_active DESC, t.sort_order, t.id')->fetchAll();
    ok(['types' => $rows, 'warn_days' => vaccine_warn_days()]);
}

/** เพิ่ม (ไม่มี id) หรือแก้ไข (มี id) ชนิดวัคซีน — valid_months ว่าง = ตลอดชีพ */
function h_vaccine_type_save(): never {
    require_admin();
    $name = mb_substr(trim((string)param('name', '')), 0, 120);
    if ($name === '') fail('กรอกชื่อวัคซีน');

    $vm = param('valid_months');
    if ($vm === null || trim((string)$vm) === '') $vm = null;
    else {
        $vm = (int)$vm;
        if ($vm < 1 || $vm > 1200) fail('อายุความคุ้มกันต้องอยู่ระหว่าง 1-1200 เดือน (เว้นว่าง = ตลอดชีพ)');
    }

    $id = (int)param('id', 0);
    if ($id > 0) {
        db()->prepare('UPDATE vaccine_types SET name = ?, valid_months = ? WHERE id = ?')->execute([$name, $vm, $id]);
        ok(['message' => 'บันทึกชนิดวัคซีนแล้ว']);
    }
    $sort = (int)db()->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM vaccine_types')->fetchColumn();
    db()->prepare('INSERT INTO vaccine_types (name, valid_months, sort_order) VALUES (?, ?, ?)')->execute([$name, $vm, $sort]);
    ok(['message' => 'เพิ่มชนิดวัคซีนแล้ว', 'id' => (int)db()->lastInsertId()]);
}

/** ซ่อน/แสดงชนิดวัคซีน (soft delete — เก็บประวัติการฉีดเดิมไว้) */
function h_vaccine_type_delete(): never {
    require_admin();
    $active = (int)param('active', 0) === 1 ? 1 : 0;
    db()->prepare('UPDATE vaccine_types SET is_active = ? WHERE id = ?')->execute([$active, (int)param('id')]);
    ok(['message' => $active ? 'แสดงวัคซีนนี้อีกครั้งแล้ว' : 'ซ่อนวัคซีนนี้แล้ว']);
}

// ---------- ฝั่งแอดมิน: ภาพรวมทีม + กรอกการฉีด ----------

/** ตารางภาพรวมทั้งทีม — แถว=เจ้าหน้าที่ active คอลัมน์=ชนิดวัคซีน (คนที่ยังไม่เคยฉีดก็โชว์ ⚪️) */
function h_vaccine_overview(): never {
    require_admin();
    $warn  = vaccine_warn_days();
    $types = vaccine_active_types();
    $staff = db()->query("SELECT id, name, position FROM users WHERE role='staff' AND status='active' ORDER BY name")->fetchAll();
    $latest = vaccine_latest_map();

    $count = ['bad' => 0, 'warn' => 0, 'ok' => 0, 'none' => 0];
    $rows  = [];
    foreach ($staff as $s) {
        $cells = [];
        foreach ($types as $t) {
            $last = $latest[$s['id'] . '_' . $t['id']] ?? null;
            $st   = vaccine_status($last, $t['valid_months'] === null ? null : (int)$t['valid_months'], $warn);
            $cells[$t['id']] = ['last_date' => $last] + $st;
            $count[$st['level']]++;
        }
        $rows[] = ['id' => (int)$s['id'], 'name' => $s['name'], 'position' => $s['position'], 'cells' => $cells];
    }
    ok(['types' => $types, 'staff' => $rows, 'summary' => $count, 'warn_days' => $warn]);
}

/** ประวัติวัคซีนของเจ้าหน้าที่ 1 คน (แอดมินเลือกดู/กรอก) — สถานะรายชนิด + ประวัติทุกเข็ม */
function h_vaccine_admin_list(): never {
    require_admin();
    $uid  = (int)param('user_id');
    $user = db()->prepare("SELECT id, name, position FROM users WHERE id = ? AND role = 'staff'");
    $user->execute([$uid]);
    $user = $user->fetch();
    if (!$user) fail('ไม่พบเจ้าหน้าที่คนนี้');

    $warn = vaccine_warn_days();
    $st = db()->prepare(
        'SELECT r.id, r.type_id, r.dose_date, r.note, t.name type_name, t.valid_months
         FROM vaccine_records r JOIN vaccine_types t ON t.id = r.type_id
         WHERE r.user_id = ? ORDER BY r.dose_date DESC, r.id DESC');
    $st->execute([$uid]);
    $doses = $st->fetchAll();

    $latest = vaccine_latest_map($uid);
    $types  = vaccine_active_types();
    $status = [];
    foreach ($types as $t) {
        $last = $latest[$uid . '_' . $t['id']] ?? null;
        $status[] = [
            'type_id' => (int)$t['id'], 'name' => $t['name'],
            'valid_months' => $t['valid_months'] === null ? null : (int)$t['valid_months'],
            'last_date' => $last,
        ] + vaccine_status($last, $t['valid_months'] === null ? null : (int)$t['valid_months'], $warn);
    }
    ok(['user' => $user, 'status' => $status, 'doses' => $doses, 'types' => $types]);
}

/** แอดมินบันทึกการฉีด 1 ครั้ง (เพิ่มใหม่เสมอ — หลายเข็มต่อคน/ชนิด) */
function h_vaccine_admin_add(): never {
    require_admin();
    $uid = (int)param('user_id');
    if (!db()->query("SELECT 1 FROM users WHERE id = $uid AND role = 'staff'")->fetch())
        fail('ไม่พบเจ้าหน้าที่คนนี้');

    $tid = (int)param('type_id');
    $t = db()->prepare('SELECT id FROM vaccine_types WHERE id = ?');
    $t->execute([$tid]);
    if (!$t->fetch()) fail('ไม่พบชนิดวัคซีนนี้');

    $date = (string)param('dose_date', '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || strtotime($date) === false) fail('วันที่ฉีดไม่ถูกต้อง');
    if ($date > date('Y-m-d')) fail('เลือกวันที่ในอนาคตไม่ได้');
    $note = mb_substr(trim((string)param('note', '')), 0, 255);

    db()->prepare('INSERT INTO vaccine_records (user_id, type_id, dose_date, note) VALUES (?, ?, ?, ?)')
        ->execute([$uid, $tid, $date, $note]);
    ok(['message' => 'บันทึกการฉีดแล้ว']);
}

/** ลบการฉีด 1 รายการ (ลบจริง — ไม่ soft delete เหมือน health_records) */
function h_vaccine_admin_del(): never {
    require_admin();
    db()->prepare('DELETE FROM vaccine_records WHERE id = ?')->execute([(int)param('id')]);
    ok(['message' => 'ลบแล้ว']);
}
