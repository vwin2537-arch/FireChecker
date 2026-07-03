<?php
// =====================================================
// FireCheck — คลังความรู้ (โซนพัฒนาตัวเอง เฟส 1)
// แอดมินเพิ่มลิงก์เอกสาร/สไลด์/ข่าว — เจ้าหน้าที่เปิดดู (log) + กดรับทราบ
// เก็บแค่ลิงก์ + file_id (ดึง thumbnail จาก Drive) ไม่เก็บไฟล์จริง
// =====================================================

const LIB_CATS = ['doc' => 'เอกสาร', 'slide' => 'สไลด์', 'news' => 'ข่าว', 'video' => 'วิดีโอ', 'manual' => 'คู่มือ'];

/** ดึง Google Drive/Docs file id จากลิงก์หลายรูปแบบ — ไม่เจอคืน '' */
function lib_extract_file_id(string $url): string {
    // .../d/<id>/...  (file, docs, presentation, spreadsheets)
    if (preg_match('#/d/([-\w]{20,})#', $url, $m)) return $m[1];
    // ...?id=<id> หรือ ...&id=<id>  (open?id=, uc?id=)
    if (preg_match('#[?&]id=([-\w]{20,})#', $url, $m)) return $m[1];
    return '';
}

/** ตรวจ + normalize input จากฟอร์มแอดมิน — คืน [title, category, url, description, file_id] หรือ fail */
function lib_validate_input(): array {
    $title = mb_substr(trim((string)param('title', '')), 0, 200);
    if ($title === '') fail('กรุณากรอกชื่อเอกสาร');

    $category = (string)param('category', 'doc');
    if (!isset(LIB_CATS[$category])) fail('หมวดหมู่ไม่ถูกต้อง');

    $url = trim((string)param('url', ''));
    if (!preg_match('#^https?://#i', $url)) fail('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
    $url = mb_substr($url, 0, 500);

    $description = mb_substr(trim((string)param('description', '')), 0, 500);

    return [$title, $category, $url, $description, lib_extract_file_id($url)];
}

// ---------- ฝั่งเจ้าหน้าที่ ----------

/** รายการคลังความรู้ที่เปิดใช้งาน + สถานะอ่าน/รับทราบของ user นี้ */
function h_library_list(): never {
    $u = require_user();
    $st = db()->prepare(
        'SELECT i.id, i.title, i.description, i.category, i.url, i.file_id, i.created_at,
                r.viewed_at, r.acked_at
         FROM library_items i
         LEFT JOIN library_reads r ON r.item_id = i.id AND r.user_id = ?
         WHERE i.is_active = 1
         ORDER BY i.created_at DESC, i.id DESC');
    $st->execute([$u['id']]);
    ok(['items' => $st->fetchAll(), 'cats' => LIB_CATS]);
}

/** บันทึกว่าเปิดดูเอกสาร (log อัตโนมัติ) */
function h_library_view(): never {
    $u  = require_user();
    $id = (int)param('id');
    $st = db()->prepare('SELECT id FROM library_items WHERE id = ? AND is_active = 1');
    $st->execute([$id]);
    if (!$st->fetch()) fail('ไม่พบเอกสารนี้');

    db()->prepare('INSERT INTO library_reads (item_id, user_id) VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE viewed_at = NOW()')
        ->execute([$id, $u['id']]);
    ok();
}

/** เจ้าหน้าที่กดยืนยัน "รับทราบ" เอกสาร */
function h_library_ack(): never {
    $u  = require_user();
    $id = (int)param('id');
    $st = db()->prepare('SELECT id FROM library_items WHERE id = ? AND is_active = 1');
    $st->execute([$id]);
    if (!$st->fetch()) fail('ไม่พบเอกสารนี้');

    db()->prepare('INSERT INTO library_reads (item_id, user_id, acked_at) VALUES (?, ?, NOW())
                   ON DUPLICATE KEY UPDATE acked_at = NOW()')
        ->execute([$id, $u['id']]);
    ok(['message' => 'รับทราบแล้ว ขอบคุณค่ะ']);
}

// ---------- ฝั่งแอดมิน ----------

/** รายการทั้งหมด (รวมที่ซ่อน) + สถิติการอ่าน/รับทราบ */
function h_library_admin_list(): never {
    require_admin();
    $st = db()->query(
        'SELECT i.*,
                (SELECT COUNT(*) FROM library_reads r WHERE r.item_id = i.id) views,
                (SELECT COUNT(*) FROM library_reads r WHERE r.item_id = i.id AND r.acked_at IS NOT NULL) acks
         FROM library_items i
         ORDER BY i.is_active DESC, i.created_at DESC, i.id DESC');
    $activeStaff = (int)db()->query("SELECT COUNT(*) c FROM users WHERE role='staff' AND status='active'")->fetch()['c'];
    ok(['items' => $st->fetchAll(), 'cats' => LIB_CATS, 'active_staff' => $activeStaff]);
}

/** เพิ่ม (ไม่มี id) หรือแก้ไข (มี id) เอกสาร */
function h_library_save(): never {
    require_admin();
    [$title, $category, $url, $description, $fileId] = lib_validate_input();
    $id = (int)param('id', 0);

    if ($id > 0) {
        $st = db()->prepare('UPDATE library_items SET title = ?, category = ?, url = ?, description = ?, file_id = ?
                             WHERE id = ?');
        $st->execute([$title, $category, $url, $description, $fileId, $id]);
        if (!$st->rowCount() && !db()->query("SELECT 1 FROM library_items WHERE id = $id")->fetch())
            fail('ไม่พบเอกสารนี้');
        ok(['message' => 'บันทึกการแก้ไขแล้ว']);
    }

    db()->prepare('INSERT INTO library_items (title, category, url, description, file_id) VALUES (?, ?, ?, ?, ?)')
        ->execute([$title, $category, $url, $description, $fileId]);
    ok(['message' => 'เพิ่มเอกสารแล้ว', 'id' => (int)db()->lastInsertId()]);
}

/** ซ่อน/แสดงเอกสาร (soft delete — เก็บประวัติการอ่านไว้; active=1 = กู้คืน) */
function h_library_delete(): never {
    require_admin();
    $active = (int)param('active', 0) === 1 ? 1 : 0;
    db()->prepare('UPDATE library_items SET is_active = ? WHERE id = ?')->execute([$active, (int)param('id')]);
    ok(['message' => $active ? 'แสดงเอกสารอีกครั้งแล้ว' : 'ซ่อนเอกสารแล้ว']);
}
