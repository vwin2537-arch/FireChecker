<?php
// =====================================================
// FireCheck — handler ของ Web Push + เก็บข้อมูลอุปกรณ์ (v37)
// แกนเข้ารหัส/ส่งอยู่ที่ app/push.php — ไฟล์นี้เป็นฝั่ง API เท่านั้น
// =====================================================

const DEV_PLATFORMS = ['ios', 'android', 'desktop', 'other'];
const DEV_PERMS     = ['unsupported', 'default', 'granted', 'denied'];

/**
 * client รายงานว่าเปิดแอปจากเครื่องอะไร (เรียกครั้งเดียวตอนเปิดแอป)
 * ตอบกลับ vapid_public ให้ client เอาไปใช้ subscribe ต่อได้เลย ไม่ต้องยิงอีกรอบ
 */
function h_device_report(): never {
    $u  = require_user();
    $k  = strtolower(preg_replace('/[^a-fA-F0-9]/', '', (string)param('device_key', '')));
    if (strlen($k) !== 32) fail('device_key ไม่ถูกต้อง');

    $platform = (string)param('platform', 'other');
    $perm     = (string)param('push_perm', 'unsupported');
    if (!in_array($platform, DEV_PLATFORMS, true)) $platform = 'other';
    if (!in_array($perm, DEV_PERMS, true))         $perm     = 'unsupported';

    db()->prepare('INSERT INTO user_devices (user_id, device_key, platform, browser, os_version, standalone, push_supported, push_perm, ua)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     user_id = VALUES(user_id), platform = VALUES(platform), browser = VALUES(browser),
                     os_version = VALUES(os_version), standalone = VALUES(standalone),
                     push_supported = VALUES(push_supported), push_perm = VALUES(push_perm), ua = VALUES(ua)')
        ->execute([
            $u['id'], $k, $platform,
            mb_substr((string)param('browser', ''), 0, 30),
            mb_substr((string)param('os_version', ''), 0, 20),
            (int)(bool)param('standalone', false),
            (int)(bool)param('push_supported', false),
            $perm,
            mb_substr((string)param('ua', ''), 0, 255),
        ]);

    ok([
        'push_enabled' => setting('push_enabled', '0') === '1',
        'vapid_public' => setting('vapid_public', ''),
    ]);
}

/** บันทึก subscription ที่เบราว์เซอร์ออกให้ (กดอนุญาตแจ้งเตือนแล้ว) */
function h_push_subscribe(): never {
    $u        = require_user();
    $endpoint = trim((string)param('endpoint', ''));
    $p256dh   = trim((string)param('p256dh', ''));
    $auth     = trim((string)param('auth', ''));
    if (!preg_match('#^https://#', $endpoint)) fail('endpoint ไม่ถูกต้อง');
    if ($p256dh === '' || $auth === '')        fail('กุญแจของเบราว์เซอร์ไม่ครบ');

    $k = strtolower(preg_replace('/[^a-fA-F0-9]/', '', (string)param('device_key', '')));
    db()->prepare('INSERT INTO push_subscriptions (user_id, device_key, endpoint, endpoint_hash, p256dh, auth_secret)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     user_id = VALUES(user_id), device_key = VALUES(device_key),
                     p256dh = VALUES(p256dh), auth_secret = VALUES(auth_secret), fail_count = 0')
        ->execute([$u['id'], strlen($k) === 32 ? $k : '', $endpoint, hash('sha256', $endpoint), $p256dh, $auth]);

    // เด้งยืนยันกลับไปที่เครื่องนั้นทันที = คนกดเปิดเห็นกับตาว่าใช้งานได้จริง
    // ⚠️ เฉพาะตอนกดปุ่มเปิดเอง (welcome=1) เท่านั้น — Push.report() เรียก sync() เงียบๆ ทุกครั้งที่เปิดแอป
    //    ถ้ายิงทุกครั้งจะกลายเป็นเด้งใส่เจ้าหน้าที่ทุกคนทุกครั้งที่เปิดแอป
    // ใช้ push_send_raw ตรง (ข้าม push_enabled) เพราะเป็นการทดสอบที่ผู้ใช้กดเอง
    if (param('welcome', false)) {
        $st = db()->prepare('SELECT * FROM push_subscriptions WHERE endpoint_hash = ?');
        $st->execute([hash('sha256', $endpoint)]);
        if ($row = $st->fetch()) {
            push_send_raw([$row], [
                'title' => '🔔 เปิดแจ้งเตือนสำเร็จ',
                'body'  => 'ต่อไปประกาศและผลอนุมัติลาจะเด้งขึ้นที่นี่',
                'url'   => './', 'tag' => 'welcome',
            ]);
        }
    }

    ok(['message' => 'เปิดแจ้งเตือนแล้ว']);
}

/** เจ้าหน้าที่กดปิดแจ้งเตือนเอง */
function h_push_unsubscribe(): never {
    $u = require_user();
    $endpoint = trim((string)param('endpoint', ''));
    if ($endpoint === '') fail('ไม่พบ endpoint');
    db()->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?')
        ->execute([$u['id'], hash('sha256', $endpoint)]);
    ok(['message' => 'ปิดแจ้งเตือนแล้ว']);
}

/** แอดมินสร้างกุญแจ VAPID (ทำครั้งเดียว) — มีแล้วต้องส่ง force=1 เพราะสร้างใหม่ = subscription เดิมพังหมด */
function h_push_vapid_gen(): never {
    require_admin();
    if (setting('vapid_public', '') !== '' && !param('force', false)) {
        fail('มีกุญแจอยู่แล้ว — สร้างใหม่จะทำให้เจ้าหน้าที่ทุกคนต้องกดอนุญาตแจ้งเตือนใหม่');
    }
    $kp = vapid_generate();
    save_setting('vapid_public',  $kp['public']);
    save_setting('vapid_private', $kp['private']);
    db()->exec('DELETE FROM push_subscriptions');   // กุญแจเปลี่ยน = ของเดิมใช้ไม่ได้แล้ว ล้างทิ้งไม่ให้ค้าง
    ok(['message' => 'สร้างกุญแจแจ้งเตือนแล้ว', 'vapid_public' => $kp['public']]);
}

/** แอดมินกดทดสอบ — ไม่ระบุ user_id = ส่งหาตัวเอง (ทุกเครื่องที่ตัวเองเปิดไว้) / ระบุ = ส่งหาเจ้าหน้าที่คนนั้น */
function h_push_test(): never {
    $u = require_admin();
    if (setting('vapid_public', '') === '') fail('ยังไม่ได้สร้างกุญแจแจ้งเตือน');
    $target = (int)param('user_id', 0) ?: (int)$u['id'];
    $st = db()->prepare('SELECT * FROM push_subscriptions WHERE user_id = ?');
    $st->execute([$target]);
    $subs = $st->fetchAll();
    if (!$subs) fail($target === (int)$u['id']
        ? 'บัญชีนี้ยังไม่ได้เปิดแจ้งเตือนบนเครื่องไหนเลย — กดปุ่ม "เปิดแจ้งเตือนบนเครื่องนี้" ก่อน'
        : 'เจ้าหน้าที่คนนี้ยังไม่ได้กดเปิดแจ้งเตือนบนเครื่องของตัวเอง');

    // ทดสอบต้องส่งได้แม้สวิตช์รวมยังปิด จึงเรียก push_send_raw ตรง (ข้าม push_enabled)
    $r = push_send_raw($subs, [
        'title' => '🔔 ทดสอบแจ้งเตือน FireCheck',
        'body'  => 'ถ้าเห็นข้อความนี้ = ระบบแจ้งเตือนพร้อมใช้งานแล้ว',
        'url'   => './',
        'tag'   => 'test',
    ]);
    if (!$r['sent']) fail('ส่งไม่สำเร็จ (' . $r['failed'] . ' ล้มเหลว / ' . $r['gone'] . ' หมดอายุ) — ดู log ของเซิร์ฟเวอร์');
    ok(['message' => "ส่งแล้ว {$r['sent']} เครื่อง", 'result' => $r]);
}

/** สรุปอุปกรณ์ของเจ้าหน้าที่ทุกคน — ให้หัวหน้าเห็นว่าใครพร้อมรับแจ้งเตือน ใครต้องไปติดตั้งก่อน */
function h_device_summary(): never {
    require_admin();
    $rows = db()->query(
        "SELECT d.*, u.name, u.role,
                (SELECT COUNT(*) FROM push_subscriptions p WHERE p.device_key = d.device_key) sub_count
           FROM user_devices d
           JOIN users u ON u.id = d.user_id
          WHERE u.status = 'active'
          ORDER BY u.name, d.last_seen DESC"
    )->fetchAll();

    // สรุปหัวตาราง: iOS ที่ยังไม่ติดตั้ง PWA คือกลุ่มที่ "ไม่มีทางได้ push" จนกว่าจะกดเพิ่มลงหน้าจอโฮม
    $sum = ['total' => count($rows), 'ready' => 0, 'ios_not_installed' => 0, 'no_permission' => 0, 'unsupported' => 0];
    foreach ($rows as $r) {
        if ((int)$r['sub_count'] > 0)                                   $sum['ready']++;
        elseif ($r['platform'] === 'ios' && !(int)$r['standalone'])     $sum['ios_not_installed']++;
        elseif (!(int)$r['push_supported'])                             $sum['unsupported']++;
        else                                                            $sum['no_permission']++;
    }

    $staff = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'staff' AND status = 'active'")->fetchColumn();
    $seen  = (int)db()->query("SELECT COUNT(DISTINCT d.user_id) FROM user_devices d
                                JOIN users u ON u.id = d.user_id
                               WHERE u.role = 'staff' AND u.status = 'active'")->fetchColumn();
    ok(['items' => $rows, 'summary' => $sum + ['staff_total' => $staff, 'staff_seen' => $seen]]);
}

/**
 * cron: เตือน "ยังไม่เช็คชื่อ" ก่อนถึงเวลาสาย
 * เรียกแบบ GET /api.php?action=cron_push_remind&key=CRON_SECRET  (ตั้งเวลาไว้ที่ push_remind_time)
 * ข้าม: วันหยุดสถานี · คนที่ลา · คนที่เช็คแล้ว · วันที่ทั้งสถานีออกนอกพื้นที่ (เวลาสายคนละชุด)
 *       · คนไปราชการแบบไม่นับสาย · คนที่เมื่อคืนลงเวรกลางคืน (ได้รับยกเว้นสายอยู่แล้ว)
 */
function h_cron_push_remind(): never {
    $key = (string)param('key');
    if (!hash_equals(CRON_SECRET, $key)) {
        $u = current_user();
        if (!$u || $u['role'] !== 'admin') fail('ไม่มีสิทธิ์เรียกคำสั่งนี้', 403);
    }
    $force = (bool)param('force', false);
    $today = date('Y-m-d');

    if (setting('push_enabled', '0') !== '1')        ok(['skipped' => 'ปิดสวิตช์แจ้งเตือนอยู่']);
    if (setting('push_remind_enabled', '1') !== '1') ok(['skipped' => 'ปิดการเตือนเช็คชื่ออยู่']);
    if (is_station_holiday($today))                  ok(['skipped' => 'วันหยุดสถานี']);
    if (offsite_for($today))                         ok(['skipped' => 'วันนี้ทั้งสถานีออกนอกพื้นที่']);

    // กันยิงซ้ำ (cron ภายนอกอาจเรียกซ้ำ / กดปุ่มทดสอบ) — insert ก่อน ถ้าชนแปลว่าส่งไปแล้ว
    if (!$force) {
        try {
            db()->prepare('INSERT INTO push_logs (log_type, log_date) VALUES (?, ?)')->execute(['remind_checkin', $today]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? 0) != 1062) throw $e;
            ok(['skipped' => 'ส่งเตือนของวันนี้ไปแล้ว']);
        }
    }

    $rows = db()->prepare(
        "SELECT u.id, u.name FROM users u
          WHERE u.role = 'staff' AND u.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id = u.id AND a.work_date = ?)
            AND NOT EXISTS (SELECT 1 FROM day_offs o   WHERE o.user_id = u.id AND o.off_date  = ?)
            AND NOT EXISTS (SELECT 1 FROM night_shifts n WHERE n.user_id = u.id AND n.duty_date = ?)
            AND NOT EXISTS (SELECT 1 FROM offsite_users s
                             WHERE s.user_id = u.id AND s.off_date = ? AND s.no_late = 1)"
    );
    $rows->execute([$today, $today, date('Y-m-d', strtotime('-1 day')), $today]);
    $ids = $rows->fetchAll(PDO::FETCH_COLUMN);

    if (!$ids) ok(['sent' => 0, 'message' => 'ทุกคนเช็คชื่อแล้ว / ไม่มีคนต้องเตือน']);

    $cut = setting('late_cutoff', '08:15');
    $r = push_to_users(array_map('intval', $ids),
        '⏰ ยังไม่ได้เช็คชื่อ',
        "อีกไม่นานจะถึง {$cut} น. แล้ว — เปิดแอปเช็คชื่อเลยนะครับ",
        './', 'remind');

    if (!$force) {
        db()->prepare('UPDATE push_logs SET sent_count = ? WHERE log_type = ? AND log_date = ?')
            ->execute([$r['sent'], 'remind_checkin', $today]);
    }
    ok(['targets' => count($ids)] + $r);
}
