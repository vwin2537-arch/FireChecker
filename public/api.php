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
require_once __DIR__ . '/../app/handlers/health.php';
require_once __DIR__ . '/../app/handlers/vaccine.php';
require_once __DIR__ . '/../app/handlers/training.php';
require_once __DIR__ . '/../app/handlers/notify.php';
require_once __DIR__ . '/../app/handlers/face.php';
require_once __DIR__ . '/../app/push.php';
require_once __DIR__ . '/../app/handlers/push.php';
require_once __DIR__ . '/../app/drive.php';

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
    'night_checkin'   => 'h_night_checkin',
    'checkout'        => 'h_checkout',
    'my_history'      => 'h_my_history',
    'face_verify'     => 'h_face_verify',
    'dayoff_add'      => 'h_dayoff_add',
    'dayoff_cancel'   => 'h_dayoff_cancel',
    'dayoff_month'    => 'h_dayoff_month',
    // admin
    'admin_data'      => 'h_admin_data',
    'users_list'      => 'h_users_list',
    'user_add'        => 'h_user_add',
    'user_set_gender' => 'h_user_set_gender',
    'user_set_birthdate' => 'h_user_set_birthdate',
    'user_approve'    => 'h_user_approve',
    'user_reject'     => 'h_user_reject',
    'user_disable'    => 'h_user_disable',
    'user_enable'     => 'h_user_enable',
    'user_reset'      => 'h_user_reset',
    'report_range'    => 'h_report_range',
    'report_month'    => 'h_report_month',
    'settings_get'    => 'h_settings_get',
    'settings_save'   => 'h_settings_save',
    'dayoff_admin_add'=> 'h_dayoff_admin_add',
    'dayoff_admin_del'=> 'h_dayoff_admin_del',
    'offsite_list'    => 'h_offsite_list',
    'offsite_add'     => 'h_offsite_add',
    'offsite_del'     => 'h_offsite_del',
    'offsite_user_list' => 'h_offsite_user_list',
    'offsite_user_add'  => 'h_offsite_user_add',
    'offsite_user_del'  => 'h_offsite_user_del',
    'proxy_checkin'   => 'h_proxy_checkin',
    'proxy_list'      => 'h_proxy_list',
    'proxy_del'       => 'h_proxy_del',
    'holiday_list'    => 'h_holiday_list',
    'holiday_add'     => 'h_holiday_add',
    'holiday_del'     => 'h_holiday_del',
    'leave_pending'   => 'h_leave_pending',
    'leave_approve'   => 'h_leave_approve',
    'leave_reject'    => 'h_leave_reject',
    'face_enroll_save'   => 'h_face_enroll_save',
    'face_enroll_clear'  => 'h_face_enroll_clear',
    'face_enroll_status' => 'h_face_enroll_status',
    'night_roster'    => 'h_night_roster',
    'night_month'     => 'h_night_month',

    'notify_list'     => 'h_notify_list',
    'announce_send'   => 'h_announce_send',
    // แจ้งเตือน Web Push (v37)
    'device_report'   => 'h_device_report',
    'push_subscribe'  => 'h_push_subscribe',
    'push_unsubscribe'=> 'h_push_unsubscribe',
    'push_vapid_gen'  => 'h_push_vapid_gen',
    'push_test'       => 'h_push_test',
    'device_summary'  => 'h_device_summary',
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
    // สุขภาพ (staff)
    'health_my'          => 'h_health_my',
    'fitness_my'         => 'h_fitness_my',
    'vaccine_my'         => 'h_vaccine_my',
    // ประวัติการฝึกอบรม (staff)
    'training_my'        => 'h_training_my',
    // สุขภาพ (admin)
    'health_dashboard'   => 'h_health_dashboard',
    'health_admin_list'  => 'h_health_admin_list',
    'health_admin_add'   => 'h_health_admin_add',
    'health_admin_del'   => 'h_health_admin_del',
    // ทดสอบสมรรถภาพ (admin)
    'fitness_items_admin' => 'h_fitness_items_admin',
    'fitness_item_save'   => 'h_fitness_item_save',
    'fitness_item_delete' => 'h_fitness_item_delete',
    'fitness_rounds_list' => 'h_fitness_rounds_list',
    'fitness_round_add'   => 'h_fitness_round_add',
    'fitness_round_del'   => 'h_fitness_round_del',
    'fitness_round_get'   => 'h_fitness_round_get',
    'fitness_result_save' => 'h_fitness_result_save',
    // การ์ดวัคซีน (admin)
    'vaccine_types_admin' => 'h_vaccine_types_admin',
    'vaccine_type_save'   => 'h_vaccine_type_save',
    'vaccine_type_delete' => 'h_vaccine_type_delete',
    'vaccine_overview'    => 'h_vaccine_overview',
    'vaccine_admin_list'  => 'h_vaccine_admin_list',
    'vaccine_admin_add'   => 'h_vaccine_admin_add',
    'vaccine_admin_del'   => 'h_vaccine_admin_del',
    // ประวัติการฝึกอบรม (admin)
    'training_list'           => 'h_training_list',
    'training_save'           => 'h_training_save',
    'training_del'            => 'h_training_del',
    'training_get'            => 'h_training_get',
    'training_attendees_save' => 'h_training_attendees_save',
    'training_person'         => 'h_training_person',
    'training_overview'       => 'h_training_overview',
    // Google Drive (admin)
    'gdrive_auth_url'   => 'h_gdrive_auth_url',
    'gdrive_status'     => 'h_gdrive_status',
    'gdrive_test'       => 'h_gdrive_test',
    'gdrive_disconnect' => 'h_gdrive_disconnect',
    // cron (LINE Bot)
    'cron_report'     => 'h_cron_report',
    'cron_push_remind'=> 'h_cron_push_remind',
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
