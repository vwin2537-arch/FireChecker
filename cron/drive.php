<?php
// =====================================================
// FireCheck — Worker ไล่คิวอัปรูปเช็คชื่อขึ้น Google Drive
// แตกออกมาเป็นโปรเซสแยกตอนเช็คอิน (ดู gdrive_spawn_worker ใน app/drive.php)
// รันเดี่ยวก็ได้:  php cron/drive.php
// =====================================================

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/drive.php';

// กันหลายโปรเซสไล่คิวชนกัน — ให้มีตัวเดียวทำงานพอ ตัวที่ชนออกทันที
$lock = fopen(sys_get_temp_dir() . '/firecheck_drive.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);

// ไล่อัปเป็นชุดจนคิวหมด (เพดานกันวนไม่จบตอนงานล้มติดกัน)
for ($i = 0; $i < 5; $i++) {
    $pending = db()->query("SELECT COUNT(*) c FROM drive_queue WHERE status = 'pending'")->fetch()['c'];
    if ((int)$pending === 0) break;
    gdrive_process_queue(3);
}

flock($lock, LOCK_UN);
