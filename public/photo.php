<?php
// =====================================================
// FireCheck — เสิร์ฟรูปจาก UPLOAD_DIR (อาจอยู่นอก public เช่น Railway Volume)
// ใช้: /photo.php?p=2026-07/selfie_xxx.jpg&token=xxx  (ต้อง login)
// =====================================================

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/auth.php';

if (!current_user()) { http_response_code(401); exit('unauthorized'); }

$p = (string)($_GET['p'] ?? '');
// อนุญาตเฉพาะรูปแบบ path ที่ระบบสร้างเอง กัน path traversal
if (!preg_match('#^\d{4}-\d{2}/[a-zA-Z0-9_.-]+\.(jpg|png|webp)$#', $p)) { http_response_code(400); exit('bad path'); }

$file = UPLOAD_DIR . '/' . $p;
if (!is_file($file)) { http_response_code(404); exit('not found'); }

$mime = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][pathinfo($file, PATHINFO_EXTENSION)];
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($file));
header('Cache-Control: private, max-age=86400');
readfile($file);
