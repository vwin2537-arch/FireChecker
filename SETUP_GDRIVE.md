# คู่มือเชื่อม Google Drive กับ FireCheck (ทำครั้งเดียว ~5-10 นาที)

รูปเซลฟี่เช็คอินจะถูกสำเนาขึ้น Google Drive ของพี่วินอัตโนมัติ แยกโฟลเดอร์รายวัน (ปี พ.ศ. เช่น `2569-07-04`)
เช็คอินไม่ต้องรอ Drive — ถ้าส่งพลาดระบบจะ retry ให้เองจนสำเร็จ

## ขั้นที่ 1 — สร้าง OAuth Client ใน Google Cloud (ทำในคอม)

1. เปิด https://console.cloud.google.com แล้ว login ด้วยบัญชี Google ที่จะเก็บรูป
2. สร้างโปรเจคใหม่ (มุมซ้ายบน → New Project) ตั้งชื่อ เช่น `firecheck` → Create
3. เปิดใช้ Drive API: ช่องค้นหาด้านบน พิมพ์ **Google Drive API** → กด **Enable**
4. ตั้งค่าหน้าขออนุญาต: เมนู **APIs & Services → OAuth consent screen**
   - เลือก **External** → Create
   - App name: `FireCheck` / User support email + Developer email: อีเมลพี่วิน → Save and Continue ไปเรื่อยๆ (ข้าม Scopes กับ Test users ได้)
5. **สำคัญมาก:** กลับมาที่หน้า OAuth consent screen แล้วกด **Publish App** (ปุ่ม Publishing status → In production)
   - ถ้าปล่อยเป็น Testing การเชื่อมต่อจะหลุดเองทุก 7 วัน ต้องกดเชื่อมใหม่เรื่อยๆ
   - Google จะเตือนว่า app ยังไม่ verify — ไม่เป็นไร เพราะใช้เองคนเดียว scope ที่ขอเป็นระดับปลอดภัย (เห็นเฉพาะไฟล์ที่แอปสร้างเอง)
6. สร้าง Client: เมนู **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `firecheck-web`
   - **Authorized redirect URIs** กด + ADD URI แล้วใส่ (ต้องตรงเป๊ะ):
     ```
     https://sakpra-erawan.up.railway.app/oauth.php
     ```
   - กด Create → จะได้ **Client ID** กับ **Client Secret** (คัดลอกเก็บไว้)

## ขั้นที่ 2 — เชื่อมต่อในแอป FireCheck

1. เข้า https://sakpra-erawan.up.railway.app → login แอดมิน → **ตั้งค่า**
2. เลื่อนลงการ์ด **🖼️ สำเนารูปเช็คชื่อขึ้น Google Drive**
3. วาง Client ID + Client Secret → กด **🔗 เชื่อมต่อ Google Drive**
4. Google จะถามให้เลือกบัญชี → ถ้าขึ้นจอเตือน "Google hasn't verified this app" ให้กด **Advanced → Go to FireCheck (unsafe)** (ปลอดภัย เพราะเป็นแอปของพี่เอง)
5. กด **Continue/อนุญาต** → เด้งกลับมาหน้า "เชื่อมต่อสำเร็จ ✅"
6. กลับหน้าตั้งค่า → กด **ทดสอบ + ส่งรูปค้าง** → ต้องขึ้น "เชื่อมต่อ Google Drive ใช้งานได้ ✓"

## ขั้นที่ 3 — ย้ายโฟลเดอร์ไปที่ที่พี่ต้องการ (ถ้าต้องการ)

ระบบสร้างโฟลเดอร์ **"รูปเช็คชื่อสถานีไฟป่า"** ไว้ใน My Drive ของพี่
ถ้าอยากให้อยู่ในโฟลเดอร์ที่พี่เตรียมไว้ ให้เปิด Google Drive แล้ว**ลากโฟลเดอร์นี้เข้าไปในโฟลเดอร์นั้นได้เลย** — ระบบยังส่งรูปเข้าโฟลเดอร์เดิมถูกต้อง (อ้างอิงด้วย id ไม่ใช่ตำแหน่ง)

> ⚠️ ทำไมไม่ส่งเข้าโฟลเดอร์ที่พี่ให้ลิงก์มาตรงๆ? — ระบบขอสิทธิ์ Google แบบแคบที่สุด (`drive.file` เห็นเฉพาะไฟล์ที่แอปสร้างเอง มองไม่เห็นไฟล์อื่นใน Drive พี่เลย) ซึ่งปลอดภัยกว่าและไม่ติดด่าน verify ของ Google แลกกับการที่แอปเข้าถึงโฟลเดอร์ที่มีอยู่แล้วไม่ได้ จึงใช้วิธีสร้างโฟลเดอร์เองแล้วให้พี่ลากไปวางแทน

## การทำงานหลังจากนั้น (อัตโนมัติทั้งหมด)

- เจ้าหน้าที่เช็คอิน → ถ่ายเซลฟี่ (บังคับ) → เช็คอินสำเร็จทันที
- รูปขึ้น Drive เบื้องหลังภายในไม่กี่วินาที เข้าโฟลเดอร์รายวัน ชื่อไฟล์ `เวลา_ชื่อ.jpg` เช่น `0745_สมชาย.jpg`
- ถ้า Google ล่มชั่วคราว รูปเข้าคิวรอ ระบบ retry ให้เองทุกครั้งที่มีคนเปิดแอป — ดูสถานะคิวได้ที่การ์ด Drive ในหน้าตั้งค่า
