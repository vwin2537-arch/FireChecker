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
      if (byId('rPass').value !== byId('rPass2').value) return toast('รหัสผ่านไม่ตรงกัน', 'error');
      const d2 = await this.api('register', { user_id: +byId('rUser').value, password: byId('rPass').value });
      await Swal.fire({ icon: 'success', title: 'ลงทะเบียนแล้ว', text: d2.message, confirmButtonText: 'ตกลง' });
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
        <div class="t-right"><button class="icon-btn" onclick="App.refreshStaff()" title="รีเฟรช">⟳</button></div>
      </div>
      <div id="view"></div>
    </div>
    <nav class="bottom-nav">
      ${[['home', '🏠', 'หน้าหลัก'], ['dayoff', '🗓️', 'วันหยุด'], ['develop', '📚', 'พัฒนาตัวเอง'], ['history', '📖', 'ประวัติ'], ['profile', '👤', 'โปรไฟล์']]
        .map(([v, i, l]) => `<button class="nav-item" data-v="${v}" onclick="App.go('${v}')"><span class="ni">${i}</span>${l}</button>`).join('')}
    </nav>`;
    await this.refreshStaff();
  },

  async refreshStaff() {
    this.data = await this.api('app_data');
    this.paintNavBadge();
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

  go(v) {
    this.view = v;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.v === v));
    clearInterval(this.clockTimer);
    ({ home: () => this.vHome(), dayoff: () => this.vDayoff(), develop: () => this.vDevelop(),
       history: () => this.vHistory(), profile: () => this.vProfile() })[v]();
  },

  // ---------- หน้าหลัก ----------
  vHome() {
    const d = this.data, t = d.today, s = d.settings;
    let stateHtml = '';

    if (t.is_holiday) {
      stateHtml = `<div class="done-badge"><span class="db-ico">🌴</span>
        <div class="db-title">วันอาทิตย์ — วันหยุดสถานี</div>
        <div class="db-sub">พักผ่อนเต็มที่ แล้วพบกันพรุ่งนี้ค่ะ</div></div>`;
    } else if (t.attendance) {
      const a = t.attendance;
      stateHtml = `<div class="done-badge">
        <span class="db-ico">${+a.late ? '🟡' : '✅'}</span>
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
      stateHtml = `<div class="done-badge"><span class="db-ico">🔵</span>
        <div class="db-title">วันนี้คุณแจ้ง${label}ไว้</div>
        <div class="db-sub">ถ้ามาทำงาน ให้ยกเลิกที่แท็บ "วันหยุด" ก่อนเช็คชื่อ</div></div>`;
    } else {
      stateHtml = `<button class="big-check" id="btnCheckin" onclick="App.doCheckin()">
        <span class="bc-ico">📍</span>เช็คชื่อ<span class="bc-sub" id="bcSub"></span>
      </button>
      <div class="clock-note">เปิดเช็คชื่อ ${s.checkin_open} น. • หลัง ${s.late_cutoff} น. นับว่าสาย</div>`;
    }

    const q = d.quota, qPct = Math.min(100, q.used / q.max * 100);
    byId('view').innerHTML = `
      <div class="card clock-card">
        <div class="clock-time" id="clock">--:--:--</div>
        <div class="clock-date">${esc(t.thai_date)}</div>
        ${stateHtml}
      </div>

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
            <div class="lr-sub">${offLabel(o.type)}${o.note ? ' — ' + esc(o.note) : ''}${+o.over_quota ? ' ⚠️ เกินโควต้า' : ''}</div></div>
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
          <div class="lr-sub">เข้า ${a.time_in.substr(11, 5)} น.${a.time_out ? ' • ส่งรายงาน ' + a.time_out.substr(11, 5) + ' น.' : ''}</div></div>
        <span class="chip ${+a.late ? 'chip-late' : 'chip-ok'}">${+a.late ? 'สาย' : 'ตรงเวลา'}</span>
      </div>`).join('')}</div>`;
  },

  startClock() {
    const s = this.data.settings;
    const tick = () => {
      const el = byId('clock'); if (!el) return clearInterval(this.clockTimer);
      const n = new Date();
      el.textContent = n.toTimeString().substr(0, 8);
      const btn = byId('btnCheckin'), sub = byId('bcSub');
      if (btn) {
        const nowM = n.getHours() * 60 + n.getMinutes();
        const openM = hm(s.checkin_open), lateM = hm(s.late_cutoff);
        if (nowM < openM) { btn.disabled = true; sub.textContent = 'เปิดเวลา ' + s.checkin_open + ' น.'; }
        else { btn.disabled = false; sub.textContent = nowM > lateM ? 'เลยเวลา — จะถูกนับว่าสาย' : 'แตะเพื่อเช็คชื่อ'; }
      }
    };
    tick();
    this.clockTimer = setInterval(tick, 1000);
  },

  // ---------- เช็คอิน ----------
  async doCheckin() {
    const s = this.data.settings;
    const btn = byId('btnCheckin'); btn.disabled = true;

    let pos = null;
    try {
      Swal.fire({ title: 'กำลังหาตำแหน่ง GPS...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      pos = await getPosition();
      Swal.close();
    } catch {
      Swal.close();
      if (s.gps_enforce) {
        await Swal.fire({ icon: 'error', title: 'ไม่พบตำแหน่ง GPS', text: 'กรุณาเปิดการเข้าถึงตำแหน่ง (Location) แล้วลองใหม่', confirmButtonText: 'ตกลง' });
        btn.disabled = false; return;
      }
    }

    let selfie = null;
    if (s.selfie_required) {
      selfie = await captureSelfie();
      if (!selfie) { btn.disabled = false; return; }
    }

    const dist = pos ? Math.round(haversine(pos.lat, pos.lng, s.gps_lat, s.gps_lng)) : null;
    const c = await Swal.fire({
      icon: 'question', title: 'ยืนยันเช็คชื่อ?',
      html: dist !== null ? `คุณอยู่ห่างสถานี <b>${dist.toLocaleString()} ม.</b>` : 'ไม่มีพิกัด GPS',
      showCancelButton: true, confirmButtonText: 'เช็คชื่อเลย', cancelButtonText: 'ยกเลิก',
    });
    if (!c.isConfirmed) { btn.disabled = false; return; }

    try {
      const d = await this.api('checkin', { lat: pos?.lat ?? null, lng: pos?.lng ?? null, selfie });
      await Swal.fire({ icon: d.late ? 'warning' : 'success', title: d.message, text: 'เวลา ' + d.time_in + ' น.', confirmButtonText: 'ตกลง' });
      this.refreshStaff();
    } catch { btn.disabled = false; }
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
          <select class="select" id="offType">
            <option value="dayoff">วันหยุด (นับโควต้า)</option>
            <option value="sick">ลาป่วย</option>
            <option value="personal">ลากิจ</option>
          </select></div>
        <div class="field"><label>หมายเหตุ (ถ้ามี)</label><input class="input" id="offNote" maxlength="255"></div>
        <button class="btn btn-primary btn-block" id="btnBook" onclick="App.submitDayoff()" disabled>เลือกวันในปฏิทินก่อน</button>
      </div>
      <div class="card"><h3>👥 ใครหยุดบ้างเดือนนี้</h3><div id="teamOff" class="muted">กำลังโหลด...</div></div>
      <div class="card"><h3>📌 รายการของฉัน</h3><div id="myOffs"></div></div>`;
    await this.loadCal();
    this.renderMyOffs();
  },

  async loadCal() {
    const d = await this.api('dayoff_month', { ym: this.calYm });
    this.teamOffs = d.day_offs;
    this.renderCal();
    this.renderTeamOff();
  },

  renderCal() {
    const [Y, M] = this.calYm.split('-').map(Number);
    const first = new Date(Y, M - 1, 1), days = new Date(Y, M, 0).getDate();
    const today = todayStr();
    const mine = new Set(this.data.upcoming.map(o => o.off_date)
      .concat(this.teamOffs.filter(o => o.user_id == this.user.id).map(o => o.off_date)));
    const counts = {};
    this.teamOffs.forEach(o => { counts[o.off_date] = (counts[o.off_date] || 0) + 1; });

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
      cells += `<button class="${cls.join(' ')}" ${clickable ? `onclick="App.toggleDay('${ds}')"` : 'disabled'}>
        ${d}${counts[ds] ? `<span class="cd-badge">หยุด ${counts[ds]}</span>` : ''}</button>`;
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

  async submitDayoff() {
    const d = await this.api('dayoff_add', {
      dates: [...this.calSel], type: byId('offType').value, note: byId('offNote').value.trim(),
    });
    let html = `บันทึกแล้ว ${d.added.length} วัน`;
    if (d.over_quota.length) html += `<br><b style="color:#d97706">⚠️ เกินโควต้า ${d.over_quota.length} วัน — แจ้งหัวหน้าสถานีแล้ว</b>`;
    if (d.skipped.length) html += `<br><span style="font-size:13px;color:#888">ข้าม: ${d.skipped.map(s => `${thaiDate(s[0], false)} (${s[1]})`).join(', ')}</span>`;
    await Swal.fire({ icon: 'success', title: 'เรียบร้อย', html, confirmButtonText: 'ตกลง' });
    this.data = await this.api('app_data');
    this.vDayoff();
  },

  renderTeamOff() {
    const byDate = {};
    this.teamOffs.forEach(o => (byDate[o.off_date] = byDate[o.off_date] || []).push(o));
    const dates = Object.keys(byDate).filter(d => d >= todayStr()).sort().slice(0, 10);
    byId('teamOff').innerHTML = dates.length ? dates.map(d => `
      <div class="list-row"><span class="dot dot-leave"></span>
        <div class="lr-main"><div class="lr-title">${thaiDate(d)}</div>
        <div class="lr-sub">${byDate[d].map(o => esc(o.name) + ' (' + offLabel(o.type) + ')').join(', ')}</div></div>
      </div>`).join('')
      : '<div class="empty"><span class="e-ico">🌿</span>เดือนนี้ยังไม่มีใครจองวันหยุด</div>';
  },

  renderMyOffs() {
    const rows = this.data.upcoming;
    byId('myOffs').innerHTML = rows.length ? rows.map(o => `
      <div class="list-row"><span class="dot dot-leave"></span>
        <div class="lr-main"><div class="lr-title">${thaiDate(o.off_date)}</div>
          <div class="lr-sub">${offLabel(o.type)}${o.note ? ' — ' + esc(o.note) : ''}${+o.over_quota ? ' ⚠️' : ''}</div></div>
        <button class="btn btn-danger-ghost btn-sm" onclick="App.cancelOff(${o.id})">ยกเลิก</button>
      </div>`).join('')
      : '<div class="empty"><span class="e-ico">📭</span>ยังไม่มีวันหยุดที่จองไว้</div>';
  },

  async cancelOff(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ยกเลิกวันหยุดนี้?', showCancelButton: true, confirmButtonText: 'ยกเลิกวันหยุด', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    await this.api('dayoff_cancel', { id });
    toast('ยกเลิกแล้ว');
    this.data = await this.api('app_data');
    this.vDayoff();
  },

  // ---------- พัฒนาตัวเอง (hub) ----------
  libItems: null,
  libFilter: 'all',
  devTab: 'lib',

  devSegHtml() {
    const t = (v, l) => `<button class="${this.devTab === v ? 'active' : ''}" onclick="App.devSetTab('${v}')">${l}</button>`;
    return `<div class="seg" id="devSeg">
      ${t('lib', '📚 คลังความรู้')}${t('quiz', '📝 แบบทดสอบ')}
      <button disabled title="เร็วๆ นี้">💪 กายภาพ</button>
    </div>`;
  },

  devSetTab(t) { this.devTab = t; this.vDevelop(); },

  async vDevelop() {
    this.devTab === 'quiz' ? await this.vQuizList() : await this.vLibrary();
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
    byId('histList').innerHTML = (this.historyCard(d.attendance, 'บันทึกเช็คชื่อ') || '<div class="card empty"><span class="e-ico">📭</span>เดือนนี้ยังไม่มีบันทึก</div>')
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

const TH_D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_M = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function thaiDate(ymd, withDow = true) {
  const [Y, M, D] = ymd.split('-').map(Number);
  const dow = new Date(Y, M - 1, D).getDay();
  return (withDow ? TH_D[dow] + ' ' : '') + D + ' ' + TH_M[M] + ' ' + (Y + 543);
}
const thaiMonth = (ym) => { const [Y, M] = ym.split('-').map(Number); return TH_M[M].replace('.', '') + ' ' + (Y + 543); };

function toast(msg, icon = 'success') {
  Swal.fire({ toast: true, position: 'top', icon, title: msg, showConfirmButton: false, timer: 2600, timerProgressBar: true });
}

function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      rej, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
