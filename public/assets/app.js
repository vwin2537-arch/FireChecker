/* =====================================================
   FireCheck — SPA core + หน้าเจ้าหน้าที่
   ===================================================== */

const App = {
  token: localStorage.getItem('fc_token') || null,
  user: null,
  data: null,        // payload จาก app_data (ฝั่งเจ้าหน้าที่)
  adminData: null,   // payload จาก admin_data
  view: 'home',
  clockTimer: null,

  // ---------- API ----------
  async api(action, body = {}, opts = {}) {
    const res = await fetch('api.php?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.token ? { 'X-Auth-Token': this.token } : {}) },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({ ok: false, error: 'การเชื่อมต่อขัดข้อง' }));
    if (res.status === 401 && !opts.noKick) { this.setToken(null); this.renderAuth(); throw new Error(d.error); }
    if (!d.ok && !opts.soft) { toast(d.error || 'เกิดข้อผิดพลาด', 'error'); throw new Error(d.error); }
    return d;
  },

  setToken(t) {
    this.token = t;
    t ? localStorage.setItem('fc_token', t) : localStorage.removeItem('fc_token');
  },

  // ---------- boot ----------
  async init() {
    if (!this.token) return this.renderAuth();
    try {
      const d = await this.api('me', {}, { soft: true, noKick: true });
      if (!d.ok) { this.setToken(null); return this.renderAuth(); }
      this.user = d.user;
      Push.report();   // รายงานว่าเปิดจากเครื่องอะไร + ต่ออายุ subscription เงียบๆ (ไม่ await ไม่หน่วงหน้าแอป)
      this.user.role === 'admin' ? Admin.enter() : this.enterStaff();
    } catch { this.renderAuth(); }
  },

  logout() {
    this.api('logout', {}, { soft: true }).catch(() => {});
    this.setToken(null);
    clearInterval(this.clockTimer);
    this.renderAuth();
  },

  // =====================================================
  // AUTH
  // =====================================================
  renderAuth(mode = 'login') {
    clearInterval(this.clockTimer);
    $app().innerHTML = `
      <div class="auth-wrap">
        <div class="auth-hero">
          <div class="logo">🔥</div>
          <h1>FireCheck</h1>
          <p>ระบบเช็คชื่อเจ้าหน้าที่<br>สถานีควบคุมไฟป่าสลักพระ-เอราวัณ</p>
        </div>
        <div class="auth-card" id="authCard"></div>
      </div>`;
    mode === 'login' ? this.renderLoginForm() : this.renderRegisterForm();
  },

  renderLoginForm() {
    byId('authCard').innerHTML = `
      <h2>เข้าสู่ระบบ</h2>
      <form id="loginForm">
        <div class="field"><label>ชื่อผู้ใช้</label>
          <input class="input" id="fUser" autocomplete="username" autocapitalize="none" required></div>
        <div class="field"><label>รหัสผ่าน</label>
          <input class="input" id="fPass" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary btn-block" type="submit">เข้าสู่ระบบ</button>
      </form>
      <div style="text-align:center;margin-top:14px">
        <button class="link-btn" onclick="App.renderAuth('register')">เจ้าหน้าที่ใหม่? ลงทะเบียนตั้งรหัสผ่าน</button>
      </div>`;
    byId('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try {
        const d = await this.api('login', { username: byId('fUser').value.trim(), password: byId('fPass').value });
        this.setToken(d.token); this.user = d.user;
        Push.report();
        d.user.role === 'admin' ? Admin.enter() : this.enterStaff();
      } catch { btn.disabled = false; }
    };
  },

  async renderRegisterForm() {
    byId('authCard').innerHTML = '<h2>ลงทะเบียน</h2><div class="muted">กำลังโหลดรายชื่อ...</div>';
    const d = await this.api('register_list');
    if (!d.users.length) {
      byId('authCard').innerHTML = `<h2>ลงทะเบียน</h2>
        <div class="empty"><span class="e-ico">📇</span>ไม่มีรายชื่อรอลงทะเบียน<br>ให้หัวหน้าสถานีเพิ่มชื่อคุณในระบบก่อน</div>
        <button class="btn btn-ghost btn-block" onclick="App.renderAuth()">← กลับ</button>`;
      return;
    }
    byId('authCard').innerHTML = `
      <h2>ลงทะเบียน — เลือกชื่อของคุณ</h2>
      <form id="regForm">
        <div class="field"><label>ชื่อ-สกุล</label>
          <select class="select" id="rUser">${d.users.map(u =>
            `<option value="${u.id}">${esc(u.name)}${u.position ? ' — ' + esc(u.position) : ''}</option>`).join('')}</select></div>
        <div class="field"><label>ตั้งชื่อผู้ใช้ (a-z, 0-9 — ไว้ใช้เข้าระบบ)</label>
          <input class="input" id="rUname" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></div>
        <div class="field"><label>ตั้งรหัสผ่าน (6 ตัวขึ้นไป)</label>
          <input class="input" id="rPass" type="password" minlength="6" required></div>
        <div class="field"><label>ยืนยันรหัสผ่าน</label>
          <input class="input" id="rPass2" type="password" required></div>
        <button class="btn btn-primary btn-block" type="submit">ลงทะเบียน</button>
      </form>
      <div style="text-align:center;margin-top:14px">
        <button class="link-btn" onclick="App.renderAuth()">← กลับหน้าเข้าสู่ระบบ</button>
      </div>`;
    byId('regForm').onsubmit = async (e) => {
      e.preventDefault();
      const uname = byId('rUname').value.trim(), pass = byId('rPass').value;
      if (pass !== byId('rPass2').value) return toast('รหัสผ่านไม่ตรงกัน', 'error');
      await this.api('register', { user_id: +byId('rUser').value, username: uname, password: pass });
      // ย้ำ user/pass ให้เจ้าหน้าที่จดไว้ (แอดมินไม่ต้องมาบอกทีละคน)
      await Swal.fire({
        icon: 'success', title: 'ลงทะเบียนเรียบร้อย',
        html: `<div style="text-align:left;font-size:15px;line-height:1.9">
                 <b>จดข้อมูลนี้ไว้สำหรับเข้าระบบครั้งต่อไป 📝</b>
                 <div style="background:#f1f5f9;border-radius:10px;padding:12px 14px;margin-top:10px">
                   ชื่อผู้ใช้: <b style="color:#0f766e">${esc(uname)}</b><br>
                   รหัสผ่าน: <b style="color:#0f766e">${esc(pass)}</b>
                 </div>
                 <div style="margin-top:10px;color:#64748b;font-size:13px">เข้าใช้งานได้เลย ไม่ต้องรออนุมัติ</div>
               </div>`,
        confirmButtonText: 'จดแล้ว เข้าสู่ระบบ',
      });
      this.renderAuth();
    };
  },

  // =====================================================
  // STAFF SHELL
  // =====================================================
  async enterStaff() {
    $app().innerHTML = `<div class="shell">
      <div class="topbar">
        <div class="avatar">${esc(initials(this.user.name))}</div>
        <div><div class="t-title">${esc(this.user.name)}</div>
        <div class="t-sub">${esc(this.user.position || 'เจ้าหน้าที่')}</div></div>
        <div class="t-right">
          <button class="icon-btn mail-btn" onclick="App.openMailbox()" title="กล่องข้อความ">📬<span class="mail-dot" id="mailDot" hidden></span></button>
          <button class="icon-btn" onclick="App.refreshStaff()" title="รีเฟรช">⟳</button></div>
      </div>
      <div id="view"></div>
    </div>
    <nav class="bottom-nav">
      ${[['home', '🏠', 'หน้าหลัก'], ['dayoff', '🗓️', 'วันหยุด'], ['develop', '📚', 'พัฒนา'], ['health', '🩺', 'สุขภาพ'], ['history', '📖', 'ประวัติ'], ['profile', '👤', 'โปรไฟล์']]
        .map(([v, i, l]) => `<button class="nav-item" data-v="${v}" onclick="App.go('${v}')"><span class="ni">${i}</span>${l}</button>`).join('')}
    </nav>`;
    await this.refreshStaff();
  },

  async refreshStaff() {
    this.data = await this.api('app_data');
    this.paintNavBadge();
    this.paintMailDot();
    this.go(this.view || 'home');
  },

  /** ป้ายจำนวนเอกสารใหม่บนแท็บพัฒนาตัวเอง */
  paintNavBadge() {
    const ni = document.querySelector('.nav-item[data-v="develop"] .ni');
    if (!ni) return;
    ni.querySelector('.ni-badge')?.remove();
    const n = this.data?.library_unread || 0;
    if (n) ni.insertAdjacentHTML('beforeend', `<span class="ni-badge">${n > 9 ? '9+' : n}</span>`);
  },

  /** จุดแดงบนไอคอนกล่องข้อความ (มีข้อความยังไม่อ่าน) */
  paintMailDot() {
    const dot = byId('mailDot');
    if (dot) dot.hidden = !(this.data?.notif_unread > 0);
  },

  /** เปิดกล่องข้อความ — โหลดรายการ (ระบบ mark อ่านหมดฝั่ง server) แล้วโชว์ป๊อปอัพ จุดแดงหาย */
  async openMailbox() {
    const d = await this.api('notify_list');
    if (this.data) this.data.notif_unread = 0;
    this.paintMailDot();
    const icon = { announcement: '📢', leave_approved: '✅', leave_rejected: '❌' };
    const items = d.items || [];
    const html = items.length
      ? `<div class="mbox">${items.map(m => `
          <div class="mbox-item${m.is_new ? ' is-new' : ''}">
            <div class="mb-ico">${icon[m.type] || '📬'}</div>
            <div class="mb-body">
              <div class="mb-title">${esc(m.title)}${m.is_new ? '<span class="mb-new">ใหม่</span>' : ''}</div>
              ${m.body ? `<div class="mb-text">${esc(m.body).replace(/\n/g, '<br>')}</div>` : ''}
              <div class="mb-time">${m.created_at.substr(5, 11)}</div>
            </div>
          </div>`).join('')}</div>`
      : '<div class="mbox-empty"><div class="mb-e-ico">📭</div>ยังไม่มีข้อความค่ะ</div>';
    Swal.fire({ title: '📬 กล่องข้อความ', html, width: 460, showConfirmButton: true, confirmButtonText: 'ปิด' });
  },

  go(v) {
    this.view = v;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.v === v));
    clearInterval(this.clockTimer);
    ({ home: () => this.vHome(), dayoff: () => this.vDayoff(), develop: () => this.vDevelop(),
       health: () => this.vHealth(), history: () => this.vHistory(), profile: () => this.vProfile() })[v]();
  },

  /** คอนเฟตติพิกเซลฉลองเช็คชื่อตรงเวลา (สร้าง overlay ชั่วคราว ลบเองใน 2.4 วิ) */
  celebrate() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    const colors = ['#16a34a', '#ea580c', '#ffd84d', '#38bdf8', '#ffffff', '#2f9e44'];
    for (let i = 0; i < 44; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      const size = (6 + Math.random() * 6).toFixed(1);
      p.style.left = (Math.random() * 100).toFixed(1) + '%';
      p.style.width = p.style.height = size + 'px';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.1 + Math.random() * 0.9).toFixed(2) + 's';
      p.style.animationDelay = (Math.random() * 0.35).toFixed(2) + 's';
      if (Math.random() < 0.3) p.style.borderRadius = '50%';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2400);
  },

  /** ฉากพิกเซล SVG ตามสถานะ (beach = วันหยุด, work = เช็คแล้ว, rest = วันลา) — ขยับด้วย CSS
   *  pop=true ให้ฉากเด้งเข้ามา (ใช้ตอนเพิ่งเช็คชื่อสำเร็จ) */
  scene(kind, pop) {
    const svg = {
      beach: `<svg viewBox="0 0 48 48">
        <rect width="48" height="48" fill="#bfe6ff"/><rect width="48" height="18" fill="#a9dcff"/>
        <g class="sc-sun"><rect x="35" y="7" width="8" height="8" fill="#ffd84d"/>
          <rect x="34" y="9" width="10" height="4" fill="#ffd84d"/><rect x="37" y="6" width="4" height="10" fill="#ffd84d"/></g>
        <g class="sc-cl"><rect x="6" y="8" width="10" height="3" fill="#fff"/><rect x="8" y="6" width="6" height="3" fill="#fff"/></g>
        <rect y="24" width="48" height="12" fill="#38bdf8"/>
        <g class="sc-wave1"><rect y="24" width="48" height="2" fill="#7dd3fc"/>
          <rect x="4" y="27" width="6" height="1" fill="#e0f6ff"/><rect x="20" y="29" width="7" height="1" fill="#e0f6ff"/>
          <rect x="36" y="27" width="6" height="1" fill="#e0f6ff"/></g>
        <rect y="36" width="48" height="12" fill="#f5e0a3"/><rect y="36" width="48" height="2" fill="#ffeec2"/>
        <rect x="6" y="42" width="3" height="1" fill="#e8cd82"/><rect x="30" y="44" width="4" height="1" fill="#e8cd82"/>
        <g class="sc-palm"><rect x="23" y="24" width="3" height="16" fill="#a26b3a"/><rect x="22" y="30" width="3" height="10" fill="#8a5628"/>
          <rect x="24" y="24" width="2" height="6" fill="#b97b45"/>
          <rect x="16" y="21" width="8" height="3" fill="#2f9e44"/><rect x="13" y="23" width="6" height="3" fill="#37b24d"/>
          <rect x="24" y="21" width="9" height="3" fill="#2f9e44"/><rect x="30" y="23" width="6" height="3" fill="#37b24d"/>
          <rect x="21" y="17" width="6" height="4" fill="#40c057"/><rect x="19" y="19" width="10" height="3" fill="#37b24d"/>
          <rect x="22" y="23" width="2" height="2" fill="#6b3f1d"/><rect x="25" y="23" width="2" height="2" fill="#6b3f1d"/></g>
      </svg>`,
      work: `<svg viewBox="0 0 48 48">
        <rect width="48" height="48" fill="#cdeafd"/><rect y="30" width="48" height="18" fill="#8fd06a"/>
        <rect y="30" width="48" height="2" fill="#a7de85"/>
        <g class="sc-sun"><rect x="36" y="6" width="7" height="7" fill="#ffe066"/></g>
        <rect x="7" y="28" width="2" height="4" fill="#7a4a22"/><rect x="4" y="20" width="8" height="4" fill="#2f9e44"/>
        <rect x="5" y="23" width="6" height="4" fill="#37b24d"/><rect x="6" y="16" width="4" height="4" fill="#40c057"/>
        <rect x="30" y="40" width="16" height="3" fill="#c98b4d"/><rect x="30" y="40" width="16" height="1" fill="#d99e63"/>
        <rect x="22" y="36" width="3" height="6" fill="#3b5f2a"/><rect x="26" y="36" width="3" height="6" fill="#3b5f2a"/>
        <rect x="22" y="42" width="3" height="2" fill="#4a3520"/><rect x="26" y="42" width="3" height="2" fill="#4a3520"/>
        <rect x="21" y="27" width="9" height="10" fill="#2f7d32"/><rect x="21" y="27" width="9" height="2" fill="#37933a"/>
        <rect x="23" y="19" width="6" height="6" fill="#f2c99a"/>
        <rect x="24" y="21" width="1" height="1" fill="#3b2a1a"/><rect x="26" y="21" width="1" height="1" fill="#3b2a1a"/>
        <rect x="24" y="23" width="3" height="1" fill="#d99a72"/>
        <rect x="20" y="18" width="11" height="2" fill="#7a4e26"/><rect x="22" y="15" width="7" height="3" fill="#a06a34"/>
        <g class="sc-arm"><rect x="28" y="27" width="3" height="9" fill="#f2c99a"/><rect x="30" y="12" width="2" height="24" fill="#7a4a22"/>
          <rect x="27" y="11" width="8" height="2" fill="#5c5c5c"/><rect x="27" y="13" width="1" height="2" fill="#5c5c5c"/>
          <rect x="30" y="13" width="1" height="2" fill="#5c5c5c"/><rect x="33" y="13" width="1" height="2" fill="#5c5c5c"/></g>
      </svg>`,
      rest: `<svg viewBox="0 0 48 48">
        <rect width="48" height="48" fill="#e7ecf5"/><rect y="34" width="48" height="14" fill="#d3d9e6"/>
        <rect x="30" y="6" width="12" height="12" fill="#cfe0ff"/>
        <rect x="30" y="6" width="12" height="12" fill="none" stroke="#b6c4dd" stroke-width="1"/>
        <rect x="35" y="9" width="5" height="5" fill="#ffe9a8"/><rect x="34" y="10" width="2" height="3" fill="#f7dd8f"/>
        <rect x="6" y="30" width="34" height="4" fill="#9c6b3f"/><rect x="6" y="33" width="4" height="8" fill="#7a5230"/>
        <rect x="36" y="33" width="4" height="8" fill="#7a5230"/>
        <rect x="8" y="26" width="10" height="6" fill="#fff"/><rect x="8" y="26" width="10" height="2" fill="#eef1f6"/>
        <rect x="12" y="22" width="6" height="6" fill="#f2c99a"/><rect x="12" y="22" width="6" height="2" fill="#3b2a1a"/>
        <g class="sc-blanket"><rect x="16" y="26" width="22" height="8" fill="#3f7fbf"/>
          <rect x="16" y="26" width="22" height="2" fill="#5b97d6"/><rect x="16" y="30" width="22" height="1" fill="#356fa8"/></g>
        <text class="sc-z1" x="20" y="20" font-size="6" fill="#7a8aa8" font-family="monospace">z</text>
        <text class="sc-z2" x="22" y="18" font-size="7" fill="#7a8aa8" font-family="monospace">z</text>
        <text class="sc-z3" x="24" y="16" font-size="8" fill="#7a8aa8" font-family="monospace">Z</text>
      </svg>`
    }[kind];
    return `<div class="scene${pop ? ' pop' : ''}">${svg}</div>`;
  },

  /** การ์ดเวรกลางคืนบนหน้าหลัก — เฉพาะ จนท.ชาย + สวิตช์เปิด */
  nightCardHtml() {
    const t = this.data.today, s = this.data.settings;
    if (this.user.gender !== 'male' || !s.night_shift_enabled) return '';
    if (t.night) {
      return `<div class="card" style="text-align:center">
        <div class="db-title" style="font-size:15px">🌙 ลงเวรกลางคืนแล้ว</div>
        <div class="db-sub">เวลา ${t.night.time_in.substr(11, 5)} น. • ขอบคุณที่เฝ้าสถานีค่ะ</div></div>`;
    }
    const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
    const canNow = nowM >= hm(s.night_checkin_open);
    return `<div class="card">
      <button class="btn btn-primary btn-block" ${canNow ? '' : 'disabled'} onclick="App.doNightCheckin()">🌙 ลงเวรกลางคืน</button>
      <div class="tiny" style="margin-top:6px;text-align:center">${canNow ? 'เฝ้าสำนักงานกลางคืน — กดตอนเริ่มเข้าเวร' : 'เปิดลงเวร ' + s.night_checkin_open + ' น.'}</div></div>`;
  },

  // ---------- หน้าหลัก ----------
  vHome() {
    const d = this.data, t = d.today, s = d.settings;
    let stateHtml = '';

    if (t.is_holiday) {
      if (t.attendance) {
        const a = t.attendance;
        const pop = this.justCheckedIn; this.justCheckedIn = false;
        stateHtml = `<div class="done-badge">${this.scene('work', pop)}
          <div class="db-title">เช็คชื่อทำงานวันหยุด ${a.time_in.substr(11, 5)} น.</div>
          <div class="db-sub"><span class="chip chip-ok">ทำงานวันหยุด 🌴</span>
          ${a.note ? `<div class="tiny" style="margin-top:6px">📝 ${esc(a.note)}</div>` : ''}</div></div>`;
      } else if (s.sunday_work_enabled) {
        stateHtml = `<div class="done-badge">${this.scene('beach')}
          <div class="db-title">วันอาทิตย์ — วันหยุดสถานี</div>
          <div class="db-sub">ถ้ามาทำงาน / เข้าเวร กดเช็คชื่อด้านล่างได้เลยค่ะ</div></div>
          <div class="field" style="margin-top:10px"><input class="input" id="holidayNote" maxlength="255" placeholder="หมายเหตุ (ถ้ามี) เช่น มาชดเชยวันลา"></div>
          <button class="btn btn-primary btn-block" onclick="App.doCheckin()">📍 เช็คชื่อทำงานวันหยุด</button>`;
      } else {
        stateHtml = `<div class="done-badge">${this.scene('beach')}
          <div class="db-title">วันอาทิตย์ — วันหยุดสถานี</div>
          <div class="db-sub">พักผ่อนเต็มที่ แล้วพบกันพรุ่งนี้ค่ะ</div></div>`;
      }
    } else if (t.attendance) {
      const a = t.attendance;
      const pop = this.justCheckedIn; this.justCheckedIn = false;
      stateHtml = `<div class="done-badge">
        ${this.scene('work', pop)}
        <div class="db-title">เช็คชื่อแล้ว ${a.time_in.substr(11, 5)} น.</div>
        <div class="db-sub"><span class="chip ${+a.late ? 'chip-late' : 'chip-ok'}">${+a.late ? 'มาสาย' : 'ตรงเวลา'}</span></div>
      </div>`;
      if (s.checkout_enabled && !a.time_out) {
        stateHtml += `<button class="btn btn-primary btn-block" onclick="App.doCheckout()" style="margin-top:10px">📝 ส่งรายงานผลงานวันนี้ (เปิด ${s.checkout_open} น.)</button>`;
      } else if (s.checkout_enabled && a.time_out) {
        stateHtml += `<div style="text-align:center;margin-top:8px"><span class="chip ${+a.report_late ? 'chip-late' : 'chip-ok'}">ส่งรายงานแล้ว ${a.time_out.substr(11, 5)} น.</span></div>`;
      }
    } else if (t.day_off) {
      const label = { dayoff: 'วันหยุด', sick: 'ลาป่วย', personal: 'ลากิจ' }[t.day_off.type];
      stateHtml = `<div class="done-badge">${this.scene('rest')}
        <div class="db-title">วันนี้คุณแจ้ง${label}ไว้</div>
        <div class="db-sub">ถ้ามาทำงาน ให้ยกเลิกที่แท็บ "วันหยุด" ก่อนเช็คชื่อ</div></div>`;
    } else {
      const os = t.offsite, osUser = t.offsite_user;
      const osBanner = os
        ? `<div style="background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.5;color:#065f46">📍 วันนี้เช็คชื่อ<b>นอกสถานที่</b>ได้ทุกที่${os.reason ? ' — ' + esc(os.reason) : ''}<br>เช็คในช่วง <b>${os.start_time}–${os.end_time}</b> น. ไม่นับสาย</div>`
        : osUser
        ? `<div style="background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.5;color:#065f46">📍 วันนี้คุณได้รับอนุญาตเช็ค<b>นอกพื้นที่</b>${osUser.reason ? ' — ' + esc(osUser.reason) : ''}<br>${+osUser.no_late ? 'เช็คได้จากทุกที่ · ไปราชการ <b>ไม่นับสาย</b>' : `เช็คได้จากทุกที่ ในเวลางานปกติ (หลัง <b>${s.late_cutoff}</b> น. นับสาย)`}</div>`
        : '';
      // เตือนถ้าเปิดยืนยันใบหน้าแต่ยังไม่ได้ลงทะเบียนหน้าให้คนนี้ (เช็คชื่อได้ปกติ แต่หัวหน้าจะเห็นหมายเหตุ)
      const faceBanner = (s.face_verify_enabled && !t.face_ready)
        ? `<div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.5;color:#92400e">🙂 ยังไม่ได้<b>ลงทะเบียนใบหน้า</b>ของคุณ — เช็คชื่อได้ปกติ แต่แจ้งหัวหน้าให้ลงทะเบียนให้ด้วยนะคะ</div>`
        : '';
      stateHtml = `${osBanner}${faceBanner}<button class="big-check" id="btnCheckin" onclick="App.doCheckin()">
        <span class="bc-ico">📍</span>เช็คชื่อ<span class="bc-sub" id="bcSub"></span>
      </button>
      <div class="clock-note">${os ? `เช็คนอกสถานที่ ${os.start_time}–${os.end_time} น. (ไม่นับสาย)` : (osUser && +osUser.no_late) ? `เปิดเช็คชื่อ ${s.checkin_open} น. • ไปราชการวันนี้ ไม่นับสาย` : `เปิดเช็คชื่อ ${s.checkin_open} น. • หลัง ${s.late_cutoff} น. นับว่าสาย`}</div>`;
    }

    const q = d.quota, qPct = Math.min(100, q.used / q.max * 100);
    byId('view').innerHTML = `
      <div class="card clock-card">
        <div class="clock-time" id="clock">--:--:--</div>
        <div class="clock-date">${esc(t.thai_date)}</div>
        ${stateHtml}
      </div>

      ${this.nightCardHtml()}

      ${d.library_unread ? `<div class="card lib-nudge" onclick="App.go('develop')">
        <span class="ln-ico">📚</span>
        <div class="ln-main"><div class="ln-title">มีเอกสารใหม่ ${d.library_unread} รายการ</div>
        <div class="ln-sub">แตะเพื่อเข้าคลังความรู้ พัฒนาตัวเอง</div></div>
        <span class="ln-arrow">›</span>
      </div>` : ''}

      <div class="card">
        <h3>🗓️ โควต้าวันหยุดเดือนนี้ <span class="h-right">${q.used}/${q.max} วัน</span></h3>
        <div class="pbar ${q.used > q.max ? 'over' : qPct >= 80 ? 'warn' : ''}"><div style="width:${Math.min(100, qPct)}%"></div></div>
        ${q.used > q.max ? '<div class="tiny" style="color:var(--absent);margin-top:6px">⚠️ เกินโควต้า — หัวหน้าสถานีได้รับแจ้งแล้ว</div>' : ''}
      </div>

      ${d.upcoming.length ? `<div class="card"><h3>⏭️ วันหยุด/ลาที่จองไว้</h3>
        ${d.upcoming.slice(0, 5).map(o => `
          <div class="list-row"><span class="dot dot-leave"></span>
            <div class="lr-main"><div class="lr-title">${thaiDate(o.off_date)}</div>
            <div class="lr-sub">${offLabel(o.type)}${o.note ? ' — ' + esc(o.note) : ''}${+o.over_quota ? ' ⚠️ เกินโควต้า' : ''}${o.status === 'pending' ? ' ⏳ รออนุมัติ' : ''}</div></div>
          </div>`).join('')}</div>` : ''}

      ${this.historyCard(d.history.slice(0, 5), 'ประวัติล่าสุด')}
    `;
    this.startClock();
  },

  historyCard(rows, title) {
    if (!rows.length) return '';
    return `<div class="card"><h3>🕐 ${title}</h3>${rows.map(a => `
      <div class="list-row"><span class="dot ${+a.late ? 'dot-late' : 'dot-ok'}"></span>
        <div class="lr-main"><div class="lr-title">${thaiDate(a.work_date)}</div>
          <div class="lr-sub">เข้า ${a.time_in.substr(11, 5)} น.${a.time_out ? ' • ส่งรายงาน ' + a.time_out.substr(11, 5) + ' น.' : ''}${a.note ? ' • 📝 ' + esc(a.note) : ''}</div></div>
        <span class="chip ${+a.late ? 'chip-late' : 'chip-ok'}">${+a.late ? 'สาย' : 'ตรงเวลา'}</span>
      </div>`).join('')}</div>`;
  },

  startClock() {
    const s = this.data.settings, os = this.data.today.offsite, osUser = this.data.today.offsite_user;   // วันนอกสถานที่คุมปุ่มด้วยช่วงเวลาของวันนั้น
    const openStr = os ? os.start_time : s.checkin_open, lateStr = os ? os.end_time : s.late_cutoff;
    const noLate = osUser && +osUser.no_late;   // ไปราชการรายคน = ไม่นับสาย ปุ่มไม่ต้องเตือนสาย
    const tick = () => {
      const el = byId('clock'); if (!el) return clearInterval(this.clockTimer);
      const n = new Date();
      el.textContent = n.toTimeString().substr(0, 8);
      const btn = byId('btnCheckin'), sub = byId('bcSub');
      if (btn) {
        const nowM = n.getHours() * 60 + n.getMinutes();
        const openM = hm(openStr), lateM = hm(lateStr);
        if (nowM < openM) { btn.disabled = true; sub.textContent = 'เปิดเวลา ' + openStr + ' น.'; }
        else { btn.disabled = false; sub.textContent = (nowM > lateM && !noLate) ? 'เลยเวลา — จะถูกนับว่าสาย' : 'แตะเพื่อเช็คชื่อ'; }
      }
    };
    tick();
    this.clockTimer = setInterval(tick, 1000);
  },

  // ---------- เช็คอิน ----------
  async doCheckin() {
    const s = this.data.settings;
    const btn = byId('btnCheckin'); if (btn) btn.disabled = true;   // วันหยุดใช้ปุ่มอื่น (ไม่มี btnCheckin)
    try {
      // 1) กล้องก่อนเสมอ — iOS/WebKit บังคับ inp.click() ต้องอยู่ในจังหวะ "กดสด" (transient activation)
      //    ห้ามมี await คั่นก่อนบรรทัดนี้ ไม่งั้นสิทธิ์กดหมด กล้องจะไม่เปิด → ค้าง (เดิมหา GPS ก่อนเลยพัง)
      let selfie = null;
      if (s.face_verify_enabled && this.data.today.face_ready) {
        // ยืนยันใบหน้า: เฟรมที่ใช้ยืนยันใช้เป็นเซลฟี่ได้เลย ไม่ต้องเปิดกล้องสองรอบ
        const fv = await faceVerifyFlow('checkin', faceCanLive());
        if (fv === 'cancel') return;
        if (s.selfie_required) selfie = fv.dataUrl || null;
      } else if (s.selfie_required) {
        selfie = await captureSelfie();
        if (!selfie) return;   // ผู้ใช้ยกเลิก
      }

      // 2) หา GPS ทีหลัง — permission grant แล้วไม่ต้องขอ activation ซ้ำ และมี timeout 12s กันค้างเงียบ
      let pos = null;
      try {
        Swal.fire({ title: 'กำลังหาตำแหน่ง GPS...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        pos = await getPosition();
        Swal.close();
      } catch (err) {
        Swal.close();
        if (s.gps_enforce && !this.data.today.offsite && !this.data.today.offsite_user) {   // นอกสถานที่ (ทั้งสถานี/รายคน) ไม่บังคับ GPS — หาไม่เจอก็เช็คต่อได้
          await Swal.fire({ icon: 'error', title: 'ไม่พบตำแหน่ง GPS', html: gpsErrorMessage(err), confirmButtonText: 'ตกลง' });
          return;
        }
      }

      // 3) ยืนยัน + ส่ง
      const dist = pos ? Math.round(haversine(pos.lat, pos.lng, s.gps_lat, s.gps_lng)) : null;
      const c = await Swal.fire({
        icon: 'question', title: 'ยืนยันเช็คชื่อ?',
        html: dist !== null ? `คุณอยู่ห่างสถานี <b>${dist.toLocaleString()} ม.</b>` : 'ไม่มีพิกัด GPS',
        showCancelButton: true, confirmButtonText: 'เช็คชื่อเลย', cancelButtonText: 'ยกเลิก',
      });
      if (!c.isConfirmed) return;

      const note = byId('holidayNote')?.value.trim() || undefined;   // งานวันอาทิตย์ใส่หมายเหตุได้
      const d = await this.api('checkin', { lat: pos?.lat ?? null, lng: pos?.lng ?? null, selfie, note });
      const onTime = !d.late;
      if (onTime) this.justCheckedIn = true;   // ให้ฉากคนทำงานเด้ง pop ตอนเรนเดอร์ใหม่
      await Swal.fire({ icon: d.late ? 'warning' : 'success', title: d.message, text: 'เวลา ' + d.time_in + ' น.', confirmButtonText: 'ตกลง' });
      this.refreshStaff();
      if (onTime) this.celebrate();   // โปรยคอนเฟตติทับฉากคนทำงาน — เฉพาะมาตรงเวลา
    } finally {
      if (btn) btn.disabled = false;   // จบทางไหนก็ปลดล็อกปุ่มเสมอ ไม่ให้ค้าง disabled อีก
    }
  },

  // ---------- ลงเวรกลางคืน ----------
  async doNightCheckin() {
    const s = this.data.settings;
    try {
      // ลำดับเหมือนเช็คชื่อ: กล้อง (ยืนยันหน้า/เซลฟี่) ก่อน GPS — iOS/WebKit ต้องเปิดกล้องในจังหวะกดสด
      let selfie = null;
      if (s.face_verify_enabled && this.data.today.face_ready) {
        const fv = await faceVerifyFlow('night', faceCanLive());
        if (fv === 'cancel') return;
        if (s.selfie_required) selfie = fv.dataUrl || null;
      } else if (s.selfie_required) {
        selfie = await captureSelfie();
        if (!selfie) return;
      }
      let pos = null;
      try {
        Swal.fire({ title: 'กำลังหาตำแหน่ง GPS...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        pos = await getPosition();
        Swal.close();
      } catch (err) {
        Swal.close();
        if (s.gps_enforce) {
          await Swal.fire({ icon: 'error', title: 'ไม่พบตำแหน่ง GPS', html: gpsErrorMessage(err), confirmButtonText: 'ตกลง' });
          return;
        }
      }
      const dist = pos ? Math.round(haversine(pos.lat, pos.lng, s.gps_lat, s.gps_lng)) : null;
      const c = await Swal.fire({
        icon: 'question', title: 'ยืนยันลงเวรกลางคืน?',
        html: dist !== null ? `คุณอยู่ห่างสถานี <b>${dist.toLocaleString()} ม.</b>` : 'ไม่มีพิกัด GPS',
        showCancelButton: true, confirmButtonText: 'ลงเวรเลย', cancelButtonText: 'ยกเลิก',
      });
      if (!c.isConfirmed) return;
      const d = await this.api('night_checkin', { lat: pos?.lat ?? null, lng: pos?.lng ?? null, selfie });
      await Swal.fire({ icon: 'success', title: d.message, text: 'เวลา ' + d.time_in + ' น.', confirmButtonText: 'ตกลง' });
      this.refreshStaff();
    } catch { /* api() แสดง toast ให้แล้ว */ }
  },

  async doCheckout() {
    const { value: form } = await Swal.fire({
      title: '📝 รายงานผลงานวันนี้',
      html: `<textarea id="swReport" class="swal2-textarea" placeholder="วันนี้ทำอะไรบ้าง เช่น ลาดตระเวนแนวกันไฟ โซน A..." style="width:88%;font-family:Kanit"></textarea>
             <input type="file" id="swPhotos" accept="image/*" multiple style="margin-top:10px;font-family:Kanit;font-size:13px">`,
      showCancelButton: true, confirmButtonText: 'ส่งรายงาน', cancelButtonText: 'ยกเลิก',
      preConfirm: async () => {
        const report = byId('swReport').value.trim();
        if (!report) { Swal.showValidationMessage('กรอกรายงานก่อนค่ะ'); return false; }
        const files = [...byId('swPhotos').files].slice(0, 6);
        const photos = [];
        for (const f of files) photos.push(await compressImage(f));
        return { report, photos };
      },
    });
    if (!form) return;
    const d = await this.api('checkout', form);
    await Swal.fire({ icon: 'success', title: d.message, confirmButtonText: 'ตกลง' });
    this.refreshStaff();
  },

  // ---------- วันหยุด ----------
  calYm: null,
  calSel: new Set(),

  async vDayoff() {
    this.calYm = this.calYm || ymNow();
    this.calSel = new Set();
    byId('view').innerHTML = `
      <div class="card">
        <h3>🗓️ จองวันหยุด / แจ้งลา</h3>
        <div id="calBox"></div>
        <div class="field" style="margin-top:12px"><label>ประเภท</label>
          <select class="select" id="offType" onchange="App.onOffTypeChange()">
            <option value="dayoff">วันหยุด (นับโควต้า)</option>
            <option value="sick">ลาป่วย</option>
            <option value="personal">ลากิจ</option>
          </select></div>
        <div class="field"><label id="offNoteLabel">หมายเหตุ (ถ้ามี)</label><input class="input" id="offNote" maxlength="255" placeholder=""></div>
        <button class="btn btn-primary btn-block" id="btnBook" onclick="App.submitDayoff()" disabled>เลือกวันในปฏิทินก่อน</button>
      </div>
      <div class="card"><h3>📌 วันหยุดของฉัน</h3><div id="myOffs"></div></div>`;
    await this.loadCal();
  },

  async loadCal() {
    const d = await this.api('dayoff_month', { ym: this.calYm });
    this.teamOffs = d.day_offs;
    this.renderCal();
    this.renderMyOffs();
  },

  renderCal() {
    const [Y, M] = this.calYm.split('-').map(Number);
    const first = new Date(Y, M - 1, 1), days = new Date(Y, M, 0).getDate();
    const today = todayStr();
    const mine = new Set(this.data.upcoming.map(o => o.off_date)
      .concat(this.teamOffs.filter(o => o.user_id == this.user.id).map(o => o.off_date)));

    let cells = '';
    for (let i = 0; i < first.getDay(); i++) cells += '<div class="cal-day other"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${Y}-${String(M).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(Y, M - 1, d).getDay();
      const cls = ['cal-day'];
      if (dow === 0 && this.data.settings.sunday_off) cls.push('sun');
      if (ds === today) cls.push('today');
      if (ds < today) cls.push('past');
      if (mine.has(ds)) cls.push('mine');
      if (this.calSel.has(ds)) cls.push('sel');
      const clickable = ds >= today && !(dow === 0 && this.data.settings.sunday_off) && !mine.has(ds);
      cells += `<button class="${cls.join(' ')}" ${clickable ? `onclick="App.toggleDay('${ds}')"` : 'disabled'}>${d}</button>`;
    }
    byId('calBox').innerHTML = `
      <div class="cal-head">
        <button class="cal-nav" onclick="App.calMove(-1)">‹</button>
        <span class="cal-title">${thaiMonth(this.calYm)}</span>
        <button class="cal-nav" onclick="App.calMove(1)">›</button>
      </div>
      <div class="cal-grid">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
      <div class="tiny" style="margin-top:8px">แตะวันเพื่อเลือก (เลือกได้หลายวัน) • สีฟ้า = จองไว้แล้ว • ขีดฆ่า = วันอาทิตย์หยุดสถานี</div>`;
  },

  calMove(dir) {
    const [Y, M] = this.calYm.split('-').map(Number);
    const d = new Date(Y, M - 1 + dir, 1);
    this.calYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.loadCal();
  },

  toggleDay(ds) {
    this.calSel.has(ds) ? this.calSel.delete(ds) : this.calSel.add(ds);
    this.renderCal();
    const btn = byId('btnBook');
    btn.disabled = !this.calSel.size;
    btn.textContent = this.calSel.size ? `บันทึก ${this.calSel.size} วัน` : 'เลือกวันในปฏิทินก่อน';
  },

  onOffTypeChange() {
    const need = ['sick', 'personal'].includes(byId('offType').value);
    byId('offNoteLabel').innerHTML = need ? 'เหตุผลการลา <span style="color:var(--absent)">*</span>' : 'หมายเหตุ (ถ้ามี)';
    byId('offNote').placeholder = need ? 'เช่น ไม่สบาย ปวดหัว / ไปธุระราชการ' : '';
  },

  async submitDayoff() {
    const type = byId('offType').value, note = byId('offNote').value.trim();
    if (['sick', 'personal'].includes(type) && !note) {
      byId('offNote').focus();
      return Swal.fire({ icon: 'warning', title: 'กรุณาระบุเหตุผลการลา', text: 'ลาป่วย/ลากิจ ต้องกรอกเหตุผลก่อนส่ง', confirmButtonText: 'ตกลง' });
    }
    const d = await this.api('dayoff_add', {
      dates: [...this.calSel], type, note,
    });
    const isLeave = type === 'sick' || type === 'personal';
    let html = `<div style="text-align:left;font-family:Kanit;font-weight:300;font-size:14.5px;line-height:1.65">`;
    html += `<div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:var(--leave);display:inline-block"></span> ${offLabel(type)} • <b>${d.added.length} วัน</b></div>`;
    if (d.pending.length) html += `<div style="margin-top:12px;padding:11px 13px;background:var(--leave-bg);border-radius:12px;color:var(--leave);font-weight:400">🔔 แจ้งหัวหน้าสถานีทาง LINE แล้ว<br><span style="font-weight:300">⏳ รออนุมัติ ${d.pending.length} วัน</span></div>`;
    else if (isLeave) html += `<div style="margin-top:12px;padding:11px 13px;background:var(--ok-bg);border-radius:12px;color:var(--ok);font-weight:400">🔔 แจ้งหัวหน้าสถานีทาง LINE แล้ว</div>`;
    if (d.over_quota.length) html += `<div style="margin-top:10px;color:var(--late)">⚠️ เกินโควต้าวันหยุดเดือนนี้ ${d.over_quota.length} วัน — ต้องรอหัวหน้าอนุมัติ</div>`;
    if (d.skipped.length) html += `<div style="margin-top:10px;font-size:12.5px;color:var(--ink-3)">ข้าม: ${d.skipped.map(s => `${thaiDate(s[0], false)} (${s[1]})`).join(', ')}</div>`;
    html += `</div>`;
    await Swal.fire({ icon: 'success', title: 'ส่งคำขอแล้ว', html, confirmButtonText: 'ตกลง' });
    this.data = await this.api('app_data');
    this.vDayoff();
  },

  renderMyOffs() {
    // เฉพาะวันหยุดของฉันในเดือนที่ดูอยู่ในปฏิทิน (เปลี่ยนเดือน → รายการตาม)
    const today = todayStr();
    const rows = (this.teamOffs || []).filter(o => o.user_id == this.user.id)
      .sort((a, b) => a.off_date.localeCompare(b.off_date));
    byId('myOffs').innerHTML = rows.length ? rows.map(o => `
      <div class="list-row"><span class="dot dot-leave"></span>
        <div class="lr-main"><div class="lr-title">${thaiDate(o.off_date)}</div>
          <div class="lr-sub">${offLabel(o.type)}${o.note ? ' — ' + esc(o.note) : ''}${+o.over_quota ? ' ⚠️' : ''}${o.status === 'pending' ? ' ⏳ รออนุมัติ' : ''}</div></div>
        ${o.off_date >= today ? `<button class="btn btn-danger-ghost btn-sm" onclick="App.cancelOff(${o.id}, '${o.type}')">ยกเลิก</button>` : ''}
      </div>`).join('')
      : '<div class="empty"><span class="e-ico">📭</span>เดือนนี้ยังไม่มีวันหยุดของคุณ</div>';
  },

  async cancelOff(id, type) {
    const isLeave = type === 'sick' || type === 'personal';
    const c = await Swal.fire({ icon: 'warning', title: 'ยกเลิกรายการนี้?',
      text: isLeave ? 'ระบบจะแจ้งหัวหน้าสถานีทาง LINE ด้วย' : '',
      showCancelButton: true, confirmButtonText: isLeave ? 'ยกเลิกการลา' : 'ยกเลิกวันหยุด', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    await this.api('dayoff_cancel', { id });
    this.data = await this.api('app_data');
    this.vDayoff();
    toast(isLeave ? 'ยกเลิกแล้ว — แจ้งหัวหน้าทาง LINE แล้ว' : 'ยกเลิกแล้ว');
  },

  // ---------- พัฒนาตัวเอง (hub) ----------
  libItems: null,
  libFilter: 'all',
  devTab: 'lib',

  devSegHtml() {
    const t = (v, l) => `<button class="${this.devTab === v ? 'active' : ''}" onclick="App.devSetTab('${v}')">${l}</button>`;
    return `<div class="seg" id="devSeg">
      ${t('lib', '📚 คลังความรู้')}${t('quiz', '📝 แบบทดสอบ')}${t('training', '🎓 อบรม')}
    </div>`;
  },

  devSetTab(t) { this.devTab = t; this.vDevelop(); },

  async vDevelop() {
    if (this.devTab === 'quiz')     return this.vQuizList();
    if (this.devTab === 'training') return this.vTraining();
    return this.vLibrary();
  },

  async vLibrary() {
    byId('view').innerHTML = this.devSegHtml() + '<div id="libBox"><div class="card muted">กำลังโหลด...</div></div>';
    const d = await this.api('library_list');
    this.libItems = d.items;
    this.renderLib();
  },

  renderLib() {
    const items = this.libFilter === 'all' ? this.libItems : this.libItems.filter(i => i.category === this.libFilter);
    const chip = (v, l) => `<button class="lib-chip ${this.libFilter === v ? 'active' : ''}" onclick="App.libSetFilter('${v}')">${l}</button>`;
    const chips = `<div class="lib-chips">${chip('all', 'ทั้งหมด')}${Object.entries(LIB_CAT).map(([v, c]) => chip(v, c.icon + ' ' + c.label)).join('')}</div>`;

    if (!this.libItems.length) {
      byId('libBox').innerHTML = chips + '<div class="card empty"><span class="e-ico">📚</span>ยังไม่มีเอกสารในคลัง<br>หัวหน้าสถานีจะเพิ่มให้เร็วๆ นี้ค่ะ</div>';
      return;
    }
    const cards = items.map(it => {
      const cat = LIB_CAT[it.category] || { icon: '📄', label: it.category };
      const thumb = it.file_id
        ? `<img class="lib-img" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(it.file_id)}&sz=w400" alt=""
             onerror="this.parentNode.classList.add('noimg');this.parentNode.innerHTML='<span class=&quot;lib-ico&quot;>${cat.icon}</span>'">`
        : `<span class="lib-ico">${cat.icon}</span>`;
      const done = it.acked_at ? `<span class="chip chip-ok">รับทราบแล้ว</span>`
        : it.viewed_at ? `<span class="chip chip-plain">เปิดแล้ว</span>` : '';
      const ackBtn = it.acked_at ? '' : `<button class="btn btn-ghost btn-sm" onclick="App.libAck(${it.id})">รับทราบ</button>`;
      return `<div class="lib-card">
        <div class="lib-thumb ${it.file_id ? '' : 'noimg'}">${thumb}</div>
        <div class="lib-body">
          <div class="lib-cat">${cat.icon} ${cat.label}</div>
          <div class="lib-title">${esc(it.title)}</div>
          ${it.description ? `<div class="lib-desc">${esc(it.description)}</div>` : ''}
          <div class="lib-actions">
            <button class="btn btn-primary btn-sm" onclick="App.libOpen(${it.id})">เปิดดู</button>
            ${ackBtn}${done}
          </div>
        </div>
      </div>`;
    }).join('');
    byId('libBox').innerHTML = chips + (items.length ? `<div class="lib-grid">${cards}</div>`
      : '<div class="card empty"><span class="e-ico">🔍</span>ไม่มีเอกสารในหมวดนี้</div>');
  },

  libSetFilter(v) { this.libFilter = v; this.renderLib(); },

  // ---------- ประวัติการฝึกอบรม (อ่านอย่างเดียว — หัวหน้าเป็นคนบันทึกให้) ----------
  async vTraining() {
    byId('view').innerHTML = this.devSegHtml() + '<div id="trBox"><div class="card muted">กำลังโหลด...</div></div>';
    const d = await this.api('training_my');
    this.renderTraining(d.items);
  },

  renderTraining(items) {
    if (!items.length) {
      byId('trBox').innerHTML = '<div class="card empty"><span class="e-ico">🎓</span>ยังไม่มีประวัติการฝึกอบรม<br>หัวหน้าสถานีจะบันทึกให้ค่ะ</div>';
      return;
    }
    const rows = items.map(it => {
      const meta = [it.place ? '📍 ' + esc(it.place) : '', it.organizer ? '🏛️ ' + esc(it.organizer) : ''].filter(Boolean).join(' · ');
      const foot = [it.doc_no ? 'หนังสือที่ ' + esc(it.doc_no) : '', it.note ? '📝 ' + esc(it.note) : ''].filter(Boolean).join(' · ');
      return `<div class="list-row">
        <div class="lr-main">
          <div class="lr-title">${esc(it.name)}</div>
          <div class="lr-sub">📅 ${esc(it.date_label)}</div>
          ${meta ? `<div class="tr-meta">${meta}</div>` : ''}
          ${foot ? `<div class="tr-meta">${foot}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    byId('trBox').innerHTML = `<div class="card"><h3>🎓 ผ่านการฝึกอบรม ${items.length} หลักสูตร</h3>${rows}</div>`;
  },

  async libOpen(id) {
    const it = this.libItems.find(i => i.id == id);
    if (!it) return;
    window.open(it.url, '_blank', 'noopener');
    if (!it.viewed_at) {
      it.viewed_at = true;   // sentinel — เปิดแล้ว (ห้ามใช้ toISOString ตามกฎเวลาไทย)
      if (this.data?.library_unread) { this.data.library_unread--; this.paintNavBadge(); }
      this.api('library_view', { id }, { soft: true, noKick: true }).catch(() => {});
      this.renderLib();
    }
  },

  async libAck(id) {
    await this.api('library_ack', { id });
    const it = this.libItems.find(i => i.id == id);
    if (it) {
      if (!it.viewed_at && this.data?.library_unread) { this.data.library_unread--; this.paintNavBadge(); }
      it.acked_at = true; it.viewed_at = true;
    }
    toast('รับทราบแล้ว ขอบคุณค่ะ');
    this.renderLib();
  },

  // ---------- แบบทดสอบ ----------
  quizSets: null,
  quizSet: null, quizQuestions: null, quizIdx: 0, quizAnswers: null,

  async vQuizList() {
    byId('view').innerHTML = this.devSegHtml() + '<div id="quizBox"><div class="card muted">กำลังโหลด...</div></div>';
    const d = await this.api('quiz_list');
    this.quizSets = d.sets;
    this.renderQuizList();
  },

  renderQuizList() {
    if (!this.quizSets.length) {
      byId('quizBox').innerHTML = '<div class="card empty"><span class="e-ico">📝</span>ยังไม่มีแบบทดสอบ<br>หัวหน้าสถานีจะเพิ่มให้เร็วๆ นี้ค่ะ</div>';
      return;
    }
    byId('quizBox').innerHTML = `<div class="lib-grid">${this.quizSets.map(s => {
      const scoreChip = s.attempts > 0
        ? `<span class="chip chip-ok">คะแนนสูงสุด ${s.best_score}/${s.question_count}</span>`
        : `<span class="chip chip-plain">ยังไม่เคยทำ</span>`;
      return `<div class="lib-card">
        <div class="lib-thumb noimg"><span class="lib-ico">📝</span></div>
        <div class="lib-body">
          <div class="lib-title">${esc(s.title)}</div>
          ${s.description ? `<div class="lib-desc">${esc(s.description)}</div>` : ''}
          <div class="tiny">${s.question_count} ข้อ${s.attempts > 0 ? ` • ทำแล้ว ${s.attempts} ครั้ง` : ''}</div>
          <div class="lib-actions">
            <button class="btn btn-primary btn-sm" onclick="App.quizStart(${s.id})">${s.attempts > 0 ? 'ทำอีกครั้ง' : 'เริ่มทำ'}</button>
            ${scoreChip}
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  },

  async quizStart(id) {
    const d = await this.api('quiz_get', { id });
    this.quizSet = d.set;
    this.quizQuestions = d.questions;
    this.quizIdx = 0;
    this.quizAnswers = new Array(d.questions.length).fill(null);
    this.renderQuizQuestion();
  },

  renderQuizQuestion() {
    const q = this.quizQuestions[this.quizIdx];
    const letters = ['ก', 'ข', 'ค', 'ง'];
    const selected = this.quizAnswers[this.quizIdx];
    const isLast = this.quizIdx === this.quizQuestions.length - 1;
    byId('view').innerHTML = `
      <div class="card">
        <div class="tiny">${esc(this.quizSet.title)} — ข้อ ${this.quizIdx + 1}/${this.quizQuestions.length}</div>
        <div class="quiz-q">${esc(q.question)}</div>
        <div class="quiz-opts">
          ${q.choices.map((c, i) => `<button class="quiz-opt${selected === i ? ' selected' : ''}" onclick="App.quizSelect(${i})">
            <span class="quiz-opt-l">${letters[i]}</span>${esc(c)}</button>`).join('')}
        </div>
      </div>
      <div class="row" style="gap:8px;margin-top:10px">
        ${this.quizIdx > 0 ? `<button class="btn btn-ghost" onclick="App.quizPrev()">← ย้อนกลับ</button>` : ''}
        <button class="btn btn-primary" style="flex:1" ${selected === null ? 'disabled' : ''}
          onclick="App.${isLast ? 'quizFinish' : 'quizNext'}()">${isLast ? 'ส่งคำตอบ' : 'ถัดไป →'}</button>
      </div>
      <button class="btn btn-ghost btn-block" onclick="App.go('develop')">← ออกจากแบบทดสอบ</button>`;
  },

  quizSelect(choiceIndex) {
    this.quizAnswers[this.quizIdx] = choiceIndex;
    this.renderQuizQuestion();
  },

  quizNext() {
    if (this.quizIdx >= this.quizQuestions.length - 1) return;
    this.quizIdx++;
    this.renderQuizQuestion();
  },

  quizPrev() {
    if (this.quizIdx <= 0) return;
    this.quizIdx--;
    this.renderQuizQuestion();
  },

  async quizFinish() {
    const answers = this.quizQuestions
      .map((q, i) => ({ question_id: q.id, answer_index: this.quizAnswers[i] }))
      .filter(a => a.answer_index !== null);
    const d = await this.api('quiz_submit', { id: this.quizSet.id, answers });
    byId('view').innerHTML = `
      <div class="card" style="text-align:center;padding:28px">
        <div style="font-size:44px">🎯</div>
        <div style="font-size:15px;margin-top:6px">${esc(this.quizSet.title)}</div>
        <div class="quiz-score">${d.score}/${d.total}</div>
        <div class="row" style="gap:8px;justify-content:center;margin-top:14px">
          <button class="btn btn-primary" onclick="App.quizStart(${this.quizSet.id})">ทำอีกครั้ง</button>
          <button class="btn btn-ghost" onclick="App.go('develop')">กลับหน้ารายการ</button>
        </div>
      </div>`;
  },

  // ---------- สุขภาพ ----------
  healthTab: 'record',
  healthChart: null,

  healthSegHtml() {
    const t = (v, l) => `<button class="${this.healthTab === v ? 'active' : ''}" onclick="App.healthSetTab('${v}')">${l}</button>`;
    return `<div class="seg" id="healthSeg">${t('record', '🩺 ผลตรวจ')}${t('fitness', '🏃 สมรรถภาพ')}${t('vaccine', '💉 วัคซีน')}</div>`;
  },

  healthSetTab(t) { this.healthTab = t; this.vHealth(); },

  async vHealth() {
    byId('view').innerHTML = this.healthSegHtml() + '<div id="healthBox"><div class="card muted">กำลังโหลด...</div></div>';
    if (this.healthTab === 'vaccine') {
      const d = await this.api('vaccine_my');
      this.renderVaccine(d.types);
    } else if (this.healthTab === 'fitness') {
      const d = await this.api('fitness_my');
      this.renderFitness(d.rounds);
    } else {
      const d = await this.api('health_my');
      this.renderHealth(d.records);
    }
  },

  // การ์ดวัคซีน — สถานะรายชนิด (จากเข็มล่าสุด) + ประวัติทุกเข็ม (อ่านอย่างเดียว หัวหน้าเป็นคนกรอก)
  renderVaccine(types) {
    if (this.healthChart) { this.healthChart.destroy(); this.healthChart = null; }
    if (!types.length) {
      byId('healthBox').innerHTML = '<div class="card empty"><span class="e-ico">💉</span>ยังไม่มีชนิดวัคซีนในระบบ<br>หัวหน้าสถานีจะเพิ่มให้ค่ะ</div>';
      return;
    }
    const rows = types.map(t => {
      const sub = t.last_date
        ? `ฉีดล่าสุด ${thaiDate(t.last_date, false)}`
          + (t.due ? ` · ครบรอบ ${thaiDate(t.due, false)}` : '')
          + (t.doses.length > 1 ? ` · ${t.doses.length} เข็ม` : '')
        : (t.valid_months ? `ยังไม่มีบันทึก — ฉีดแล้วคุ้ม ${t.valid_months} เดือน` : 'ยังไม่มีบันทึก');
      return `<div class="vc-row">
        <div class="vc-main"><div class="vc-name">${esc(t.name)}</div><div class="vc-sub">${esc(sub)}</div></div>
        <div class="vc-chip">${vaccineChip(t)}</div>
      </div>`;
    }).join('');

    // ประวัติทุกเข็มเรียงใหม่→เก่า (รวมทุกชนิด)
    const doses = types.flatMap(t => t.doses.map(d => ({ name: t.name, ...d })))
      .sort((a, b) => a.dose_date < b.dose_date ? 1 : -1);
    const histCard = doses.length ? `<div class="card"><h3>ประวัติการฉีด <span class="h-right">${doses.length} ครั้ง</span></h3>
      ${doses.map(d => `<div class="list-row"><span class="dot" style="background:#0ea5e9"></span>
        <div class="lr-main"><div class="lr-title">${esc(d.name)}</div>
          <div class="lr-sub">${thaiDate(d.dose_date)}${d.note ? ' · ' + esc(d.note) : ''}</div></div></div>`).join('')}</div>` : '';

    byId('healthBox').innerHTML = `<div class="card"><h3>💉 การ์ดวัคซีนของฉัน</h3>${rows}
      <div class="tiny" style="margin-top:10px">ข้อมูลนี้หัวหน้าสถานีเป็นคนบันทึกให้ — ถ้าไม่ตรงกับที่ฉีดจริง แจ้งหัวหน้าได้เลยค่ะ</div>
      </div>` + histCard;
  },

  renderFitness(rounds) {
    if (this.healthChart) { this.healthChart.destroy(); this.healthChart = null; }
    if (!rounds.length) {
      byId('healthBox').innerHTML = '<div class="card empty"><span class="e-ico">🏃</span>ยังไม่มีผลทดสอบสมรรถภาพ<br>หัวหน้าสถานีจะบันทึกให้หลังทดสอบค่ะ</div>';
      return;
    }
    byId('healthBox').innerHTML = rounds.map(r => `<div class="card">
      <h3>${esc(r.title)} <span class="h-right">${thaiDate(r.test_date)}</span></h3>
      ${r.items.map(it => `<div class="hm-row">
        <div class="hm-label" style="flex:1">${esc(it.item_name)}</div>
        <div class="hm-val" style="flex:0 0 auto">${it.raw_value !== null ? (+it.raw_value % 1 === 0 ? +it.raw_value : (+it.raw_value).toFixed(1)) : '—'}${it.unit ? ` <span class="hm-unit">${esc(it.unit)}</span>` : ''}</div>
        <div class="hm-chip">${fitnessChip(it.level, it.tone)}</div>
      </div>`).join('')}
    </div>`).join('');
  },

  renderHealth(records) {
    if (this.healthChart) { this.healthChart.destroy(); this.healthChart = null; }
    if (!records.length) {
      byId('healthBox').innerHTML = '<div class="card empty"><span class="e-ico">🩺</span>ยังไม่มีบันทึกผลตรวจสุขภาพ<br>หัวหน้าสถานีจะบันทึกให้หลังคุณไปตรวจสุขภาพค่ะ</div>';
      return;
    }
    const latest = records[0];
    // การ์ดค่าล่าสุด — แต่ละค่ามี chip จัดระดับ (เขียว=ปกติ ส้ม=เฝ้าระวัง แดง=ผิดปกติ ฟ้า=ข้อมูล)
    const metric = (label, val, unit, cls) => (val === null || val === undefined || val === '')
      ? '' : `<div class="hm-row">
          <div class="hm-label">${label}</div>
          <div class="hm-val">${val}${unit ? ` <span class="hm-unit">${unit}</span>` : ''}</div>
          <div class="hm-chip">${healthChip(cls)}</div>
        </div>`;
    const latestCard = `<div class="card">
      <h3>ผลตรวจล่าสุด <span class="h-right">${thaiDate(latest.record_date)}</span></h3>
      ${latest.checkup_place ? `<div class="tiny" style="margin:-4px 0 8px">📍 ${esc(latest.checkup_place)}</div>` : ''}
      <div class="hm-grid">
        ${metric('น้ำหนัก', latest.weight_kg, 'กก.', null)}
        ${metric('ส่วนสูง', latest.height_cm, 'ซม.', null)}
        ${metric('BMI', latest.bmi ?? '', '', latest.bmi_class)}
        ${metric('ความดัน', (latest.bp_sys && latest.bp_dia) ? latest.bp_sys + '/' + latest.bp_dia : '', 'mmHg', latest.bp_class)}
        ${metric('รอบเอว', latest.waist_cm, 'ซม.', latest.waist_class)}
        ${metric('ชีพจร', latest.pulse, 'ครั้ง/นาที', latest.pulse_class)}
      </div>
      ${latest.note ? `<div class="hm-note">📝 ${esc(latest.note)}</div>` : ''}
    </div>`;

    // กราฟแนวโน้มน้ำหนัก (ถ้ามี ≥2 ครั้งที่ชั่งน้ำหนัก)
    const wSeries = records.filter(r => r.weight_kg !== null).slice().reverse();
    const chartCard = wSeries.length >= 2
      ? '<div class="card"><h3>📈 แนวโน้มน้ำหนัก</h3><div style="height:200px"><canvas id="chHealth"></canvas></div></div>'
      : '';

    // ประวัติทุกครั้ง
    const histCard = `<div class="card"><h3>ประวัติผลตรวจ <span class="h-right">${records.length} ครั้ง</span></h3>
      ${records.map(r => `<div class="list-row"><span class="dot" style="background:#0ea5e9"></span>
        <div class="lr-main"><div class="lr-title">${thaiDate(r.record_date)}</div>
          <div class="lr-sub">${healthSummary(r)}</div></div></div>`).join('')}</div>`;

    byId('healthBox').innerHTML = latestCard + chartCard + histCard;

    if (wSeries.length >= 2) {
      this.healthChart = new Chart(byId('chHealth'), {
        type: 'line',
        data: { labels: wSeries.map(r => thaiDate(r.record_date, false)),
          datasets: [{ label: 'น้ำหนัก (กก.)', data: wSeries.map(r => +r.weight_kg),
            borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,.12)', fill: true, tension: .3,
            pointRadius: 4, pointBackgroundColor: '#0ea5e9' }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { bodyFont: { family: 'Kanit' }, titleFont: { family: 'Kanit' } } },
          scales: { x: { ticks: { font: { family: 'Kanit', size: 11 } }, grid: { display: false } },
            y: { ticks: { font: { family: 'Kanit', size: 11 } }, grid: { color: '#eef1ec' } } } },
      });
    }
  },

  // ---------- ประวัติ ----------
  histYm: null,
  async vHistory() {
    this.histYm = this.histYm || ymNow();
    byId('view').innerHTML = `
      <div class="card">
        <div class="cal-head">
          <button class="cal-nav" onclick="App.histMove(-1)">‹</button>
          <span class="cal-title">${thaiMonth(this.histYm)}</span>
          <button class="cal-nav" onclick="App.histMove(1)">›</button>
        </div>
        <div id="histStats"></div>
      </div>
      <div id="histList"><div class="card muted">กำลังโหลด...</div></div>`;
    const d = await this.api('my_history', { ym: this.histYm });
    const ontime = d.attendance.filter(a => !+a.late).length, late = d.attendance.length - ontime;
    byId('histStats').innerHTML = `
      <div class="grid-4">
        <div class="kpi k-ok"><div class="k-label">ตรงเวลา</div><div class="k-value">${ontime}</div></div>
        <div class="kpi k-late"><div class="k-label">สาย</div><div class="k-value">${late}</div></div>
        <div class="kpi k-leave"><div class="k-label">ลา/หยุด</div><div class="k-value">${d.day_offs.length}</div></div>
        <div class="kpi"><div class="k-label">มาทั้งหมด</div><div class="k-value">${d.attendance.length}</div></div>
      </div>`;
    const nights = d.night_shifts || [];
    byId('histList').innerHTML = (this.historyCard(d.attendance, 'บันทึกเช็คชื่อ') || '<div class="card empty"><span class="e-ico">📭</span>เดือนนี้ยังไม่มีบันทึก</div>')
      + (nights.length ? `<div class="card"><h3>🌙 เวรกลางคืน <span class="h-right">${nights.length} คืน</span></h3>${nights.map(n => `
        <div class="list-row"><span class="dot" style="background:#6366f1"></span>
          <div class="lr-main"><div class="lr-title">${thaiDate(n.duty_date)}</div>
          <div class="lr-sub">ลงเวร ${n.time_in.substr(11, 5)} น.</div></div></div>`).join('')}</div>` : '')
      + (d.day_offs.length ? `<div class="card"><h3>🔵 วันลา/หยุด</h3>${d.day_offs.map(o => `
        <div class="list-row"><span class="dot dot-leave"></span>
          <div class="lr-main"><div class="lr-title">${thaiDate(o.off_date)}</div>
          <div class="lr-sub">${offLabel(o.type)}${o.note ? ' — ' + esc(o.note) : ''}</div></div></div>`).join('')}</div>` : '');
  },

  histMove(dir) {
    const [Y, M] = this.histYm.split('-').map(Number);
    const d = new Date(Y, M - 1 + dir, 1);
    this.histYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.vHistory();
  },

  // ---------- โปรไฟล์ ----------
  vProfile() {
    byId('view').innerHTML = `
      <div class="card" style="text-align:center;padding:26px">
        <div class="avatar" style="width:72px;height:72px;font-size:26px;margin:0 auto 10px;background:var(--green-100);color:var(--green-900)">${esc(initials(this.user.name))}</div>
        <div style="font-size:19px;font-weight:600">${esc(this.user.name)}</div>
        <div class="muted">${esc(this.user.position || 'เจ้าหน้าที่')} • @${esc(this.user.username)}</div>
      </div>
      <div class="card">
        <div class="setting-row"><div class="sr-main"><div class="sr-title">🔑 เปลี่ยนรหัสผ่าน</div></div>
          <button class="btn btn-ghost btn-sm" onclick="App.changePass()">เปลี่ยน</button></div>
        <div class="setting-row"><div class="sr-main"><div class="sr-title">📲 ติดตั้งเป็นแอป</div>
          <div class="sr-sub">เปิดเมนูเบราว์เซอร์ → "เพิ่มไปยังหน้าจอโฮม"</div></div></div>
        ${Push.rowHtml()}
      </div>
      <button class="btn btn-danger-ghost btn-block" onclick="App.logout()">ออกจากระบบ</button>`;
  },

  async changePass() {
    const { value: f } = await Swal.fire({
      title: 'เปลี่ยนรหัสผ่าน',
      html: `<input type="password" id="p0" class="swal2-input" placeholder="รหัสผ่านเดิม" style="font-family:Kanit">
             <input type="password" id="p1" class="swal2-input" placeholder="รหัสผ่านใหม่ (6 ตัวขึ้นไป)" style="font-family:Kanit">`,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      preConfirm: () => ({ old_password: byId('p0').value, new_password: byId('p1').value }),
    });
    if (!f) return;
    const d = await this.api('change_password', f);
    toast(d.message);
  },
};

// =====================================================
// แจ้งเตือน Web Push (v37)
// ⚠️ iPhone ได้แจ้งเตือนเฉพาะตอนที่ "เพิ่มลงหน้าจอโฮม" แล้วเท่านั้น (iOS 16.4+) — เปิดใน Safari ธรรมดาไม่มีทางได้
// ⚠️ Notification.requestPermission() ต้องเรียกในจังหวะกดสด ห้ามมี await คั่นก่อน (WebKit เหมือนกรณีเปิดกล้อง → PROGRESS lesson 10)
// =====================================================
const Push = {
  vapid: null,      // กุญแจสาธารณะจาก server (ว่าง = หัวหน้ายังไม่ได้สร้าง)
  enabled: false,   // สวิตช์รวมฝั่ง server
  dev: null,        // ข้อมูลเครื่องที่ตรวจได้ (cache ต่อ session)

  /** รหัสประจำเครื่อง สุ่มครั้งเดียวเก็บใน localStorage (ล้าง = นับเป็นเครื่องใหม่ ไม่เป็นไร) */
  deviceKey() {
    let k = localStorage.getItem('fc_device');
    if (!k || !/^[a-f0-9]{32}$/.test(k)) {
      k = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('fc_device', k);
    }
    return k;
  },

  /** ตรวจว่าเครื่องนี้คืออะไร รองรับ push ไหม ติดตั้งเป็นแอปแล้วหรือยัง */
  info() {
    const ua = navigator.userAgent;
    // iPadOS ใหม่รายงานตัวเป็น Mac — แยกด้วย maxTouchPoints
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    let browser = 'other';
    if (/Line\//i.test(ua)) browser = 'line';
    else if (/EdgA?\//.test(ua)) browser = 'edge';
    else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
    else if (/FxiOS|Firefox/.test(ua)) browser = 'firefox';
    else if (/CriOS|Chrome/.test(ua)) browser = 'chrome';
    else if (/Safari/.test(ua)) browser = 'safari';
    let os = '', m;
    if (iOS && (m = ua.match(/OS (\d+[_.]\d+)/))) os = m[1].replace('_', '.');
    else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) os = m[1];
    return {
      device_key: this.deviceKey(),
      platform: iOS ? 'ios' : android ? 'android' : /Win|Mac|Linux|CrOS/.test(ua) ? 'desktop' : 'other',
      browser, os_version: os, standalone, push_supported: supported,
      push_perm: supported ? Notification.permission : 'unsupported',
      ua: ua.slice(0, 255),
    };
  },

  /** รายงานเครื่องขึ้น server (ทุกครั้งที่เปิดแอป) — เงียบเสมอ ห้ามรบกวนหน้าแอปถ้าพลาด */
  async report() {
    this.dev = this.info();
    try {
      const d = await App.api('device_report', this.dev, { soft: true, noKick: true });
      this.vapid = d.vapid_public || '';
      this.enabled = !!d.push_enabled;
      // เคยกดอนุญาตไว้แล้ว → ต่ออายุ subscription เงียบๆ (endpoint หมดอายุเองได้)
      if (this.enabled && this.vapid && this.dev.push_perm === 'granted') this.sync().catch(() => {});
    } catch (_) {}
  },

  b64ToU8(b64) {
    const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4));
    const a = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  },

  u8ToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  /** ขอ subscription จากเบราว์เซอร์แล้วส่งขึ้น server (เรียกได้เฉพาะตอน permission = granted แล้ว) */
  async sync() {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    // กุญแจ VAPID ฝั่ง server เปลี่ยน = ของเดิมใช้ไม่ได้ ต้องถอนแล้วขอใหม่
    if (sub && sub.options && sub.options.applicationServerKey
        && this.u8ToB64(sub.options.applicationServerKey) !== this.vapid) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.b64ToU8(this.vapid) });
    }
    const j = sub.toJSON();
    await App.api('push_subscribe', {
      endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device_key: this.deviceKey(),
    }, { soft: true });
    return true;
  },

  /** ปุ่ม "เปิดแจ้งเตือน" — ต้องเรียก requestPermission ก่อน await ตัวอื่นเสมอ */
  async enable() {
    const d = this.dev || (this.dev = this.info());
    if (!d.push_supported) return toast('เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน', 'error');
    if (d.platform === 'ios' && !d.standalone) return this.iosGuide();

    // ⚠️ ห้ามมี await คั่นก่อนบรรทัดนี้ — WebKit กินสิทธิ์กดสดไปแล้วจะไม่เด้งขอสิทธิ์
    let perm;
    try { perm = await Notification.requestPermission(); }
    catch (_) { return toast('ขออนุญาตแจ้งเตือนไม่สำเร็จ', 'error'); }
    if (this.vapid === null) await this.report();          // เผื่อกดเร็วกว่าที่ report() จะกลับมา
    if (!this.vapid) return toast('หัวหน้ายังไม่ได้สร้างกุญแจแจ้งเตือน', 'error');
    this.dev.push_perm = perm;
    if (perm !== 'granted') {
      this.refreshUI();
      return toast(perm === 'denied' ? 'ถูกปฏิเสธ — ต้องไปเปิดในตั้งค่าเบราว์เซอร์' : 'ยังไม่ได้อนุญาต', 'error');
    }
    try { await this.sync(); } catch (e) { return toast('เปิดแจ้งเตือนไม่สำเร็จ: ' + e.message, 'error'); }
    App.api('device_report', this.info(), { soft: true }).catch(() => {});
    this.refreshUI();
    toast('เปิดแจ้งเตือนแล้ว 🔔');
  },

  async disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await App.api('push_unsubscribe', { endpoint: sub.endpoint }, { soft: true });
      await sub.unsubscribe();
    }
    this.refreshUI();
    toast('ปิดแจ้งเตือนแล้ว');
  },

  /** วาดหน้าใหม่หลังเปิด/ปิด — แอดมินอยู่หน้าตั้งค่า (ห้ามเรียก vProfile ของเจ้าหน้าที่ทับ) */
  refreshUI() {
    App.user?.role === 'admin' ? Admin.pushRefresh() : App.vProfile();
  },

  iosGuide() {
    Swal.fire({
      title: '📲 iPhone ต้องติดตั้งก่อน',
      html: `<div style="text-align:left;font-size:14px;line-height:1.9">
        iPhone จะส่งแจ้งเตือนให้เฉพาะแอปที่เพิ่มลงหน้าจอโฮมแล้วเท่านั้นนะครับ<br><br>
        <b>1.</b> เปิดเว็บนี้ด้วย <b>Safari</b> (Chrome ไม่ได้)<br>
        <b>2.</b> แตะปุ่มแชร์ <b>􀈂</b> ด้านล่างจอ<br>
        <b>3.</b> เลื่อนหาแล้วแตะ <b>"เพิ่มไปยังหน้าจอโฮม"</b><br>
        <b>4.</b> เปิดแอปจาก<b>ไอคอนบนหน้าจอโฮม</b> แล้วมากดเปิดแจ้งเตือนอีกครั้ง
      </div>`,
      confirmButtonText: 'เข้าใจแล้ว',
    });
  },

  /** แถวตั้งค่าแจ้งเตือนในหน้าโปรไฟล์ */
  rowHtml() {
    const d = this.dev || (this.dev = this.info());
    const row = (sub, btn) => `<div class="setting-row"><div class="sr-main"><div class="sr-title">🔔 แจ้งเตือนเข้ามือถือ</div>
      <div class="sr-sub">${sub}</div></div>${btn}</div>`;
    if (!d.push_supported) return row('เบราว์เซอร์นี้ยังไม่รองรับ', '');
    if (d.platform === 'ios' && !d.standalone) {
      return row('iPhone ต้องเพิ่มลงหน้าจอโฮมก่อน', '<button class="btn btn-ghost btn-sm" onclick="Push.iosGuide()">วิธีทำ</button>');
    }
    if (d.push_perm === 'granted') return row('เปิดอยู่ — ประกาศและผลอนุมัติลาจะเด้งขึ้นหน้าจอ', '<button class="btn btn-ghost btn-sm" onclick="Push.disable()">ปิด</button>');
    if (d.push_perm === 'denied')  return row('ถูกบล็อกไว้ — เปิดใหม่ได้ที่ตั้งค่าเบราว์เซอร์', '');
    return row('เปิดไว้จะได้รู้ทันทีเมื่อมีประกาศหรือผลอนุมัติลา', '<button class="btn btn-primary btn-sm" onclick="Push.enable()">เปิด</button>');
  },
};

// =====================================================
// Utilities
// =====================================================
const $app = () => document.getElementById('app');
const byId = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const todayStr = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
const ymNow = () => todayStr().substr(0, 7);
const initials = (name) => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
const offLabel = (t) => ({ dayoff: 'วันหยุด', sick: 'ลาป่วย', personal: 'ลากิจ' }[t] || t);
const LIB_CAT = {
  doc:    { icon: '📄', label: 'เอกสาร' },
  slide:  { icon: '📊', label: 'สไลด์' },
  news:   { icon: '📰', label: 'ข่าว' },
  video:  { icon: '🎬', label: 'วิดีโอ' },
  manual: { icon: '📘', label: 'คู่มือ' },
};

// ป้ายจัดระดับสุขภาพ/สมรรถภาพ — cls = {label, level} จาก backend (level: ok/warn/bad/info) หรือ null = ยังไม่จัดระดับ
const HEALTH_LV = { ok: '#16a34a', warn: '#f59e0b', bad: '#dc2626', info: '#0ea5e9' };
function healthChip(cls) {
  if (!cls) return `<span class="hchip" style="background:#f1f5f9;color:#64748b">ยังไม่จัดระดับ</span>`;
  const c = HEALTH_LV[cls.level] || '#64748b';
  return `<span class="hchip" style="background:${c}1a;color:${c}">${esc(cls.label)}</span>`;
}
// ป้ายระดับสมรรถภาพ — level = label string, tone = ok/warn/bad จาก backend (null = ยังไม่จัดระดับ)
function fitnessChip(level, tone) {
  if (!level) return `<span class="hchip" style="background:#f1f5f9;color:#64748b">ยังไม่จัดระดับ</span>`;
  const c = HEALTH_LV[tone] || '#64748b';
  return `<span class="hchip" style="background:${c}1a;color:${c}">${esc(level)}</span>`;
}
// ป้ายสถานะวัคซีน — st = {level, label} จาก backend (level: none/ok/warn/bad) · none = ยังไม่มีข้อมูล
const VAC_ICON = { ok: '🟢', warn: '🟡', bad: '🔴', none: '⚪️' };
function vaccineChip(st) {
  const c = st.level === 'none' ? '#64748b' : (HEALTH_LV[st.level] || '#64748b');
  return `<span class="hchip" style="background:${c}1a;color:${c}">${VAC_ICON[st.level] || ''} ${esc(st.label)}</span>`;
}
// สรุปสั้น 1 บรรทัดของผลตรวจ (ใช้ในรายการประวัติ)
function healthSummary(r) {
  const p = [];
  if (r.weight_kg !== null) p.push(`${(+r.weight_kg).toFixed(1)} กก.`);
  if (r.bmi != null) p.push(`BMI ${r.bmi}`);
  if (r.bp_sys && r.bp_dia) p.push(`ความดัน ${r.bp_sys}/${r.bp_dia}`);
  if (r.pulse) p.push(`ชีพจร ${r.pulse}`);
  return p.length ? esc(p.join(' • ')) : 'ไม่มีค่าตัวเลข';
}

const TH_D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_M = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function thaiDate(ymd, withDow = true) {
  const [Y, M, D] = ymd.split('-').map(Number);
  const dow = new Date(Y, M - 1, D).getDay();
  return (withDow ? TH_D[dow] + ' ' : '') + D + ' ' + TH_M[M] + ' ' + (Y + 543);
}
/** วันที่แบบสั้นสำหรับช่องตาราง — '12 ส.ค. 69' */
const vacShortDate = (ymd) => { const [Y, M, D] = ymd.split('-').map(Number); return `${D} ${TH_M[M]} ${String(Y + 543).slice(-2)}`; };
const thaiMonth = (ym) => { const [Y, M] = ym.split('-').map(Number); return TH_M[M].replace('.', '') + ' ' + (Y + 543); };

/** อายุ (ปี) จากวันเกิด 'YYYY-MM-DD' — null ถ้าไม่มี/ผิดรูปแบบ */
function ageFrom(birthdate) {
  if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
  const [Y, M, D] = birthdate.split('-').map(Number);
  const n = new Date();
  let age = n.getFullYear() - Y;
  if (n.getMonth() + 1 < M || (n.getMonth() + 1 === M && n.getDate() < D)) age--;
  return age >= 0 && age < 120 ? age : null;
}

function toast(msg, icon = 'success') {
  Swal.fire({ toast: true, position: 'top', icon, title: msg, showConfirmButton: false, timer: 2600, timerProgressBar: true });
}

function getPosition() {
  return new Promise((res, rej) => {
    // code 0 = ไม่รองรับ/ไม่ใช่ secure context (แยกจาก GeolocationPositionError จริง)
    if (!navigator.geolocation) return rej({ code: 0, message: 'browser ไม่รองรับ' });
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => rej(err), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

// แปลง error ตำแหน่งเป็นข้อความไทยที่บอกวิธีแก้ตรงสาเหตุ (+ รหัสไว้ debug)
function gpsErrorMessage(err) {
  const code = err && typeof err.code === 'number' ? err.code : -1;
  const tag = `<br><small style="opacity:.6">(รหัส ${code})</small>`;
  if (code === 1) return  // PERMISSION_DENIED — iOS จำการปฏิเสธไว้ ต้องเปิดใน Settings
    'iPhone ปิดสิทธิ์เข้าถึงตำแหน่งของ Safari ไว้ค่ะ<br><br>' +
    '<b>วิธีเปิด:</b><br>1. ตั้งค่า → ความเป็นส่วนตัวและความปลอดภัย → บริการหาตำแหน่ง → <b>เปิด</b><br>' +
    '2. เลื่อนหา Safari → เลือก <b>ขณะใช้แอป</b><br>' +
    '3. ตั้งค่า → แอป → Safari → ตำแหน่ง → <b>อนุญาต</b><br>' +
    '4. กลับมารีเฟรชหน้านี้แล้วกดเช็คชื่อใหม่' + tag;
  if (code === 2) return 'หาสัญญาณ GPS ไม่ได้ ลองออกไปที่โล่งแล้วกดใหม่' + tag;      // POSITION_UNAVAILABLE
  if (code === 3) return 'หาตำแหน่งนานเกินไป กดเช็คชื่ออีกครั้งค่ะ' + tag;              // TIMEOUT
  if (code === 0) return 'หน้านี้ต้องเปิดผ่าน HTTPS ถึงจะใช้ GPS ได้' + tag;
  return 'กรุณาเปิดการเข้าถึงตำแหน่ง (Location) แล้วลองใหม่' + tag;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* =====================================================
   ยืนยันใบหน้า (v33) — คำนวณ descriptor ในเครื่อง ส่งขึ้นเซิร์ฟเวอร์แค่เวกเตอร์ 128 ตัว
   ⚠️ detector ต้องเป็น ssd_mobilenetv1 ให้ตรงกับตอนลงทะเบียน (วัดแล้ว tiny จับรูปเซลฟี่หน้าใหญ่ไม่ได้ 18.5%)
      ถ้าเปลี่ยน detector ข้างใดข้างหนึ่ง กรอบ/แลนด์มาร์กจะเลื่อน = เกณฑ์ที่วัดมาใช้ไม่ได้
   ===================================================== */
const FACE_MODEL_URI = 'assets/models';
let _faceLibP = null, _faceModelP = null;

/** โหลด face-api.js (1.3MB) ครั้งเดียว — มี timeout กันค้างเงียบ */
function loadFaceLib() {
  if (_faceLibP) return _faceLibP;
  _faceLibP = new Promise((resolve, reject) => {
    if (window.faceapi) return resolve(window.faceapi);
    const s = document.createElement('script');
    s.src = 'assets/face-api.js?v=33';
    s.onload = () => window.faceapi ? resolve(window.faceapi) : reject(new Error('lib ไม่โหลด'));
    s.onerror = () => reject(new Error('โหลดไลบรารีใบหน้าไม่ได้'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('โหลดไลบรารีใบหน้านานเกินไป')), 15000);
  }).catch(e => { _faceLibP = null; throw e; });
  return _faceLibP;
}

/** โหลดน้ำหนักโมเดล (~12MB ครั้งแรก แล้ว browser cache) + ถอยไป cpu ถ้า WebGL ใช้ไม่ได้ */
function loadFaceModels() {
  if (_faceModelP) return _faceModelP;
  _faceModelP = (async () => {
    const f = await loadFaceLib();
    await Promise.race([
      Promise.all([
        f.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_URI),
        f.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URI),
        f.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URI),
      ]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('โหลดโมเดลใบหน้านานเกินไป')), 40000)),
    ]);
    // เฟรมแรกบน iOS อาจล้มถ้า WebGL ไม่รองรับ float texture → ถอยไป cpu (ช้าแต่ได้ผลถูก)
    try { await f.detectSingleFace(document.createElement('canvas'), faceOpts()); }
    catch { try { await f.tf.setBackend('cpu'); await f.tf.ready(); } catch { /* ปล่อยให้พังตอนใช้จริง */ } }
    return f;
  })().catch(e => { _faceModelP = null; throw e; });
  return _faceModelP;
}

const faceOpts = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

/** คำนวณ descriptor จาก <video>/<canvas>/<img> — คืน {desc, box} หรือ null ถ้าไม่พบหน้า */
async function faceDescriptorFrom(el) {
  const d = await faceapi.detectSingleFace(el, faceOpts()).withFaceLandmarks().withFaceDescriptor();
  return d ? { desc: Array.from(d.descriptor), box: d.detection.box, score: d.detection.score } : null;
}

/** เปิดกล้องสด + กรอบจับหน้า → เก็บ 3 เฟรมนิ่งแล้วคืนทั้งหมด
 *  คืน {descs:[[...],...], dataUrl} | 'denied' | 'timeout' | 'cancel'
 *  เก็บ 3 เฟรมเพราะเฟรมเดียวอาจเบลอ/กระพริบตา — เซิร์ฟเวอร์เอาเฟรมที่ใกล้สุดไปตัดสิน
 */
async function faceLiveCapture() {
  await loadFaceModels();
  const ov = document.createElement('div');
  ov.className = 'fov';
  ov.innerHTML = `
    <div class="fov-box">
      <div class="fov-head">🙂 ยืนยันใบหน้า</div>
      <div class="fov-stage">
        <video class="fov-vid" autoplay muted playsinline></video>
        <canvas class="fov-cv"></canvas>
      </div>
      <div class="fov-st">กำลังเปิดกล้อง...</div>
      <div class="fov-act">
        <button class="btn btn-ghost fov-cancel">ยกเลิก</button>
        <button class="btn btn-primary fov-shot" disabled>📸 ถ่ายเลย</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const vid = ov.querySelector('.fov-vid'), cv = ov.querySelector('.fov-cv'), st = ov.querySelector('.fov-st');
  let stream = null, closed = false, forced = false;
  const cleanup = () => {
    closed = true;
    if (stream) stream.getTracks().forEach(t => t.stop());   // ต้องปิดกล้องทุกทางออก ไม่ให้ไฟกล้องค้าง
    ov.remove();
    document.removeEventListener('visibilitychange', onHide);
  };
  const onHide = () => { if (document.hidden && !closed) { result = 'cancel'; cleanup(); } };
  let result = null;
  ov.querySelector('.fov-cancel').onclick = () => { result = 'cancel'; cleanup(); };
  ov.querySelector('.fov-shot').onclick = () => { forced = true; };
  document.addEventListener('visibilitychange', onHide);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch { cleanup(); return 'denied'; }
  if (closed) return result || 'cancel';
  vid.srcObject = stream;
  await new Promise(r => vid.onloadedmetadata = r);
  st.textContent = 'จัดหน้าให้อยู่ในกรอบ';
  ov.querySelector('.fov-shot').disabled = false;

  const cx = cv.getContext('2d');
  const t0 = Date.now();
  let stable = 0, lastCx = null, descs = [], shot = null;
  try {
    while (!closed && descs.length < 3) {
      if (Date.now() - t0 > 30000) { cleanup(); return 'timeout'; }
      const det = await faceapi.detectSingleFace(vid, faceOpts());
      if (closed) break;
      cv.width = vid.clientWidth; cv.height = vid.clientHeight;
      cx.clearRect(0, 0, cv.width, cv.height);
      let ready = false;
      if (det) {
        const b = faceapi.resizeResults(det, { width: cv.width, height: cv.height }).box;
        const minSide = Math.min(vid.videoWidth, vid.videoHeight);
        const bigEnough = det.box.width >= minSide * 0.3;
        const centered = Math.abs((det.box.x + det.box.width / 2) / vid.videoWidth - 0.5) < 0.22;
        const cxNow = det.box.x + det.box.width / 2;
        const stillEnough = lastCx === null || Math.abs(cxNow - lastCx) < vid.videoWidth * 0.05;
        lastCx = cxNow;
        ready = det.score >= 0.6 && bigEnough && centered && stillEnough;
        cx.strokeStyle = ready ? '#22c55e' : '#f59e0b';
        cx.lineWidth = 3;
        cx.strokeRect(b.x, b.y, b.width, b.height);
        st.textContent = ready ? 'นิ่งไว้นะคะ...' : (!bigEnough ? 'ขยับเข้าใกล้อีกนิด' : !centered ? 'จัดหน้าให้อยู่กลางกรอบ' : 'กำลังจับภาพ...');
      } else {
        lastCx = null;
        st.textContent = 'ยังไม่เห็นใบหน้า — หันเข้าหาแสงค่ะ';
      }
      stable = ready ? stable + 1 : 0;
      if (stable >= 2 || forced) {
        const snap = document.createElement('canvas');
        snap.width = vid.videoWidth; snap.height = vid.videoHeight;
        snap.getContext('2d').drawImage(vid, 0, 0);
        const got = await faceDescriptorFrom(snap);
        if (got) {
          descs.push(got.desc);
          if (!shot) shot = snap.toDataURL('image/jpeg', 0.6);   // เก็บเฟรมแรกไว้ใช้เป็นเซลฟี่/หลักฐาน
          st.textContent = `เก็บภาพแล้ว ${descs.length}/3`;
        }
        if (forced) break;
        stable = 0;
      }
    }
  } finally { if (!closed) cleanup(); }
  if (result === 'cancel') return 'cancel';
  if (!descs.length) return 'timeout';
  return { descs, dataUrl: shot };
}

/** ยืนยันใบหน้าให้ครบกระบวนการ — คืน {ok:true,dataUrl} | {flagged:true,dataUrl} | 'cancel'
 *  liveFirst=false = ใช้ทางถอย (input capture) เพราะ getUserMedia ใช้ไม่ได้/เคยถูกปฏิเสธ
 *  ⚠️ ห้ามมี await ก่อนเรียกฟังก์ชันนี้ตอน liveFirst=false — captureSelfie() ต้องอยู่ในจังหวะกดสด (iOS)
 */
async function faceVerifyFlow(ctx, liveFirst) {
  let dataUrl = null, live = liveFirst, lastLeft = null;
  for (let round = 0; round < 6; round++) {
    let descs = null;
    if (live) {
      let cap;
      try { cap = await faceLiveCapture(); }
      catch (e) { await faceSkip(ctx, 'no_lib', null); return { flagged: true, dataUrl }; }
      if (cap === 'cancel') return 'cancel';
      if (cap === 'denied') {
        // สิทธิ์ "กดสด" หมดไปกับ getUserMedia ที่ถูกปฏิเสธแล้ว → ต้องให้ผู้ใช้แตะใหม่ ก่อนเปิด file picker
        localStorage.setItem('fc_gum', '0');
        const c = await Swal.fire({ icon: 'info', title: 'เปิดกล้องสดไม่ได้',
          text: 'แตะปุ่มด้านล่างเพื่อถ่ายรูปยืนยันแทนค่ะ', confirmButtonText: '📸 ถ่ายรูป',
          showCancelButton: true, cancelButtonText: 'ยกเลิก' });
        if (!c.isConfirmed) return 'cancel';
        live = false;
        continue;                                  // วนใหม่ในจังหวะกดสดของปุ่มนี้
      }
      if (cap === 'timeout') {
        const c = await Swal.fire({ icon: 'warning', title: 'จับใบหน้าไม่ได้',
          text: 'ลองใหม่อีกครั้ง หรือข้ามไปเช็คชื่อ (หัวหน้าจะเห็นหมายเหตุ)',
          confirmButtonText: 'ลองใหม่', showCancelButton: true, cancelButtonText: 'ข้ามไปเช็คชื่อ' });
        if (c.isConfirmed) continue;
        await faceSkip(ctx, 'no_face', null);
        return { flagged: true, dataUrl };
      }
      descs = cap.descs; dataUrl = cap.dataUrl;
      localStorage.removeItem('fc_gum');
    } else {
      const img = await captureSelfie();
      if (!img) return 'cancel';
      dataUrl = img;
      try {
        await loadFaceModels();
        const el = new Image();
        await new Promise(r => { el.onload = r; el.onerror = r; el.src = img; });
        const got = await faceDescriptorFrom(el);
        if (!got) {
          const c = await Swal.fire({ icon: 'warning', title: 'ไม่พบใบหน้าในรูป',
            text: 'ถ่ายให้เห็นหน้าชัดๆ อีกครั้งค่ะ', confirmButtonText: 'ถ่ายใหม่',
            showCancelButton: true, cancelButtonText: 'ข้ามไปเช็คชื่อ' });
          if (c.isConfirmed) continue;
          await faceSkip(ctx, 'no_face', dataUrl);
          return { flagged: true, dataUrl };
        }
        descs = [got.desc];
      } catch {
        await faceSkip(ctx, 'no_lib', dataUrl);
        return { flagged: true, dataUrl };
      }
    }

    // เซิร์ฟเวอร์ตัดสิน — ส่งทีละเฟรม หยุดทันทีที่ผ่าน (แต่ละครั้งนับเป็น 1 try ฝั่งเซิร์ฟเวอร์)
    // แนบรูปเฉพาะครั้งสุดท้ายที่เหลือ (attempts_left===1) → ทางที่ผ่านเลย ไม่มีรูปออกจากเครื่องเลย
    let d = null;
    for (const desc of descs) {
      d = await App.api('face_verify', { context: ctx, descriptor: desc,
        photo: lastLeft === 1 ? dataUrl : undefined });
      lastLeft = d.attempts_left;
      if (d.next !== 'retry') break;
    }
    if (d.next === 'checkin') { toast(d.message); return { ok: true, dataUrl }; }
    if (d.next === 'checkin_flagged') {
      await Swal.fire({ icon: 'warning', title: 'ยืนยันใบหน้าไม่ผ่าน',
        text: 'เช็คชื่อได้ แต่หัวหน้าจะเห็นหมายเหตุว่ายืนยันไม่ผ่านค่ะ', confirmButtonText: 'เข้าใจแล้ว' });
      return { flagged: true, dataUrl };
    }
    const c = await Swal.fire({ icon: 'error', title: 'ยังไม่ตรงกับใบหน้าที่ลงทะเบียน',
      html: `เหลืออีก <b>${d.attempts_left}</b> ครั้ง<div style="margin-top:8px;font-size:13px;color:#64748b">
             ถอดหมวก/แว่นกันแดด · หันเข้าหาแสง · ให้เห็นหน้าเต็มๆ</div>`,
      confirmButtonText: 'ลองอีกครั้ง', showCancelButton: true, cancelButtonText: 'ยกเลิก' });
    if (!c.isConfirmed) return 'cancel';
  }
  return { flagged: true, dataUrl };
}

/** แจ้งเซิร์ฟเวอร์ว่ายืนยันไม่ได้ (กล้อง/ไลบรารีพัง) → เผาโควตา = ผ่านแบบติดธง ไม่ปล่อยผ่านเงียบ */
async function faceSkip(ctx, reason, photo) {
  try { await App.api('face_verify', { context: ctx, skip: 1, reason, photo: photo || undefined }, { soft: true }); }
  catch { /* ถ้ายิงไม่ได้ ก็ให้ h_checkin เด้ง 'กรุณายืนยันใบหน้าก่อน' เอง */ }
}

/** ใช้กล้องสดได้ไหม — ตัดสินแบบ synchronous เพื่อไม่เผาสิทธิ์ "กดสด" ของ iOS */
function faceCanLive() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    && window.isSecureContext && localStorage.getItem('fc_gum') !== '0';
}

/** ถ่ายเซลฟี่ผ่านกล้องหน้า (input capture) คืน dataURL หรือ null ถ้ายกเลิก */
function captureSelfie() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'user';
    inp.onchange = async () => {
      if (!inp.files[0]) return resolve(null);
      resolve(await compressImage(inp.files[0], 1000, 0.6));   // เซลฟี่เอาพอเห็นหน้า ไม่ต้องชัดมาก — ไฟล์เล็ก ส่งขึ้น Drive เร็ว
    };
    inp.oncancel = () => resolve(null);
    inp.click();
  });
}

/** ย่อรูปก่อนอัปโหลด (max 1200px, jpeg 70%) */
function compressImage(file, maxDim = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}
