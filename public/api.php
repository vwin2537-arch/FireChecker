<?php
// =====================================================
// FireCheck — API Router
// เรียกแบบ: POST /api.php?action=xxx  (body = JSON)
// auth ผ่าน header X-Auth-Token
// =====================================================

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/auth.php';
require_once __DIR__ . '/../app/handlers/auth_handlers.php';
require_once __DIR__ . '/../app/handlers/attendance.php';
require_once __DIR__ . '/../app/handlers/dayoffs.php';
require_once __DIR__ . '/../app/handlers/admin.php';
require_once __DIR__ . '/../app/handlers/line.php';
require_once __DIR__ . '/../app/handlers/library.php';
require_once __DIR__ . '/../app/handlers/quiz.php';

const ACTIONS = [
    // auth
    'login'           => 'h_login',
    'logout'          => 'h_logout',
    'me'              => 'h_me',
    'register_list'   => 'h_register_list',
    'register'        => 'h_register',
    'change_password' => 'h_change_password',
    // staff
    'app_data'        => 'h_app_data',
    'checkin'         => 'h_checkin',
    'checkout'        => 'h_checkout',
    'my_history'      => 'h_my_history',
    'dayoff_add'      => 'h_dayoff_add',
    'dayoff_cancel'   => 'h_dayoff_cancel',
    'dayoff_month'    => 'h_dayoff_month',
    // admin
    'admin_data'      => 'h_admin_data',
    'users_list'      => 'h_users_list',
    'user_add'        => 'h_user_add',
    'user_approve'    => 'h_user_approve',
    'user_reject'     => 'h_user_reject',
    'user_disable'    => 'h_user_disable',
    'user_enable'     => 'h_user_enable',
    'user_reset'      => 'h_user_reset',
    'report_range'    => 'h_report_range',
    'settings_get'    => 'h_settings_get',
    'settings_save'   => 'h_settings_save',
    'dayoff_admin_add'=> 'h_dayoff_admin_add',
    'dayoff_admin_del'=> 'h_dayoff_admin_del',
    // คลังความรู้ (staff)
    'library_list'    => 'h_library_list',
    'library_view'    => 'h_library_view',
    'library_ack'     => 'h_library_ack',
    // คลังความรู้ (admin)
    'library_admin_list' => 'h_library_admin_list',
    'library_save'    => 'h_library_save',
    'library_delete'  => 'h_library_delete',
    // แบบทดสอบ (staff)
    'quiz_list'       => 'h_quiz_list',
    'quiz_get'        => 'h_quiz_get',
    'quiz_submit'     => 'h_quiz_submit',
    // แบบทดสอบ (admin)
    'quiz_admin_list'   => 'h_quiz_admin_list',
    'quiz_set_get'      => 'h_quiz_set_get',
    'quiz_admin_scores' => 'h_quiz_admin_scores',
    'quiz_save'         => 'h_quiz_save',
    'quiz_delete'       => 'h_quiz_delete',
    // cron (LINE Bot)
    'cron_report'     => 'h_cron_report',
];

try {
    ensure_admin();
    $action = $_GET['action'] ?? '';
    $fn = ACTIONS[$action] ?? null;
    if (!$fn) fail('ไม่รู้จักคำสั่ง: ' . $action, 404);
    $fn();
} catch (PDOException $e) {
    error_log('[FireCheck DB] ' . $e->getMessage());
    fail('ฐานข้อมูลขัดข้อง กรุณาลองใหม่', 500);
} catch (Throwable $e) {
    error_log('[FireCheck] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail('ระบบขัดข้อง กรุณาลองใหม่', 500);
}
