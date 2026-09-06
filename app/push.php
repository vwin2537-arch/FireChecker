<?php
// =====================================================
// FireCheck — Web Push (v37)
// ส่งแจ้งเตือนขึ้นหน้าจอมือถือแบบแอปจริง โดยไม่พึ่ง Firebase/composer
// มาตรฐาน: VAPID (RFC 8292) + payload เข้ารหัส aes128gcm (RFC 8291/8188)
// ใช้แค่ openssl + hash_hkdf ที่มากับ PHP — ไม่มี dependency ภายนอก
//
// ⚠️ อย่าเปลี่ยน vapid_public หลังเจ้าหน้าที่ subscribe แล้ว — subscription เดิมจะใช้ไม่ได้ทั้งหมด ต้องกดอนุญาตใหม่ทุกคน
// =====================================================

/** base64url encode (ไม่มี padding) — รูปแบบที่ Web Push ใช้ทุกจุด */
function b64u_enc(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function b64u_dec(string $txt): string {
    return (string)base64_decode(strtr($txt, '-_', '+/') . str_repeat('=', (4 - strlen($txt) % 4) % 4));
}

/**
 * สร้างกุญแจ VAPID คู่ใหม่ (ทำครั้งเดียวตอนตั้งค่า)
 * คืน ['public' => base64url ของจุด 65 ไบต์ (client ใช้เป็น applicationServerKey), 'private' => PEM (server ใช้เซ็น)]
 * เก็บ private เป็น PEM ตรงๆ จะได้ไม่ต้องประกอบ DER กลับตอนเซ็น
 */
function vapid_generate(): array {
    $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if ($key === false) throw new RuntimeException('สร้างกุญแจ VAPID ไม่สำเร็จ (openssl ไม่รองรับ prime256v1)');
    $d = openssl_pkey_get_details($key);
    openssl_pkey_export($key, $pem);
    // จุดบนเส้นโค้งแบบ uncompressed = 0x04 || X(32) || Y(32) — ต้อง pad ซ้ายให้ครบ 32 เสมอ (openssl ตัด 0 นำหน้าออก)
    $pub = "\x04" . str_pad($d['ec']['x'], 32, "\x00", STR_PAD_LEFT)
                  . str_pad($d['ec']['y'], 32, "\x00", STR_PAD_LEFT);
    return ['public' => b64u_enc($pub), 'private' => $pem];
}

/**
 * ประกอบ PEM public key จากจุดดิบ 65 ไบต์ (กุญแจของเบราว์เซอร์ที่ได้จาก subscription.p256dh)
 * prefix 26 ไบต์เป็นค่าคงที่ของ SubjectPublicKeyInfo สำหรับเส้น P-256 (id-ecPublicKey + prime256v1)
 */
function p256_pub_pem(string $raw65): string {
    if (strlen($raw65) !== 65 || $raw65[0] !== "\x04") {
        throw new RuntimeException('กุญแจ p256dh ของเบราว์เซอร์ผิดรูปแบบ');
    }
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw65;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/** openssl_sign คืนลายเซ็นเป็น DER (SEQUENCE{INTEGER r, INTEGER s}) แต่ JWT ES256 ต้องการ r||s ดิบ 64 ไบต์ */
function ecdsa_der_to_raw(string $der): string {
    $off = 0;
    if (($der[$off++] ?? '') !== "\x30") throw new RuntimeException('ลายเซ็น DER ผิดรูปแบบ');
    $len = ord($der[$off++]);
    if ($len & 0x80) $off += ($len & 0x7f);          // ข้ามความยาวแบบ long-form
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        if (($der[$off++] ?? '') !== "\x02") throw new RuntimeException('ลายเซ็น DER ผิดรูปแบบ');
        $l = ord($der[$off++]);
        $v = ltrim(substr($der, $off, $l), "\x00");   // ตัด 0 นำหน้าที่ DER ใส่กัน sign bit
        $off += $l;
        $out .= str_pad($v, 32, "\x00", STR_PAD_LEFT);
    }
    return $out;
}

/** สร้าง JWT ES256 สำหรับ header Authorization: vapid */
function vapid_jwt(string $audience, string $privatePem, string $subject): string {
    $head = b64u_enc(json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_UNESCAPED_SLASHES));
    $body = b64u_enc(json_encode([
        'aud' => $audience,
        'exp' => time() + 12 * 3600,     // อายุสูงสุดตามสเปกคือ 24 ชม.
        'sub' => $subject,
    ], JSON_UNESCAPED_SLASHES));
    $key = openssl_pkey_get_private($privatePem);
    if ($key === false) throw new RuntimeException('กุญแจ VAPID เสีย — กดสร้างกุญแจใหม่ในหน้าตั้งค่า');
    if (!openssl_sign("$head.$body", $der, $key, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('เซ็น JWT ไม่สำเร็จ');
    }
    return "$head.$body." . b64u_enc(ecdsa_der_to_raw($der));
}

/**
 * เข้ารหัส payload ตาม RFC 8291 (aes128gcm) — คืน body ที่พร้อม POST
 * โครง body: salt(16) | rs(4) | idlen(1)=65 | ephemeral public(65) | ciphertext
 */
function push_encrypt(string $payload, string $p256dhB64, string $authB64): string {
    $uaPub = b64u_dec($p256dhB64);
    $auth  = b64u_dec($authB64);
    if (strlen($auth) !== 16) throw new RuntimeException('auth secret ต้องยาว 16 ไบต์');

    $salt = random_bytes(16);
    $eph  = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    $ed   = openssl_pkey_get_details($eph);
    $ephPub = "\x04" . str_pad($ed['ec']['x'], 32, "\x00", STR_PAD_LEFT)
                     . str_pad($ed['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    $shared = openssl_pkey_derive(p256_pub_pem($uaPub), $eph);
    if ($shared === false) throw new RuntimeException('คำนวณ ECDH ไม่สำเร็จ');

    // ขั้นแรก: ผสม shared secret กับ auth secret (info ผูกกุญแจทั้งสองฝั่งไว้ กันสลับ subscription)
    $prk = hash_hkdf('sha256', $shared, 32, "WebPush: info\x00" . $uaPub . $ephPub, $auth);
    $cek   = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\x00", $salt);
    $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\x00", $salt);

    // 0x02 = ตัวคั่นบอกว่านี่คือ record สุดท้าย (เราส่ง record เดียวเสมอ)
    $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($cipher === false) throw new RuntimeException('เข้ารหัส payload ไม่สำเร็จ');

    return $salt . pack('N', 4096) . chr(65) . $ephPub . $cipher . $tag;
}

/** อ่านกุญแจ VAPID จาก settings — คืน null ถ้ายังไม่ได้สร้าง */
function vapid_keys(): ?array {
    $pub  = setting('vapid_public');
    $priv = setting('vapid_private');
    if ($pub === '' || $priv === '') return null;
    return ['public' => $pub, 'private' => $priv, 'subject' => setting('vapid_subject', 'mailto:admin@example.com')];
}

/**
 * ส่ง push จริงไปหลาย subscription พร้อมกัน (curl_multi — 19 คนจบใน ~1 วิ)
 * $subs = แถวจาก push_subscriptions · $data = ['title'=>, 'body'=>, 'url'=>, 'tag'=>]
 * คืน ['sent'=>n, 'gone'=>n, 'failed'=>n] — endpoint ที่ตาย (404/410) ถูกลบทิ้งให้เลย
 */
function push_send_raw(array $subs, array $data): array {
    $keys = vapid_keys();
    if (!$keys || !$subs) return ['sent' => 0, 'gone' => 0, 'failed' => 0];

    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $multi   = curl_multi_init();
    $handles = [];

    foreach ($subs as $s) {
        try {
            $parts = parse_url($s['endpoint']);
            $aud   = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
            $jwt   = vapid_jwt($aud, $keys['private'], $keys['subject']);
            $body  = push_encrypt($payload, $s['p256dh'], $s['auth_secret']);
        } catch (Throwable $e) {
            error_log('push encrypt failed: ' . $e->getMessage());
            continue;
        }
        $ch = curl_init($s['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/octet-stream',
                'Content-Encoding: aes128gcm',
                'TTL: 86400',
                'Urgency: normal',
                'Authorization: vapid t=' . $jwt . ', k=' . $keys['public'],
            ],
        ]);
        curl_multi_add_handle($multi, $ch);
        $handles[] = ['ch' => $ch, 'id' => (int)$s['id']];
    }

    do {
        curl_multi_exec($multi, $running);
        if ($running) curl_multi_select($multi, 1.0);
    } while ($running);

    $sent = $gone = $failed = 0;
    $dead = $alive = [];
    foreach ($handles as $h) {
        $code = (int)curl_getinfo($h['ch'], CURLINFO_HTTP_CODE);
        if ($code === 200 || $code === 201 || $code === 202) {
            $sent++; $alive[] = $h['id'];
        } elseif ($code === 404 || $code === 410) {
            $gone++; $dead[] = $h['id'];               // เจ้าหน้าที่ถอนสิทธิ์/ล้างแอป — ลบทิ้งได้เลย
        } else {
            $failed++;
            error_log("push failed http $code sub#{$h['id']}: " . substr((string)curl_multi_getcontent($h['ch']), 0, 200));
        }
        curl_multi_remove_handle($multi, $h['ch']);
        curl_close($h['ch']);
    }
    curl_multi_close($multi);

    if ($dead) {
        db()->exec('DELETE FROM push_subscriptions WHERE id IN (' . implode(',', array_map('intval', $dead)) . ')');
    }
    if ($alive) {
        db()->exec('UPDATE push_subscriptions SET last_ok_at = NOW() WHERE id IN (' . implode(',', array_map('intval', $alive)) . ')');
    }
    return ['sent' => $sent, 'gone' => $gone, 'failed' => $failed];
}

/** ส่ง push ให้คนเดียว (ทุก device ที่เขา subscribe ไว้) */
function push_to_user(int $userId, string $title, string $body = '', string $url = './', string $tag = 'firecheck'): array {
    if (setting('push_enabled', '0') !== '1') return ['sent' => 0, 'gone' => 0, 'failed' => 0];
    $st = db()->prepare('SELECT * FROM push_subscriptions WHERE user_id = ?');
    $st->execute([$userId]);
    return push_send_raw($st->fetchAll(), ['title' => $title, 'body' => $body, 'url' => $url, 'tag' => $tag]);
}

/** ส่ง push ให้หลายคนพร้อมกัน (ประกาศ/เตือนเช้า) — ยิงทีเดียวไม่วนเรียก push_to_user */
function push_to_users(array $userIds, string $title, string $body = '', string $url = './', string $tag = 'firecheck'): array {
    if (setting('push_enabled', '0') !== '1' || !$userIds) return ['sent' => 0, 'gone' => 0, 'failed' => 0];
    $in = implode(',', array_map('intval', $userIds));
    $subs = db()->query("SELECT * FROM push_subscriptions WHERE user_id IN ($in)")->fetchAll();
    return push_send_raw($subs, ['title' => $title, 'body' => $body, 'url' => $url, 'tag' => $tag]);
}
