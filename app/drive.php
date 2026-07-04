<?php
// =====================================================
// FireCheck — สำเนารูปเช็คชื่อขึ้น Google Drive
// เช็คอินสำเร็จทันทีเสมอ — อัปโหลดเบื้องหลังผ่านคิว drive_queue หลังส่ง response แล้ว
// ใช้ OAuth ของบัญชีพี่วิน scope drive.file (เห็นเฉพาะไฟล์/โฟลเดอร์ที่แอปสร้างเอง)
// → แอปสร้างโฟลเดอร์รากของตัวเอง แล้วพี่วินลากไปไว้ในโฟลเดอร์ที่ต้องการได้ (id ไม่เปลี่ยน)
// token เก็บใน settings (DB) แบบเดียวกับ LINE token — ไม่อยู่ในโค้ด
// =====================================================

const GDRIVE_ROOT_NAME = 'รูปเช็คชื่อสถานีไฟป่า';

/** เชื่อมต่อแล้วหรือยัง (มี refresh token) */
function gdrive_configured(): bool {
    return setting('gdrive_refresh_token') !== ''
        && setting('gdrive_client_id') !== ''
        && setting('gdrive_client_secret') !== '';
}

/** ยิง HTTP ไป Google — คืน [httpCode, decodedJson] โยน Exception เมื่อ curl พัง */
function gdrive_http(string $method, string $url, array $headers, ?string $body = null): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $res = curl_exec($ch);
    if ($res === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('เชื่อมต่อ Google ไม่ได้: ' . $err);
    }
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode($res, true) ?: []];
}

/** access token ใช้งานได้ (refresh อัตโนมัติ, cache ใน settings ~1 ชม.) */
function gdrive_token(): string {
    if ((int)setting('gdrive_access_exp', '0') > time() + 60) return setting('gdrive_access_token');

    [$code, $d] = gdrive_http('POST', 'https://oauth2.googleapis.com/token',
        ['Content-Type: application/x-www-form-urlencoded'],
        http_build_query([
            'client_id'     => setting('gdrive_client_id'),
            'client_secret' => setting('gdrive_client_secret'),
            'refresh_token' => setting('gdrive_refresh_token'),
            'grant_type'    => 'refresh_token',
        ]));
    if ($code !== 200 || empty($d['access_token'])) {
        throw new RuntimeException('ขอ access token ไม่สำเร็จ: ' . ($d['error_description'] ?? $d['error'] ?? "HTTP {$code}"));
    }
    save_setting('gdrive_access_token', $d['access_token']);
    save_setting('gdrive_access_exp', (string)(time() + (int)($d['expires_in'] ?? 3600) - 60));
    return $d['access_token'];
}

/** สร้างโฟลเดอร์บน Drive คืน id */
function gdrive_mkdir(string $name, ?string $parentId): string {
    $meta = ['name' => $name, 'mimeType' => 'application/vnd.google-apps.folder'];
    if ($parentId) $meta['parents'] = [$parentId];
    [$code, $d] = gdrive_http('POST', 'https://www.googleapis.com/drive/v3/files',
        ['Content-Type: application/json', 'Authorization: Bearer ' . gdrive_token()],
        json_encode($meta, JSON_UNESCAPED_UNICODE));
    if ($code !== 200 || empty($d['id'])) {
        throw new RuntimeException("สร้างโฟลเดอร์ {$name} ไม่สำเร็จ: HTTP {$code} " . ($d['error']['message'] ?? ''));
    }
    return $d['id'];
}

/** หาโฟลเดอร์ชื่อนี้ใต้ parent — คืน id หรือ null */
function gdrive_find_folder(string $name, string $parentId): ?string {
    $q = sprintf("name = '%s' and '%s' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        str_replace("'", "\\'", $name), $parentId);
    [$code, $d] = gdrive_http('GET',
        'https://www.googleapis.com/drive/v3/files?q=' . urlencode($q) . '&fields=files(id)&pageSize=1',
        ['Authorization: Bearer ' . gdrive_token()]);
    if ($code !== 200) throw new RuntimeException("ค้นหาโฟลเดอร์ไม่สำเร็จ: HTTP {$code}");
    return $d['files'][0]['id'] ?? null;
}

/** โฟลเดอร์รากของแอป (สร้างครั้งแรกอัตโนมัติ, id เก็บใน settings) */
function gdrive_root_folder(): string {
    $id = setting('gdrive_root_id');
    if ($id !== '') return $id;
    $id = gdrive_mkdir(GDRIVE_ROOT_NAME, null);
    save_setting('gdrive_root_id', $id);
    return $id;
}

/** โฟลเดอร์รายวัน ชื่อปี พ.ศ. เช่น 2569-07-03 (cache วันละครั้ง) */
function gdrive_day_folder(string $ymd): string {
    $t    = strtotime($ymd);
    $name = (date('Y', $t) + 543) . date('-m-d', $t);
    $cache = json_decode(setting('gdrive_day_cache', '{}'), true) ?: [];
    if (($cache['name'] ?? '') === $name) return $cache['id'];

    $root = gdrive_root_folder();
    try {
        $id = gdrive_find_folder($name, $root) ?? gdrive_mkdir($name, $root);
    } catch (RuntimeException $e) {
        // โฟลเดอร์รากอาจถูกลบทิ้งใน Drive — ล้าง id เพื่อให้รอบถัดไปสร้างใหม่
        if (str_contains($e->getMessage(), '404')) save_setting('gdrive_root_id', '');
        throw $e;
    }
    save_setting('gdrive_day_cache', json_encode(['name' => $name, 'id' => $id], JSON_UNESCAPED_UNICODE));
    return $id;
}

/** อัปโหลดไฟล์ขึ้นโฟลเดอร์ (multipart) คืน file id */
function gdrive_upload(string $absPath, string $fname, string $folderId): string {
    $bin  = file_get_contents($absPath);
    if ($bin === false) throw new RuntimeException('อ่านไฟล์ต้นทางไม่ได้');
    $mime = str_ends_with($fname, '.png') ? 'image/png' : (str_ends_with($fname, '.webp') ? 'image/webp' : 'image/jpeg');
    $meta = json_encode(['name' => $fname, 'parents' => [$folderId]], JSON_UNESCAPED_UNICODE);
    $b    = 'firecheck' . bin2hex(random_bytes(8));
    $body = "--{$b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{$meta}\r\n"
          . "--{$b}\r\nContent-Type: {$mime}\r\n\r\n{$bin}\r\n--{$b}--";
    [$code, $d] = gdrive_http('POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        ['Content-Type: multipart/related; boundary=' . $b, 'Authorization: Bearer ' . gdrive_token()],
        $body);
    if ($code !== 200 || empty($d['id'])) {
        throw new RuntimeException("อัปโหลดไม่สำเร็จ: HTTP {$code} " . ($d['error']['message'] ?? ''));
    }
    return $d['id'];
}

/** เพิ่มรูปเข้าคิวส่งขึ้น Drive (เรียกตอนเช็คอิน — ไม่แตะ network) */
function gdrive_enqueue(string $localPath, string $userName, string $workDate): void {
    if (!gdrive_configured()) return;
    $ext   = pathinfo($localPath, PATHINFO_EXTENSION) ?: 'jpg';
    $clean = preg_replace('#[/\\\\:*?"<>|]#u', '', str_replace(' ', '_', $userName));
    $fname = date('Hi') . '_' . $clean . '.' . $ext;
    db()->prepare('INSERT INTO drive_queue (local_path, fname, work_date) VALUES (?, ?, ?)')
        ->execute([$localPath, $fname, $workDate]);
    // แตกโปรเซสอัปโหลดแยกออกไป — เช็คอินตอบทันที; ถ้าแตกไม่ได้ค่อยอัปแบบรอสั้นๆ ในคำขอนี้
    if (!gdrive_spawn_worker()) gdrive_process_queue(3);
}

/** ถ้ามีงานค้าง ให้แตกโปรเซสมาไล่ (ห่างรอบก่อน >60 วิ กันเด้งถี่) — เรียกจาก endpoint ที่คนเข้าบ่อย */
function gdrive_kick_if_stale(): void {
    if (!gdrive_configured()) return;
    if (time() - (int)setting('gdrive_last_run', '0') < 60) return;
    $n = db()->query("SELECT COUNT(*) c FROM drive_queue WHERE status = 'pending'")->fetch()['c'];
    if ((int)$n > 0) {
        save_setting('gdrive_last_run', (string)time()); // กันหน้าแอปเด้ง worker ซ้ำถี่
        gdrive_spawn_worker();                            // ไม่ fallback inline ที่นี่ — กัน app_data ช้า
    }
}

/** แตกโปรเซส CLI มาไล่คิว Drive (ไม่บล็อก request) — คืน false ถ้า server ปิด exec() */
function gdrive_spawn_worker(): bool {
    if (!function_exists('exec')) return false;
    $disabled = array_map('trim', explode(',', strtolower((string)ini_get('disable_functions'))));
    if (in_array('exec', $disabled, true)) return false;
    $cmd = 'nohup php ' . escapeshellarg(__DIR__ . '/../cron/drive.php') . ' > /dev/null 2>&1 &';
    exec($cmd, $_out, $code);
    return $code === 0;
}

/** อัปโหลดงานค้างทีละไม่เกิน $limit รายการ — รันหลังส่ง response แล้วเท่านั้น */
function gdrive_process_queue(int $limit = 3): void {
    if (!gdrive_configured()) return;
    save_setting('gdrive_last_run', (string)time());
    set_time_limit(90);

    $rows = db()->query("SELECT * FROM drive_queue WHERE status = 'pending' ORDER BY id LIMIT " . (int)$limit)->fetchAll();
    foreach ($rows as $r) {
        $abs = UPLOAD_DIR . '/' . $r['local_path'];
        if (!is_file($abs)) {
            db()->prepare("UPDATE drive_queue SET status = 'error', last_error = 'ไฟล์ต้นทางหายจาก Volume' WHERE id = ?")
                ->execute([$r['id']]);
            continue;
        }
        try {
            gdrive_upload($abs, $r['fname'], gdrive_day_folder($r['work_date']));
            db()->prepare("UPDATE drive_queue SET status = 'done', done_at = NOW(), last_error = '' WHERE id = ?")
                ->execute([$r['id']]);
        } catch (Throwable $e) {
            error_log('[FireCheck Drive] queue #' . $r['id'] . ': ' . $e->getMessage());
            db()->prepare("UPDATE drive_queue SET tries = tries + 1, last_error = ?,
                           status = IF(tries >= 30, 'error', 'pending') WHERE id = ?")
                ->execute([mb_substr($e->getMessage(), 0, 255), $r['id']]);
        }
    }
}

// ---------- OAuth (เชื่อมบัญชี Google ของแอดมิน — ทำครั้งเดียว) ----------

/** redirect URI ของ instance นี้ (ต้องตรงกับที่ลงทะเบียนใน Google Cloud Console เป๊ะ) */
function gdrive_redirect_uri(): string {
    $https = ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' || ($_SERVER['HTTPS'] ?? '') === 'on';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/oauth.php';
}

/** สร้างลิงก์หน้าอนุญาต Google ให้แอดมินกด */
function h_gdrive_auth_url(): never {
    require_admin();
    if (setting('gdrive_client_id') === '' || setting('gdrive_client_secret') === '') {
        fail('กรุณากรอก Client ID และ Client Secret แล้วกดบันทึกก่อน');
    }
    $state = bin2hex(random_bytes(16));
    save_setting('gdrive_oauth_state', $state . '|' . time());
    $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id'     => setting('gdrive_client_id'),
        'redirect_uri'  => gdrive_redirect_uri(),
        'response_type' => 'code',
        'scope'         => 'https://www.googleapis.com/auth/drive.file',
        'access_type'   => 'offline',
        'prompt'        => 'consent',   // บังคับให้ได้ refresh token ทุกครั้ง
        'state'         => $state,
    ]);
    ok(['url' => $url, 'redirect_uri' => gdrive_redirect_uri()]);
}

/** สถานะการเชื่อมต่อ + คิวค้าง (การ์ด Drive ในหน้าตั้งค่า) */
function h_gdrive_status(): never {
    require_admin();
    $q = db()->query("SELECT
            SUM(status = 'pending') pending, SUM(status = 'done') done, SUM(status = 'error') err
        FROM drive_queue")->fetch();
    $lastErr = db()->query("SELECT last_error FROM drive_queue
                            WHERE last_error != '' ORDER BY id DESC LIMIT 1")->fetch();
    ok([
        'connected'    => gdrive_configured(),
        'root_id'      => setting('gdrive_root_id'),
        'root_name'    => GDRIVE_ROOT_NAME,
        'redirect_uri' => gdrive_redirect_uri(),
        'pending'      => (int)($q['pending'] ?? 0),
        'done'         => (int)($q['done'] ?? 0),
        'error'        => (int)($q['err'] ?? 0),
        'last_error'   => $lastErr['last_error'] ?? '',
    ]);
}

/** ทดสอบการเชื่อมต่อ: สร้าง/หาโฟลเดอร์วันนี้ + ไล่คิวค้างทันที */
function h_gdrive_test(): never {
    require_admin();
    if (!gdrive_configured()) fail('ยังไม่ได้เชื่อมต่อ Google Drive');
    try {
        $folderId = gdrive_day_folder(date('Y-m-d'));
    } catch (Throwable $e) {
        fail('เชื่อมต่อไม่สำเร็จ: ' . $e->getMessage());
    }
    gdrive_process_queue(5);
    $pending = db()->query("SELECT COUNT(*) c FROM drive_queue WHERE status = 'pending'")->fetch()['c'];
    ok([
        'message'   => 'เชื่อมต่อ Google Drive ใช้งานได้ ✓',
        'folder_id' => $folderId,
        'root_url'  => 'https://drive.google.com/drive/folders/' . setting('gdrive_root_id'),
        'pending'   => (int)$pending,
    ]);
}

/** ยกเลิกการเชื่อมต่อ (เผื่อเชื่อมผิดบัญชี) — ไม่ลบไฟล์ที่อัปโหลดไปแล้ว */
function h_gdrive_disconnect(): never {
    require_admin();
    foreach (['gdrive_refresh_token', 'gdrive_access_token', 'gdrive_access_exp',
              'gdrive_root_id', 'gdrive_day_cache', 'gdrive_oauth_state'] as $k) save_setting($k, '');
    ok(['message' => 'ยกเลิกการเชื่อมต่อแล้ว']);
}
