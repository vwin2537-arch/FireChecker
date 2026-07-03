<?php
// =====================================================
// FireCheck — แบบทดสอบ (โซนพัฒนาตัวเอง เฟส 2)
// แอดมินสร้างชุดคำถามหลายตัวเลือก — เจ้าหน้าที่ทำได้ไม่จำกัดครั้ง เห็นแค่คะแนนสรุปท้าย
// ไม่ผูกกับเอกสารในคลังความรู้
// =====================================================

/** ตรวจ + normalize คำถามหนึ่งชุดจาก input แอดมิน — คืน [question, choice1..4, correct_index] หรือ fail */
function quiz_validate_question(array $q): array {
    $text = mb_substr(trim((string)($q['question'] ?? '')), 0, 500);
    if ($text === '') fail('กรุณากรอกคำถามให้ครบทุกข้อ');

    $choices = array_map(fn($c) => mb_substr(trim((string)$c), 0, 255), (array)($q['choices'] ?? []));
    if (count($choices) !== 4 || in_array('', $choices, true)) fail('กรุณากรอกตัวเลือกให้ครบ 4 ข้อในทุกคำถาม');

    $correct = (int)($q['correct'] ?? -1);
    if ($correct < 0 || $correct > 3) fail('กรุณาเลือกข้อที่ถูกในทุกคำถาม');

    return [$text, ...$choices, $correct];
}

// ---------- ฝั่งเจ้าหน้าที่ ----------

/** รายการชุดคำถามที่เปิดใช้งาน + คะแนนสูงสุด/จำนวนครั้งที่ user นี้เคยทำ */
function h_quiz_list(): never {
    $u = require_user();
    $st = db()->prepare(
        'SELECT s.id, s.title, s.description, s.created_at,
                (SELECT COUNT(*) FROM quiz_questions q WHERE q.set_id = s.id) question_count,
                (SELECT MAX(score) FROM quiz_attempts a WHERE a.set_id = s.id AND a.user_id = ?) best_score,
                (SELECT COUNT(*) FROM quiz_attempts a WHERE a.set_id = s.id AND a.user_id = ?) attempts
         FROM quiz_sets s
         WHERE s.is_active = 1
         ORDER BY s.created_at DESC, s.id DESC');
    $st->execute([$u['id'], $u['id']]);
    ok(['sets' => $st->fetchAll()]);
}

/** โจทย์ของชุดคำถาม (ไม่ส่ง correct_index ไปฝั่ง client) */
function h_quiz_get(): never {
    require_user();
    $id = (int)param('id');
    $st = db()->prepare('SELECT id, title, description FROM quiz_sets WHERE id = ? AND is_active = 1');
    $st->execute([$id]);
    $set = $st->fetch();
    if (!$set) fail('ไม่พบแบบทดสอบนี้');

    $st = db()->prepare('SELECT id, question, choice1, choice2, choice3, choice4
                         FROM quiz_questions WHERE set_id = ? ORDER BY sort_order, id');
    $st->execute([$id]);
    $questions = array_map(fn($q) => [
        'id'       => (int)$q['id'],
        'question' => $q['question'],
        'choices'  => [$q['choice1'], $q['choice2'], $q['choice3'], $q['choice4']],
    ], $st->fetchAll());
    if (!$questions) fail('ชุดนี้ยังไม่มีคำถาม');

    ok(['set' => $set, 'questions' => $questions]);
}

/** ส่งคำตอบ + บันทึกผล — คืนคะแนนสรุปท้าย */
function h_quiz_submit(): never {
    $u = require_user();
    $setId = (int)param('id');
    $st = db()->prepare('SELECT id FROM quiz_sets WHERE id = ? AND is_active = 1');
    $st->execute([$setId]);
    if (!$st->fetch()) fail('ไม่พบแบบทดสอบนี้');

    $st = db()->prepare('SELECT id, correct_index FROM quiz_questions WHERE set_id = ?');
    $st->execute([$setId]);
    $correctBy = [];
    foreach ($st->fetchAll() as $q) $correctBy[(int)$q['id']] = (int)$q['correct_index'];
    $total = count($correctBy);
    if ($total === 0) fail('ชุดนี้ยังไม่มีคำถาม');

    $score = 0;
    foreach ((array)param('answers', []) as $a) {
        $qid = (int)($a['question_id'] ?? 0);
        $ans = (int)($a['answer_index'] ?? -1);
        if (isset($correctBy[$qid]) && $correctBy[$qid] === $ans) $score++;
    }

    db()->prepare('INSERT INTO quiz_attempts (set_id, user_id, score, total) VALUES (?, ?, ?, ?)')
        ->execute([$setId, $u['id'], $score, $total]);
    ok(['score' => $score, 'total' => $total]);
}

// ---------- ฝั่งแอดมิน ----------

/** รายการชุดคำถามทั้งหมด (รวมที่ซ่อน) + จำนวนคำถาม/คนที่เคยทำ */
function h_quiz_admin_list(): never {
    require_admin();
    $st = db()->query(
        'SELECT s.*,
                (SELECT COUNT(*) FROM quiz_questions q WHERE q.set_id = s.id) question_count,
                (SELECT COUNT(DISTINCT user_id) FROM quiz_attempts a WHERE a.set_id = s.id) participants
         FROM quiz_sets s
         ORDER BY s.is_active DESC, s.created_at DESC, s.id DESC');
    ok(['sets' => $st->fetchAll()]);
}

/** ชุดคำถามพร้อมโจทย์เต็ม (รวม correct_index) สำหรับหน้าแก้ไข */
function h_quiz_set_get(): never {
    require_admin();
    $id = (int)param('id');
    $st = db()->prepare('SELECT * FROM quiz_sets WHERE id = ?');
    $st->execute([$id]);
    $set = $st->fetch();
    if (!$set) fail('ไม่พบชุดคำถามนี้');

    $st = db()->prepare('SELECT id, question, choice1, choice2, choice3, choice4, correct_index
                         FROM quiz_questions WHERE set_id = ? ORDER BY sort_order, id');
    $st->execute([$id]);
    $questions = array_map(fn($q) => [
        'question' => $q['question'],
        'choices'  => [$q['choice1'], $q['choice2'], $q['choice3'], $q['choice4']],
        'correct'  => (int)$q['correct_index'],
    ], $st->fetchAll());

    ok(['set' => $set, 'questions' => $questions]);
}

/** คะแนนของเจ้าหน้าที่ทุกคน (active) สำหรับชุดคำถามหนึ่งชุด */
function h_quiz_admin_scores(): never {
    require_admin();
    $id = (int)param('id');
    $st = db()->prepare('SELECT title FROM quiz_sets WHERE id = ?');
    $st->execute([$id]);
    $set = $st->fetch();
    if (!$set) fail('ไม่พบชุดคำถามนี้');

    $st = db()->prepare('SELECT COUNT(*) c FROM quiz_questions WHERE set_id = ?');
    $st->execute([$id]);
    $total = (int)$st->fetch()['c'];

    $st = db()->prepare(
        'SELECT u.id, u.name,
                (SELECT MAX(score) FROM quiz_attempts a WHERE a.set_id = ? AND a.user_id = u.id) best_score,
                (SELECT COUNT(*) FROM quiz_attempts a WHERE a.set_id = ? AND a.user_id = u.id) attempts
         FROM users u
         WHERE u.role = "staff" AND u.status = "active"
         ORDER BY u.name');
    $st->execute([$id, $id]);
    ok(['title' => $set['title'], 'total' => $total, 'rows' => $st->fetchAll()]);
}

/** เพิ่ม (ไม่มี id) หรือแก้ไข (มี id) ชุดคำถาม — แทนที่คำถามทั้งชุดทุกครั้งที่บันทึก */
function h_quiz_save(): never {
    require_admin();
    $title = mb_substr(trim((string)param('title', '')), 0, 200);
    if ($title === '') fail('กรุณากรอกชื่อชุดคำถาม');
    $description = mb_substr(trim((string)param('description', '')), 0, 500);

    $questionsIn = (array)param('questions', []);
    if (!$questionsIn) fail('กรุณาเพิ่มอย่างน้อย 1 คำถาม');
    $rows = array_map('quiz_validate_question', $questionsIn);

    $id = (int)param('id', 0);
    if ($id > 0) {
        $st = db()->prepare('SELECT id FROM quiz_sets WHERE id = ?');
        $st->execute([$id]);
        if (!$st->fetch()) fail('ไม่พบชุดคำถามนี้');
        db()->prepare('UPDATE quiz_sets SET title = ?, description = ? WHERE id = ?')
            ->execute([$title, $description, $id]);
        db()->prepare('DELETE FROM quiz_questions WHERE set_id = ?')->execute([$id]);
    } else {
        db()->prepare('INSERT INTO quiz_sets (title, description) VALUES (?, ?)')->execute([$title, $description]);
        $id = (int)db()->lastInsertId();
    }

    $st = db()->prepare('INSERT INTO quiz_questions (set_id, question, choice1, choice2, choice3, choice4, correct_index, sort_order)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $i => [$q, $c1, $c2, $c3, $c4, $correct]) $st->execute([$id, $q, $c1, $c2, $c3, $c4, $correct, $i]);

    ok(['message' => 'บันทึกชุดคำถามแล้ว', 'id' => $id]);
}

/** ซ่อน/แสดงชุดคำถาม (soft delete — เก็บประวัติคะแนนไว้; active=1 = กู้คืน) */
function h_quiz_delete(): never {
    require_admin();
    $active = (int)param('active', 0) === 1 ? 1 : 0;
    db()->prepare('UPDATE quiz_sets SET is_active = ? WHERE id = ?')->execute([$active, (int)param('id')]);
    ok(['message' => $active ? 'แสดงชุดคำถามอีกครั้งแล้ว' : 'ซ่อนชุดคำถามแล้ว']);
}
