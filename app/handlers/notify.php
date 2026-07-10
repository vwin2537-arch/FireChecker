<?php
// =====================================================
// FireCheck — Mailbox / กล่องข้อความเจ้าหน้าที่ (notifications)
// 1 แถว/คน/ข้อความ · read_at NULL = ยังไม่อ่าน (จุดแดง) · เปิดกล่อง = อ่านหมด
// =====================================================

/** ส่งข้อความเข้ากล่องของคนเดียว */
function notify_push(int $userId, string $type, string $title, string $body = '', ?int $refId = null): void {
    db()->prepare('INSERT INTO notifications (user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?)')
        ->execute([$userId, $type, mb_substr($title, 0, 150), $body, $refId]);
}

/** ประกาศถึงเจ้าหน้าที่ active ทุกคน (broadcast = fan-out หลายแถว) → คืนจำนวนคนที่ส่งถึง */
function notify_broadcast(string $type, string $title, string $body = ''): int {
    $ids = db()->query("SELECT id FROM users WHERE role = 'staff' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
    $ins = db()->prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)');
    $title = mb_substr($title, 0, 150);
    foreach ($ids as $id) $ins->execute([(int)$id, $type, $title, $body]);
    return count($ids);
}

/** จำนวนข้อความยังไม่อ่าน (สำหรับจุดแดง) */
function notify_unread_count(int $userId): int {
    $st = db()->prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL');
    $st->execute([$userId]);
    return (int)$st->fetch()['c'];
}

/** เปิดกล่อง: คืนรายการล่าสุด (พร้อม flag is_new) แล้ว mark อ่านหมด → จุดแดงหาย */
function h_notify_list(): never {
    $u = require_user();
    $st = db()->prepare('SELECT id, type, title, body, created_at, read_at FROM notifications
                         WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50');
    $st->execute([$u['id']]);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) { $r['is_new'] = $r['read_at'] === null; unset($r['read_at']); }
    unset($r);
    // อ่านค่า is_new เสร็จแล้วค่อย mark (ต้องหลัง fetch เสมอ ไม่งั้น is_new เพี้ยน)
    db()->prepare('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL')->execute([$u['id']]);
    ok(['items' => $rows]);
}

/** หัวหน้าประกาศถึงเจ้าหน้าที่ทุกคน */
function h_announce_send(): never {
    require_admin();
    $title = trim((string)param('title', ''));
    $body  = mb_substr(trim((string)param('body', '')), 0, 2000);
    if ($title === '') fail('กรุณากรอกหัวข้อประกาศ');
    $n = notify_broadcast('announcement', $title, $body);
    ok(['message' => "ส่งประกาศเข้ากล่องข้อความเจ้าหน้าที่ {$n} คนแล้ว", 'count' => $n]);
}
