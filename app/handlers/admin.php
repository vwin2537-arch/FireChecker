<?php
// =====================================================
// FireCheck — Admin handlers (dashboard analytics, users, settings, reports)
// =====================================================

/** สถานะรายคนของวันหนึ่ง: present / leave / absent  (คืน map user_id => row) */
function roster_for(string $date): array {
    $st = db()->prepare(
        "SELECT u.id, u.name, u.position,
                a.time_in, a.late, a.time_out, a.report_late, a.distance_m, a.selfie_path,
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
    $today = date('Y-m-d');
    $isHoliday = is_station_holiday($today);

    // ---------- วันนี้ ----------
    $roster = $isHoliday ? [] : roster_for($today);
    $todayCounts = roster_counts($roster);

    // ---------- แนวโน้ม 14 วันทำการล่าสุด ----------
    $trend = [];
    for ($d = new DateTime($today), $i = 0; count($trend) < 14 && $i < 25; $i++, $d->modify('-1 day')) {
        $ymd = $d->format('Y-m-d');
        if (is_station_holiday($ymd)) continue;
        $c = roster_counts(roster_for($ymd));
        $trend[] = ['date' => $ymd, 'label' => (int)date('j', strtotime($ymd)) . ' ' . THAI_MONTHS[(int)date('n', strtotime($ymd))]] + $c;
    }
    $trend = array_reverse($trend);

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

    // ---------- เตือนเกินโควต้า (เดือนนี้ขึ้นไป) ----------
    $st = db()->prepare(
        "SELECT u.name, DATE_FORMAT(o.off_date,'%Y-%m') ym,
                SUM(o.type = 'dayoff') n, MAX(o.over_quota) has_over
         FROM day_offs o JOIN users u ON u.id = o.user_id
         WHERE o.off_date >= DATE_FORMAT(?, '%Y-%m-01') AND u.status = 'active'
         GROUP BY o.user_id, u.name, ym
         HAVING SUM(o.type = 'dayoff') > ? OR MAX(o.over_quota) = 1
         ORDER BY ym, n DESC");
    $quota = (int)setting('off_quota_month', '10');
    $st->execute([$today, $quota]);
    $overQuota = $st->fetchAll();

    // ---------- เปรียบเทียบสัปดาห์นี้ / สัปดาห์ก่อน ----------
    $monThis = date('Y-m-d', strtotime('monday this week'));
    $monLast = date('Y-m-d', strtotime('monday last week'));
    $wk = function (string $from, string $to): array {
        $st = db()->prepare("SELECT COUNT(*) total, COALESCE(SUM(late=0),0) ontime, COALESCE(SUM(late=1),0) late_n
                             FROM attendance WHERE work_date BETWEEN ? AND ?");
        $st->execute([$from, $to]);
        $r = $st->fetch();
        return ['total' => (int)$r['total'], 'ontime' => (int)$r['ontime'], 'late' => (int)$r['late_n']];
    };
    $weekCompare = ['this' => $wk($monThis, $today), 'last' => $wk($monLast, date('Y-m-d', strtotime($monLast . ' +6 days')))];

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

    ok([
        'today' => [
            'date' => $today, 'thai_date' => thai_date($today), 'is_holiday' => $isHoliday,
            'counts' => $todayCounts, 'roster' => array_values($roster),
        ],
        'trend14'      => $trend,
        'weekday'      => $weekday,
        'ranking'      => $ranking,
        'over_quota'   => $overQuota,
        'week_compare' => $weekCompare,
        'activity'     => $activity,
        'pending_users'=> $pending,
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

    $users = db()->query("SELECT id, name, position, created_at FROM users WHERE role = 'staff' AND status = 'active' ORDER BY name")->fetchAll();

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
            'id' => $uid, 'name' => $u['name'], 'position' => $u['position'],
            'planned' => $planned, 'present' => $present, 'ontime' => $ontime, 'late' => $late,
            'absent' => $absent, 'leave' => $leave, 'reported' => $reported, 'report_ontime' => $reportOntime,
            'avg_in' => $avgIn, 'score' => $score,
        ];
    }
    usort($out, fn($a, $b) => ($b['score'] ?? -1) <=> ($a['score'] ?? -1));
    return $out;
}

// ---------- จัดการผู้ใช้ ----------

function h_users_list(): never {
    require_admin();
    $ym = date('Y-m');
    $rows = db()->query(
        "SELECT u.id, u.username, u.name, u.position, u.role, u.status, u.created_at,
                (SELECT COUNT(*) FROM day_offs o
                  WHERE o.user_id = u.id AND o.type = 'dayoff' AND DATE_FORMAT(o.off_date,'%Y-%m') = '{$ym}') quota_used
         FROM users u ORDER BY u.role, u.status, u.name")->fetchAll();
    ok(['users' => $rows, 'quota_max' => (int)setting('off_quota_month', '10')]);
}

function h_user_add(): never {
    require_admin();
    $username = trim((string)param('username'));
    $name     = trim((string)param('name'));
    $position = mb_substr(trim((string)param('position', '')), 0, 100);
    if (!preg_match('/^[a-zA-Z0-9_.-]{3,30}$/', $username)) fail('ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ - ยาว 3-30 ตัว');
    if ($name === '') fail('กรอกชื่อ-สกุล');

    $st = db()->prepare('SELECT id FROM users WHERE username = ?');
    $st->execute([$username]);
    if ($st->fetch()) fail('ชื่อผู้ใช้นี้มีอยู่แล้ว');

    db()->prepare("INSERT INTO users (username, name, position, role, status) VALUES (?, ?, ?, 'staff', 'unregistered')")
        ->execute([$username, $name, $position]);
    ok(['message' => "เพิ่ม {$name} แล้ว — ให้เจ้าตัวเปิดหน้าเว็บ กด \"ลงทะเบียน\" เพื่อตั้งรหัสผ่าน"]);
}

function set_user_status(int $id, string $status, bool $clearPass = false): void {
    $sql = $clearPass
        ? "UPDATE users SET status = ?, password_hash = NULL WHERE id = ? AND role = 'staff'"
        : "UPDATE users SET status = ? WHERE id = ? AND role = 'staff'";
    $st = db()->prepare($sql);
    $st->execute([$status, $id]);
    if (!$st->rowCount()) fail('ไม่พบเจ้าหน้าที่คนนี้');
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

    ok(['from' => $from, 'to' => $to, 'attendance' => $att, 'day_offs' => $offs]);
}

// ---------- ตั้งค่า ----------

const EDITABLE_SETTINGS = [
    'station_name', 'checkin_open', 'late_cutoff', 'checkout_open', 'report_cutoff',
    'gps_lat', 'gps_lng', 'gps_radius_m', 'gps_enforce',
    'selfie_required', 'checkout_enabled', 'off_quota_month', 'sunday_off',
    'line_token', 'line_group_id',
];

function h_settings_get(): never {
    require_admin();
    $all = settings();
    ok(['settings' => array_intersect_key($all, array_flip(EDITABLE_SETTINGS))]);
}

function h_settings_save(): never {
    require_admin();
    $in = (array)param('settings', []);
    $timeKeys = ['checkin_open', 'late_cutoff', 'checkout_open', 'report_cutoff'];
    $numKeys  = ['gps_radius_m', 'off_quota_month'];
    $boolKeys = ['gps_enforce', 'selfie_required', 'checkout_enabled', 'sunday_off'];

    foreach ($in as $k => $v) {
        if (!in_array($k, EDITABLE_SETTINGS, true)) continue;
        $v = trim((string)$v);
        if (in_array($k, $timeKeys, true) && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) fail("รูปแบบเวลาไม่ถูกต้อง: {$k}");
        if (in_array($k, $numKeys, true))  $v = (string)max(0, (int)$v);
        if (in_array($k, $boolKeys, true)) $v = $v === '1' ? '1' : '0';
        if (($k === 'gps_lat' || $k === 'gps_lng') && !is_numeric($v)) fail('พิกัด GPS ไม่ถูกต้อง');
        save_setting($k, $v);
    }
    ok(['message' => 'บันทึกการตั้งค่าแล้ว']);
}
