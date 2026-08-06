<?php
// =====================================================
// FireCheck — Admin handlers (dashboard analytics, users, settings, reports)
// =====================================================

/** สถานะรายคนของวันหนึ่ง: present / leave / absent  (คืน map user_id => row) */
function roster_for(string $date): array {
    $st = db()->prepare(
        "SELECT u.id, u.name, u.position,
                a.time_in, a.late, a.time_out, a.report_late, a.distance_m, a.selfie_path,
                a.face_flag, a.face_dist, a.face_photo,
                o.type AS off_type, o.note AS off_note, o.over_quota
         FROM users u
         LEFT JOIN attendance a ON a.user_id = u.id AND a.work_date = ?
         LEFT JOIN day_offs  o ON o.user_id = u.id AND o.off_date  = ?
         WHERE u.role = 'staff' AND u.status = 'active' AND DATE(u.created_at) <= ?
         ORDER BY u.name");
    $st->execute([$date, $date, $date]);
    $rows = [];
    foreach ($st->fetchAll() as $r) {
        if ($r['time_in'])       $r['state'] = $r['late'] ? 'late' : 'ontime';
        elseif ($r['off_type'])  $r['state'] = 'leave';
        else                     $r['state'] = 'absent';
        $rows[(int)$r['id']] = $r;
    }
    return $rows;
}

/** สรุปตัวเลขของ roster หนึ่งวัน */
function roster_counts(array $roster): array {
    $c = ['total' => count($roster), 'present' => 0, 'ontime' => 0, 'late' => 0, 'leave' => 0, 'absent' => 0];
    foreach ($roster as $r) {
        if ($r['state'] === 'ontime') { $c['present']++; $c['ontime']++; }
        elseif ($r['state'] === 'late') { $c['present']++; $c['late']++; }
        elseif ($r['state'] === 'leave') $c['leave']++;
        else $c['absent']++;
    }
    return $c;
}

function h_admin_data(): never {
    require_admin();
    gdrive_kick_if_stale();   // ถือโอกาสไล่คิวรูปค้างขึ้น Drive (ทำหลังส่ง response)
    leave_auto_approve();     // backstop: ล็อกคำขอลาที่เลย deadline (เผื่อ cron ไม่ทัน)
    $today = date('Y-m-d');
    $isHoliday = is_station_holiday($today);

    // ---------- วันนี้ ----------
    $roster = $isHoliday ? [] : roster_for($today);
    $todayCounts = roster_counts($roster);

    // วันหยุด: ใครมาทำงาน (เช็คชื่อ) วันนี้บ้าง — วันทำงานปกติไม่ต้องดึง (roster ครอบคลุมแล้ว)
    $holidayWorkers = [];
    if ($isHoliday) {
        $st = db()->prepare(
            "SELECT u.name, u.position, a.time_in, a.note, a.distance_m, a.selfie_path
             FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE a.work_date = ? ORDER BY a.time_in");
        $st->execute([$today]);
        $holidayWorkers = $st->fetchAll();
    }

    // ---------- สถิติเวรกลางคืนเดือนนี้ (จำนวนคืนต่อคน — ดูความเป็นธรรม) ----------
    $nightMonth = night_month_data(date('Y-m'));

    // ---------- เข้าเวรกลางคืน "คืนนี้" (ใครลงเวรบ้าง) ----------
    $nightDate = tonight_duty_date();
    $st = db()->prepare(
        "SELECT u.name, u.position, n.time_in FROM night_shifts n JOIN users u ON u.id = n.user_id
         WHERE n.duty_date = ? ORDER BY n.time_in");
    $st->execute([$nightDate]);
    $nightTonight = $st->fetchAll();

    // ---------- สถิติตามวันในสัปดาห์ (8 สัปดาห์ล่าสุด, จ-ส) ----------
    $st = db()->prepare(
        "SELECT DAYOFWEEK(work_date) dow,
                SUM(late = 0) ontime, SUM(late = 1) late_n
         FROM attendance
         WHERE work_date >= DATE_SUB(?, INTERVAL 56 DAY) AND work_date <= ?
         GROUP BY DAYOFWEEK(work_date)");
    $st->execute([$today, $today]);
    $byDow = array_fill(1, 7, ['ontime' => 0, 'late' => 0]);
    foreach ($st->fetchAll() as $r) {
        $byDow[(int)$r['dow']] = ['ontime' => (int)$r['ontime'], 'late' => (int)$r['late_n']];
    }
    // MySQL DAYOFWEEK: 1=อาทิตย์ … 7=เสาร์ → ส่ง จ-ส
    $weekday = [];
    foreach ([2 => 'จ.', 3 => 'อ.', 4 => 'พ.', 5 => 'พฤ.', 6 => 'ศ.', 7 => 'ส.'] as $dow => $label) {
        $weekday[] = ['day' => $label] + $byDow[$dow];
    }

    // ---------- Ranking + Engagement Score (เดือนนี้) ----------
    $ranking = engagement_ranking(date('Y-m'));

    // ---------- เตือนเกินโควต้า (เดือนนี้ขึ้นไป) — over_quota ถูก flag ตอน insert ตามโควต้ารายเดือนแล้ว ----------
    $st = db()->prepare(
        "SELECT u.name, DATE_FORMAT(o.off_date,'%Y-%m') ym, SUM(o.type = 'dayoff') n
         FROM day_offs o JOIN users u ON u.id = o.user_id
         WHERE o.off_date >= DATE_FORMAT(?, '%Y-%m-01') AND u.status = 'active' AND o.over_quota = 1
         GROUP BY o.user_id, u.name, ym
         ORDER BY ym, n DESC");
    $st->execute([$today]);
    $overQuota = $st->fetchAll();

    // ---------- กิจกรรมล่าสุด ----------
    $activity = [];
    $st = db()->query(
        "SELECT u.name, a.work_date, a.time_in, a.late, a.time_out
         FROM attendance a JOIN users u ON u.id = a.user_id
         ORDER BY a.time_in DESC LIMIT 10");
    foreach ($st->fetchAll() as $r) {
        $activity[] = ['ts' => $r['time_in'], 'icon' => $r['late'] ? '🟡' : '🟢',
                       'text' => $r['name'] . ' เช็คชื่อ ' . substr($r['time_in'], 11, 5) . ' น.' . ($r['late'] ? ' (สาย)' : '')];
        if ($r['time_out']) {
            $activity[] = ['ts' => $r['time_out'], 'icon' => '📝', 'text' => $r['name'] . ' ส่งรายงาน ' . substr($r['time_out'], 11, 5) . ' น.'];
        }
    }
    $st = db()->query(
        "SELECT u.name, o.type, o.off_date, o.created_at, o.over_quota
         FROM day_offs o JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC LIMIT 6");
    foreach ($st->fetchAll() as $r) {
        $activity[] = ['ts' => $r['created_at'], 'icon' => $r['over_quota'] ? '⚠️' : '🔵',
                       'text' => $r['name'] . ' แจ้ง' . OFF_TYPES[$r['type']] . ' ' . thai_date($r['off_date'], false)
                               . ($r['over_quota'] ? ' (เกินโควต้า!)' : '')];
    }
    usort($activity, fn($a, $b) => strcmp($b['ts'], $a['ts']));
    $activity = array_slice($activity, 0, 12);

    // ---------- ผู้ใช้รออนุมัติ ----------
    $pending = db()->query("SELECT id, name, position FROM users WHERE status = 'pending' ORDER BY created_at")->fetchAll();

    // ---------- คำขอลารออนุมัติ (badge + แถบเตือน) ----------
    $pendingLeaves = leave_pending_list();

    // ---------- ยืนยันใบหน้าไม่ผ่านวันนี้ (แถบเตือน v33) ----------
    $st = db()->prepare(
        "SELECT u.name, a.time_in, a.face_dist, a.face_photo
         FROM attendance a JOIN users u ON u.id = a.user_id
         WHERE a.work_date = ? AND a.face_flag = 1 ORDER BY a.time_in");
    $st->execute([$today]);
    $faceFlags = $st->fetchAll();

    ok([
        'today' => [
            'date' => $today, 'thai_date' => thai_date($today), 'is_holiday' => $isHoliday,
            'counts' => $todayCounts, 'roster' => array_values($roster),
            'holiday_workers' => $holidayWorkers,
        ],
        'face_flags' => $faceFlags,
        'weekday'      => $weekday,
        'night_stats'   => $nightMonth['stats'],
        'night_summary' => $nightMonth['summary'],
        'night_month'   => date('Y-m'),
        'night_tonight'      => $nightTonight,
        'night_tonight_date' => $nightDate,
        'ranking'      => $ranking,
        'over_quota'   => $overQuota,
        'activity'     => $activity,
        'pending_users'=> $pending,
        'pending_leaves'=> $pendingLeaves,
        'settings'     => client_settings(),
        'score_mode'   => setting('checkout_enabled', '0') === '1' ? 'full' : 'checkin_only',
    ]);
}

/**
 * Engagement Score รายคนของเดือน $ym (นับถึงวันนี้)
 * โหมดเช็คอินอย่างเดียว: มา 60 + เช้าตรงเวลา 40
 * โหมดเต็ม (เปิดเช็คเอาท์): มา 30 + ตรงเวลา 30 + ส่งรายงาน 20 + รายงานตรงเวลา 20
 */
function engagement_ranking(string $ym): array {
    $today    = date('Y-m-d');
    $start    = $ym . '-01';
    $end      = min($today, date('Y-m-t', strtotime($start)));
    $fullMode = setting('checkout_enabled', '0') === '1';

    if ($start > $today) return [];

    // วันทำการของเดือน (ไม่รวมวันอาทิตย์)
    $workdays = [];
    for ($d = new DateTime($start); $d->format('Y-m-d') <= $end; $d->modify('+1 day')) {
        $ymd = $d->format('Y-m-d');
        if (!is_station_holiday($ymd)) $workdays[] = $ymd;
    }
    $nWork = count($workdays);

    $users = db()->query("SELECT id, name, position, birthdate, created_at FROM users WHERE role = 'staff' AND status = 'active' ORDER BY name")->fetchAll();

    $st = db()->prepare("SELECT * FROM attendance WHERE work_date BETWEEN ? AND ?");
    $st->execute([$start, $end]);
    $attByUser = [];
    foreach ($st->fetchAll() as $a) $attByUser[(int)$a['user_id']][$a['work_date']] = $a;

    $st = db()->prepare("SELECT user_id, off_date FROM day_offs WHERE off_date BETWEEN ? AND ?");
    $st->execute([$start, $end]);
    $offByUser = [];
    foreach ($st->fetchAll() as $o) $offByUser[(int)$o['user_id']][$o['off_date']] = true;

    $out = [];
    foreach ($users as $u) {
        $uid = (int)$u['id'];
        $createdDate = substr($u['created_at'], 0, 10);
        $present = $ontime = $late = $absent = $leave = $reported = $reportOntime = 0;
        $points = 0; $planned = 0; $sumMinIn = 0;

        foreach ($workdays as $ymd) {
            if ($ymd < $createdDate) continue;                    // ยังไม่เข้าระบบ ไม่นับ
            $att = $attByUser[$uid][$ymd] ?? null;
            if (!$att && isset($offByUser[$uid][$ymd])) { $leave++; continue; }  // ลา ไม่หักคะแนน
            $planned++;
            if (!$att) { $absent++; continue; }
            $present++;
            $isOntime = !(int)$att['late'];
            $isOntime ? $ontime++ : $late++;
            $sumMinIn += (int)substr($att['time_in'], 11, 2) * 60 + (int)substr($att['time_in'], 14, 2);
            if ($fullMode) {
                $points += 30 + ($isOntime ? 30 : 0);
                if ($att['time_out']) { $reported++; $points += 20 + ((int)$att['report_late'] ? 0 : 20); if (!(int)$att['report_late']) $reportOntime++; }
            } else {
                $points += 60 + ($isOntime ? 40 : 0);
            }
        }

        $score = $planned > 0 ? round($points / ($planned * 100) * 100, 1) : null;
        $avgIn = $present > 0 ? sprintf('%02d:%02d', intdiv(intdiv($sumMinIn, $present), 60), intdiv($sumMinIn, $present) % 60) : null;

        $out[] = [
            'id' => $uid, 'name' => $u['name'], 'position' => $u['position'], 'birthdate' => $u['birthdate'],
            'planned' => $planned, 'present' => $present, 'ontime' => $ontime, 'late' => $late,
            'absent' => $absent, 'leave' => $leave, 'reported' => $reported, 'report_ontime' => $reportOntime,
            'avg_in' => $avgIn, 'score' => $score,
        ];
    }
    usort($out, fn($a, $b) => ($b['score'] ?? -1) <=> ($a['score'] ?? -1));
    return $out;
}

/** ชื่อเดือนไทย + พ.ศ. จาก "YYYY-MM" เช่น "2026-07" → "กรกฎาคม 2569" */
function thai_month_label(string $ym): string {
    static $m = [1=>'มกราคม',2=>'กุมภาพันธ์',3=>'มีนาคม',4=>'เมษายน',5=>'พฤษภาคม',6=>'มิถุนายน',
        7=>'กรกฎาคม',8=>'สิงหาคม',9=>'กันยายน',10=>'ตุลาคม',11=>'พฤศจิกายน',12=>'ธันวาคม'];
    return $m[(int)substr($ym, 5, 2)] . ' ' . ((int)substr($ym, 0, 4) + 543);
}

/**
 * รายงานอันดับความขยันรายเดือน (สำหรับปริ้น/ส่ง LINE) — reuse engagement_ranking() + สรุปรวมทีม
 * รับ param month "YYYY-MM" (default = เดือนที่แล้ว), กันเดือนอนาคต
 */
function h_report_month(): never {
    require_admin();
    $ym = (string)(param('month') ?: date('Y-m', strtotime('first day of last month')));
    if (!preg_match('/^\d{4}-\d{2}$/', $ym))   fail('รูปแบบเดือนไม่ถูกต้อง');
    if ($ym > date('Y-m'))                     fail('เลือกเดือนในอนาคตไม่ได้');

    $ranking = engagement_ranking($ym);

    // จำนวนวันทำการของเดือน (ไม่รวมวันอาทิตย์/วันหยุด, ถึงวันนี้ถ้าเป็นเดือนปัจจุบัน)
    $start = $ym . '-01';
    $end   = min(date('Y-m-d'), date('Y-m-t', strtotime($start)));
    $nWork = 0;
    for ($d = new DateTime($start); $d->format('Y-m-d') <= $end; $d->modify('+1 day'))
        if (!is_station_holiday($d->format('Y-m-d'))) $nWork++;

    // สรุปรวมทั้งทีม
    $present = $ontime = $late = $absent = $leave = 0; $sumScore = 0; $nScored = 0;
    foreach ($ranking as $r) {
        $present += $r['present']; $ontime += $r['ontime']; $late += $r['late'];
        $absent  += $r['absent'];  $leave  += $r['leave'];
        if ($r['score'] !== null) { $sumScore += $r['score']; $nScored++; }
    }

    ok([
        'month'        => $ym,
        'month_label'  => thai_month_label($ym),
        'generated_at' => date('d/m/') . (date('Y') + 543) . ' ' . date('H:i'),
        'workdays'     => $nWork,
        'staff_count'  => count($ranking),
        'ranking'      => $ranking,
        'score_mode'   => setting('checkout_enabled', '0') === '1' ? 'full' : 'checkin_only',
        'summary'      => [
            'present'    => $present, 'ontime' => $ontime, 'late' => $late,
            'absent'     => $absent,  'leave'  => $leave,
            'ontime_pct' => $present > 0 ? round($ontime / $present * 100) : null,
            'avg_score'  => $nScored > 0 ? round($sumScore / $nScored, 1) : null,
        ],
    ]);
}

// ---------- จัดการผู้ใช้ ----------

function h_users_list(): never {
    require_admin();
    $ym = date('Y-m');
    $rows = db()->query(
        "SELECT u.id, u.username, u.name, u.position, u.gender, u.birthdate, u.role, u.status, u.created_at,
                (SELECT COUNT(*) FROM day_offs o
                  WHERE o.user_id = u.id AND o.type = 'dayoff' AND DATE_FORMAT(o.off_date,'%Y-%m') = '{$ym}') quota_used,
                (SELECT COUNT(*) FROM face_descriptors f WHERE f.user_id = u.id) face_n
         FROM users u ORDER BY u.role, u.status, u.name")->fetchAll();
    ok(['users' => $rows, 'quota_max' => station_holidays_in_month($ym),
        'face_min_desc' => (int)setting('face_min_desc', '3'),
        'face_verify_enabled' => setting('face_verify_enabled', '0') === '1']);
}

/** validate 'YYYY-MM-DD' + ช่วงอายุสมเหตุผล (15-80 ปี) — คืน string วันเกิด หรือ null ถ้าว่าง/ผิด */
function valid_birthdate($v): ?string {
    if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return null;
    $t = strtotime($v);
    if ($t === false) return null;
    $year = (int)date('Y', $t);
    $now  = (int)date('Y');
    if ($year < $now - 80 || $year > $now - 15) return null;   // นอกช่วงวัยทำงาน = ถือว่ากรอกผิด
    return $v;
}

function h_user_add(): never {
    require_admin();
    $name      = trim((string)param('name'));
    $position  = mb_substr(trim((string)param('position', '')), 0, 100);
    $gender    = in_array(param('gender'), ['male', 'female'], true) ? param('gender') : null;
    $birthdate = valid_birthdate(param('birthdate'));
    if ($name === '') fail('กรอกชื่อ-สกุล');

    // แอดมินเพิ่มแค่ชื่อ-สกุล — ชื่อผู้ใช้ (username) เจ้าหน้าที่ตั้งเองตอนลงทะเบียน (username = NULL ไปก่อน)
    db()->prepare("INSERT INTO users (name, position, gender, birthdate, role, status) VALUES (?, ?, ?, ?, 'staff', 'unregistered')")
        ->execute([$name, $position, $gender, $birthdate]);
    ok(['message' => "เพิ่ม {$name} แล้ว — ให้เจ้าตัวเปิดหน้าเว็บ กด \"ลงทะเบียน\" เลือกชื่อ แล้วตั้งชื่อผู้ใช้+รหัสผ่านเอง ใช้ได้เลย"]);
}

function set_user_status(int $id, string $status, bool $clearPass = false): void {
    $sql = $clearPass
        ? "UPDATE users SET status = ?, password_hash = NULL WHERE id = ? AND role = 'staff'"
        : "UPDATE users SET status = ? WHERE id = ? AND role = 'staff'";
    $st = db()->prepare($sql);
    $st->execute([$status, $id]);
    if (!$st->rowCount()) fail('ไม่พบเจ้าหน้าที่คนนี้');
}

function h_user_set_gender(): never {
    require_admin();
    $g = param('gender');
    $gender = in_array($g, ['male', 'female'], true) ? $g : null;
    db()->prepare("UPDATE users SET gender = ? WHERE id = ? AND role = 'staff'")
        ->execute([$gender, (int)param('id')]);
    ok(['message' => 'บันทึกเพศแล้ว']);
}

function h_user_set_birthdate(): never {
    require_admin();
    $birthdate = valid_birthdate(param('birthdate'));   // ว่าง/ผิด = ล้างเป็น NULL
    db()->prepare("UPDATE users SET birthdate = ? WHERE id = ? AND role = 'staff'")
        ->execute([$birthdate, (int)param('id')]);
    ok(['message' => 'บันทึกวันเกิดแล้ว']);
}

function h_user_approve(): never { require_admin(); set_user_status((int)param('id'), 'active');        ok(['message' => 'อนุมัติแล้ว']); }
function h_user_reject(): never  { require_admin(); set_user_status((int)param('id'), 'unregistered', true); ok(['message' => 'ปฏิเสธแล้ว — ให้ลงทะเบียนใหม่ได้']); }
function h_user_disable(): never { require_admin(); set_user_status((int)param('id'), 'disabled');      ok(['message' => 'ปิดใช้งานแล้ว']); }
function h_user_enable(): never  { require_admin(); set_user_status((int)param('id'), 'active');        ok(['message' => 'เปิดใช้งานแล้ว']); }
function h_user_reset(): never   { require_admin(); set_user_status((int)param('id'), 'unregistered', true); ok(['message' => 'รีเซ็ตแล้ว — ให้เจ้าตัวลงทะเบียนตั้งรหัสผ่านใหม่']); }

// ---------- รายงานย้อนหลัง ----------

function h_report_range(): never {
    require_admin();
    $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)param('from')) ? param('from') : date('Y-m-01');
    $to   = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)param('to'))   ? param('to')   : date('Y-m-d');
    $uid  = (int)param('user_id', 0);

    $sql = "SELECT a.*, u.name FROM attendance a JOIN users u ON u.id = a.user_id
            WHERE a.work_date BETWEEN ? AND ?" . ($uid ? " AND a.user_id = ?" : "") . "
            ORDER BY a.work_date DESC, a.time_in";
    $st = db()->prepare($sql);
    $st->execute($uid ? [$from, $to, $uid] : [$from, $to]);
    $att = $st->fetchAll();

    $sql = "SELECT o.*, u.name FROM day_offs o JOIN users u ON u.id = o.user_id
            WHERE o.off_date BETWEEN ? AND ?" . ($uid ? " AND o.user_id = ?" : "") . "
            ORDER BY o.off_date DESC";
    $st = db()->prepare($sql);
    $st->execute($uid ? [$from, $to, $uid] : [$from, $to]);
    $offs = $st->fetchAll();

    $sql = "SELECT n.*, u.name FROM night_shifts n JOIN users u ON u.id = n.user_id
            WHERE n.duty_date BETWEEN ? AND ?" . ($uid ? " AND n.user_id = ?" : "") . "
            ORDER BY n.duty_date DESC, u.name";
    $st = db()->prepare($sql);
    $st->execute($uid ? [$from, $to, $uid] : [$from, $to]);
    $nights = $st->fetchAll();

    ok(['from' => $from, 'to' => $to, 'attendance' => $att, 'day_offs' => $offs, 'night_shifts' => $nights]);
}

/**
 * สถิติเวรกลางคืนของเดือน "YYYY-MM" — จำนวนคืนต่อคน + วันที่ๆ เข้าเวร + สรุปรวมทั้งเดือน
 * ใช้ร่วมกันทั้งการ์ดแดชบอร์ด (เดือนปัจจุบัน) และ h_night_month (month picker ย้อนหลัง)
 */
function night_month_data(string $ym): array {
    $st = db()->prepare(
        "SELECT u.name, u.position, COUNT(*) nights,
                GROUP_CONCAT(DAY(n.duty_date) ORDER BY n.duty_date SEPARATOR ',') days
         FROM night_shifts n JOIN users u ON u.id = n.user_id
         WHERE DATE_FORMAT(n.duty_date,'%Y-%m') = ?
         GROUP BY n.user_id, u.name, u.position ORDER BY nights DESC, u.name");
    $st->execute([$ym]);
    $stats = $st->fetchAll();

    // สรุปรวม: กี่คืนที่มีคนเข้าเวร (distinct วัน), กี่คนที่เข้าเวร, รวมคน-คืน
    $st = db()->prepare(
        "SELECT COUNT(DISTINCT duty_date) nights, COUNT(DISTINCT user_id) people, COUNT(*) man_nights
         FROM night_shifts WHERE DATE_FORMAT(duty_date,'%Y-%m') = ?");
    $st->execute([$ym]);

    return ['stats' => $stats, 'summary' => $st->fetch()];
}

/** สถิติเวรกลางคืนของเดือนที่เลือก (month picker บนแดชบอร์ด) — default เดือนปัจจุบัน, กันเดือนอนาคต */
function h_night_month(): never {
    require_admin();
    $ym = (string)(param('month') ?: date('Y-m'));
    if (!preg_match('/^\d{4}-\d{2}$/', $ym)) fail('รูปแบบเดือนไม่ถูกต้อง');
    if ($ym > date('Y-m'))                   fail('เลือกเดือนในอนาคตไม่ได้');
    $nm = night_month_data($ym);
    ok(['month' => $ym, 'month_label' => thai_month_label($ym), 'stats' => $nm['stats'], 'summary' => $nm['summary']]);
}

/** รายชื่อคนเข้าเวรกลางคืนของวันที่ระบุ (default = คืนนี้) — สำหรับ date picker บนแดชบอร์ด */
function h_night_roster(): never {
    require_admin();
    $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)param('date')) ? param('date') : tonight_duty_date();
    $st = db()->prepare(
        "SELECT u.name, u.position, n.time_in FROM night_shifts n JOIN users u ON u.id = n.user_id
         WHERE n.duty_date = ? ORDER BY n.time_in");
    $st->execute([$date]);
    ok(['date' => $date, 'items' => $st->fetchAll()]);
}

// ---------- ตั้งค่า ----------

const EDITABLE_SETTINGS = [
    'station_name', 'checkin_open', 'late_cutoff', 'checkout_open', 'report_cutoff',
    'gps_lat', 'gps_lng', 'gps_radius_m', 'gps_enforce',
    'selfie_required', 'checkout_enabled', 'sunday_off',
    'night_shift_enabled', 'night_checkin_open', 'sunday_work_enabled',
    'face_verify_enabled', 'face_match_threshold', 'face_max_attempts', 'face_min_desc',
    'line_token', 'line_group_id',
    'gdrive_client_id', 'gdrive_client_secret',
];

function h_settings_get(): never {
    require_admin();
    $all = settings();
    ok(['settings' => array_intersect_key($all, array_flip(EDITABLE_SETTINGS))]);
}

function h_settings_save(): never {
    require_admin();
    $in = (array)param('settings', []);
    $timeKeys = ['checkin_open', 'late_cutoff', 'checkout_open', 'report_cutoff', 'night_checkin_open'];
    $numKeys  = ['gps_radius_m'];
    $boolKeys = ['gps_enforce', 'selfie_required', 'checkout_enabled', 'sunday_off', 'night_shift_enabled',
                 'sunday_work_enabled', 'face_verify_enabled'];

    foreach ($in as $k => $v) {
        if (!in_array($k, EDITABLE_SETTINGS, true)) continue;
        $v = trim((string)$v);
        if (in_array($k, $timeKeys, true) && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) fail("รูปแบบเวลาไม่ถูกต้อง: {$k}");
        if (in_array($k, $numKeys, true))  $v = (string)max(0, (int)$v);
        if (in_array($k, $boolKeys, true)) $v = $v === '1' ? '1' : '0';
        if (($k === 'gps_lat' || $k === 'gps_lng') && !is_numeric($v)) fail('พิกัด GPS ไม่ถูกต้อง');
        // ยืนยันใบหน้า: เกณฑ์ระยะต้องอยู่ในช่วงที่วัดมาแล้วสมเหตุผล / จำนวนครั้งกับจำนวน descriptor ขั้นต่ำ clamp ไว้
        if ($k === 'face_match_threshold') {
            if (!is_numeric($v) || (float)$v < 0.20 || (float)$v > 0.90) fail('เกณฑ์ใบหน้าต้องอยู่ระหว่าง 0.20-0.90');
            $v = number_format((float)$v, 2, '.', '');
        }
        if ($k === 'face_max_attempts') $v = (string)max(1, min(5, (int)$v));
        if ($k === 'face_min_desc')     $v = (string)max(1, min(10, (int)$v));
        save_setting($k, $v);
    }
    ok(['message' => 'บันทึกการตั้งค่าแล้ว']);
}

// ---------- วันเช็คชื่อนอกสถานที่ (offsite) ----------

/** รายการวันนอกสถานที่ที่ตั้งไว้ (วันนี้ขึ้นไป) — สำหรับหน้าตั้งค่าแอดมิน */
function h_offsite_list(): never {
    require_admin();
    $st = db()->prepare('SELECT id, off_date, start_time, end_time, reason FROM offsite_days WHERE off_date >= ? ORDER BY off_date');
    $st->execute([date('Y-m-d')]);
    ok(['items' => $st->fetchAll()]);
}

/** เพิ่ม/แก้วันนอกสถานที่ (แก้วันเดิม = ทับ ผ่าน ON DUPLICATE KEY) */
function h_offsite_add(): never {
    require_admin();
    $date   = trim((string)param('off_date', ''));
    $start  = trim((string)param('start_time', ''));
    $end    = trim((string)param('end_time', ''));
    $reason = mb_substr(trim((string)param('reason', '')), 0, 255);
    $timeRe = '/^([01]\d|2[0-3]):[0-5]\d$/';

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) fail('วันที่ไม่ถูกต้อง');
    if ($date < date('Y-m-d')) fail('เลือกวันย้อนหลังไม่ได้');
    if (!preg_match($timeRe, $start) || !preg_match($timeRe, $end)) fail('รูปแบบเวลาไม่ถูกต้อง (HH:MM)');
    if (hm_to_min($start) >= hm_to_min($end)) fail('เวลาเริ่มต้องก่อนเวลาสิ้นสุด');

    db()->prepare('INSERT INTO offsite_days (off_date, start_time, end_time, reason)
                   VALUES (?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), reason = VALUES(reason)')
        ->execute([$date, $start, $end, $reason]);
    ok(['message' => 'บันทึกวันเช็คชื่อนอกสถานที่แล้ว']);
}

/** ลบวันนอกสถานที่ */
function h_offsite_del(): never {
    require_admin();
    db()->prepare('DELETE FROM offsite_days WHERE id = ?')->execute([(int)param('id', 0)]);
    ok(['message' => 'ลบแล้ว']);
}

// ---------- วันหยุดนักขัตฤกษ์ (public_holidays) ----------

/** รายการวันหยุดนักขัตฤกษ์ที่ตั้งไว้ (วันนี้ขึ้นไป) — สำหรับหน้าตั้งค่าแอดมิน */
function h_holiday_list(): never {
    require_admin();
    $st = db()->prepare('SELECT id, holiday_date, name FROM public_holidays WHERE holiday_date >= ? ORDER BY holiday_date');
    $st->execute([date('Y-m-d')]);
    ok(['items' => $st->fetchAll()]);
}

function h_holiday_add(): never {
    require_admin();
    $date = trim((string)param('holiday_date', ''));
    $name = mb_substr(trim((string)param('name', '')), 0, 255);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) fail('วันที่ไม่ถูกต้อง');
    if ($name === '') fail('กรุณาระบุชื่อวันหยุด');

    db()->prepare('INSERT INTO public_holidays (holiday_date, name) VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE name = VALUES(name)')
        ->execute([$date, $name]);
    ok(['message' => 'บันทึกวันหยุดนักขัตฤกษ์แล้ว']);
}

function h_holiday_del(): never {
    require_admin();
    db()->prepare('DELETE FROM public_holidays WHERE id = ?')->execute([(int)param('id', 0)]);
    ok(['message' => 'ลบแล้ว']);
}

// ---------- อนุญาตเช็คนอกสถานที่รายคน (offsite_users) ----------

function h_offsite_user_list(): never {
    require_admin();
    $st = db()->prepare(
        "SELECT ou.id, ou.user_id, ou.off_date, ou.reason, ou.no_late, u.name, u.position
           FROM offsite_users ou JOIN users u ON u.id = ou.user_id
          WHERE ou.off_date >= ? ORDER BY ou.off_date, u.name");
    $st->execute([date('Y-m-d')]);
    ok(['items' => $st->fetchAll()]);
}

function h_offsite_user_add(): never {
    require_admin();
    $uidsRaw = param('user_ids', []);
    $uids    = is_array($uidsRaw) ? $uidsRaw : explode(',', (string)$uidsRaw);
    $uids    = array_values(array_unique(array_filter(array_map('intval', $uids))));
    $start   = trim((string)param('start_date', ''));
    $end     = trim((string)param('end_date', '')) ?: $start;
    $reason  = mb_substr(trim((string)param('reason', '')), 0, 255);
    $noLate  = (int)!!param('no_late', 0);   // 1 = วันไปราชการ ไม่นับสาย

    if (!$uids) fail('เลือกเจ้าหน้าที่อย่างน้อย 1 คน');
    $dateRe = '/^\d{4}-\d{2}-\d{2}$/';
    if (!preg_match($dateRe, $start) || !strtotime($start)) fail('วันที่เริ่มไม่ถูกต้อง');
    if (!preg_match($dateRe, $end) || !strtotime($end))     fail('วันที่สิ้นสุดไม่ถูกต้อง');
    if ($end < $start)          fail('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    if ($start < date('Y-m-d'))  fail('เลือกวันย้อนหลังไม่ได้');
    if ((strtotime($end) - strtotime($start)) / 86400 > 62) fail('ช่วงวันยาวเกินไป (สูงสุด 62 วัน)');

    // เฉพาะ staff active เท่านั้น
    $in     = implode(',', array_fill(0, count($uids), '?'));
    $st     = db()->prepare("SELECT id, name FROM users WHERE role = 'staff' AND status = 'active' AND id IN ($in)");
    $st->execute($uids);
    $valid  = $st->fetchAll(PDO::FETCH_KEY_PAIR);   // [id => name]
    if (!$valid) fail('ไม่พบเจ้าหน้าที่ที่เลือก');

    // แตกช่วงวันเป็นราย row ต่อคน/วัน
    $dates = [];
    for ($d = new DateTime($start); $d->format('Y-m-d') <= $end; $d->modify('+1 day')) $dates[] = $d->format('Y-m-d');

    $ins = db()->prepare('INSERT INTO offsite_users (user_id, off_date, reason, no_late) VALUES (?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE reason = VALUES(reason), no_late = VALUES(no_late)');
    foreach ($valid as $uid => $name) {
        foreach ($dates as $dt) $ins->execute([$uid, $dt, $reason, $noLate]);
        // แจ้งเข้ากล่องข้อความให้เจ้าตัวรู้ว่าได้รับอนุญาต
        $range = count($dates) > 1 ? thai_date($start) . ' – ' . thai_date($end) : thai_date($start);
        $lateNote = $noLate ? 'เช็คได้จากทุกที่ (ไปราชการ ไม่นับสาย)' : 'เช็คชื่อได้จากทุกที่ ในเวลางานปกติ';
        notify_push((int)$uid, 'announcement', '📍 ได้รับอนุญาตเช็คนอกพื้นที่',
            "วันที่ {$range}" . ($reason ? " ({$reason})" : '') . " — {$lateNote}");
    }
    ok(['message' => 'บันทึกแล้ว ' . count($valid) . ' คน · ' . count($dates) . ' วัน']);
}

function h_offsite_user_del(): never {
    require_admin();
    db()->prepare('DELETE FROM offsite_users WHERE id = ?')->execute([(int)param('id', 0)]);
    ok(['message' => 'ลบแล้ว']);
}
