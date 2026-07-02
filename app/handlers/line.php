<?php
// =====================================================
// FireCheck — LINE Bot report (สรุปเช้า/เย็นเข้ากลุ่ม)
// เรียกโดย cron:  GET /api.php?action=cron_report&type=morning&key=CRON_SECRET
// หรือ CLI:       php cron/report.php morning
// กันส่งซ้ำด้วยตาราง line_logs (unique ต่อ type+วัน)
// =====================================================

function build_report(string $type): ?string {
    $today = date('Y-m-d');
    if (is_station_holiday($today)) return null;

    $roster = roster_for($today);
    $c = roster_counts($roster);
    $station = setting('station_name');

    $names = fn(string $state) => array_map(
        fn($r) => '• ' . $r['name'] . ($state === 'leave' ? ' (' . OFF_TYPES[$r['off_type']] . ')' : ''),
        array_values(array_filter($roster, fn($r) => $r['state'] === $state))
    );

    if ($type === 'morning') {
        $lines = ["🔥 {$station}", '📋 สรุปเช็คชื่อเช้า ' . thai_date($today), ''];
        $lines[] = "✅ มาแล้ว {$c['present']}/{$c['total']} คน (ตรงเวลา {$c['ontime']} / สาย {$c['late']})";
        if ($c['late'])  { $lines[] = ''; $lines[] = '🟡 มาสาย:'; array_push($lines, ...$names('late')); }
        if ($c['leave']) { $lines[] = ''; $lines[] = '🔵 ลา/หยุด ' . $c['leave'] . ' คน:'; array_push($lines, ...$names('leave')); }
        if ($c['absent']){ $lines[] = ''; $lines[] = '🔴 ยังไม่เช็คชื่อ ' . $c['absent'] . ' คน:'; array_push($lines, ...$names('absent')); }
        if (!$c['late'] && !$c['absent']) { $lines[] = ''; $lines[] = '🎉 มาครบ ตรงเวลาทุกคน'; }
        return implode("\n", $lines);
    }

    // ---- evening ----
    $lines = ["🔥 {$station}", '🌇 สรุปประจำวัน ' . thai_date($today), ''];
    $lines[] = "มาปฏิบัติงาน {$c['present']}/{$c['total']} คน | ตรงเวลา {$c['ontime']} | สาย {$c['late']} | ลา {$c['leave']} | ขาด {$c['absent']}";
    if ($c['absent']) { $lines[] = ''; $lines[] = '🔴 ขาดวันนี้:'; array_push($lines, ...$names('absent')); }
    if (setting('checkout_enabled', '0') === '1') {
        $sent    = array_filter($roster, fn($r) => $r['time_in'] && $r['time_out']);
        $notSent = array_filter($roster, fn($r) => $r['time_in'] && !$r['time_out']);
        $lines[] = '';
        $lines[] = '📝 ส่งรายงานแล้ว ' . count($sent) . '/' . $c['present'] . ' คน';
        if ($notSent) { $lines[] = '⏳ ยังไม่ส่งรายงาน:'; array_push($lines, ...array_map(fn($r) => '• ' . $r['name'], array_values($notSent))); }
    }
    return implode("\n", $lines);
}

/** push ข้อความเข้ากลุ่ม LINE — คืน [success, detail] */
function line_push(string $text): array {
    $token   = setting('line_token');
    $groupId = setting('line_group_id');
    if ($token === '' || $groupId === '') return [false, 'ยังไม่ได้ตั้งค่า LINE token / group id'];

    $payload = json_encode(['to' => $groupId, 'messages' => [['type' => 'text', 'text' => mb_substr($text, 0, 4900)]]], JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.line.me/v2/bot/message/push');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $token],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code === 200, "HTTP {$code}: " . substr((string)$res, 0, 300)];
}

function run_line_report(string $type, bool $force = false): array {
    if (!in_array($type, ['morning', 'evening'], true)) return ['ok' => false, 'error' => 'type ต้องเป็น morning หรือ evening'];

    $today = date('Y-m-d');
    $text  = build_report($type);
    if ($text === null) return ['ok' => true, 'skipped' => 'วันนี้วันหยุดสถานี ไม่ส่งรายงาน'];

    if (!$force) {
        $st = db()->prepare('SELECT id FROM line_logs WHERE report_type = ? AND report_date = ?');
        $st->execute([$type, $today]);
        if ($st->fetch()) return ['ok' => true, 'skipped' => 'ส่งรายงานนี้ไปแล้ววันนี้', 'preview' => $text];
    }

    [$sent, $detail] = line_push($text);
    if ($sent) {
        db()->prepare('INSERT IGNORE INTO line_logs (report_type, report_date) VALUES (?, ?)')->execute([$type, $today]);
    }
    return ['ok' => true, 'sent' => $sent, 'detail' => $detail, 'preview' => $text];
}

function h_cron_report(): never {
    $key = (string)param('key');
    // อนุญาต 2 ทาง: CRON_SECRET (สำหรับ cron ภายนอก) หรือแอดมิน login อยู่ (ปุ่มทดสอบในหน้าตั้งค่า)
    if (!hash_equals(CRON_SECRET, $key)) {
        $u = current_user();
        if (!$u || $u['role'] !== 'admin') fail('ไม่มีสิทธิ์เรียกคำสั่งนี้', 403);
    }
    json_out(run_line_report((string)param('type', 'morning'), (bool)param('force', false)));
}
