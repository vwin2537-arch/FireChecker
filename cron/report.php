<?php
// =====================================================
// FireCheck — CLI สำหรับ cron
// ใช้บน Railway (Cron Schedule) หรือ crontab:
//   php cron/report.php morning   → สรุปเช้า (ตั้งเวลา 08:30)
//   php cron/report.php evening   → สรุปเย็น (ตั้งเวลา 17:30)
// =====================================================

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/auth.php';
require_once __DIR__ . '/../app/handlers/attendance.php';
require_once __DIR__ . '/../app/handlers/dayoffs.php';
require_once __DIR__ . '/../app/handlers/admin.php';
require_once __DIR__ . '/../app/handlers/line.php';

$type = $argv[1] ?? 'morning';
$result = run_line_report($type, in_array('--force', $argv, true));
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
exit($result['ok'] ? 0 : 1);
