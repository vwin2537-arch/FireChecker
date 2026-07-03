<?php
// =====================================================
// FireCheck — Google OAuth callback (เชื่อม Google Drive ครั้งเดียวโดยแอดมิน)
// Google redirect มาที่นี่พร้อม ?code=&state= — ตรวจ state แล้วแลก code เป็น refresh token
// หน้านี้ไม่มี auth header (มาจาก browser redirect) จึงพึ่ง state ที่ h_gdrive_auth_url สร้างไว้
// =====================================================

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/drive.php';

function oauth_page(string $title, string $detail, bool $okFlag): never {
    http_response_code($okFlag ? 200 : 400);
    header('Content-Type: text/html; charset=utf-8');
    $ico = $okFlag ? '✅' : '❌';
    echo "<!DOCTYPE html><html lang=\"th\"><head><meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>FireCheck — Google Drive</title></head>
<body style=\"font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;text-align:center\">
<div><div style=\"font-size:56px\">{$ico}</div><h2>" . htmlspecialchars($title) . "</h2>
<p style=\"color:#555\">" . htmlspecialchars($detail) . "</p>
<p><a href=\"index.php\">← กลับเข้าแอป FireCheck</a></p></div></body></html>";
    exit;
}

try {
    if (isset($_GET['error'])) oauth_page('การเชื่อมต่อถูกยกเลิก', (string)$_GET['error'], false);

    $code  = (string)($_GET['code'] ?? '');
    $state = (string)($_GET['state'] ?? '');
    if ($code === '' || $state === '') oauth_page('ลิงก์ไม่ถูกต้อง', 'ไม่มี code/state ใน URL', false);

    // ตรวจ state ต้องตรงกับที่แอดมินขอไว้ และไม่เก่ากว่า 10 นาที (กัน CSRF)
    [$saved, $ts] = explode('|', setting('gdrive_oauth_state') . '|0');
    if ($saved === '' || !hash_equals($saved, $state) || time() - (int)$ts > 600) {
        oauth_page('ลิงก์หมดอายุ', 'กรุณากดปุ่ม "เชื่อมต่อ Google Drive" ในหน้าตั้งค่าใหม่อีกครั้ง', false);
    }
    save_setting('gdrive_oauth_state', '');

    [$http, $d] = gdrive_http('POST', 'https://oauth2.googleapis.com/token',
        ['Content-Type: application/x-www-form-urlencoded'],
        http_build_query([
            'client_id'     => setting('gdrive_client_id'),
            'client_secret' => setting('gdrive_client_secret'),
            'code'          => $code,
            'redirect_uri'  => gdrive_redirect_uri(),
            'grant_type'    => 'authorization_code',
        ]));
    if ($http !== 200 || empty($d['refresh_token'])) {
        oauth_page('แลก token ไม่สำเร็จ',
            ($d['error_description'] ?? $d['error'] ?? "HTTP {$http}") .
            (empty($d['refresh_token']) && $http === 200 ? ' (ไม่ได้ refresh token — ลองกดเชื่อมต่อใหม่)' : ''), false);
    }

    save_setting('gdrive_refresh_token', $d['refresh_token']);
    save_setting('gdrive_access_token', $d['access_token'] ?? '');
    save_setting('gdrive_access_exp', (string)(time() + (int)($d['expires_in'] ?? 3600) - 60));

    // สร้างโฟลเดอร์รากทันที จะได้เห็นใน Drive เลย
    $rootId = gdrive_root_folder();
    oauth_page('เชื่อมต่อ Google Drive สำเร็จ',
        'ระบบสร้างโฟลเดอร์ "' . GDRIVE_ROOT_NAME . '" ใน My Drive แล้ว — รูปเช็คชื่อจะทยอยเข้าโฟลเดอร์นี้', true);
} catch (Throwable $e) {
    error_log('[FireCheck OAuth] ' . $e->getMessage());
    oauth_page('ระบบขัดข้อง', $e->getMessage(), false);
}
