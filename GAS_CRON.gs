// ===== FireCheck — cron ทั้งหมด (รายงาน LINE เช้า/เย็น + เตือนเช็คชื่อ 08:10) =====
// วางทับโค้ดเดิมทั้งไฟล์ได้เลย แล้วกดรัน setupTriggers 1 ครั้ง
const BASE   = 'https://sakpra-erawan.up.railway.app/api.php';
const SECRET = 'PASTE_SECRET_HERE';   // ← ดูจาก Railway → firecheck-app → Variables → CRON_SECRET

const REMIND_HOUR = 8, REMIND_MIN = 10;   // เวลาเตือน "ยังไม่ได้เช็คชื่อ" (ต้องก่อน late_cutoff ในหน้าตั้งค่า)

// ---------- รายงาน LINE ----------
function reportMorning() { ping('morning'); }
function reportEvening() { ping('evening'); }

function ping(type) {
  const url = `${BASE}?action=cron_report&type=${type}&key=${encodeURIComponent(SECRET)}`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  console.log(type, res.getResponseCode(), res.getContentText());
}

// ---------- เตือนคนที่ยังไม่เช็คชื่อ (Push เข้ามือถือ) ----------
// trigger รายวันของ GAS คลาดได้ ±15 นาที ยิงตรง 08:10 ไม่ได้
// จึงตั้ง scheduleRemind ไว้ 07:00 (คลาดได้ไม่เป็นไร) ให้ไปตั้ง trigger ครั้งเดียวที่ 08:10 อีกที (แม่นระดับนาที)
function scheduleRemind() {
  clearRemindTriggers();                                   // เก็บกวาดของค้าง (เผื่อเมื่อวานยิงไม่สำเร็จ)
  const at = new Date();
  at.setHours(REMIND_HOUR, REMIND_MIN, 0, 0);
  if (at <= new Date()) return;                            // เลยเวลาไปแล้ววันนี้ ข้าม
  ScriptApp.newTrigger('remindCheckin').timeBased().at(at).create();
  console.log('ตั้งคิวเตือนเช็คชื่อไว้', at);
}

function remindCheckin() {
  const url = `${BASE}?action=cron_push_remind&key=${encodeURIComponent(SECRET)}`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  console.log('remind', res.getResponseCode(), res.getContentText());
  clearRemindTriggers();                                   // trigger ครั้งเดียว ใช้เสร็จเก็บทิ้ง
}

function clearRemindTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'remindCheckin')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ---------- ปุ่มทดสอบ (กดรันเองได้ทันที ดูผลที่ "บันทึกการดำเนินการ") ----------
// ⚠️ ส่งเข้ากลุ่ม LINE จริง
function testNow() {
  const url = `${BASE}?action=cron_report&type=morning&key=${encodeURIComponent(SECRET)}&force=1`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  console.log(res.getResponseCode(), res.getContentText());
}
// เด้งเข้ามือถือคนที่ยังไม่เช็คชื่อเดี๋ยวนี้ (ไม่กวนกลุ่ม LINE) — ต้องเปิดสวิตช์ push_enabled ก่อน
function testRemindNow() {
  const url = `${BASE}?action=cron_push_remind&key=${encodeURIComponent(SECRET)}&force=1`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  console.log('remind test', res.getResponseCode(), res.getContentText());
}

// ---------- ติดตั้ง: รันครั้งเดียว (รันซ้ำได้ ไม่ซ้อน เพราะล้างของเก่าก่อน) ----------
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));   // ล้างของเก่ากันซ้ำ
  ScriptApp.newTrigger('reportMorning').timeBased().atHour(8).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('reportEvening').timeBased().atHour(17).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('scheduleRemind').timeBased().atHour(7).everyDays(1).create();
  console.log('ตั้ง trigger แล้ว: เตือนเช็คชื่อ 08:10 · รายงานเช้า 08:30 · รายงานเย็น 17:30');
  console.log(ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()).join(', '));
}
