<?php
// =====================================================
// FireCheck — Helper functions
// =====================================================

/** ส่ง JSON response แล้วจบ request */
function json_out(array $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function ok(array $data = []): never {
    json_out(['ok' => true] + $data);
}

function fail(string $message, int $code = 400): never {
    json_out(['ok' => false, 'error' => $message], $code);
}

/** อ่าน JSON body ของ request */
function body(): array {
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        $b = $raw ? (json_decode($raw, true) ?: []) : [];
    }
    return $b;
}

function param(string $key, $default = null) {
    return body()[$key] ?? $_POST[$key] ?? $_GET[$key] ?? $default;
}

/** ระยะทางเมตรระหว่างพิกัด 2 จุด (Haversine) */
function distance_m(float $lat1, float $lng1, float $lat2, float $lng2): int {
    $r = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return (int)round($r * 2 * atan2(sqrt($a), sqrt(1 - $a)));
}

/** 'HH:MM' → นาทีตั้งแต่เที่ยงคืน */
function hm_to_min(string $hm): int {
    [$h, $m] = array_map('intval', explode(':', $hm));
    return $h * 60 + $m;
}

/** นาทีปัจจุบันของวัน (เวลาไทย) */
function now_min(): int {
    return (int)date('G') * 60 + (int)date('i');
}

const THAI_DAYS   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const THAI_MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

/** '2026-07-02' → 'พฤหัสบดี 2 ก.ค. 2569' */
function thai_date(string $ymd, bool $withDay = true): string {
    $t = strtotime($ymd);
    if ($t === false) return $ymd;
    $s = (int)date('j', $t) . ' ' . THAI_MONTHS[(int)date('n', $t)] . ' ' . ((int)date('Y', $t) + 543);
    return $withDay ? THAI_DAYS[(int)date('w', $t)] . ' ' . $s : $s;
}

/** วันอาทิตย์ + เปิดใช้ sunday_off → วันหยุดสถานี */
function is_station_holiday(string $ymd): bool {
    return setting('sunday_off', '1') === '1' && date('w', strtotime($ymd)) === '0';
}

/** เซฟรูป base64 (data URI) ลง UPLOAD_DIR/{yyyy-mm}/ คืน path สัมพัทธ์ หรือ null ถ้าไม่สำเร็จ */
function save_photo(string $dataUri, string $prefix): ?string {
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,(.+)$#', $dataUri, $m)) return null;
    $bin = base64_decode($m[2], true);
    if ($bin === false || strlen($bin) < 100 || strlen($bin) > 8 * 1024 * 1024) return null;
    $sub = date('Y-m');
    $dir = UPLOAD_DIR . '/' . $sub;
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) return null;
    $ext  = $m[1] === 'jpeg' ? 'jpg' : $m[1];
    $name = $prefix . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    return file_put_contents($dir . '/' . $name, $bin) !== false ? $sub . '/' . $name : null;
}
