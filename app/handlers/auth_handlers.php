<?php
// =====================================================
// FireCheck — Auth handlers
// =====================================================

function h_login(): never {
    $username = trim((string)param('username'));
    $password = (string)param('password');
    if ($username === '' || $password === '') fail('กรอกชื่อผู้ใช้และรหัสผ่าน');

    $st = db()->prepare('SELECT * FROM users WHERE username = ?');
    $st->execute([$username]);
    $u = $st->fetch();

    if (!$u || !$u['password_hash'] || !password_verify($password, $u['password_hash'])) {
        fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    }
    if ($u['status'] === 'pending')  fail('บัญชีรอผู้ดูแลระบบอนุมัติ', 403);
    if ($u['status'] !== 'active')   fail('บัญชีนี้ถูกปิดใช้งาน', 403);

    ok(['token' => issue_token((int)$u['id']), 'user' => public_user($u)]);
}

function h_logout(): never {
    $t = auth_token();
    if ($t) db()->prepare('DELETE FROM auth_tokens WHERE token = ?')->execute([$t]);
    ok();
}

function h_me(): never {
    ok(['user' => public_user(require_user())]);
}

/** รายชื่อที่แอดมินเพิ่มไว้แต่ยังไม่ตั้งรหัสผ่าน — สำหรับหน้าลงทะเบียน (public) */
function h_register_list(): never {
    $rows = db()->query("SELECT id, name, position FROM users WHERE status = 'unregistered' ORDER BY name")->fetchAll();
    ok(['users' => $rows]);
}

function h_register(): never {
    $userId   = (int)param('user_id');
    $username = trim((string)param('username'));
    $password = (string)param('password');
    if (!preg_match('/^[a-zA-Z0-9_.-]{3,30}$/', $username)) fail('ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ - ยาว 3-30 ตัว');
    if (mb_strlen($password) < 6) fail('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');

    $st = db()->prepare("SELECT id FROM users WHERE id = ? AND status = 'unregistered'");
    $st->execute([$userId]);
    if (!$st->fetch()) fail('ไม่พบบัญชีนี้ หรือลงทะเบียนไปแล้ว');

    // เช็คชื่อผู้ใช้ซ้ำ (ยกเว้นตัวเอง) — pre-check + catch 23000 กัน race
    $st = db()->prepare('SELECT id FROM users WHERE username = ? AND id <> ?');
    $st->execute([$username, $userId]);
    if ($st->fetch()) fail('ชื่อผู้ใช้นี้มีคนใช้แล้ว ลองตั้งชื่ออื่น');

    // ลงทะเบียนเสร็จใช้ได้เลย ไม่ต้องรออนุมัติ (status = active)
    try {
        db()->prepare("UPDATE users SET username = ?, password_hash = ?, status = 'active' WHERE id = ?")
            ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $userId]);
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') === '23000') fail('ชื่อผู้ใช้นี้มีคนใช้แล้ว ลองตั้งชื่ออื่น');
        throw $e;
    }
    ok(['message' => 'ลงทะเบียนเรียบร้อย เข้าใช้งานได้เลย']);
}

function h_change_password(): never {
    $u = require_user();
    $old = (string)param('old_password');
    $new = (string)param('new_password');
    if (mb_strlen($new) < 6) fail('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร');
    if (!password_verify($old, $u['password_hash'])) fail('รหัสผ่านเดิมไม่ถูกต้อง');

    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
    ok(['message' => 'เปลี่ยนรหัสผ่านแล้ว']);
}
