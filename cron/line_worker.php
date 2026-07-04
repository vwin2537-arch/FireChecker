<?php
// =====================================================
// FireCheck — Worker ไล่คิวแจ้งเตือนเข้ากลุ่ม LINE
// แตกออกมาเป็นโปรเซสแยกตอนแอดมินอนุมัติลา (ดู line_spawn_worker ใน app/handlers/line.php)
// รันเดี่ยวก็ได้:  php cron/line_worker.php
// =====================================================

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/handlers/dayoffs.php';
require_once __DIR__ . '/../app/handlers/line.php';

// กันหลายโปรเซสไล่คิวชนกัน — ให้มีตัวเดียวทำงานพอ ตัวที่ชนออกทันที
$lock = fopen(sys_get_temp_dir() . '/firecheck_line.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);

// ไล่ส่งเป็นชุดจนคิวหมด (เพดานกันวนไม่จบตอนงานล้มติดกัน)
for ($i = 0; $i < 5; $i++) {
    $pending = db()->query("SELECT COUNT(*) c FROM line_queue WHERE status = 'pending'")->fetch()['c'];
    if ((int)$pending === 0) break;
    line_process_queue(5);
}

flock($lock, LOCK_UN);
