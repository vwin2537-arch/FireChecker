<?php
// =====================================================
// FireCheck — Token authentication
// token เก็บใน DB (รอด redeploy) — frontend เก็บใน localStorage
// ส่งมากับ header X-Auth-Token
// =====================================================

function auth_token(): ?string {
    $t = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? param('token');
    return (is_string($t) && preg_match('/^[a-f0-9]{64}$/', $t)) ? $t : null;
}

/** คืน user ปัจจุบัน หรือ null */
function current_user(): ?array {
    static $user = false;
    if ($user !== false) return $user;
    $user = null;
    $token = auth_token();
    if ($token) {
        $st = db()->prepare(
            "SELECT u.* FROM auth_tokens t
             JOIN users u ON u.id = t.user_id
             WHERE t.token = ? AND u.status = 'active'
               AND t.created_at > DATE_SUB(NOW(), INTERVAL 90 DAY)");
        $st->execute([$token]);
        $user = $st->fetch() ?: null;
        if ($user) {
            db()->prepare('UPDATE auth_tokens SET last_used_at = NOW() WHERE token = ?')->execute([$token]);
        }
    }
    return $user;
}

/** บังคับ login — คืน user หรือตอบ 401 */
function require_user(): array {
    $u = current_user();
    if (!$u) fail('กรุณาเข้าสู่ระบบใหม่', 401);
    return $u;
}

/** บังคับ role admin */
function require_admin(): array {
    $u = require_user();
    if ($u['role'] !== 'admin') fail('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
    return $u;
}

function issue_token(int $userId): string {
    $token = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)')->execute([$token, $userId]);
    // เก็บกวาด token เก่าเกิน 90 วัน
    db()->exec("DELETE FROM auth_tokens WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
    return $token;
}

/** ข้อมูล user ที่ปลอดภัยจะส่งให้ frontend */
function public_user(array $u): array {
    return [
        'id'       => (int)$u['id'],
        'username' => $u['username'],
        'name'     => $u['name'],
        'position' => $u['position'],
        'role'     => $u['role'],
        'status'   => $u['status'],
    ];
}
