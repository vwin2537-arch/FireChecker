/* =====================================================
   FireCheck — หน้าแอดมิน (หัวหน้าสถานี)
   แท็บ: แดชบอร์ด / รายงาน / วันหยุด / เจ้าหน้าที่ / ตั้งค่า
   ===================================================== */

const C_OK = '#2e7d32', C_LATE = '#d97706', C_LEAVE = '#2563eb', C_ABSENT = '#dc2626';

// ชื่อเดือนไทย + พ.ศ. จาก "YYYY-MM" เช่น "2026-07" → "กรกฎาคม 2569"
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function rpMonthLabel(ym) {
  return TH_MONTHS[+ym.slice(5, 7) - 1] + ' ' + (+ym.slice(0, 4) + 543);
}
const CHART_BASE = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { font: { family: 'Kanit', size: 12 }, boxWidth: 12, boxHeight: 12, usePointStyle: true } } },
};

const Admin = {
  tab: 'dash',
  charts: [],

  async enter() {
    clearInterval(App.clockTimer);
    $app().innerHTML = `<div class="shell shell-wide">
      <div class="topbar">
        <div class="avatar">🔥</div>
        <div><div class="t-title">FireCheck — หัวหน้าสถานี</div>
        <div class="t-sub" id="tbSub">สถานีควบคุมไฟป่าสลักพระ-เอราวัณ</div></div>
        <div class="t-right">
          <button class="icon-btn" onclick="Admin.refresh()" title="รีเฟรช">⟳</button>
          <button class="icon-btn" onclick="App.logout()" title="ออกจากระบบ">⏻</button>
        </div>
      </div>
      <div id="view"></div>
    </div>
    <nav class="bottom-nav wide">
      ${[['dash', '📊', 'แดชบอร์ด'], ['report', '📋', 'รายงาน'], ['dayoff', '🗓️', 'วันหยุด'], ['users', '👥', 'เจ้าหน้าที่'], ['develop', '📚', 'พัฒนา'], ['health', '🩺', 'สุขภาพ'], ['settings', '⚙️', 'ตั้งค่า']]
        .map(([v, i, l]) => `<button class="nav-item" data-v="${v}" onclick="Admin.go('${v}')"><span class="ni">${i}</span>${l}</button>`).join('')}
    </nav>`;
    await this.refresh();
  },

  async refresh() {
    App.adminData = await App.api('admin_data');
    byId('tbSub').textContent = App.adminData.settings.station_name;
    this.go(this.tab);
  },

  go(tab) {
    this.tab = tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.v === tab));
    this.charts.forEach(c => c.destroy()); this.charts = [];
    ({ dash: () => this.vDash(), report: () => this.vReport(), dayoff: () => this.vDayoff(),
       users: () => this.vUsers(), develop: () => this.vDevelop(), health: () => this.vHealth(), settings: () => this.vSettings() })[tab]();
  },

  // =====================================================
  // แดชบอร์ด
  // =====================================================
  vDash() {
    const d = App.adminData, c = d.today.counts;

    // แถบแจ้งเตือน
    let alerts = '';
    if (d.pending_users.length) alerts += `<div class="alert-bar">👤 มีเจ้าหน้าที่รออนุมัติ <b>${d.pending_users.length} คน</b>
      <button class="btn btn-sm btn-primary" onclick="Admin.go('users')">ไปอนุมัติ</button></div>`;
    if ((d.pending_leaves || []).length) alerts += `<div class="alert-bar">📝 มีคำขอลารออนุมัติ <b>${d.pending_leaves.length} รายการ</b>
      <button class="btn btn-sm btn-primary" onclick="Admin.go('dayoff')">ไปอนุมัติ</button></div>`;
    if (d.over_quota.length) alerts += `<div class="alert-bar">⚠️ วันหยุดเกินโควต้า: <b>${d.over_quota.map(o =>
      `${esc(o.name)} (${o.n} วัน เดือน ${thaiMonth(o.ym)})`).join(', ')}</b>
      <button class="btn btn-sm btn-primary" onclick="Admin.go('dayoff')">ดูปฏิทิน</button></div>`;
    if ((d.face_flags || []).length) alerts += `<div class="alert-bar">🙂 ยืนยันใบหน้าไม่ผ่านวันนี้ <b>${d.face_flags.length} คน</b>
      — ${d.face_flags.map(f => esc(f.name)).join(', ')}
      <button class="btn btn-sm btn-primary" onclick="Admin.faceFlagList()">ดูรูป</button></div>`;

    // วันหยุดสถานี — โชว์คนที่มาทำงาน/เข้าเวรวันหยุด + ส่วนวิเคราะห์
    if (d.today.is_holiday) {
      const hw = d.today.holiday_workers || [];
      byId('view').innerHTML = `${alerts}
        <div class="card" style="padding:14px 18px"><div style="font-size:16px;font-weight:500">📍 วันนี้ — ${esc(d.today.thai_date)}</div>
          <div class="tiny">วันอาทิตย์ วันหยุดสถานี${hw.length ? ` · มาทำงาน ${hw.length} คน` : ''}</div></div>
        ${hw.length ? `<div class="card"><h3>📅 มาทำงานวันหยุด (${hw.length})</h3>
          ${hw.map(w => `<div class="list-row"><span class="dot dot-ok"></span>
            <div class="lr-main"><div class="lr-title">${esc(w.name)}</div>
            <div class="lr-sub">เข้า ${w.time_in.substr(11, 5)} น.${w.note ? ' • ' + esc(w.note) : ''}${w.position ? ' • ' + esc(w.position) : ''}</div></div></div>`).join('')}</div>`
          : '<div class="card empty"><span class="e-ico">🌴</span>วันนี้วันหยุดสถานี ยังไม่มีใครมาเช็คชื่อ</div>'}
        ${this.analyticsHtml(d)}`;
      this.drawWeekday(d.weekday);
      return;
    }

    const { total, present, leave, absent } = c;
    const expected = total - leave;                                   // คนที่ต้องมา (หักคนลาออก)
    const pct = expected > 0 ? Math.round(present / expected * 100) : 100;
    const ribbon = total === 0 ? ''
      : absent === 0
        ? `<div class="dt-status ok">🎉 มาครบแล้ว — เช็คชื่อ ${present}/${expected} คน</div>`
        : `<div class="dt-status warn">⛔ ยังไม่มา ${absent} คน จากที่ต้องมา ${expected} คน</div>`;

    byId('view').innerHTML = `${alerts}
      <div class="card dash-today">
        <div class="dt-head">
          <div><div class="dt-date">📍 วันนี้ — ${esc(d.today.thai_date)}</div>
            <div class="tiny">อัปเดต ${new Date().toTimeString().substr(0, 5)} น. · เจ้าหน้าที่ ${total} คน${leave ? ` · ลา ${leave}` : ''}</div></div>
          ${total ? `<div class="dt-pct"><div class="dt-pct-num">${pct}%</div><div class="tiny">มาแล้ว</div></div>` : ''}
        </div>
        ${total === 0 ? '<div class="empty"><span class="e-ico">👥</span>ยังไม่มีเจ้าหน้าที่ในระบบ</div>' : `
        <div class="dt-body">
          <div class="dt-donut"><canvas id="chToday"></canvas>
            <div class="dt-center"><div class="dt-c-num">${present}<span>/${expected}</span></div><div class="dt-c-lbl">มาแล้ว</div></div>
          </div>
          <div class="dt-legend">
            <div class="dt-leg s-ontime"><span class="dot dot-ok"></span>ตรงเวลา<b>${c.ontime}</b></div>
            <div class="dt-leg s-late"><span class="dot dot-late"></span>มาสาย<b>${c.late}</b></div>
            <div class="dt-leg s-leave"><span class="dot dot-leave"></span>ลา/หยุด<b>${leave}</b></div>
            <div class="dt-leg s-absent"><span class="dot dot-absent"></span>ยังไม่มา<b>${absent}</b></div>
          </div>
        </div>
        ${ribbon}`}
      </div>

      ${total ? `<div class="card"><h3>👥 รายชื่อวันนี้</h3>
        ${this.rosterGroup(d.today.roster, 'absent', '⛔', 'ยังไม่มา', 'มาครบแล้ว ไม่มีใครขาด 🎉')}
        ${this.rosterGroup(d.today.roster, 'late', '🟡', 'มาสาย', '')}
        ${this.rosterGroup(d.today.roster, 'leave', '🔵', 'ลา/หยุด', '')}
        ${this.rosterGroup(d.today.roster, 'ontime', '🟢', 'มาแล้ว ตรงเวลา', '')}
      </div>` : ''}

      ${this.analyticsHtml(d)}`;

    if (total) this.drawToday(c);
    this.drawWeekday(d.weekday);
  },

  // รายชื่อแยกกลุ่มตามสถานะ (ยังไม่มา/สาย/ลา/มาแล้ว) — absent มี emptyMsg โชว์เมื่อมาครบ
  rosterGroup(roster, state, icon, label, emptyMsg) {
    const list = roster.filter(r => r.state === state);
    const dotClass = state === 'ontime' ? 'ok' : state;
    if (!list.length) {
      return emptyMsg ? `<div class="rgroup rg-${state}">
        <div class="rg-head"><span class="dot dot-${dotClass}"></span>${icon} ${label} <b>0</b></div>
        <div class="rg-empty">${emptyMsg}</div></div>` : '';
    }
    return `<div class="rgroup rg-${state}">
      <div class="rg-head"><span class="dot dot-${dotClass}"></span>${icon} ${label} <b>${list.length}</b></div>
      <div class="roster">${list.map(r => `
        <div class="roster-cell s-${state}">
          <div><div class="rc-name">${esc(r.name)}${faceFlagChip(r)}</div>
          <div class="rc-sub">${r.time_in ? 'เข้า ' + r.time_in.substr(11, 5) + ' น.' :
            state === 'leave' ? offLabel(r.off_type) + (r.off_note ? ' — ' + esc(r.off_note) : '') : 'ยังไม่เช็คชื่อ'}</div></div>
        </div>`).join('')}</div>
    </div>`;
  },

  // ส่วนวิเคราะห์ด้านล่าง (อันดับความขยัน / สถิติรายวัน / กิจกรรมล่าสุด)
  analyticsHtml(d) {
    return `
      ${this.nightTonightHtml(d)}
      ${this.nightMonthHtml(d)}
      <div class="card">
        <h3>🏆 อันดับความขยันเดือนนี้ <span class="h-right">${d.score_mode === 'full' ? 'มา25+ตรง25+รายงาน15+ตรง15 +สม่ำเสมอ20' : 'มา 50 + ตรงเวลา 30 /วัน + สม่ำเสมอ 20'}</span></h3>
        <button class="btn btn-primary btn-block" style="margin-bottom:12px" onclick="Admin.openReport()">📄 ออกรายงานรายเดือน (ปริ้น / บันทึกรูปส่ง LINE)</button>
        ${this.rankingHtml(d.ranking)}
      </div>
      <div class="grid-2-lg">
        <div class="card"><h3>📅 สถิติตามวันในสัปดาห์ <span class="h-right">8 สัปดาห์ล่าสุด</span></h3><div class="chart-box"><canvas id="chWeekday"></canvas></div></div>
        <div class="card"><h3>🕐 กิจกรรมล่าสุด</h3>
          ${d.activity.length ? d.activity.map(a => `<div class="feed-item"><span>${a.icon}</span><span>${esc(a.text)}</span>
            <span class="f-time">${a.ts.substr(5, 11)}</span></div>`).join('') : '<div class="empty">ยังไม่มีกิจกรรม</div>'}
        </div>
      </div>`;
  },

  // การ์ดประกาศถึงเจ้าหน้าที่ (เด้งเข้ากล่องข้อความทุกคน)
  announceHtml() {
    return `<div class="card">
      <h3>📢 ประกาศถึงเจ้าหน้าที่</h3>
      <div class="tiny" style="margin-bottom:10px">ส่งเข้ากล่องข้อความของเจ้าหน้าที่ทุกคน — มีจุดแดงเตือนจนกว่าจะเปิดอ่าน</div>
      <div class="field"><input class="input" id="annTitle" maxlength="150" placeholder="หัวข้อประกาศ เช่น ประชุมประจำเดือน"></div>
      <div class="field" style="margin-top:8px"><textarea class="input" id="annBody" rows="3" maxlength="2000" placeholder="รายละเอียด (ถ้ามี)"></textarea></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="Admin.announceSend()">ส่งประกาศ</button>
    </div>`;
  },

  async announceSend() {
    const title = byId('annTitle').value.trim();
    if (!title) return toast('กรอกหัวข้อประกาศก่อนค่ะ', 'error');
    const c = await Swal.fire({ icon: 'question', title: 'ส่งประกาศนี้?', text: 'จะเด้งเข้ากล่องข้อความเจ้าหน้าที่ทุกคน',
      showCancelButton: true, confirmButtonText: 'ส่งเลย', cancelButtonText: 'ยกเลิก' });
    if (!c.isConfirmed) return;
    const d = await App.api('announce_send', { title, body: byId('annBody').value.trim() });
    byId('annTitle').value = ''; byId('annBody').value = '';
    toast(d.message);
  },

  // การ์ด "คืนนี้ใครเข้าเวร" + เลือกย้อนดูวันอื่นได้
  nightTonightHtml(d) {
    return `<div class="card">
      <h3>🌙 เข้าเวรกลางคืน <span class="h-right"><input type="date" id="nrDate" value="${d.night_tonight_date || ''}" onchange="Admin.nightRosterLoad()" class="nr-date"></span></h3>
      <div id="nrBody">${this.nightRosterBody(d.night_tonight || [], d.night_tonight_date || '')}</div>
    </div>`;
  },

  nightRosterBody(list, date) {
    const head = `<div class="tiny" style="margin-bottom:8px">คืนวันที่ ${date ? thaiDate(date) : '-'} · ${list.length} คน</div>`;
    if (!list.length) return head + '<div class="empty" style="padding:16px"><span class="e-ico">🌙</span>ยังไม่มีใครลงเวรคืนนี้</div>';
    return head + list.map(n => `<div class="list-row"><span class="dot dot-ok"></span>
      <div class="lr-main"><div class="lr-title">${esc(n.name)}</div>
      <div class="lr-sub">เข้าเวร ${n.time_in.substr(11, 5)} น.${n.position ? ' • ' + esc(n.position) : ''}</div></div></div>`).join('');
  },

  async nightRosterLoad() {
    const date = byId('nrDate').value;
    const d = await App.api('night_roster', { date });
    byId('nrBody').innerHTML = this.nightRosterBody(d.items, d.date);
  },

  // การ์ด "เวรกลางคืนรายเดือน" — สรุปต่อคน (กี่คืน + วันไหน) + เลือกย้อนเดือนได้
  nightMonthHtml(d) {
    return `<div class="card">
      <h3>🌙 เวรกลางคืนรายเดือน <span class="h-right"><input type="month" id="nmMonth" value="${d.night_month || ''}" max="${d.night_month || ''}" onchange="Admin.nightMonthLoad()" class="nr-date"></span></h3>
      <div id="nmBody">${this.nightMonthBody(d.night_stats || [], d.night_summary || {})}</div>
    </div>`;
  },

  nightMonthBody(stats, sum) {
    const bar = `<div class="nm-sum">
      <span><b>${+sum.nights || 0}</b> คืนที่มีเวร</span>
      <span><b>${+sum.people || 0}</b> คน</span>
      <span><b>${+sum.man_nights || 0}</b> คน-คืน</span></div>`;
    if (!stats.length) return bar + '<div class="empty" style="padding:16px"><span class="e-ico">🌙</span>เดือนนี้ยังไม่มีการเข้าเวร</div>';
    return bar + stats.map(n => `<div class="list-row">
      <div class="lr-main"><div class="lr-title">${esc(n.name)}${n.days ? ` <span class="tiny">(${n.days})</span>` : ''}</div></div>
      <span class="night-count"><b>${n.nights}</b> คืน</span></div>`).join('');
  },

  async nightMonthLoad() {
    const month = byId('nmMonth').value;
    const d = await App.api('night_month', { month });
    byId('nmBody').innerHTML = this.nightMonthBody(d.stats, d.summary);
  },

  rankingHtml(ranking) {
    if (!ranking.length) return '<div class="empty"><span class="e-ico">👥</span>ยังไม่มีเจ้าหน้าที่ในระบบ</div>';
    const scored = ranking.filter(r => r.score !== null);
    const medals = ['🥇', '🥈', '🥉'];
    const top = scored.slice(0, 3).map((r, i) => `
      <div class="rank-card"><div class="r-medal">${medals[i]}</div>
        <div class="r-name">${esc(r.name)}</div><div class="r-score">${r.score}</div>
        <div class="tiny">คะแนน</div></div>`).join('');
    return `${top ? `<div class="rank-top">${top}</div>` : ''}
      <div class="tbl-wrap"><table class="tbl">
        <tr><th>#</th><th>ชื่อ</th><th class="num">คะแนน</th><th class="num">ต้องมา</th><th class="num">มา</th>
        <th class="num">ตรงเวลา</th><th class="num">สาย</th><th class="num">ลา</th><th class="num">ขาด</th><th class="num">เฉลี่ยเข้า</th></tr>
        ${ranking.map((r, i) => `<tr>
          <td>${i + 1}</td><td><b>${esc(r.name)}${ageFrom(r.birthdate) !== null ? ` (${ageFrom(r.birthdate)})` : ''}</b><div class="tiny">${esc(r.position || '')}</div></td>
          <td class="num"><b style="color:${r.score === null ? 'var(--ink-3)' : r.score >= 80 ? C_OK : r.score >= 50 ? C_LATE : C_ABSENT}">${r.score ?? '—'}</b></td>
          <td class="num">${r.planned}</td><td class="num">${r.present}</td>
          <td class="num" style="color:${C_OK}">${r.ontime}</td><td class="num" style="color:${C_LATE}">${r.late}</td>
          <td class="num" style="color:${C_LEAVE}">${r.leave}</td><td class="num" style="color:${C_ABSENT}">${r.absent}</td>
          <td class="num">${r.avg_in ?? '—'}</td></tr>`).join('')}
      </table></div>`;
  },

  // ===== รายงานอันดับความขยันรายเดือน (overlay สำหรับปริ้น / บันทึกรูปส่ง LINE) =====
  openReport() {
    const now = new Date();
    const ym = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    const curYm = ym(now);
    // เดือนปัจจุบัน (ถึงวันนี้) + ย้อนหลัง 12 เดือน — default = เดือนที่แล้ว
    const opts = [`<option value="${curYm}">${rpMonthLabel(curYm)} (ถึงวันนี้)</option>`];
    for (let i = 1; i <= 12; i++) {
      const v = ym(new Date(now.getFullYear(), now.getMonth() - i, 1));
      opts.push(`<option value="${v}">${rpMonthLabel(v)}</option>`);
    }
    const ov = document.createElement('div');
    ov.id = 'reportOverlay';
    ov.className = 'rpt-overlay';
    ov.innerHTML = `
      <div class="rpt-bar">
        <select id="rptMonth" class="rpt-sel" onchange="Admin.reportLoad()">${opts.join('')}</select>
        <button class="btn btn-primary" onclick="Admin.reportSave()">🖼️ บันทึกรูป</button>
        <button class="btn" onclick="Admin.reportPrint()">🖨️ ปริ้น</button>
        <button class="btn rpt-close" onclick="Admin.reportClose()">✕ ปิด</button>
      </div>
      <div class="rpt-scroll"><div id="rptPaper" class="rpt-paper"><div class="empty" style="padding:60px">กำลังโหลด…</div></div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add('rpt-open');
    byId('rptMonth').selectedIndex = 1;   // เดือนที่แล้ว
    this.reportLoad();
  },

  async reportLoad() {
    const paper = byId('rptPaper');
    paper.innerHTML = '<div class="empty" style="padding:60px">กำลังโหลด…</div>';
    try {
      const d = await App.api('report_month', { month: byId('rptMonth').value });
      paper.innerHTML = this.reportPaperHtml(d);
    } catch (e) {
      paper.innerHTML = '<div class="empty" style="padding:60px">โหลดรายงานไม่สำเร็จ</div>';
    }
  },

  rpStat(v, l) { return `<div class="rp-stat"><div class="rp-sv">${v}</div><div class="rp-sl">${l}</div></div>`; },

  reportPaperHtml(d) {
    const s = d.summary;
    const medals = ['🥇', '🥈', '🥉'];
    const top = d.ranking.filter(r => r.score !== null).slice(0, 3).map((r, i) => `
      <div class="rp-podium-item rp-p${i + 1}">
        <div class="rp-mico">${medals[i]}</div>
        <div class="rp-mname">${esc(r.name)}</div>
        <div class="rp-mscore">${r.score}</div><div class="rp-mlbl">คะแนน</div>
      </div>`).join('');
    return `
      <div class="rp-head">
        <div class="rp-fire">🔥</div>
        <div class="rp-htext">
          <div class="rp-station">สถานีควบคุมไฟป่าสลักพระ-เอราวัณ</div>
          <div class="rp-title">รายงานอันดับความขยันประจำเดือน</div>
          <div class="rp-month">${d.month_label}</div>
        </div>
      </div>
      <div class="rp-sumrow">
        ${this.rpStat(d.staff_count, 'เจ้าหน้าที่ (คน)')}
        ${this.rpStat(d.workdays, 'วันทำการ')}
        ${this.rpStat(s.ontime_pct === null ? '—' : s.ontime_pct + '%', 'ตรงเวลาทั้งทีม')}
        ${this.rpStat(s.late, 'มาสาย (ครั้ง)')}
        ${this.rpStat(s.absent, 'ขาด (ครั้ง)')}
        ${this.rpStat(s.leave, 'ลา (ครั้ง)')}
      </div>
      ${top ? `<div class="rp-podium">${top}</div>` : ''}
      <table class="rp-tbl">
        <thead><tr><th>อันดับ</th><th class="l">ชื่อ-สกุล</th><th>คะแนน</th><th>มา</th><th>ตรงเวลา</th><th>สาย</th><th>ลา</th><th>ขาด</th></tr></thead>
        <tbody>${d.ranking.map((r, i) => `<tr>
          <td class="rp-rank">${r.score === null ? '—' : i + 1}</td>
          <td class="l"><b>${esc(r.name)}</b>${r.position ? `<div class="rp-pos">${esc(r.position)}</div>` : ''}</td>
          <td class="rp-score">${r.score ?? '—'}</td>
          <td>${r.present}</td><td>${r.ontime}</td><td>${r.late}</td><td>${r.leave}</td><td>${r.absent}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="rp-foot">ออกรายงานเมื่อ ${d.generated_at} น. · จัดอันดับจากการมาทำงาน การตรงต่อเวลา และความสม่ำเสมอตลอดเดือน · ระบบเช็คชื่อ FireCheck</div>`;
  },

  async reportSave() {
    if (typeof html2canvas !== 'function') return toast('โหลดตัวสร้างรูปไม่สำเร็จ ลองรีเฟรช', 'error');
    toast('กำลังสร้างรูป…');
    await document.fonts.ready;
    const canvas = await html2canvas(byId('rptPaper'), { scale: 2.5, backgroundColor: '#ffffff', useCORS: true });
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ความขยัน-${byId('rptMonth').value}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('บันทึกรูปแล้ว 📥');
    }, 'image/png');
  },

  reportPrint() {
    document.body.classList.add('rpt-printing');
    const done = () => { document.body.classList.remove('rpt-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
    setTimeout(done, 60000);
  },

  reportClose() {
    const ov = byId('reportOverlay'); if (ov) ov.remove();
    document.body.classList.remove('rpt-open');
  },

  // โดนัทองค์ประกอบการมาวันนี้ (ตรงเวลา/สาย/ลา/ยังไม่มา) — ตัวเลขกลางวงวางเป็น HTML ทับ
  drawToday(c) {
    const el = byId('chToday'); if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'doughnut',
      data: { labels: ['ตรงเวลา', 'มาสาย', 'ลา/หยุด', 'ยังไม่มา'],
        datasets: [{ data: [c.ontime, c.late, c.leave, c.absent],
          backgroundColor: [C_OK, C_LATE, C_LEAVE, C_ABSENT], borderColor: '#fff', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: { legend: { display: false },
          tooltip: { bodyFont: { family: 'Kanit' }, titleFont: { family: 'Kanit' },
            callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} คน` } } },
      },
    }));
  },

  drawWeekday(weekday) {
    const el = byId('chWeekday'); if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: { labels: weekday.map(w => w.day), datasets: [
        { label: 'ตรงเวลา', data: weekday.map(w => w.ontime), backgroundColor: C_OK, borderRadius: 4, maxBarThickness: 22 },
        { label: 'สาย', data: weekday.map(w => w.late), backgroundColor: C_LATE, borderRadius: 4, maxBarThickness: 22 }] },
      options: { ...CHART_BASE, scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Kanit', size: 12 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Kanit', size: 11 } }, grid: { color: '#eef1ec' } } } },
    }));
  },

  // =====================================================
  // รายงานย้อนหลัง
  // =====================================================
  async vReport() {
    const users = (await App.api('users_list')).users.filter(u => u.role === 'staff');
    const mStart = todayStr().substr(0, 8) + '01';
    byId('view').innerHTML = `
      <div class="card"><h3>📋 รายงานการเช็คชื่อ</h3>
        <div class="rpt-filter">
          <div class="field" style="margin:0;min-width:0"><label>จาก</label><input type="date" class="input" id="rpFrom" value="${mStart}"></div>
          <div class="field" style="margin:0;min-width:0"><label>ถึง</label><input type="date" class="input" id="rpTo" value="${todayStr()}"></div>
          <div class="field rpt-full" style="margin:0;min-width:0"><label>คน</label><select class="select" id="rpUser">
            <option value="0">ทุกคน</option>${users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
          <button class="btn btn-primary rpt-full" onclick="Admin.loadReport()">ดู</button>
        </div>
      </div>
      <div id="rpOut"></div>`;
    this.loadReport();
  },

  async loadReport() {
    byId('rpOut').innerHTML = '<div class="card muted">กำลังโหลด...</div>';
    const d = await App.api('report_range', { from: byId('rpFrom').value, to: byId('rpTo').value, user_id: +byId('rpUser').value });
    this.lastReport = d;
    const ontime = d.attendance.filter(a => !+a.late).length;
    byId('rpOut').innerHTML = `
      <div class="grid-4">
        <div class="kpi"><div class="k-label">บันทึกทั้งหมด</div><div class="k-value">${d.attendance.length}</div></div>
        <div class="kpi k-ok"><div class="k-label">ตรงเวลา</div><div class="k-value">${ontime}</div></div>
        <div class="kpi k-late"><div class="k-label">สาย</div><div class="k-value">${d.attendance.length - ontime}</div></div>
        <div class="kpi k-leave"><div class="k-label">ลา/หยุด</div><div class="k-value">${d.day_offs.length}</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>บันทึกเช็คชื่อ <span class="h-right"><button class="link-btn" onclick="Admin.exportCsv()">⬇ ดาวน์โหลด CSV</button></span></h3>
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>วันที่</th><th>ชื่อ</th><th>เวลาเข้า</th><th>สถานะ</th><th class="num">ระยะ (ม.)</th><th>รายงาน</th></tr>
          ${d.attendance.map(a => `<tr>
            <td>${thaiDate(a.work_date)}</td><td>${esc(a.name)}${faceFlagChip(a)}${a.note ? `<div class="tiny">📝 ${esc(a.note)}</div>` : ''}</td>
            <td>${a.time_in.substr(11, 5)}${a.time_out ? ' – ' + a.time_out.substr(11, 5) : ''}</td>
            <td><span class="chip ${+a.late ? 'chip-late' : 'chip-ok'}">${+a.late ? 'สาย' : 'ตรงเวลา'}</span></td>
            <td class="num">${a.distance_m ?? '—'}</td>
            <td>${a.report_text ? `<button class="link-btn" onclick="Admin.showReport(${a.id})">ดู</button>` : '—'}</td></tr>`).join('')
            || '<tr><td colspan="6" class="empty">ไม่มีข้อมูลช่วงนี้</td></tr>'}
        </table></div>
      </div>
      ${d.day_offs.length ? `<div class="card"><h3>วันลา/หยุดในช่วงนี้</h3>
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>วันที่</th><th>ชื่อ</th><th>ประเภท</th><th>หมายเหตุ</th></tr>
          ${d.day_offs.map(o => `<tr><td>${thaiDate(o.off_date)}</td><td>${esc(o.name)}</td>
            <td><span class="chip chip-leave">${offLabel(o.type)}</span>${+o.over_quota ? ' ⚠️' : ''}</td><td>${esc(o.note || '—')}</td></tr>`).join('')}
        </table></div></div>` : ''}
      ${(d.night_shifts || []).length ? `<div class="card"><h3>🌙 เวรกลางคืน (${d.night_shifts.length} คืน)</h3>
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>คืนของวันที่</th><th>ชื่อ</th><th>เวลาลงเวร</th><th class="num">ระยะ (ม.)</th></tr>
          ${d.night_shifts.map(n => `<tr><td>${thaiDate(n.duty_date)}</td><td>${esc(n.name)}</td>
            <td>${n.time_in.substr(11, 5)}</td><td class="num">${n.distance_m ?? '—'}</td></tr>`).join('')}
        </table></div></div>` : ''}`;
  },

  showReport(id) {
    const a = this.lastReport.attendance.find(x => x.id == id);
    if (!a) return;
    const photos = JSON.parse(a.photos_json || '[]');
    Swal.fire({
      title: esc(a.name) + ' — ' + thaiDate(a.work_date),
      html: `<div style="text-align:left;font-family:Kanit;font-weight:300;white-space:pre-wrap">${esc(a.report_text)}</div>
        ${photos.map(p => `<img src="photo.php?p=${encodeURIComponent(p)}&token=${App.token}" style="max-width:100%;border-radius:10px;margin-top:8px">`).join('')}
        ${a.selfie_path ? `<div class="tiny" style="margin-top:8px">เซลฟี่ตอนเช็คอิน:</div><img src="photo.php?p=${encodeURIComponent(a.selfie_path)}&token=${App.token}" style="max-width:50%;border-radius:10px">` : ''}`,
      confirmButtonText: 'ปิด', width: 560,
    });
  },

  exportCsv() {
    const d = this.lastReport;
    const rows = [['วันที่', 'ชื่อ', 'เวลาเข้า', 'เวลาออก', 'สถานะ', 'ระยะ_เมตร', 'ยืนยันใบหน้า', 'หมายเหตุ', 'รายงาน']];
    const faceTxt = (f) => ({ 1: 'ไม่ผ่าน', 2: 'ยังไม่ลงทะเบียน' })[+f] || 'ผ่าน';
    d.attendance.forEach(a => rows.push([a.work_date, a.name, a.time_in.substr(11, 8),
      a.time_out ? a.time_out.substr(11, 8) : '', +a.late ? 'สาย' : 'ตรงเวลา', a.distance_m ?? '',
      faceTxt(a.face_flag), a.note || '', (a.report_text || '').replace(/\n/g, ' ')]));
    rows.push([]); rows.push(['วันที่', 'ชื่อ', 'ประเภทลา', 'หมายเหตุ']);
    d.day_offs.forEach(o => rows.push([o.off_date, o.name, offLabel(o.type), o.note || '']));
    if ((d.night_shifts || []).length) {
      rows.push([]); rows.push(['คืนของวันที่', 'ชื่อ', 'เวลาลงเวร', 'ระยะ_เมตร']);
      d.night_shifts.forEach(n => rows.push([n.duty_date, n.name, n.time_in.substr(11, 8), n.distance_m ?? '']));
    }
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `firecheck_${d.from}_${d.to}.csv`;
    a.click();
  },

  // =====================================================
  // วันหยุด (มุมมองแอดมิน)
  // =====================================================
  aYm: null,
  async vDayoff() {
    this.aYm = this.aYm || ymNow();
    const [d, ul, lp] = await Promise.all([App.api('dayoff_month', { ym: this.aYm }), App.api('users_list'), App.api('leave_pending')]);
    const staff = ul.users.filter(u => u.role === 'staff' && u.status === 'active');
    const pend = lp.pending || [];
    const pendCard = pend.length ? `<div class="card" style="border:1.5px solid #fed7aa">
      <h3>📝 คำขอลารออนุมัติ (${pend.length})</h3>
      ${pend.map(p => `<div class="list-row">
        <div class="lr-main"><div class="lr-title">${esc(p.name)} <span style="color:${p.type === 'sick' ? '#d97706' : '#7c3aed'}">• ${offLabel(p.type)}</span></div>
          <div class="lr-sub">${p.off_thai}${p.note ? ' — ' + esc(p.note) : ''}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" onclick="Admin.leaveAct('leave_approve',${p.id})">อนุมัติ</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="Admin.leaveAct('leave_reject',${p.id})">ปฏิเสธ</button>
        </div></div>`).join('')}</div>` : '';
    const single = !!this.aUser;
    const shown = single ? d.day_offs.filter(o => o.user_id == this.aUser) : d.day_offs;
    const byDate = {};
    shown.forEach(o => (byDate[o.off_date] = byDate[o.off_date] || []).push(o));
    this.aByDate = byDate;

    // แผนที่วันเกิดเจ้าหน้าที่ (MM-DD → รายชื่อ) ตามขอบเขตที่เลือกดู
    const bstaff = single ? staff.filter(u => u.id == this.aUser) : staff;
    const bday = {};
    bstaff.forEach(u => { if (/^\d{4}-\d{2}-\d{2}$/.test(u.birthdate || '')) (bday[u.birthdate.slice(5)] = bday[u.birthdate.slice(5)] || []).push(u.name); });
    this.aBday = bday;

    byId('view').innerHTML = `
      ${pendCard}
      <div class="card">
        <div class="cal-head">
          <button class="cal-nav" onclick="Admin.aMove(-1)">‹</button>
          <span class="cal-title">ปฏิทินวันหยุด — ${thaiMonth(this.aYm)}</span>
          <button class="cal-nav" onclick="Admin.aMove(1)">›</button>
        </div>
        <div class="field" style="margin-bottom:10px"><label>ดูของ</label>
          <select class="select" onchange="Admin.aSetUser(this.value)">
            <option value="">— ทุกคน (ภาพรวม) —</option>
            ${staff.map(u => `<option value="${u.id}"${this.aUser == u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}
          </select></div>
        <div class="cal-grid">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(x => `<div class="cal-dow">${x}</div>`).join('')}${this.heatCells(byDate, staff.length, single)}</div>
        <div class="tiny" style="margin-top:8px">${single
          ? '🟠 ลาป่วย • 🟣 ลากิจ • 🔵 วันหยุด • 🎂 วันเกิด • แตะวันเพื่อดู/ลบ'
          : 'ยิ่งเข้ม = หยุดกันเยอะ • ตัวเลข = จำนวนคนหยุด • ⚠️ = มีเกินโควต้า • 🎂 = วันเกิด • แตะวันเพื่อดูรายชื่อ'}</div>
      </div>
      <div class="card"><h3>➕ บันทึกลาแทนเจ้าหน้าที่ <span class="h-right">เช่น โทรมาลาป่วยตอนเช้า</span></h3>
        <div class="field"><label>เจ้าหน้าที่</label><select class="select" id="aoUser">
          ${staff.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
        <div class="grid-2">
          <div class="field"><label>วันที่</label><input type="date" class="input" id="aoDate" value="${todayStr()}"></div>
          <div class="field"><label>ประเภท</label><select class="select" id="aoType">
            <option value="sick">ลาป่วย</option><option value="personal">ลากิจ</option><option value="dayoff">วันหยุด (นับโควต้า)</option></select></div>
        </div>
        <div class="field"><label>หมายเหตุ</label><input class="input" id="aoNote" maxlength="255"></div>
        <button class="btn btn-primary btn-block" onclick="Admin.addOff()">บันทึก</button>
      </div>`;
  },

  // ช่องปฏิทิน — ทุกคน: ไล่สีตามจำนวนคนหยุด / รายคน: สีตามประเภทการลา
  heatCells(byDate, staffTotal, single) {
    const TYPE_COLOR = { sick: '#d97706', personal: '#7c3aed', dayoff: '#2563eb' };
    const TYPE_SHORT = { sick: 'ป่วย', personal: 'กิจ', dayoff: 'หยุด' };
    const [Y, M] = this.aYm.split('-').map(Number);
    const first = new Date(Y, M - 1, 1), days = new Date(Y, M, 0).getDate();
    const today = todayStr();
    let cells = '';
    for (let i = 0; i < first.getDay(); i++) cells += '<div class="cal-day other"></div>';
    for (let dd = 1; dd <= days; dd++) {
      const ds = `${Y}-${String(M).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      const dow = new Date(Y, M - 1, dd).getDay();
      const items = byDate[ds] || [];
      const n = items.length;
      const over = items.some(o => +o.over_quota);
      const hasBday = !!(this.aBday && this.aBday[ds.slice(5)]);
      const cls = ['cal-day']; if (dow === 0) cls.push('sun'); if (ds === today) cls.push('today');
      let style = '', badge = '';
      if (n && single) {                       // รายคน — สีตามประเภท
        style = `background:${TYPE_COLOR[items[0].type] || '#2563eb'};border-color:transparent;color:#fff`;
        badge = `<span class="cd-badge" style="color:#fff">${TYPE_SHORT[items[0].type] || ''}${over ? '⚠️' : ''}</span>`;
      } else if (n) {                          // ทุกคน — ไล่สีตามจำนวน
        const t = staffTotal ? Math.min(1, n / staffTotal) : 1, dark = t > 0.5;
        style = `background:rgba(37,99,235,${(0.15 + t * 0.75).toFixed(2)});border-color:transparent${dark ? ';color:#fff' : ''}`;
        badge = `<span class="cd-badge"${dark ? ' style="color:#fff"' : ''}>${n}${over ? '⚠️' : ''}</span>`;
      }
      const cake = hasBday ? '<span class="cd-cake">🎂</span>' : '';
      const click = (n || hasBday) ? `onclick="Admin.dayDetail('${ds}')"` : '';
      cells += `<div class="${cls.join(' ')}" style="${style}" ${click}>${dd}${cake}${badge}</div>`;
    }
    return cells;
  },

  // แตะวันในปฏิทิน → รายชื่อคนหยุดวันนั้น + ปุ่มลบ
  dayDetail(ds) {
    const list = this.aByDate[ds] || [];
    const bdayNames = (this.aBday && this.aBday[ds.slice(5)]) || [];
    const bdayHtml = bdayNames.length
      ? `<div style="padding:7px 0;border-bottom:1px solid var(--line);text-align:left">🎂 วันเกิด: ${bdayNames.map(esc).join(', ')}</div>` : '';
    Swal.fire({
      title: thaiDate(ds), showConfirmButton: false, showCloseButton: true,
      html: bdayHtml + (list.map(o =>
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)">
          <span style="text-align:left">${esc(o.name)} <span class="tiny">(${offLabel(o.type)})${+o.over_quota ? ' ⚠️เกินโควต้า' : ''}</span>${o.note ? `<div class="tiny" style="color:var(--ink-2);margin-top:2px">📝 ${esc(o.note)}</div>` : ''}</span>
          <button class="link-btn" style="color:var(--absent);font-size:13px;flex-shrink:0" onclick="Admin.delOff(${o.id})">ลบ</button>
        </div>`).join('')) || (bdayHtml ? '' : 'ไม่มีข้อมูล'),
    });
  },

  aSetUser(v) { this.aUser = v; this.vDayoff(); },

  aMove(dir) {
    const [Y, M] = this.aYm.split('-').map(Number);
    const dt = new Date(Y, M - 1 + dir, 1);
    this.aYm = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    this.vDayoff();
  },

  async addOff() {
    const d = await App.api('dayoff_admin_add', {
      user_id: +byId('aoUser').value, dates: [byId('aoDate').value],
      type: byId('aoType').value, note: byId('aoNote').value.trim(),
    });
    toast(d.message);
    this.vDayoff();
  },

  async delOff(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบรายการลานี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    await App.api('dayoff_admin_del', { id });
    toast('ลบแล้ว');
    this.vDayoff();
  },

  // =====================================================
  // เจ้าหน้าที่
  // =====================================================
  async vUsers() {
    const d = await App.api('users_list');
    const pending = d.users.filter(u => u.status === 'pending');
    const staff = d.users.filter(u => u.role === 'staff' && u.status !== 'pending');

    byId('view').innerHTML = `
      ${pending.length ? `<div class="card" style="border:1.5px solid #fed7aa"><h3>⏳ รออนุมัติ (${pending.length})</h3>
        ${pending.map(u => `<div class="list-row">
          <div class="lr-main"><div class="lr-title">${esc(u.name)}</div><div class="lr-sub">@${esc(u.username)} ${esc(u.position || '')}</div></div>
          <button class="btn btn-primary btn-sm" onclick="Admin.userAct('user_approve',${u.id})">อนุมัติ</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="Admin.userAct('user_reject',${u.id})">ปฏิเสธ</button>
        </div>`).join('')}</div>` : ''}

      <div class="card"><h3>➕ เพิ่มเจ้าหน้าที่ใหม่</h3>
        <div class="field"><label>ชื่อ-สกุล</label><input class="input" id="nuName"></div>
        <div class="grid-2">
          <div class="field"><label>ตำแหน่ง</label><input class="input" id="nuPos" placeholder="เช่น พนักงานดับไฟป่า"></div>
          <div class="field"><label>เพศ <span class="tiny">(เวรกลางคืน+เกณฑ์ทดสอบ)</span></label>
            <select class="select" id="nuGender"><option value="">— ยังไม่ระบุ —</option><option value="male">ชาย</option><option value="female">หญิง</option></select></div>
        </div>
        <div class="field"><label>วันเกิด <span class="tiny">(ใช้เทียบเกณฑ์ทดสอบสมรรถภาพตามอายุ)</span></label><input class="input" type="date" id="nuBirth"></div>
        <button class="btn btn-primary btn-block" onclick="Admin.addUser()">เพิ่ม</button>
        <div class="tiny" style="margin-top:8px">เพิ่มแล้วให้เจ้าตัวเปิดเว็บ → "ลงทะเบียน" → เลือกชื่อ → ตั้งชื่อผู้ใช้+รหัสผ่านเอง ใช้ได้เลย</div>
      </div>

      <div class="card"><h3>🙂 ลงทะเบียนใบหน้า</h3>
        <div class="tiny" style="margin-bottom:10px">สอนระบบให้จำหน้าเจ้าหน้าที่จากรูปเช็คชื่อเดิม — เก็บแค่ "เวกเตอร์" ไม่เก็บรูป
          ${d.face_verify_enabled ? '' : '<br>⚠️ สวิตช์ยืนยันใบหน้ายัง<b>ปิด</b>อยู่ (เปิดที่เมนูตั้งค่า หลังลงทะเบียนครบแล้ว)'}</div>
        <button class="btn btn-primary btn-block" onclick="Admin.faceEnrollOpen()">📂 ลงทะเบียนจากโฟลเดอร์รูป (ทำบนคอม)</button>
      </div>

      <div class="card"><h3>👥 เจ้าหน้าที่ทั้งหมด (${staff.length})</h3>
        <div class="tiny" style="margin-bottom:8px">💡 ตั้งเพศ+วันเกิดให้ครบ — เพศใช้กรองเวรกลางคืน (เฉพาะชาย) · เพศ+วันเกิดใช้เทียบเกณฑ์ทดสอบสมรรถภาพ</div>
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>ชื่อ</th><th>เพศ</th><th>วันเกิด</th><th>ใบหน้า</th><th>สถานะ</th><th class="num">หยุดเดือนนี้</th><th></th></tr>
          ${staff.map(u => `<tr>
            <td><b>${esc(u.name)}</b><div class="tiny">${u.username ? '@' + esc(u.username) + ' ' : ''}${esc(u.position || '')}</div></td>
            <td><select class="select" style="min-width:86px;padding:4px 6px" onchange="Admin.setGender(${u.id}, this.value)">
              <option value=""${!u.gender ? ' selected' : ''}>—</option>
              <option value="male"${u.gender === 'male' ? ' selected' : ''}>ชาย</option>
              <option value="female"${u.gender === 'female' ? ' selected' : ''}>หญิง</option></select></td>
            <td><input type="date" class="input" style="min-width:130px;padding:4px 6px" value="${u.birthdate || ''}" onchange="Admin.setBirthdate(${u.id}, this.value)"></td>
            <td style="white-space:nowrap">${(+u.face_n >= d.face_min_desc)
              ? `<span class="chip chip-ok">${u.face_n} รูป</span>`
              : `<span class="chip chip-absent">${+u.face_n ? u.face_n + ' รูป' : 'ยังไม่มี'}</span>`}
              ${+u.face_n ? `<button class="btn btn-danger-ghost btn-sm" style="margin-left:4px" onclick="Admin.faceClear(${u.id},'${esc(u.name)}')">ลบ</button>` : ''}</td>
            <td>${{ active: '<span class="chip chip-ok">ใช้งาน</span>', unregistered: '<span class="chip chip-plain">ยังไม่ลงทะเบียน</span>',
                   disabled: '<span class="chip chip-absent">ปิดใช้งาน</span>' }[u.status] || u.status}</td>
            <td class="num">${u.quota_used}/${d.quota_max}</td>
            <td style="white-space:nowrap;text-align:right">
              ${u.status === 'active' ? `<button class="btn btn-ghost btn-sm" onclick="Admin.userAct('user_reset',${u.id},'รีเซ็ตรหัสผ่าน? เจ้าตัวต้องลงทะเบียนใหม่')">รีเซ็ตรหัส</button>
                <button class="btn btn-danger-ghost btn-sm" onclick="Admin.userAct('user_disable',${u.id},'ปิดใช้งานบัญชีนี้?')">ปิด</button>` : ''}
              ${u.status === 'disabled' ? `<button class="btn btn-ghost btn-sm" onclick="Admin.userAct('user_enable',${u.id})">เปิดใช้งาน</button>` : ''}
            </td></tr>`).join('') || '<tr><td colspan="7" class="empty">ยังไม่มีเจ้าหน้าที่</td></tr>'}
        </table></div>
      </div>`;
  },

  async addUser() {
    const d = await App.api('user_add', { name: byId('nuName').value.trim(), position: byId('nuPos').value.trim(), gender: byId('nuGender').value, birthdate: byId('nuBirth').value });
    await Swal.fire({ icon: 'success', title: 'เพิ่มแล้ว', text: d.message, confirmButtonText: 'ตกลง' });
    this.vUsers();
  },

  async setGender(id, gender) {
    const d = await App.api('user_set_gender', { id, gender });
    toast(d.message);
  },

  async setBirthdate(id, birthdate) {
    const d = await App.api('user_set_birthdate', { id, birthdate });
    toast(d.message);
  },

  // =====================================================
  // สุขภาพ (แอดมินกรอกให้เจ้าหน้าที่แต่ละคน)
  // =====================================================
  healthTab: 'overview',
  healthUid: null,
  healthStaff: null,

  healthSegHtml() {
    const t = (v, l) => `<button class="${this.healthTab === v ? 'active' : ''}" onclick="Admin.healthSetTab('${v}')">${l}</button>`;
    return `<div class="seg">${t('overview', '📊 ภาพรวม')}${t('record', '🩺 ผลตรวจ')}${t('fitness', '🏃 สมรรถภาพ')}${t('vaccine', '💉 วัคซีน')}</div>`;
  },
  healthSetTab(t) { this.healthTab = t; this.vHealth(); },

  async vHealth() {
    if (this.healthTab === 'overview') return this.vHealthOverview();
    if (this.healthTab === 'fitness') return this.vFitness();
    if (this.healthTab === 'vaccine') return this.vVaccine();
    const dl = await App.api('users_list');
    this.healthStaff = dl.users.filter(u => u.role === 'staff' && u.status !== 'pending');
    const opts = this.healthStaff.map(u => `<option value="${u.id}"${u.id == this.healthUid ? ' selected' : ''}>${esc(u.name)}${u.position ? ' — ' + esc(u.position) : ''}</option>`).join('');
    byId('view').innerHTML = this.healthSegHtml() + `
      <div class="card"><h3>🩺 สมุดสุขภาพเจ้าหน้าที่</h3>
        <div class="field"><label>เลือกเจ้าหน้าที่</label>
          <select class="select" id="hUser" onchange="Admin.healthPick(this.value)">
            <option value="">— เลือก —</option>${opts}</select></div>
      </div>
      <div id="hDetail"></div>`;
    if (this.healthUid) this.loadHealthDetail();
  },

  // ---------- แดชบอร์ดภาพรวม (คนต้องดูแล/เฝ้าระวัง แยกสุขภาพ & สมรรถภาพ) ----------
  async vHealthOverview() {
    byId('view').innerHTML = this.healthSegHtml() + '<div id="ovBox"><div class="card muted">กำลังโหลด...</div></div>';
    const d = await App.api('health_dashboard');
    byId('ovBox').innerHTML =
      this.ovCard('🩺 สุขภาพ', d.health, 'จากผลตรวจล่าสุด') +
      this.ovCard('🏃 สมรรถภาพ', d.fitness, 'จากรอบทดสอบล่าสุด');
  },

  ovCard(title, s, sub) {
    const stat = (n, cls, lbl) => `<div class="ov-stat ov-${cls}"><b>${n}</b><span>${lbl}</span></div>`;
    const person = (p, cls) => `<button class="ov-row ov-${cls}" onclick="Admin.healthOpen(${p.id})">
        <span class="ov-name">${esc(p.name)}</span>
        <span class="ov-iss">${p.issues.map(esc).join(' · ')}</span></button>`;
    let body;
    if (s.total === 0) body = '<div class="empty" style="padding:16px 12px">ยังไม่มีข้อมูล — เมื่อบันทึกผลแล้วจะสรุปให้อัตโนมัติค่ะ</div>';
    else if (!s.red.length && !s.yellow.length) body = '<div class="empty" style="padding:16px 12px">🟢 ทุกคนอยู่ในเกณฑ์ดี ไม่มีใครต้องเป็นห่วงค่ะ</div>';
    else body =
      (s.red.length ? `<div class="ov-sec ov-sec-r">🔴 ต้องดูแล (${s.red.length})</div>${s.red.map(p => person(p, 'r')).join('')}` : '') +
      (s.yellow.length ? `<div class="ov-sec ov-sec-y">🟡 เฝ้าระวัง (${s.yellow.length})</div>${s.yellow.map(p => person(p, 'y')).join('')}` : '');
    return `<div class="card">
      <h3>${title} <span class="h-right tiny">${sub}</span></h3>
      <div class="ov-stats">${stat(s.red.length, 'r', 'ต้องดูแล')}${stat(s.yellow.length, 'y', 'เฝ้าระวัง')}${stat(s.green, 'g', 'ปกติ')}</div>
      ${body}</div>`;
  },

  // กดชื่อคน → เปิดหน้าผลตรวจรายคนของเขา
  healthOpen(uid) { this.healthUid = String(uid); this.healthTab = 'record'; this.vHealth(); },

  healthPick(uid) { this.healthUid = uid || null; this.loadHealthDetail(); },

  async loadHealthDetail() {
    if (!this.healthUid) { byId('hDetail').innerHTML = ''; return; }
    byId('hDetail').innerHTML = '<div class="card muted">กำลังโหลด...</div>';
    const d = await App.api('health_admin_list', { user_id: +this.healthUid });
    const u = d.user, age = ageFrom(u.birthdate);
    const warn = (!u.gender || !u.birthdate)
      ? `<div class="alert-bar" style="margin-bottom:12px">⚠️ ${esc(u.name)} ยัง${!u.birthdate ? 'ไม่มีวันเกิด' : ''}${(!u.gender && !u.birthdate) ? '+' : ''}${!u.gender ? 'ไม่ระบุเพศ' : ''} — บันทึกผลตรวจได้ แต่รอบเอวจะยังไม่จัดระดับ (ตั้งได้ที่แท็บเจ้าหน้าที่)</div>`
      : '';
    // ฟอร์มกรอกผลตรวจใหม่
    const form = `<div class="card"><h3>➕ บันทึกผลตรวจใหม่</h3>
      ${warn}
      <div class="grid-2">
        <div class="field"><label>วันที่ตรวจ</label><input type="date" class="input" id="hDate" value="${todayStr()}"></div>
        <div class="field"><label>ตรวจที่ไหน</label><input class="input" id="hPlace" placeholder="เช่น รพ.พหลฯ"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>น้ำหนัก (กก.)</label><input type="number" step="0.1" class="input" id="hW" inputmode="decimal"></div>
        <div class="field"><label>ส่วนสูง (ซม.)</label><input type="number" step="0.1" class="input" id="hH" inputmode="decimal"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>รอบเอว (ซม.)</label><input type="number" step="0.1" class="input" id="hWaist" inputmode="decimal"></div>
        <div class="field"><label>ชีพจร (ครั้ง/นาที)</label><input type="number" class="input" id="hPulse" inputmode="numeric"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>ความดันตัวบน (SBP)</label><input type="number" class="input" id="hSys" inputmode="numeric"></div>
        <div class="field"><label>ความดันตัวล่าง (DBP)</label><input type="number" class="input" id="hDia" inputmode="numeric"></div>
      </div>
      <div class="field"><label>ผลตรวจอื่น ๆ / หมายเหตุ</label><textarea class="input" id="hNote" rows="2" placeholder="เช่น น้ำตาลในเลือด ไขมัน ฯลฯ"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="Admin.saveHealth()">บันทึกผลตรวจ</button>
    </div>`;
    // ประวัติ
    const hist = d.records.length
      ? `<div class="card"><h3>ประวัติผลตรวจ <span class="h-right">${d.records.length} ครั้ง${age !== null ? ` • อายุ ${age} ปี` : ''}</span></h3>
          ${d.records.map(r => `<div class="list-row"><span class="dot" style="background:#0ea5e9"></span>
            <div class="lr-main"><div class="lr-title">${thaiDate(r.record_date)}${r.checkup_place ? ` <span class="tiny">· ${esc(r.checkup_place)}</span>` : ''}</div>
              <div class="lr-sub">${healthSummary(r)}${r.bmi_class ? ' · ' + healthChip(r.bmi_class) : ''}${r.bp_class ? ' ' + healthChip(r.bp_class) : ''}</div></div>
            <button class="btn btn-danger-ghost btn-sm" onclick="Admin.delHealth(${r.id})">ลบ</button></div>`).join('')}</div>`
      : '<div class="card empty"><span class="e-ico">🩺</span>ยังไม่มีบันทึกผลตรวจของคนนี้</div>';
    byId('hDetail').innerHTML = form + hist;
  },

  async saveHealth() {
    await App.api('health_admin_add', {
      user_id: +this.healthUid,
      record_date: byId('hDate').value, checkup_place: byId('hPlace').value.trim(),
      weight_kg: byId('hW').value, height_cm: byId('hH').value, waist_cm: byId('hWaist').value,
      bp_sys: byId('hSys').value, bp_dia: byId('hDia').value, pulse: byId('hPulse').value,
      note: byId('hNote').value.trim(),
    });
    toast('บันทึกผลตรวจแล้ว');
    this.loadHealthDetail();
  },

  async delHealth(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบผลตรวจนี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
    if (!c.isConfirmed) return;
    await App.api('health_admin_del', { id });
    toast('ลบแล้ว');
    this.loadHealthDetail();
  },

  // =====================================================
  // การ์ดวัคซีน (แอดมิน) — ภาพรวมทีม + กรอกการฉีดรายคน + จัดการชนิดวัคซีน
  // =====================================================
  vacView: 'team',     // team | person | types
  vacUid: null,
  vacTypes: null,      // ชนิดที่ใช้งานอยู่ (ไว้ทำ dropdown ตอนกรอก)
  vacTypeList: null,   // ชนิดทั้งหมดในแท็บจัดการ (ไว้ให้ปุ่มแก้หยิบค่าเดิม)

  vVaccine() {
    const sub = (v, l) => `<button class="${this.vacView === v ? 'active' : ''}" onclick="Admin.vacGo('${v}')">${l}</button>`;
    const bar = `<div class="seg" style="margin-top:-4px">${sub('team', '👥 ภาพรวมทีม')}${sub('person', '🧍 รายคน')}${sub('types', '⚙️ ชนิดวัคซีน')}</div>`;
    byId('view').innerHTML = this.healthSegHtml() + bar + '<div id="vacBox"><div class="card muted">กำลังโหลด...</div></div>';
    if (this.vacView === 'types') return this.vacLoadTypes();
    if (this.vacView === 'person') return this.vacLoadPerson();
    return this.vacLoadTeam();
  },
  vacGo(v) { this.vacView = v; this.vVaccine(); },

  // กดชื่อคนในตารางภาพรวม → เปิดหน้ารายคนของเขา
  vacOpen(uid) { this.vacUid = String(uid); this.vacView = 'person'; this.vVaccine(); },

  // ---------- ภาพรวมทีม (ตาราง คน × ชนิดวัคซีน) ----------
  async vacLoadTeam() {
    const d = await App.api('vaccine_overview');
    if (!d.types.length) {
      byId('vacBox').innerHTML = '<div class="card empty"><span class="e-ico">💉</span>ยังไม่มีชนิดวัคซีน — เพิ่มที่แท็บ ⚙️ ชนิดวัคซีน ก่อนค่ะ</div>';
      return;
    }
    const s = d.summary;
    // ค่าท้ายบรรทัดของแต่ละชนิด: ยังคุ้ม=วันที่ฉีด · ใกล้ครบ/เกิน=จำนวนวัน · ยังไม่มี=—
    const cellText = c => c.level === 'none' ? '—'
      : c.level === 'bad'  ? `เกิน ${Math.abs(c.days_left)} วัน`
      : c.level === 'warn' ? `เหลือ ${c.days_left} วัน`
      : (c.last_date ? vacShortDate(c.last_date) : 'ฉีดแล้ว');
    // คนที่มีปัญหาขึ้นก่อน (แดง → เหลือง → ที่เหลือ) แล้วค่อยเรียงชื่อตามที่ backend ส่งมา
    const rank = u => Math.min(...d.types.map(t => ({ bad: 0, warn: 1 }[u.cells[t.id].level] ?? 2)));
    const staff = d.staff.slice().sort((a, b) => rank(a) - rank(b));

    const people = staff.map(u => `<button class="vac-p" onclick="Admin.vacOpen(${u.id})">
      <div class="vac-p-name">${esc(u.name)}${u.position ? ` <span class="tiny">${esc(u.position)}</span>` : ''}</div>
      ${d.types.map(t => {
        const c = u.cells[t.id];
        return `<div class="vac-p-it"><span class="vac-p-ic">${VAC_ICON[c.level]}</span>
          <span class="vac-p-nm">${esc(t.name)}</span>
          <span class="vac-p-val">${esc(cellText(c))}</span></div>`;
      }).join('')}
    </button>`).join('');

    byId('vacBox').innerHTML = `<div class="card">
      <h3>💉 ภาพรวมวัคซีนทั้งทีม <span class="h-right tiny">เตือนล่วงหน้า ${d.warn_days} วัน</span></h3>
      <div class="ov-stats">
        <div class="ov-stat ov-r"><b>${s.bad}</b><span>เกินกำหนด</span></div>
        <div class="ov-stat ov-y"><b>${s.warn}</b><span>ใกล้ครบ</span></div>
        <div class="ov-stat ov-g"><b>${s.ok}</b><span>ยังคุ้ม</span></div>
        <div class="ov-stat"><b>${s.none}</b><span>ยังไม่มีข้อมูล</span></div>
      </div>
      ${staff.length ? people : '<div class="empty" style="padding:16px 12px">ยังไม่มีเจ้าหน้าที่ในระบบ</div>'}
      <div class="tiny" style="margin-top:10px">🟢 ยังคุ้ม · 🟡 ใกล้ครบ · 🔴 เกินกำหนด · ⚪️ ยังไม่มีข้อมูล — แตะชื่อเพื่อบันทึกการฉีด</div>
    </div>`;
  },

  // ---------- รายคน: บันทึกการฉีด + ประวัติ ----------
  async vacLoadPerson() {
    const dl = await App.api('users_list');
    const staff = dl.users.filter(u => u.role === 'staff' && u.status !== 'pending');
    const opts = staff.map(u => `<option value="${u.id}"${u.id == this.vacUid ? ' selected' : ''}>${esc(u.name)}${u.position ? ' — ' + esc(u.position) : ''}</option>`).join('');
    byId('vacBox').innerHTML = `<div class="card"><h3>💉 การ์ดวัคซีนรายคน</h3>
      <div class="field"><label>เลือกเจ้าหน้าที่</label>
        <select class="select" id="vacUser" onchange="Admin.vacPick(this.value)">
          <option value="">— เลือก —</option>${opts}</select></div>
    </div><div id="vacDetail"></div>`;
    if (this.vacUid) this.vacLoadDetail();
  },

  vacPick(uid) { this.vacUid = uid || null; this.vacLoadDetail(); },

  async vacLoadDetail() {
    if (!this.vacUid) { byId('vacDetail').innerHTML = ''; return; }
    byId('vacDetail').innerHTML = '<div class="card muted">กำลังโหลด...</div>';
    const d = await App.api('vaccine_admin_list', { user_id: +this.vacUid });
    this.vacTypes = d.types;

    const status = d.status.length
      ? `<div class="card"><h3>สถานะปัจจุบัน — ${esc(d.user.name)}</h3>
          ${d.status.map(t => `<div class="vc-row">
            <div class="vc-main"><div class="vc-name">${esc(t.name)}</div>
              <div class="vc-sub">${t.last_date ? 'ฉีดล่าสุด ' + thaiDate(t.last_date, false) + (t.due ? ' · ครบรอบ ' + thaiDate(t.due, false) : '') : 'ยังไม่มีบันทึก'}</div></div>
            <div class="vc-chip">${vaccineChip(t)}</div></div>`).join('')}</div>`
      : '';

    const form = d.types.length ? `<div class="card"><h3>➕ บันทึกการฉีด</h3>
      <div class="field"><label>วัคซีน</label>
        <select class="select" id="vacType">${d.types.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
      <div class="grid-2">
        <div class="field"><label>วันที่ฉีด</label><input type="date" class="input" id="vacDate" value="${todayStr()}" max="${todayStr()}"></div>
        <div class="field"><label>หมายเหตุ</label><input class="input" id="vacNote" placeholder="เช่น เข็มที่ 2 / รพ.พหลฯ"></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="Admin.vacSave()">บันทึกการฉีด</button>
    </div>` : '<div class="card empty"><span class="e-ico">💉</span>ยังไม่มีชนิดวัคซีน — เพิ่มที่แท็บ ⚙️ ชนิดวัคซีน ก่อนค่ะ</div>';

    const hist = d.doses.length
      ? `<div class="card"><h3>ประวัติการฉีด <span class="h-right">${d.doses.length} ครั้ง</span></h3>
          ${d.doses.map(r => `<div class="list-row"><span class="dot" style="background:#0ea5e9"></span>
            <div class="lr-main"><div class="lr-title">${esc(r.type_name)}</div>
              <div class="lr-sub">${thaiDate(r.dose_date)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
            <button class="btn btn-danger-ghost btn-sm" onclick="Admin.vacDel(${r.id})">ลบ</button></div>`).join('')}</div>`
      : '<div class="card empty"><span class="e-ico">💉</span>ยังไม่มีประวัติการฉีดของคนนี้</div>';

    byId('vacDetail').innerHTML = status + form + hist;
  },

  async vacSave() {
    await App.api('vaccine_admin_add', {
      user_id: +this.vacUid, type_id: +byId('vacType').value,
      dose_date: byId('vacDate').value, note: byId('vacNote').value.trim(),
    });
    toast('บันทึกการฉีดแล้ว');
    this.vacLoadDetail();
  },

  async vacDel(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบรายการฉีดนี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
    if (!c.isConfirmed) return;
    await App.api('vaccine_admin_del', { id });
    toast('ลบแล้ว');
    this.vacLoadDetail();
  },

  // ---------- ชนิดวัคซีน + วันเตือนล่วงหน้า ----------
  async vacLoadTypes() {
    const d = await App.api('vaccine_types_admin');
    this.vacTypeList = d.types;      // เก็บไว้ให้ vacTypeEdit หาชื่อ/อายุ (ไม่ยัดค่าลง onclick — ชื่อมีอักขระพิเศษได้)
    const row = t => `<div class="list-row${t.is_active ? '' : ' dimmed'}">
      <span class="dot" style="background:${t.is_active ? '#16a34a' : '#94a3b8'}"></span>
      <div class="lr-main"><div class="lr-title">${esc(t.name)}${t.is_active ? '' : ' <span class="tiny">(ซ่อนอยู่)</span>'}</div>
        <div class="lr-sub">${t.valid_months ? 'คุ้ม ' + t.valid_months + ' เดือน' : 'ตลอดชีพ (ไม่เตือนครบรอบ)'} · บันทึกแล้ว ${t.doses} ครั้ง</div></div>
      <button class="btn btn-ghost btn-sm" onclick="Admin.vacTypeEdit(${t.id})">แก้</button>
      <button class="btn btn-danger-ghost btn-sm" onclick="Admin.vacTypeToggle(${t.id}, ${t.is_active ? 0 : 1})">${t.is_active ? 'ซ่อน' : 'แสดง'}</button>
    </div>`;

    byId('vacBox').innerHTML = `<div class="card"><h3>➕ เพิ่มชนิดวัคซีน</h3>
      <div class="grid-2">
        <div class="field"><label>ชื่อวัคซีน</label><input class="input" id="vtName" placeholder="เช่น ไข้หวัดใหญ่"></div>
        <div class="field"><label>อายุความคุ้มกัน (เดือน)</label><input type="number" class="input" id="vtMonths" inputmode="numeric" placeholder="เว้นว่าง = ตลอดชีพ"></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="Admin.vacTypeSave()">เพิ่มวัคซีน</button>
    </div>
    <div class="card"><h3>ชนิดวัคซีนทั้งหมด <span class="h-right">${d.types.length} ชนิด</span></h3>
      ${d.types.length ? d.types.map(row).join('') : '<div class="empty" style="padding:16px 12px">ยังไม่มีชนิดวัคซีน</div>'}</div>
    <div class="card"><h3>⏰ เตือนล่วงหน้าก่อนครบรอบ</h3>
      <div class="field"><label>ขึ้นป้ายเหลือง "ใกล้ครบ" เมื่อเหลืออีกกี่วัน</label>
        <input type="number" class="input" id="vtWarn" inputmode="numeric" min="1" max="365" value="${d.warn_days}"></div>
      <button class="btn btn-primary btn-block" onclick="Admin.vacSaveWarn()">บันทึก</button>
    </div>`;
  },

  async vacTypeSave() {
    const name = byId('vtName').value.trim();
    if (!name) return toast('กรอกชื่อวัคซีนก่อนค่ะ');
    await App.api('vaccine_type_save', { name, valid_months: byId('vtMonths').value.trim() });
    toast('เพิ่มวัคซีนแล้ว');
    this.vacLoadTypes();
  },

  async vacTypeEdit(id) {
    const t = (this.vacTypeList || []).find(x => +x.id === +id);
    if (!t) return;
    const r = await Swal.fire({
      title: 'แก้ชนิดวัคซีน', html:
        `<input id="sw1" class="swal2-input" placeholder="ชื่อวัคซีน" value="${esc(t.name)}">
         <input id="sw2" class="swal2-input" type="number" placeholder="อายุ (เดือน) เว้นว่าง = ตลอดชีพ" value="${t.valid_months ?? ''}">`,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      preConfirm: () => ({ name: document.getElementById('sw1').value.trim(), months: document.getElementById('sw2').value.trim() }),
    });
    if (!r.isConfirmed) return;
    if (!r.value.name) return toast('กรอกชื่อวัคซีนก่อนค่ะ');
    await App.api('vaccine_type_save', { id, name: r.value.name, valid_months: r.value.months });
    toast('บันทึกแล้ว');
    this.vacLoadTypes();
  },

  async vacTypeToggle(id, active) {
    await App.api('vaccine_type_delete', { id, active });
    toast(active ? 'แสดงแล้ว' : 'ซ่อนแล้ว');
    this.vacLoadTypes();
  },

  async vacSaveWarn() {
    await App.api('settings_save', { settings: { vaccine_warn_days: byId('vtWarn').value } });
    toast('บันทึกแล้ว');
    this.vacLoadTypes();
  },

  // =====================================================
  // ทดสอบสมรรถภาพ (แอดมิน) — รอบทดสอบ + กรอกผล + จัดการท่า/เกณฑ์
  // =====================================================
  fitView: 'rounds',   // rounds | entry | items | itemEdit
  fitRoundId: null,
  fitItems: null,
  fitEdit: null,       // ท่าที่กำลังแก้ (working copy)

  vFitness() {
    const sub = (v, l) => `<button class="${this.fitView === v ? 'active' : ''}" onclick="Admin.fitGo('${v}')">${l}</button>`;
    const bar = `<div class="seg" style="margin-top:-4px">${sub('rounds', '📋 รอบทดสอบ')}${sub('items', '⚙️ ท่า & เกณฑ์')}</div>`;
    byId('view').innerHTML = this.healthSegHtml() + bar + '<div id="fitBox"><div class="card muted">กำลังโหลด...</div></div>';
    if (this.fitView === 'items') return this.fitLoadItems();
    if (this.fitView === 'entry') return this.fitLoadEntry();
    if (this.fitView === 'itemEdit') return this.fitRenderItemEdit();
    return this.fitLoadRounds();
  },
  fitGo(v) { this.fitView = v; this.vFitness(); },

  // ---------- รอบทดสอบ ----------
  async fitLoadRounds() {
    const d = await App.api('fitness_rounds_list');
    byId('fitBox').innerHTML = `
      <div class="card"><h3>➕ สร้างรอบทดสอบใหม่</h3>
        <div class="field"><label>ชื่อรอบ</label><input class="input" id="frTitle" placeholder="เช่น ทดสอบสมรรถภาพ ไตรมาส 3/2569"></div>
        <div class="grid-2">
          <div class="field"><label>วันที่ทดสอบ</label><input type="date" class="input" id="frDate" value="${todayStr()}"></div>
          <div class="field"><label>หมายเหตุ</label><input class="input" id="frNote"></div>
        </div>
        <button class="btn btn-primary btn-block" onclick="Admin.fitAddRound()">สร้างรอบ + แจ้ง LINE</button>
      </div>
      ${d.rounds.length ? `<div class="card"><h3>รอบทดสอบทั้งหมด</h3>
        ${d.rounds.map(r => `<div class="list-row">
          <div class="lr-main"><div class="lr-title">${esc(r.title)}</div>
            <div class="lr-sub">${thaiDate(r.test_date)} • ทดสอบแล้ว ${r.tested} คน${r.note ? ' • ' + esc(r.note) : ''}</div></div>
          <button class="btn btn-primary btn-sm" onclick="Admin.fitOpenEntry(${r.id})">กรอก/ดูผล</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="Admin.fitDelRound(${r.id})">ลบ</button>
        </div>`).join('')}</div>` : '<div class="card empty"><span class="e-ico">📋</span>ยังไม่มีรอบทดสอบ</div>'}`;
  },
  async fitAddRound() {
    const title = byId('frTitle').value.trim();
    if (!title) return toast('กรอกชื่อรอบ', 'error');
    const d = await App.api('fitness_round_add', { title, test_date: byId('frDate').value, note: byId('frNote').value.trim() });
    toast(d.message); this.fitOpenEntry(d.id);
  },
  async fitDelRound(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบรอบทดสอบนี้?', text: 'ผลทั้งรอบจะถูกลบ', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
    if (!c.isConfirmed) return;
    await App.api('fitness_round_del', { id }); toast('ลบแล้ว'); this.fitLoadRounds();
  },
  fitOpenEntry(id) { this.fitRoundId = id; this.fitGo('entry'); },

  // ---------- กรอกผลแบบ roster ----------
  async fitLoadEntry() {
    const d = await App.api('fitness_round_get', { round_id: this.fitRoundId });
    if (!d.items.length) {
      byId('fitBox').innerHTML = `<div class="card"><button class="btn btn-ghost btn-sm" onclick="Admin.fitGo('rounds')">← กลับ</button>
        <div class="empty" style="margin-top:10px">ยังไม่มีท่าทดสอบที่ใช้งาน — ไปเพิ่มที่แท็บ "ท่า & เกณฑ์" ก่อน</div></div>`;
      return;
    }
    const head = d.items.map(it => `<th class="num">${esc(it.name)}<div class="tiny">${esc(it.unit || '')}</div></th>`).join('');
    const rows = d.staff.map(s => {
      const cells = d.items.map(it => {
        const r = d.results[s.id + '_' + it.id];
        const val = r && r.raw_value !== null ? +r.raw_value : '';
        const chip = r && r.level ? fitnessChip(r.level, r.tone) : '';
        return `<td class="num"><input type="number" step="0.1" inputmode="decimal" class="input fit-in" style="width:74px;padding:4px 6px" data-u="${s.id}" data-i="${it.id}" value="${val}"><div class="fit-chip">${chip}</div></td>`;
      }).join('');
      const meta = (s.age !== null ? 'อายุ ' + s.age + ' ปี' : '<span style="color:#dc2626">ไม่มีวันเกิด</span>') + (!s.gender ? ' <span style="color:#dc2626">·ไม่ระบุเพศ</span>' : '');
      return `<tr><td><b>${esc(s.name)}</b><div class="tiny">${meta}</div></td>${cells}</tr>`;
    }).join('');
    byId('fitBox').innerHTML = `
      <div class="card">
        <button class="btn btn-ghost btn-sm" onclick="Admin.fitGo('rounds')">← กลับ</button>
        <h3 style="margin-top:10px">${esc(d.round.title)} <span class="h-right">${thaiDate(d.round.test_date)}</span></h3>
        <div class="tiny" style="margin-bottom:8px">💡 กรอกค่าที่วัดได้ → ระบบจัดระดับให้ตอนกดบันทึก (ช่องว่าง = ไม่มีผล) · คนที่ไม่มีวันเกิด/เพศ จะยังไม่จัดระดับท่าที่อิงอายุ</div>
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>เจ้าหน้าที่</th>${head}</tr>
          ${rows || '<tr><td class="empty">ไม่มีเจ้าหน้าที่ active</td></tr>'}
        </table></div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="Admin.fitSaveResults()">บันทึกผลทั้งหมด</button>
      </div>`;
  },
  async fitSaveResults() {
    const results = [...document.querySelectorAll('.fit-in')].map(el => ({ user_id: +el.dataset.u, item_id: +el.dataset.i, value: el.value }));
    const d = await App.api('fitness_result_save', { round_id: this.fitRoundId, results });
    toast(d.message); this.fitLoadEntry();
  },

  // ---------- จัดการท่าทดสอบ + เกณฑ์ ----------
  async fitLoadItems() {
    const d = await App.api('fitness_items_admin');
    this.fitItems = d.items;
    const dirL = { higher: 'มากยิ่งดี', lower: 'น้อย/เร็วยิ่งดี', cap: 'ผ่านภายในเพดาน' };
    byId('fitBox').innerHTML = `
      <div class="card"><h3>⚙️ ท่าทดสอบ & เกณฑ์</h3>
        <div class="tiny" style="margin-bottom:8px">ตั้งท่าเอง — cap = ผ่านภายในเพดาน (เช่น WCT ไม่ใช้อายุ/เพศ) · มากยิ่งดี (ดันพื้น) · น้อย/เร็วยิ่งดี (เวลาวิ่ง) มีเกณฑ์ตามอายุ×เพศ</div>
        <button class="btn btn-primary btn-sm" onclick="Admin.fitEditItem(0)">+ เพิ่มท่าทดสอบ</button>
      </div>
      <div class="card">${d.items.map(it => `<div class="list-row" style="${it.is_active == 0 ? 'opacity:.5' : ''}">
        <div class="lr-main"><div class="lr-title">${esc(it.name)}</div><div class="lr-sub">${esc(it.unit || '')} • ${dirL[it.direction]}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="Admin.fitEditItem(${it.id})">แก้ไข</button>
        <button class="btn btn-danger-ghost btn-sm" onclick="Admin.fitToggleItem(${it.id},${it.is_active == 1 ? 0 : 1})">${it.is_active == 1 ? 'ซ่อน' : 'แสดง'}</button>
      </div>`).join('') || '<div class="empty">ยังไม่มีท่าทดสอบ</div>'}</div>`;
  },
  async fitToggleItem(id, active) { await App.api('fitness_item_delete', { id, active }); this.fitLoadItems(); },

  fitEditItem(id) {
    const it = id ? (this.fitItems || []).find(x => x.id == id) : null;
    this.fitEdit = it
      ? { id: it.id, name: it.name, unit: it.unit, direction: it.direction, criteria: JSON.parse(it.criteria_json || 'null') || {} }
      : { id: 0, name: '', unit: '', direction: 'higher', criteria: { levels: ['ดี', 'พอใช้', 'ต้องปรับปรุง'], bands: [] } };
    this.fitGo('itemEdit');
  },

  fitRenderItemEdit() {
    const e = this.fitEdit;
    byId('fitBox').innerHTML = `
      <div class="card">
        <button class="btn btn-ghost btn-sm" onclick="Admin.fitGo('items')">← กลับ</button>
        <h3 style="margin-top:10px">${e.id ? 'แก้ไข' : 'เพิ่ม'}ท่าทดสอบ</h3>
        <div class="field"><label>ชื่อท่า</label><input class="input" id="fiName" value="${esc(e.name)}" placeholder="เช่น ดันพื้น 1 นาที"></div>
        <div class="grid-2">
          <div class="field"><label>หน่วย</label><input class="input" id="fiUnit" value="${esc(e.unit)}" placeholder="ครั้ง/วินาที/ซม./นาที"></div>
          <div class="field"><label>ทิศทางการให้เกรด</label>
            <select class="select" id="fiDir" onchange="Admin.fitDirChange(this.value)">
              <option value="higher"${e.direction === 'higher' ? ' selected' : ''}>มากยิ่งดี</option>
              <option value="lower"${e.direction === 'lower' ? ' selected' : ''}>น้อย/เร็วยิ่งดี</option>
              <option value="cap"${e.direction === 'cap' ? ' selected' : ''}>ผ่านภายในเพดาน (cap)</option>
            </select></div>
        </div>
        <div id="fiCrit"></div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="Admin.fitSaveItem()">บันทึกท่าทดสอบ</button>
      </div>`;
    this.fitRenderCrit();
  },
  fitDirChange(dir) {
    this.fitEdit.direction = dir;
    if (dir === 'cap') { if (this.fitEdit.criteria?.cap === undefined) this.fitEdit.criteria = { cap: '' }; }
    else if (!this.fitEdit.criteria?.levels) this.fitEdit.criteria = { levels: ['ดี', 'พอใช้', 'ต้องปรับปรุง'], bands: [] };
    this.fitRenderCrit();
  },
  fitRenderCrit() {
    const e = this.fitEdit, box = byId('fiCrit');
    if (e.direction === 'cap') {
      box.innerHTML = `<div class="field"><label>เพดาน (ผ่านถ้าค่า ≤ เพดาน)</label>
        <input type="number" step="0.1" class="input" id="fiCap" value="${e.criteria?.cap ?? ''}"></div>
        <div class="tiny">เช่น WCT Arduous = 45 (นาที) — cap ไม่ใช้อายุ/เพศ จัดระดับได้ทุกคน</div>`;
      return;
    }
    const lv = e.criteria.levels || [], bands = e.criteria.bands || [];
    const bandRows = bands.map((b, bi) => {
      const inputs = g => lv.map((lname, li) => `<input type="number" step="0.1" class="input" style="width:64px;padding:4px 5px" data-b="${bi}" data-g="${g}" data-l="${li}" value="${b[g] && b[g][li] !== undefined ? b[g][li] : ''}" title="${esc(lname)}">`).join(' ');
      return `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">
        <div class="row" style="gap:6px;margin-bottom:6px">อายุ
          <input type="number" class="input" style="width:60px;padding:4px 5px" data-b="${bi}" data-f="min" value="${b.min_age ?? ''}"> ถึง
          <input type="number" class="input" style="width:60px;padding:4px 5px" data-b="${bi}" data-f="max" value="${b.max_age ?? ''}">
          <button class="btn btn-danger-ghost btn-sm" style="margin-left:auto" onclick="Admin.fitDelBand(${bi})">ลบช่วง</button></div>
        <div class="tiny">ชาย (${esc(lv.join(' / '))}):</div><div class="row" style="gap:4px;margin:3px 0 6px;flex-wrap:wrap">${inputs('male')}</div>
        <div class="tiny">หญิง:</div><div class="row" style="gap:4px;margin-top:3px;flex-wrap:wrap">${inputs('female')}</div>
      </div>`;
    }).join('');
    box.innerHTML = `
      <div class="field"><label>ระดับ (เรียงดี→แย่ คั่นด้วยจุลภาค)</label>
        <input class="input" id="fiLevels" value="${esc(lv.join(', '))}" onchange="Admin.fitSetLevels(this.value)"></div>
      <div class="tiny" style="margin-bottom:6px">ใส่ค่าเกณฑ์แต่ละระดับตามอายุ/เพศ (${e.direction === 'higher' ? 'ค่าขั้นต่ำของระดับนั้น' : 'เวลาสูงสุดของระดับนั้น'}) — เรียงซ้าย→ขวาตามระดับ</div>
      ${bandRows}
      <button class="btn btn-ghost btn-sm" onclick="Admin.fitAddBand()">+ เพิ่มช่วงอายุ</button>`;
  },
  // อ่านค่าจาก input ทั้งหมดกลับเข้า working copy ก่อน mutate/re-render (กันค่าที่พิมพ์หาย)
  fitSyncCrit() {
    const e = this.fitEdit;
    if (e.direction === 'cap') { const c = byId('fiCap'); e.criteria = { cap: c ? c.value : '' }; return; }
    const bands = e.criteria.bands || [];
    document.querySelectorAll('#fiCrit input[data-f]').forEach(el => {
      const b = bands[+el.dataset.b]; if (!b) return;
      if (el.dataset.f === 'min') b.min_age = el.value; else b.max_age = el.value;
    });
    document.querySelectorAll('#fiCrit input[data-g]').forEach(el => {
      const b = bands[+el.dataset.b]; if (!b) return;
      b[el.dataset.g] = b[el.dataset.g] || []; b[el.dataset.g][+el.dataset.l] = el.value;
    });
    e.criteria.bands = bands;
  },
  fitSetLevels(v) { this.fitSyncCrit(); this.fitEdit.criteria.levels = v.split(',').map(s => s.trim()).filter(Boolean); this.fitRenderCrit(); },
  fitAddBand() { this.fitSyncCrit(); this.fitEdit.criteria.bands.push({ min_age: '', max_age: '', male: [], female: [] }); this.fitRenderCrit(); },
  fitDelBand(bi) { this.fitSyncCrit(); this.fitEdit.criteria.bands.splice(bi, 1); this.fitRenderCrit(); },

  async fitSaveItem() {
    const e = this.fitEdit;
    e.name = byId('fiName').value.trim(); e.unit = byId('fiUnit').value.trim(); e.direction = byId('fiDir').value;
    if (!e.name) return toast('กรอกชื่อท่า', 'error');
    this.fitSyncCrit();
    let criteria;
    if (e.direction === 'cap') {
      criteria = { cap: parseFloat(e.criteria.cap) };
      if (isNaN(criteria.cap)) return toast('กรอกเพดานเป็นตัวเลข', 'error');
    } else {
      const levels = (e.criteria.levels || []).filter(Boolean);
      const bands = (e.criteria.bands || []).map(b => ({
        min_age: +b.min_age, max_age: +b.max_age,
        male: (b.male || []).map(x => x === '' ? 0 : +x), female: (b.female || []).map(x => x === '' ? 0 : +x),
      }));
      if (!levels.length || !bands.length) return toast('ใส่ระดับและช่วงอายุอย่างน้อย 1 ช่วง', 'error');
      criteria = { levels, bands };
    }
    const d = await App.api('fitness_item_save', { id: e.id, name: e.name, unit: e.unit, direction: e.direction, criteria });
    toast(d.message); this.fitGo('items');
  },

  async userAct(action, id, confirmMsg) {
    if (confirmMsg) {
      const c = await Swal.fire({ icon: 'warning', title: confirmMsg, showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก' });
      if (!c.isConfirmed) return;
    }
    const d = await App.api(action, { id });
    toast(d.message);
    this.vUsers();
  },

  async leaveAct(action, id) {
    if (action === 'leave_reject') {
      const c = await Swal.fire({ icon: 'warning', title: 'ปฏิเสธคำขอลานี้?', text: 'คำขอจะถูกลบ เจ้าหน้าที่ต้องยื่นใหม่ถ้าต้องการ', showCancelButton: true, confirmButtonText: 'ปฏิเสธ', cancelButtonText: 'ไม่' });
      if (!c.isConfirmed) return;
    }
    const d = await App.api(action, { id });
    toast(d.message);
    App.adminData = await App.api('admin_data');   // refresh badge บนแดชบอร์ด
    this.vDayoff();
  },

  // =====================================================
  // พัฒนาตัวเอง — จัดการคลังความรู้
  // =====================================================
  libAdmin: null,
  libStaffN: 0,
  devTab: 'lib',

  devSegHtml() {
    const t = (v, l) => `<button class="${this.devTab === v ? 'active' : ''}" onclick="Admin.devSetTab('${v}')">${l}</button>`;
    return `<div class="seg">
      ${t('lib', '📚 คลังความรู้')}${t('quiz', '📝 แบบทดสอบ')}${t('training', '🎓 อบรม')}
    </div>`;
  },

  devSetTab(t) { this.devTab = t; this.vDevelop(); },

  async vDevelop() {
    if (this.devTab === 'quiz')     return this.vDevelopQuiz();
    if (this.devTab === 'training') return this.vTraining();
    return this.vDevelopLib();
  },

  async vDevelopLib() {
    byId('view').innerHTML = `
      ${this.devSegHtml()}
      <div class="card"><h3 id="lfHead">➕ เพิ่มเอกสารเข้าคลัง</h3>
        <input type="hidden" id="lfId" value="">
        <div class="field"><label>ชื่อเอกสาร</label><input class="input" id="lfTitle" maxlength="200"></div>
        <div class="grid-2">
          <div class="field"><label>หมวดหมู่</label><select class="select" id="lfCat">
            ${Object.entries(LIB_CAT).map(([v, c]) => `<option value="${v}">${c.icon} ${c.label}</option>`).join('')}</select></div>
          <div class="field"><label>รูปปก (จากลิงก์)</label><div class="lib-preview" id="lfPreview"></div></div>
        </div>
        <div class="field"><label>ลิงก์ Google Drive / ภายนอก</label>
          <input class="input" id="lfUrl" placeholder="https://drive.google.com/file/d/..." oninput="Admin.libPreview()"></div>
        <div class="field"><label>คำอธิบายสั้นๆ (ถ้ามี)</label><input class="input" id="lfDesc" maxlength="500"></div>
        <div class="row" style="gap:8px">
          <button class="btn btn-primary" onclick="Admin.libSave()">บันทึก</button>
          <button class="btn btn-ghost btn-sm" id="lfCancel" style="display:none" onclick="Admin.libResetForm()">ยกเลิกแก้ไข</button>
        </div>
        <div class="tiny" style="margin-top:8px">💡 ตั้งแชร์ไฟล์ใน Drive เป็น "ทุกคนที่มีลิงก์" รูปปกถึงจะขึ้น</div>
      </div>
      <div id="libList"><div class="card muted">กำลังโหลด...</div></div>`;
    this.libResetForm();
    const d = await App.api('library_admin_list');
    this.libAdmin = d.items;
    this.libStaffN = d.active_staff;
    this.renderLibList();
  },

  libExtractId(url) {
    const m = url.match(/\/d\/([-\w]{20,})/) || url.match(/[?&]id=([-\w]{20,})/);
    return m ? m[1] : '';
  },

  libPreview() {
    const id = this.libExtractId(byId('lfUrl').value.trim());
    byId('lfPreview').innerHTML = id
      ? `<img src="https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w400"
           onerror="this.parentNode.innerHTML='<span class=&quot;tiny&quot;>โหลดรูปไม่ได้ — เช็คว่าแชร์ไฟล์แล้ว</span>'">`
      : `<span class="tiny">วางลิงก์ Drive เพื่อดูรูปปก</span>`;
  },

  renderLibList() {
    if (!this.libAdmin.length) {
      byId('libList').innerHTML = '<div class="card empty"><span class="e-ico">📚</span>ยังไม่มีเอกสารในคลัง เพิ่มอันแรกด้านบนได้เลย</div>';
      return;
    }
    const N = this.libStaffN;
    byId('libList').innerHTML = `<div class="card"><h3>📚 เอกสารในคลัง <span class="h-right">${this.libAdmin.length} รายการ • ${N} เจ้าหน้าที่</span></h3>
      <div class="tbl-wrap"><table class="tbl">
        <tr><th></th><th>ชื่อ / หมวด</th><th class="num">เปิดดู</th><th class="num">รับทราบ</th><th></th></tr>
        ${this.libAdmin.map(it => {
          const cat = LIB_CAT[it.category] || { icon: '📄', label: it.category };
          const thumb = it.file_id
            ? `<img class="lib-thumb-sm" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(it.file_id)}&sz=w200"
                 onerror="this.parentNode.innerHTML='<span style=&quot;font-size:22px&quot;>${cat.icon}</span>'">`
            : `<span style="font-size:22px">${cat.icon}</span>`;
          return `<tr class="${+it.is_active ? '' : 'lib-hidden'}">
            <td>${thumb}</td>
            <td><b>${esc(it.title)}</b>${+it.is_active ? '' : ' <span class="chip chip-plain">ซ่อนอยู่</span>'}
              <div class="tiny">${cat.icon} ${cat.label}${it.description ? ' — ' + esc(it.description) : ''}</div></td>
            <td class="num">${it.views}/${N}</td>
            <td class="num"><b style="color:${N && +it.acks >= N ? C_OK : 'inherit'}">${it.acks}/${N}</b></td>
            <td style="white-space:nowrap;text-align:right">
              <button class="link-btn" onclick="Admin.libEdit(${it.id})">แก้</button>
              ${+it.is_active
                ? `<button class="link-btn" style="color:var(--absent)" onclick="Admin.libHide(${it.id},0)">ซ่อน</button>`
                : `<button class="link-btn" onclick="Admin.libHide(${it.id},1)">แสดง</button>`}
            </td></tr>`;
        }).join('')}
      </table></div></div>`;
  },

  libResetForm() {
    byId('lfId').value = ''; byId('lfTitle').value = ''; byId('lfUrl').value = ''; byId('lfDesc').value = '';
    byId('lfCat').value = 'doc';
    byId('lfHead').textContent = '➕ เพิ่มเอกสารเข้าคลัง';
    byId('lfCancel').style.display = 'none';
    this.libPreview();
  },

  libEdit(id) {
    const it = this.libAdmin.find(x => x.id == id);
    if (!it) return;
    byId('lfId').value = it.id; byId('lfTitle').value = it.title; byId('lfUrl').value = it.url;
    byId('lfDesc').value = it.description || ''; byId('lfCat').value = it.category;
    byId('lfHead').textContent = '✏️ แก้ไขเอกสาร';
    byId('lfCancel').style.display = '';
    this.libPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async libSave() {
    const body = {
      id: +byId('lfId').value || 0,
      title: byId('lfTitle').value.trim(),
      category: byId('lfCat').value,
      url: byId('lfUrl').value.trim(),
      description: byId('lfDesc').value.trim(),
    };
    if (!body.title) return toast('กรอกชื่อเอกสารก่อนค่ะ', 'error');
    if (!/^https?:\/\//i.test(body.url)) return toast('ลิงก์ต้องขึ้นต้น http:// หรือ https://', 'error');
    const d = await App.api('library_save', body);
    toast(d.message);
    this.vDevelop();
  },

  async libHide(id, active) {
    if (!active) {
      const c = await Swal.fire({ icon: 'warning', title: 'ซ่อนเอกสารนี้?', text: 'เจ้าหน้าที่จะไม่เห็น แต่สถิติการอ่านยังเก็บไว้', showCancelButton: true, confirmButtonText: 'ซ่อน', cancelButtonText: 'ยกเลิก' });
      if (!c.isConfirmed) return;
    }
    const d = await App.api('library_delete', { id, active });
    toast(d.message);
    this.vDevelop();
  },

  // =====================================================
  // แบบทดสอบ (โซนพัฒนาตัวเอง เฟส 2)
  // =====================================================
  quizAdmin: null,
  quizForm: null,

  async vDevelopQuiz() {
    byId('view').innerHTML = `
      ${this.devSegHtml()}
      <div class="card"><h3 id="qfHead">➕ สร้างชุดคำถามใหม่</h3>
        <input type="hidden" id="qfId" value="">
        <div class="field"><label>ชื่อชุดคำถาม</label><input class="input" id="qfTitle" maxlength="200"></div>
        <div class="field"><label>คำอธิบายสั้นๆ (ถ้ามี)</label><input class="input" id="qfDesc" maxlength="500"></div>
        <div id="qfRows"></div>
        <button class="btn btn-ghost btn-sm" onclick="Admin.quizAddQuestion()">+ เพิ่มคำถาม</button>
        <div class="row" style="gap:8px;margin-top:14px">
          <button class="btn btn-primary" onclick="Admin.quizSave()">บันทึก</button>
          <button class="btn btn-ghost btn-sm" id="qfCancel" style="display:none" onclick="Admin.quizResetForm()">ยกเลิกแก้ไข</button>
        </div>
      </div>
      <div id="quizList"><div class="card muted">กำลังโหลด...</div></div>`;
    this.quizResetForm();
    const d = await App.api('quiz_admin_list');
    this.quizAdmin = d.sets;
    this.renderQuizList();
  },

  quizResetForm() {
    this.quizForm = { id: 0, questions: [{ question: '', choices: ['', '', '', ''], correct: 0 }] };
    byId('qfId').value = ''; byId('qfTitle').value = ''; byId('qfDesc').value = '';
    byId('qfHead').textContent = '➕ สร้างชุดคำถามใหม่';
    byId('qfCancel').style.display = 'none';
    this.renderQuizForm();
  },

  renderQuizForm() {
    const L = ['ก', 'ข', 'ค', 'ง'];
    byId('qfRows').innerHTML = this.quizForm.questions.map((q, i) => `
      <div class="quiz-row">
        <div class="row" style="justify-content:space-between;align-items:center">
          <label class="tiny">คำถามข้อ ${i + 1}</label>
          ${this.quizForm.questions.length > 1 ? `<button class="link-btn" style="color:var(--absent)" onclick="Admin.quizRemoveQuestion(${i})">ลบข้อนี้</button>` : ''}
        </div>
        <input class="input" id="qQ${i}" value="${esc(q.question)}" placeholder="พิมพ์คำถาม...">
        <div class="tiny" style="margin:6px 0 2px">แตะวงกลมหน้าตัวเลือกที่ถูกต้อง</div>
        <div class="grid-2">
          ${[0, 1, 2, 3].map(j => `
            <div class="field" style="margin-bottom:6px">
              <label class="quiz-choice-label"><input type="radio" name="qCorrect${i}" value="${j}" ${q.correct === j ? 'checked' : ''}> ตัวเลือก ${L[j]}</label>
              <input class="input" id="qC${i}_${j}" value="${esc(q.choices[j])}" placeholder="ตัวเลือกที่ ${L[j]}">
            </div>`).join('')}
        </div>
      </div>`).join('');
  },

  quizSyncFromDom() {
    if (!this.quizForm) return;
    this.quizForm.questions.forEach((q, i) => {
      q.question = byId(`qQ${i}`)?.value ?? q.question;
      q.choices = [0, 1, 2, 3].map(j => byId(`qC${i}_${j}`)?.value ?? q.choices[j]);
      const checked = document.querySelector(`input[name="qCorrect${i}"]:checked`);
      if (checked) q.correct = +checked.value;
    });
  },

  quizAddQuestion() {
    this.quizSyncFromDom();
    this.quizForm.questions.push({ question: '', choices: ['', '', '', ''], correct: 0 });
    this.renderQuizForm();
  },

  quizRemoveQuestion(i) {
    this.quizSyncFromDom();
    this.quizForm.questions.splice(i, 1);
    this.renderQuizForm();
  },

  async quizEdit(id) {
    const d = await App.api('quiz_set_get', { id });
    this.quizForm = { id: d.set.id, questions: d.questions };
    byId('qfId').value = d.set.id; byId('qfTitle').value = d.set.title; byId('qfDesc').value = d.set.description || '';
    byId('qfHead').textContent = '✏️ แก้ไขชุดคำถาม';
    byId('qfCancel').style.display = '';
    this.renderQuizForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async quizSave() {
    this.quizSyncFromDom();
    const body = {
      id: +byId('qfId').value || 0,
      title: byId('qfTitle').value.trim(),
      description: byId('qfDesc').value.trim(),
      questions: this.quizForm.questions,
    };
    if (!body.title) return toast('กรอกชื่อชุดคำถามก่อนค่ะ', 'error');
    for (const q of body.questions) {
      if (!q.question.trim()) return toast('กรอกคำถามให้ครบทุกข้อ', 'error');
      if (q.choices.some(c => !c.trim())) return toast('กรอกตัวเลือกให้ครบ 4 ข้อในทุกคำถาม', 'error');
    }
    const d = await App.api('quiz_save', body);
    toast(d.message);
    this.vDevelopQuiz();
  },

  renderQuizList() {
    if (!this.quizAdmin.length) {
      byId('quizList').innerHTML = '<div class="card empty"><span class="e-ico">📝</span>ยังไม่มีชุดคำถาม เพิ่มอันแรกด้านบนได้เลย</div>';
      return;
    }
    byId('quizList').innerHTML = `<div class="card"><h3>📝 ชุดคำถาม <span class="h-right">${this.quizAdmin.length} ชุด</span></h3>
      <div class="tbl-wrap"><table class="tbl">
        <tr><th>ชื่อชุด</th><th class="num">คำถาม</th><th class="num">คนทำแล้ว</th><th></th></tr>
        ${this.quizAdmin.map(s => `<tr class="${+s.is_active ? '' : 'lib-hidden'}">
          <td><b>${esc(s.title)}</b>${+s.is_active ? '' : ' <span class="chip chip-plain">ซ่อนอยู่</span>'}
            ${s.description ? `<div class="tiny">${esc(s.description)}</div>` : ''}</td>
          <td class="num">${s.question_count}</td>
          <td class="num">${s.participants}</td>
          <td style="white-space:nowrap;text-align:right">
            <button class="link-btn" onclick="Admin.quizScores(${s.id})">คะแนน</button>
            <button class="link-btn" onclick="Admin.quizEdit(${s.id})">แก้</button>
            ${+s.is_active
              ? `<button class="link-btn" style="color:var(--absent)" onclick="Admin.quizHide(${s.id},0)">ซ่อน</button>`
              : `<button class="link-btn" onclick="Admin.quizHide(${s.id},1)">แสดง</button>`}
          </td></tr>`).join('')}
      </table></div></div>`;
  },

  async quizHide(id, active) {
    if (!active) {
      const c = await Swal.fire({ icon: 'warning', title: 'ซ่อนชุดคำถามนี้?', text: 'เจ้าหน้าที่จะไม่เห็น แต่คะแนนเก่ายังเก็บไว้', showCancelButton: true, confirmButtonText: 'ซ่อน', cancelButtonText: 'ยกเลิก' });
      if (!c.isConfirmed) return;
    }
    const d = await App.api('quiz_delete', { id, active });
    toast(d.message);
    this.vDevelopQuiz();
  },

  async quizScores(id) {
    const d = await App.api('quiz_admin_scores', { id });
    const rowStyle = 'border-bottom:1px solid #eee;padding:7px 4px';
    const rows = d.rows.length ? d.rows.map(r => `<tr>
      <td style="${rowStyle};text-align:left">${esc(r.name)}</td>
      <td style="${rowStyle};text-align:right">${r.attempts > 0 ? r.best_score + '/' + d.total : '—'}</td>
      <td style="${rowStyle};text-align:right">${r.attempts}</td></tr>`).join('')
      : `<tr><td colspan="3" style="padding:14px;color:#888">ยังไม่มีเจ้าหน้าที่</td></tr>`;
    Swal.fire({
      title: d.title,
      html: `<table style="width:100%;font-size:13.5px;border-collapse:collapse">
        <tr><th style="${rowStyle};text-align:left">ชื่อ</th><th style="${rowStyle};text-align:right">คะแนนสูงสุด</th><th style="${rowStyle};text-align:right">จำนวนครั้ง</th></tr>
        ${rows}</table>`,
      width: 420,
      confirmButtonText: 'ปิด',
    });
  },

  // =====================================================
  // ประวัติการฝึกอบรม (v35) — 3 sub-view: รายการอบรม | รายคน | ภาพรวม
  // =====================================================
  trView: 'list',     // list | person | overview
  trUid: null,        // เจ้าหน้าที่ที่เลือกในหน้ารายคน
  trList: null,       // รายการอบรมทั้งหมด (ปุ่ม "แก้" หยิบค่าจากตรงนี้ ไม่ยัดลง onclick)
  trPickId: null,     // การอบรมที่กำลังเปิดแผงจัดคน
  trPerson: null,     // ผลของ training_person ที่โหลดล่าสุด (หน้าปริ้นใช้ต่อ ไม่ยิงซ้ำ)

  vTraining() {
    const sub = (v, l) => `<button class="${this.trView === v ? 'active' : ''}" onclick="Admin.trGo('${v}')">${l}</button>`;
    const bar = `<div class="seg" style="margin-top:-4px">${sub('list', '📅 รายการอบรม')}${sub('person', '🧍 รายคน')}${sub('overview', '👥 ภาพรวม')}</div>`;
    byId('view').innerHTML = this.devSegHtml() + bar + '<div id="trBox"><div class="card muted">กำลังโหลด...</div></div>';
    if (this.trView === 'person')   return this.trLoadPerson();
    if (this.trView === 'overview') return this.trLoadOverview();
    return this.trLoadList();
  },

  trGo(v) { this.trView = v; this.vTraining(); },
  trOpen(uid) { this.trUid = String(uid); this.trView = 'person'; this.vTraining(); },

  // ---------- รายการอบรม ----------
  async trLoadList() {
    const d = await App.api('training_list');
    this.trList = d.items;
    const rows = d.items.length ? d.items.map(it => `<div class="list-row">
        <div class="lr-main">
          <div class="lr-title">${esc(it.name)}</div>
          <div class="lr-sub">📅 ${esc(it.date_label)} · 👥 ${it.n_people} คน</div>
          ${it.place || it.organizer ? `<div class="tr-meta">${[it.place ? '📍 ' + esc(it.place) : '', it.organizer ? '🏛️ ' + esc(it.organizer) : ''].filter(Boolean).join(' · ')}</div>` : ''}
        </div>
        <div class="tr-btns">
          <button class="btn btn-ghost btn-sm" onclick="Admin.trPick(${it.id})">👥 จัดคน</button>
          <button class="btn btn-ghost btn-sm" onclick="Admin.trEdit(${it.id})">แก้</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="Admin.trDel(${it.id})">ลบ</button>
        </div>
      </div>${this.trPickId === it.id ? '<div id="trPeopleBox" class="tr-people"><div class="muted">กำลังโหลด...</div></div>' : ''}`).join('')
      : '<div style="color:var(--muted);padding:6px 0">ยังไม่มีการอบรมที่บันทึกไว้</div>';

    byId('trBox').innerHTML = `
      <div class="card"><h3 id="trFormHead">➕ เพิ่มการอบรม</h3>
        <input type="hidden" id="trId" value="">
        <div class="field"><label>ชื่อการฝึกอบรม</label><input class="input" id="trName" maxlength="200" placeholder="เช่น อบรมทบทวนการดับไฟป่า ประจำปี"></div>
        <div class="grid-2">
          <div class="field"><label>วันเริ่ม</label><input type="date" class="input" id="trStart" value="${todayStr()}"></div>
          <div class="field"><label>วันสิ้นสุด</label><input type="date" class="input" id="trEnd" value="${todayStr()}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>สถานที่</label><input class="input" id="trPlace" maxlength="200"></div>
          <div class="field"><label>หน่วยงานที่จัด</label><input class="input" id="trOrg" maxlength="200"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>เลขที่หนังสือสั่งการ</label><input class="input" id="trDoc" maxlength="120" placeholder="เช่น ทส 0910.404/ว123"></div>
          <div class="field"><label>หมายเหตุ</label><input class="input" id="trNote" maxlength="500"></div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-primary" onclick="Admin.trSave()">บันทึก</button>
          <button class="btn btn-ghost btn-sm" id="trCancel" style="display:none" onclick="Admin.trResetForm()">ยกเลิกแก้ไข</button>
        </div>
        <div class="tiny" style="margin-top:8px">💡 กรอกวันย้อนหลังได้ — ใช้บันทึกการอบรมที่ผ่านมาแล้ว</div>
      </div>
      <div class="card"><h3>📅 การอบรมทั้งหมด <span class="h-right">${d.items.length} รายการ</span></h3>${rows}</div>`;
    if (this.trPickId) this.trLoadPeople();
  },

  trResetForm() {
    ['trName', 'trPlace', 'trOrg', 'trDoc', 'trNote'].forEach(k => { const el = byId(k); if (el) el.value = ''; });
    byId('trId').value = '';
    byId('trStart').value = todayStr();
    byId('trEnd').value = todayStr();
    byId('trFormHead').textContent = '➕ เพิ่มการอบรม';
    byId('trCancel').style.display = 'none';
  },

  trEdit(id) {
    const it = (this.trList || []).find(x => x.id == id);   // หยิบจาก state — ห้ามยัดค่าลง onclick
    if (!it) return;
    byId('trId').value = it.id;
    byId('trName').value = it.name;
    byId('trStart').value = it.start_date;
    byId('trEnd').value = it.end_date;
    byId('trPlace').value = it.place;
    byId('trOrg').value = it.organizer;
    byId('trDoc').value = it.doc_no;
    byId('trNote').value = it.note;
    byId('trFormHead').textContent = '✏️ แก้ไขการอบรม';
    byId('trCancel').style.display = '';
    byId('trName').scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  async trSave() {
    const d = await App.api('training_save', {
      id: +byId('trId').value || 0,
      name: byId('trName').value.trim(),
      start_date: byId('trStart').value,
      end_date: byId('trEnd').value,
      place: byId('trPlace').value.trim(),
      organizer: byId('trOrg').value.trim(),
      doc_no: byId('trDoc').value.trim(),
      note: byId('trNote').value.trim(),
    });
    toast(d.message);
    this.trResetForm();
    this.trLoadList();
  },

  async trDel(id) {
    const it = (this.trList || []).find(x => x.id == id);
    const n = it ? +it.n_people : 0;
    const c = await Swal.fire({
      icon: 'warning', title: 'ลบการอบรมนี้?',
      text: n ? `มีเจ้าหน้าที่ผูกอยู่ ${n} คน ประวัติของทุกคนจะหายไปด้วย (กู้คืนไม่ได้)` : 'ลบแล้วกู้คืนไม่ได้',
      showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ไม่',
    });
    if (!c.isConfirmed) return;
    const d = await App.api('training_del', { id });
    toast(d.message);
    if (this.trPickId === id) this.trPickId = null;
    this.trLoadList();
  },

  // ---------- จัดคนเข้าอบรม ----------
  trPick(id) {
    this.trPickId = this.trPickId === id ? null : id;
    this.trLoadList();
  },

  async trLoadPeople() {
    const box = byId('trPeopleBox');
    if (!box || !this.trPickId) return;
    const [t, u] = await Promise.all([App.api('training_get', { id: this.trPickId }), App.api('users_list')]);
    const staff = u.users.filter(x => x.role === 'staff' && x.status === 'active');
    const chips = staff.length
      ? staff.map(x => `<label class="osu-chk"><input type="checkbox" value="${x.id}" ${t.user_ids.includes(+x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')
      : '<span style="color:var(--muted)">ยังไม่มีเจ้าหน้าที่</span>';
    box.innerHTML = `<div class="tr-people-head">👥 ผู้เข้าอบรม — ${esc(t.training.name)}</div>
      <div class="osu-people">${chips}</div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="Admin.trPeopleSave()">💾 บันทึกผู้เข้าอบรม</button>
      <div class="tiny" style="margin-top:6px">💡 ระบบแจ้งเข้ากล่องข้อความ 📬 เฉพาะคนที่เพิ่มใหม่ — คนเดิมกดบันทึกซ้ำไม่โดนแจ้งซ้ำ</div>`;
  },

  async trPeopleSave() {
    const ids = [...document.querySelectorAll('#trPeopleBox input:checked')].map(c => +c.value);
    const d = await App.api('training_attendees_save', { training_id: this.trPickId, user_ids: ids });
    toast(d.message);
    this.trLoadList();
  },

  // ---------- รายคน ----------
  async trLoadPerson() {
    const dl = await App.api('users_list');
    const staff = dl.users.filter(u => u.role === 'staff' && u.status !== 'pending');
    const opts = staff.map(u => `<option value="${u.id}"${u.id == this.trUid ? ' selected' : ''}>${esc(u.name)}${u.position ? ' — ' + esc(u.position) : ''}</option>`).join('');
    byId('trBox').innerHTML = `<div class="card"><h3>🧍 ประวัติการอบรมรายคน</h3>
      <div class="field"><label>เลือกเจ้าหน้าที่</label>
        <select class="select" id="trUser" onchange="Admin.trPickUser(this.value)">
          <option value="">— เลือก —</option>${opts}</select></div>
    </div><div id="trDetail"></div>`;
    if (this.trUid) this.trLoadDetail();
  },

  trPickUser(uid) { this.trUid = uid || null; this.trLoadDetail(); },

  async trLoadDetail() {
    if (!this.trUid) { byId('trDetail').innerHTML = ''; return; }
    byId('trDetail').innerHTML = '<div class="card muted">กำลังโหลด...</div>';
    const d = await App.api('training_person', { user_id: +this.trUid });
    this.trPerson = d;

    if (!d.items.length) {
      byId('trDetail').innerHTML = `<div class="card empty"><span class="e-ico">🎓</span>${esc(d.user.name)} ยังไม่มีประวัติการฝึกอบรม</div>`;
      return;
    }
    const rows = d.items.map(it => {
      const meta = [it.place ? '📍 ' + esc(it.place) : '', it.organizer ? '🏛️ ' + esc(it.organizer) : '',
                    it.doc_no ? 'หนังสือที่ ' + esc(it.doc_no) : '', it.note ? '📝 ' + esc(it.note) : ''].filter(Boolean).join(' · ');
      return `<div class="list-row"><div class="lr-main">
        <div class="lr-title">${esc(it.name)}</div>
        <div class="lr-sub">📅 ${esc(it.date_label)}</div>
        ${meta ? `<div class="tr-meta">${meta}</div>` : ''}</div></div>`;
    }).join('');
    byId('trDetail').innerHTML = `<div class="card">
      <h3>${esc(d.user.name)} <span class="h-right">${d.count} หลักสูตร</span></h3>
      ${d.user.position ? `<div class="tr-meta" style="margin-bottom:6px">${esc(d.user.position)}</div>` : ''}
      ${rows}
      <button class="btn btn-block" style="margin-top:12px" onclick="Admin.trPrintOpen()">🖨️ ปริ้นประวัติ (A4)</button>
    </div>`;
  },

  // ---------- ภาพรวม ----------
  async trLoadOverview() {
    const d = await App.api('training_overview');
    // คนที่ยังไม่เคยอบรมขึ้นก่อน แล้วเรียงจำนวนน้อย→มาก (หัวหน้าไม่ต้องไถหาคนตกหล่น)
    const people = d.people.slice().sort((a, b) => a.n - b.n || a.name.localeCompare(b.name, 'th'));
    const rows = people.map(p => `<button class="list-row tr-row" onclick="Admin.trOpen(${p.id})">
        <div class="lr-main">
          <div class="lr-title">${esc(p.name)}</div>
          <div class="lr-sub">${p.n ? 'ล่าสุด ' + esc(p.last_label) : '— ยังไม่เคยเข้าอบรม'}</div>
        </div>
        <span class="night-count">${p.n} หลักสูตร</span>
      </button>`).join('');
    byId('trBox').innerHTML = `
      <div class="card"><h3>👥 ภาพรวมการฝึกอบรม</h3>
        <div class="ov-stats">
          <div class="ov-stat ov-g"><b>${d.summary.trained}</b><span>เคยอบรม</span></div>
          <div class="ov-stat ov-r"><b>${d.summary.never}</b><span>ยังไม่เคยเลย</span></div>
          <div class="ov-stat"><b>${d.summary.trainings}</b><span>การอบรมทั้งหมด</span></div>
        </div>
      </div>
      <div class="card"><h3>รายคน <span class="h-right">${people.length} คน</span></h3>${rows || '<div style="color:var(--muted)">ยังไม่มีเจ้าหน้าที่</div>'}</div>`;
  },

  // ---------- ปริ้นประวัติรายคน (A4) ----------
  // ⚠️ ต้องใช้ id "reportOverlay" ตัวเดิม — @media print ใน app.css ผูกกับ id นี้ (ซ่อนทุกอย่างที่ไม่ใช่)
  //    reuse reportPrint()/reportClose() ของรายงานรายเดือน (v29) ได้เลย ไม่ต้องแก้ CSS
  trPrintOpen() {
    const d = this.trPerson;
    if (!d) return;
    const ov = document.createElement('div');
    ov.id = 'reportOverlay';
    ov.className = 'rpt-overlay';
    ov.innerHTML = `
      <div class="rpt-bar">
        <button class="btn btn-primary" onclick="Admin.reportPrint()">🖨️ ปริ้น</button>
        <button class="btn rpt-close" onclick="Admin.reportClose()">✕ ปิด</button>
      </div>
      <div class="rpt-scroll"><div id="rptPaper" class="rpt-paper">${this.trPaperHtml(d)}</div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add('rpt-open');
  },

  trPaperHtml(d) {
    const rows = d.items.map((it, i) => `<tr>
      <td class="rp-rank">${i + 1}</td>
      <td class="l">${esc(it.name)}${it.note ? `<div class="rp-pos">${esc(it.note)}</div>` : ''}</td>
      <td>${esc(it.date_label)}</td>
      <td class="l">${esc(it.organizer || '-')}</td>
      <td class="l">${esc(it.place || '-')}</td>
      <td>${esc(it.doc_no || '-')}</td></tr>`).join('');
    return `<div class="rp-head">
        <span class="rp-fire">🎓</span>
        <div>
          <div class="rp-station">${esc(d.station_name)}</div>
          <div class="rp-title">ประวัติการฝึกอบรม</div>
          <div class="rp-month">${esc(d.user.name)}${d.user.position ? ' · ' + esc(d.user.position) : ''}</div>
        </div>
      </div>
      <div style="padding:16px 22px 4px">
        <table class="rp-tbl">
          <thead><tr><th>ลำดับ</th><th class="l">หลักสูตร</th><th>วันที่</th><th class="l">หน่วยงานที่จัด</th><th class="l">สถานที่</th><th>เลขที่หนังสือ</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:12px;font-size:14px">รวมทั้งสิ้น <b>${d.count}</b> หลักสูตร</div>
      </div>
      <div class="rp-foot">ออกรายงานเมื่อ ${esc(d.generated_at)} น. · ระบบเช็คชื่อ FireCheck</div>`;
  },

  // =====================================================
  // ตั้งค่า
  // =====================================================
  async vSettings() {
    const s = (await App.api('settings_get')).settings;
    const T = (k, label, sub) => `<div class="setting-row">
      <div class="sr-main"><div class="sr-title">${label}</div>${sub ? `<div class="sr-sub">${sub}</div>` : ''}</div>
      <label class="switch"><input type="checkbox" id="st_${k}" ${s[k] === '1' ? 'checked' : ''}><span class="sl"></span></label></div>`;
    const I = (k, label, type = 'text', extra = '') => `<div class="field"><label>${label}</label>
      <input class="input" id="st_${k}" type="${type}" value="${esc(s[k])}" ${extra}></div>`;

    byId('view').innerHTML = `
      ${this.announceHtml()}
      <div class="card"><h3>🎚️ สวิตช์ฟีเจอร์</h3>
        ${T('selfie_required', '🤳 บังคับเซลฟี่ตอนเช็คอิน', 'โค้ดพร้อมแล้ว เปิดเมื่อไหร่ก็ได้')}
        ${T('checkout_enabled', '📝 เช็คเอาท์ + รายงานผลงานเย็น', 'เปิดแล้วคะแนนความขยันเปลี่ยนเป็นสูตรเต็ม 30/30/20/20')}
        ${T('gps_enforce', '📍 บังคับ GPS ในรัศมีสถานี', 'ปิดชั่วคราวได้ตอนทดสอบระบบ')}
        ${T('sunday_off', '🌴 วันอาทิตย์เป็นวันหยุดสถานี', 'ไม่ต้องเช็คชื่อ ไม่นับขาด')}
        ${T('sunday_work_enabled', '📅 เปิดเช็คชื่อวันอาทิตย์', 'ให้คนมาทำงาน/เข้าเวรวันหยุด กดเช็คชื่อได้ (ไม่นับสาย)')}
        ${T('night_shift_enabled', '🌙 เวรกลางคืน (เฝ้าสำนักงาน)', 'เฉพาะ จนท.ชาย — ยกเว้นสายเช้าถัดมาให้อัตโนมัติ')}
        ${T('face_verify_enabled', '🙂 ยืนยันใบหน้าตอนเช็คชื่อ', 'สแกนหน้าสดแทนการเก็บรูป — ไม่ผ่าน 3 ครั้งยังเช็คชื่อได้ แต่ติดหมายเหตุให้หัวหน้าเห็น (ต้องลงทะเบียนใบหน้าที่แท็บเจ้าหน้าที่ก่อน)')}
      </div>
      <div class="card"><h3>🙂 เกณฑ์ยืนยันใบหน้า</h3>
        <div class="tiny" style="margin-bottom:10px">ค่าตั้งต้นวัดมาจากรูปเช็คชื่อจริง 460 ใบของสถานี (รับคนอื่นผิด 0.30% · ปฏิเสธเจ้าตัว 3.8%)
          — <b>ยิ่งน้อยยิ่งเข้ม</b> ถ้าเจ้าหน้าที่บ่นว่าไม่ผ่านบ่อย ค่อยๆ เพิ่มทีละ 0.02</div>
        <div class="grid-2">
          ${I('face_match_threshold', 'เกณฑ์ระยะ (0.20-0.90)', 'number', 'step=0.01 min=0.2 max=0.9')}
          ${I('face_max_attempts', 'ลองได้กี่ครั้ง (1-5)', 'number', 'step=1 min=1 max=5')}
        </div>
        <div class="field">${I('face_min_desc', 'ต้องมีใบหน้าอย่างน้อยกี่รูปถึงใช้งาน (1-10)', 'number', 'step=1 min=1 max=10')}</div>
      </div>
      <div class="card"><h3>⏰ เวลา</h3>
        <div class="grid-2">
          ${I('checkin_open', 'เปิดเช็คอิน (น.)', 'time')}${I('late_cutoff', 'หลังเวลานี้ = สาย', 'time')}
          ${I('checkout_open', 'เปิดส่งรายงาน', 'time')}${I('report_cutoff', 'หลังเวลานี้ = รายงานช้า', 'time')}
          ${I('night_checkin_open', 'เปิดลงเวรกลางคืน', 'time')}
        </div>
      </div>
      <div class="card"><h3>📍 พิกัดสถานี</h3>
        <div class="grid-2">${I('gps_lat', 'ละติจูด')}${I('gps_lng', 'ลองจิจูด')}</div>
        <div class="field">${I('gps_radius_m', 'รัศมี (เมตร)', 'number')}</div>
        <button class="btn btn-ghost btn-sm" onclick="Admin.useHere()">📌 ใช้ตำแหน่งปัจจุบันของฉัน</button>
      </div>
      <div class="card"><h3>🎌 วันหยุดนักขัตฤกษ์</h3>
        <div class="tiny" style="margin-bottom:10px">วันหยุดราชการ — ระบบถือเป็นวันหยุดสถานี (ไม่นับขาด ไม่ต้องเช็คชื่อ) และรวมเป็น<b>โควต้าวันหยุดของเดือนนั้นให้อัตโนมัติ</b> (โควต้า = วันอาทิตย์ + นักขัตฯในเดือน)</div>
        <div id="holidayList" class="tiny">กำลังโหลด...</div>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label>วันที่</label><input type="date" class="input" id="hoDate" value="${todayStr()}"></div>
          <div class="field"><label>ชื่อวันหยุด</label><input class="input" id="hoName" maxlength="255" placeholder="เช่น วันปิยมหาราช"></div>
        </div>
        <button class="btn btn-primary btn-block" onclick="Admin.holidayAdd()">➕ เพิ่มวันหยุด</button>
      </div>
      <div class="card"><h3>📍 วันเช็คชื่อนอกสถานที่</h3>
        <div class="tiny" style="margin-bottom:10px">วันที่สั่ง จนท. ไปกิจกรรมนอกสถานี — วันนั้นทุกคนเช็คชื่อจากที่ไหนก็ได้ (ข้าม GPS) เช็คในช่วงเวลาที่ตั้ง = ไม่นับสาย</div>
        <div id="offsiteList" class="tiny">กำลังโหลด...</div>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label>วันที่</label><input type="date" class="input" id="osDate" value="${todayStr()}"></div>
          <div class="field"><label>เหตุผล/กิจกรรม</label><input class="input" id="osReason" maxlength="255" placeholder="เช่น อบรมดับไฟป่า อ.เมือง"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>เปิดเช็ค (น.)</label><input type="time" class="input" id="osStart" value="07:00"></div>
          <div class="field"><label>ปิด — ไม่นับสาย (น.)</label><input type="time" class="input" id="osEnd" value="09:00"></div>
        </div>
        <button class="btn btn-primary btn-block" onclick="Admin.offsiteAdd()">➕ เพิ่มวันนอกสถานที่</button>
      </div>
      <div class="card"><h3>🧍 อนุญาตเช็คนอกสถานที่ (รายคน)</h3>
        <div class="tiny" style="margin-bottom:10px">เจาะรายคน เช่น ได้รับคำสั่งไปประชุม — คนที่เลือกเช็คจากที่ไหนก็ได้ (ข้าม GPS) ในช่วงวันที่กำหนด · เวลาเปิด+คิดสาย = ปกติ · ระบบแจ้งเข้ากล่องข้อความให้เจ้าตัว</div>
        <div id="osuList" class="tiny">กำลังโหลด...</div>
        <div class="field" style="margin-top:12px"><label>เลือกเจ้าหน้าที่ (ได้หลายคน)</label>
          <div id="osuPeople" class="osu-people">กำลังโหลด...</div></div>
        <div class="grid-2">
          <div class="field"><label>ตั้งแต่วันที่</label><input type="date" class="input" id="osuStart" value="${todayStr()}"></div>
          <div class="field"><label>ถึงวันที่</label><input type="date" class="input" id="osuEnd" value="${todayStr()}"></div>
        </div>
        <div class="field"><label>เหตุผล/กิจกรรม</label><input class="input" id="osuReason" maxlength="255" placeholder="เช่น ประชุมที่ว่าการอำเภอ"></div>
        <label class="osu-nolate"><input type="checkbox" id="osuNoLate" checked> ✅ วันไปราชการ <b>ไม่นับสาย</b> (มาเมื่อไหร่ก็ถือว่าตรงเวลา — เหมาะกับคนไปประชุมตั้งแต่เช้า)</label>
        <button class="btn btn-primary btn-block" onclick="Admin.offsiteUserAdd()">➕ อนุญาต + แจ้งเจ้าหน้าที่</button>
      </div>
      <div class="card"><h3>🏷️ ทั่วไป</h3>${I('station_name', 'ชื่อสถานี')}
        <div class="setting-row" style="border:none;padding-top:4px">
          <div class="sr-main"><div class="sr-title">🔑 เปลี่ยนรหัสผ่านแอดมิน</div>
          <div class="sr-sub">ควรเปลี่ยนทันทีหลัง deploy ครั้งแรก</div></div>
          <button class="btn btn-ghost btn-sm" onclick="App.changePass()">เปลี่ยน</button></div>
      </div>
      <div class="card"><h3>💬 LINE Bot</h3>
        ${I('line_token', 'Channel Access Token')}${I('line_group_id', 'Group ID')}
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="Admin.testLine('morning')">ทดสอบสรุปเช้า</button>
          <button class="btn btn-ghost btn-sm" onclick="Admin.testLine('evening')">ทดสอบสรุปเย็น</button>
        </div>
        <div class="tiny" style="margin-top:8px">สรุปอัตโนมัติ: ตั้ง cron เรียก <code>php cron/report.php morning</code> (08:30) และ <code>evening</code> (17:30) — ดูวิธีใน README</div>
      </div>
      <div class="card"><h3>🖼️ สำเนารูปเช็คชื่อขึ้น Google Drive</h3>
        ${I('gdrive_client_id', 'Client ID')}${I('gdrive_client_secret', 'Client Secret', 'password')}
        <div id="gdriveStatus" class="tiny">กำลังตรวจสถานะ...</div>
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="Admin.gdriveConnect()">🔗 เชื่อมต่อ Google Drive</button>
          <button class="btn btn-ghost btn-sm" onclick="Admin.gdriveTest()">ทดสอบ + ส่งรูปค้าง</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="Admin.gdriveDisconnect()">ยกเลิกการเชื่อมต่อ</button>
        </div>
        <div class="tiny" style="margin-top:8px">รูปเซลฟี่เช็คอินจะถูกสำเนาขึ้น Drive อัตโนมัติ แยกโฟลเดอร์รายวัน (ปี พ.ศ.) — เช็คอินไม่ต้องรอ Drive ถ้าส่งพลาดระบบ retry ให้เอง</div>
      </div>
      <button class="btn btn-primary btn-block" onclick="Admin.saveSettings()" style="margin-bottom:20px">💾 บันทึกการตั้งค่าทั้งหมด</button>`;
    this.gdriveRefreshStatus();
    this.holidayRefresh();
    this.offsiteRefresh();
    this.offsiteUserRefresh();
  },

  // วันหยุดนักขัตฤกษ์ — โหลด/แสดง list (handler แยกจาก settings_save)
  async holidayRefresh() {
    const el = byId('holidayList');
    if (!el) return;
    const d = await App.api('holiday_list');
    el.innerHTML = d.items.length ? d.items.map(o => `
      <div class="list-row">
        <div class="lr-main"><div class="lr-title">${thaiDate(o.holiday_date)}</div>
          <div class="lr-sub">${esc(o.name)}</div></div>
        <button class="link-btn" style="color:var(--absent);font-size:13px" onclick="Admin.holidayDel(${o.id})">ลบ</button>
      </div>`).join('') : '<div style="color:var(--muted);padding:6px 0">ยังไม่มีวันหยุดนักขัตฤกษ์ที่ตั้งไว้</div>';
  },

  async holidayAdd() {
    const name = byId('hoName').value.trim();
    if (!name) return toast('กรุณาระบุชื่อวันหยุด');
    const d = await App.api('holiday_add', { holiday_date: byId('hoDate').value, name });
    toast(d.message);
    byId('hoName').value = '';
    this.holidayRefresh();
  },

  async holidayDel(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบวันหยุดนี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    await App.api('holiday_del', { id });
    toast('ลบแล้ว');
    this.holidayRefresh();
  },

  // วันเช็คชื่อนอกสถานที่ — โหลด/แสดง list (handler แยกจาก settings_save)
  async offsiteRefresh() {
    const el = byId('offsiteList');
    if (!el) return;
    const d = await App.api('offsite_list');
    el.innerHTML = d.items.length ? d.items.map(o => `
      <div class="list-row">
        <div class="lr-main"><div class="lr-title">${thaiDate(o.off_date)} <span style="color:var(--muted)">· ${o.start_time}–${o.end_time} น.</span></div>
          ${o.reason ? `<div class="lr-sub">${esc(o.reason)}</div>` : ''}</div>
        <button class="link-btn" style="color:var(--absent);font-size:13px" onclick="Admin.offsiteDel(${o.id})">ลบ</button>
      </div>`).join('') : '<div style="color:var(--muted);padding:6px 0">ยังไม่มีวันนอกสถานที่ที่ตั้งไว้</div>';
  },

  async offsiteAdd() {
    const d = await App.api('offsite_add', {
      off_date: byId('osDate').value, start_time: byId('osStart').value,
      end_time: byId('osEnd').value, reason: byId('osReason').value.trim(),
    });
    toast(d.message);
    byId('osReason').value = '';
    this.offsiteRefresh();
  },

  async offsiteDel(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบวันนอกสถานที่นี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    await App.api('offsite_del', { id });
    toast('ลบแล้ว');
    this.offsiteRefresh();
  },

  // อนุญาตเช็คนอกสถานที่รายคน — เลือกหลายคน + ช่วงวัน (handler แยกจาก settings_save)
  async offsiteUserRefresh() {
    const listEl = byId('osuList'), pplEl = byId('osuPeople');
    if (!listEl || !pplEl) return;
    const [u, d] = await Promise.all([App.api('users_list'), App.api('offsite_user_list')]);
    const staff = u.users.filter(x => x.role === 'staff' && x.status === 'active');
    pplEl.innerHTML = staff.length
      ? staff.map(s => `<label class="osu-chk"><input type="checkbox" value="${s.id}"> ${esc(s.name)}</label>`).join('')
      : '<span style="color:var(--muted)">ยังไม่มีเจ้าหน้าที่</span>';
    listEl.innerHTML = d.items.length
      ? d.items.map(o => `<div class="list-row">
          <div class="lr-main"><div class="lr-title">${thaiDate(o.off_date)} · ${esc(o.name)}${+o.no_late ? ' <span class="osu-tag">ไม่นับสาย</span>' : ''}</div>
            ${o.reason ? `<div class="lr-sub">${esc(o.reason)}</div>` : ''}</div>
          <button class="link-btn" style="color:var(--absent);font-size:13px" onclick="Admin.offsiteUserDel(${o.id})">ลบ</button>
        </div>`).join('')
      : '<div style="color:var(--muted);padding:6px 0">ยังไม่มีรายการที่อนุญาตไว้</div>';
  },

  async offsiteUserAdd() {
    const ids = [...document.querySelectorAll('#osuPeople input:checked')].map(c => +c.value);
    if (!ids.length) return toast('เลือกเจ้าหน้าที่อย่างน้อย 1 คน', 'error');
    const d = await App.api('offsite_user_add', {
      user_ids: ids, start_date: byId('osuStart').value, end_date: byId('osuEnd').value,
      reason: byId('osuReason').value.trim(), no_late: byId('osuNoLate').checked ? 1 : 0,
    });
    toast(d.message);
    byId('osuReason').value = '';
    this.offsiteUserRefresh();
  },

  async offsiteUserDel(id) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบรายการนี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    await App.api('offsite_user_del', { id });
    toast('ลบแล้ว');
    this.offsiteUserRefresh();
  },

  async gdriveRefreshStatus() {
    const el = byId('gdriveStatus');
    if (!el) return;
    const d = await App.api('gdrive_status', {}, { soft: true });
    if (!d.ok) { el.textContent = 'ตรวจสถานะไม่สำเร็จ'; return; }
    el.innerHTML = d.connected
      ? `✅ เชื่อมต่อแล้ว${d.root_id ? ` — <a href="https://drive.google.com/drive/folders/${d.root_id}" target="_blank" rel="noopener">เปิดโฟลเดอร์ "${esc(d.root_name)}"</a>` : ''}
         <br>คิวรูป: รอส่ง ${d.pending} • ส่งแล้ว ${d.done} • ล้มเหลว ${d.error}
         ${d.last_error ? `<br>⚠️ ปัญหาล่าสุด: ${esc(d.last_error)}` : ''}`
      : `⛔ ยังไม่ได้เชื่อมต่อ — ตอนสร้าง OAuth client ใน Google Cloud ให้ใส่ Redirect URI:<br><code>${esc(d.redirect_uri)}</code>`;
  },

  async gdriveConnect() {
    await this.saveSettings();   // เซฟ Client ID/Secret ก่อนพาไปหน้าอนุญาต Google
    const d = await App.api('gdrive_auth_url');
    location.href = d.url;
  },

  async gdriveTest() {
    const d = await App.api('gdrive_test');
    Swal.fire({ icon: 'success', title: d.message,
      html: `<a href="${d.root_url}" target="_blank" rel="noopener">เปิดโฟลเดอร์บน Google Drive</a>
        <div class="tiny" style="margin-top:6px">รูปค้างรอส่ง: ${d.pending} รูป</div>`,
      confirmButtonText: 'ปิด' });
    this.gdriveRefreshStatus();
  },

  async gdriveDisconnect() {
    const c = await Swal.fire({ icon: 'warning', title: 'ยกเลิกการเชื่อมต่อ Google Drive?',
      text: 'รูปที่อัปโหลดไปแล้วยังอยู่ใน Drive — รูปใหม่จะไม่ถูกส่งจนกว่าจะเชื่อมต่ออีกครั้ง',
      showCancelButton: true, confirmButtonText: 'ยกเลิกการเชื่อมต่อ', cancelButtonText: 'ไม่' });
    if (!c.isConfirmed) return;
    const d = await App.api('gdrive_disconnect');
    toast(d.message);
    this.gdriveRefreshStatus();
  },

  useHere() {
    getPosition().then(p => {
      byId('st_gps_lat').value = p.lat.toFixed(6);
      byId('st_gps_lng').value = p.lng.toFixed(6);
      toast('ใส่พิกัดปัจจุบันแล้ว อย่าลืมกดบันทึก');
    }).catch(() => toast('หาตำแหน่งไม่ได้', 'error'));
  },

  async saveSettings() {
    const keys = ['selfie_required', 'checkout_enabled', 'gps_enforce', 'sunday_off',
      'sunday_work_enabled', 'night_shift_enabled', 'night_checkin_open',
      'checkin_open', 'late_cutoff', 'checkout_open', 'report_cutoff',
      'gps_lat', 'gps_lng', 'gps_radius_m', 'station_name', 'line_token', 'line_group_id',
      'face_verify_enabled', 'face_match_threshold', 'face_max_attempts', 'face_min_desc',
      'gdrive_client_id', 'gdrive_client_secret'];
    const settings = {};
    keys.forEach(k => {
      const el = byId('st_' + k);
      settings[k] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
    });
    const d = await App.api('settings_save', { settings });
    toast(d.message);
    App.adminData = await App.api('admin_data');
  },

  async testLine(type) {
    const d = await App.api('cron_report&type=' + type + '&force=1', {});
    if (d.sent) toast('ส่งเข้ากลุ่ม LINE แล้ว');
    else Swal.fire({ icon: 'info', title: d.sent === false ? 'ยังส่งไม่ได้' : 'ตัวอย่างข้อความ',
      html: `<div class="tiny" style="margin-bottom:6px">${esc(d.detail || d.skipped || '')}</div>
        <pre style="text-align:left;font-family:Kanit;font-size:13px;white-space:pre-wrap;background:#f4f6f2;padding:12px;border-radius:10px">${esc(d.preview || '')}</pre>`,
      confirmButtonText: 'ปิด', width: 520 });
  },

  // ==========================================================
  // ลงทะเบียนใบหน้า (v33) — คำนวณในเบราว์เซอร์ ส่งขึ้นเซิร์ฟเวอร์แค่เวกเตอร์
  // ทำเป็น overlay ไม่ใช่การ์ด เพราะ vUsers() re-render ทุกครั้งที่กดอะไร จะล้าง state 460 ไฟล์ทิ้ง
  // ==========================================================
  feFiles: [],      // [{name, file}]
  feGroups: {},     // ชื่อจากไฟล์ → [file...]
  feMatch: {},      // ชื่อจากไฟล์ → user_id ('' = ไม่ลงทะเบียน)
  feUsers: [],
  feResult: null,   // ผลหลังคำนวณ { ชื่อ: {keep:[{desc,src}], drops:[[file,reason]], warn:[] } }
  feStop: false,

  async faceEnrollOpen() {
    this.feFiles = []; this.feGroups = {}; this.feMatch = {}; this.feResult = null; this.feStop = false;
    const d = await App.api('users_list');
    this.feUsers = d.users.filter(u => u.role === 'staff' && u.status !== 'pending');
    this.feMinDesc = d.face_min_desc;

    const ov = document.createElement('div');
    ov.id = 'faceEnrollOv';
    ov.className = 'fe-ov';
    ov.innerHTML = `
      <div class="fe-bar">
        <b>🙂 ลงทะเบียนใบหน้าเจ้าหน้าที่</b>
        <button class="btn btn-ghost btn-sm" onclick="Admin.faceEnrollClose()">✕ ปิด</button>
      </div>
      <div class="fe-scroll">
        <div class="card"><h3>🆕 เจ้าหน้าที่คนใหม่ — ถ่าย 3 รูป</h3>
          <div class="tiny" style="margin-bottom:10px">ใช้ตอนมีคนใหม่เข้ามาทำงาน หรือคนที่รูปเดิมไม่พอ
            — <b>ถ่ายหน้าตรง 3-5 รูป</b> (หันซ้าย/ตรง/ขวาเล็กน้อย แสงสว่าง ไม่ใส่หมวก/แว่นกันแดด)
            <br>เป็นการ<b>เพิ่มทับของเดิม</b> (ไม่ลบรูปเก่า) — ถ้าอยากเริ่มใหม่หมด กดปุ่ม "ลบ" ในตารางเจ้าหน้าที่ก่อน</div>
          <div class="field"><label>เลือกเจ้าหน้าที่</label>
            <select class="select" id="feOneUser">${this.feUsers.filter(u => u.status === 'active')
              .map(u => `<option value="${u.id}">${esc(u.name)}${+u.face_n ? ` (มีแล้ว ${u.face_n} รูป)` : ' — ยังไม่มีใบหน้า'}</option>`).join('')}</select></div>
          <input type="file" id="feOneFiles" accept="image/*" multiple capture="user" style="font-size:13px">
          <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="Admin.feOneSave()">🙂 วิเคราะห์ + บันทึกใบหน้า</button>
          <div id="feOneOut" class="tiny" style="margin-top:8px"></div>
        </div>

        <div class="card"><h3>1️⃣ เลือกโฟลเดอร์รูป <span class="h-right">ลงทะเบียนยกทีมจากรูปเช็คชื่อเดิม</span></h3>
          <div class="tiny" style="margin-bottom:10px">เลือกโฟลเดอร์ <b>รูปเช็คชื่อสถานีไฟป่า</b> ที่โหลดจาก Google Drive (มีโฟลเดอร์ย่อยรายวัน)
            — ระบบอ่านชื่อคนจากชื่อไฟล์ให้เอง · <b>ทำบนคอมพิวเตอร์</b> (มือถือเลือกโฟลเดอร์ไม่ได้)</div>
          <input type="file" id="feDir" webkitdirectory multiple accept="image/*" style="font-size:13px">
          <div class="tiny" style="margin-top:6px">หรือเลือกไฟล์รูปหลายไฟล์: <input type="file" id="feMulti" multiple accept="image/*" style="font-size:13px"></div>
          <div id="fePick" class="tiny" style="margin-top:8px">ยังไม่ได้เลือก</div>
        </div>
        <div id="feMatchCard"></div>
        <div id="feRunCard"></div>
        <div id="feReport"></div>
      </div>`;
    document.body.appendChild(ov);
    byId('feDir').onchange   = (e) => this.fePick(e.target.files);
    byId('feMulti').onchange = (e) => this.fePick(e.target.files);
  },

  faceEnrollClose() {
    this.feStop = true;
    const ov = byId('faceEnrollOv'); if (ov) ov.remove();
    this.vUsers();
  },

  /** อ่านชื่อคนจากชื่อไฟล์ — ต้องตรงกับที่ gdrive_enqueue ตั้งชื่อไว้ (HHMM_ชื่อ_สกุล[_(เวรกลางคืน)].jpg) */
  feParseName(fname) {
    return fname.replace(/\.[^.]+$/, '')
      .replace(/_\(เวรกลางคืน\)$/, '')
      .replace(/^\d{4}_/, '')
      .replace(/_/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFC');
  },

  fePick(fileList) {
    this.feFiles = [...fileList].filter(f => /\.(jpe?g|png)$/i.test(f.name) && !f.name.startsWith('.'));
    this.feGroups = {};
    for (const f of this.feFiles) (this.feGroups[this.feParseName(f.name)] ||= []).push(f);
    const names = Object.keys(this.feGroups).sort();
    byId('fePick').innerHTML = `พบ <b>${this.feFiles.length}</b> รูป · <b>${names.length}</b> ชื่อ`;
    this.feMatch = {};
    names.forEach(n => this.feMatch[n] = this.feGuess(n));
    this.feRenderMatch();
  },

  /** เดา user จากชื่อไฟล์ — ตรงเป๊ะก่อน ไม่งั้นตัดคำนำหน้าแล้วเทียบ (น.ส. vs นางสาว) */
  feGuess(name) {
    const strip = (s) => s.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ว่าที่ร้อยตรี|ส\.อ\.|จ\.ส\.อ\.)\s*/, '').replace(/\s+/g, ' ').trim();
    const exact = this.feUsers.find(u => u.name.normalize('NFC') === name);
    if (exact) return String(exact.id);
    const bare = strip(name);
    const same = this.feUsers.filter(u => strip(u.name.normalize('NFC')) === bare);
    return same.length === 1 ? String(same[0].id) : '';
  },

  feRenderMatch() {
    const names = Object.keys(this.feGroups).sort();
    if (!names.length) { byId('feMatchCard').innerHTML = ''; byId('feRunCard').innerHTML = ''; return; }
    const opts = (sel) => `<option value=""${sel ? '' : ' selected'}>— ไม่ลงทะเบียน —</option>` +
      this.feUsers.map(u => `<option value="${u.id}"${String(u.id) === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('');
    const unmatched = names.filter(n => !this.feMatch[n]);
    byId('feMatchCard').innerHTML = `
      <div class="card"><h3>2️⃣ จับคู่ชื่อไฟล์กับเจ้าหน้าที่</h3>
        ${unmatched.length ? `<div class="alert-bar" style="margin-bottom:10px">⛔ ยังจับคู่ไม่ได้ <b>${unmatched.length} ชื่อ</b> — ${unmatched.map(esc).join(', ')}</div>` : ''}
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>ชื่อจากไฟล์</th><th class="num">รูป</th><th>ลงทะเบียนให้</th></tr>
          ${names.map(n => `<tr>
            <td>${esc(n)}${this.feMatch[n] && this.feUsers.find(u => String(u.id) === this.feMatch[n])?.name.normalize('NFC') !== n
                ? '<div class="tiny" style="color:var(--late)">⚠️ ชื่อไม่ตรงเป๊ะ ตรวจให้แน่ใจ</div>' : ''}</td>
            <td class="num">${this.feGroups[n].length}</td>
            <td><select class="select" style="min-width:190px;padding:4px 6px"
                  onchange="Admin.feSetMatch('${esc(n).replace(/'/g, '&#39;')}', this.value)">${opts(this.feMatch[n])}</select></td>
          </tr>`).join('')}
        </table></div>
        <label class="osu-nolate" style="margin-top:12px"><input type="checkbox" id="feConfirm" onchange="byId('feGo').disabled = !this.checked">
          <span>ตรวจการจับคู่ด้านบนแล้ว ถูกต้องทุกชื่อ</span></label>
      </div>`;
    byId('feRunCard').innerHTML = `
      <div class="card"><h3>3️⃣ คำนวณใบหน้า</h3>
        <div class="tiny" style="margin-bottom:10px">คำนวณในเครื่องนี้ ไม่ส่งรูปออกไปไหน — <b>460 รูปใช้เวลา 5-10 นาที</b>
          <br>⚠️ <b>อยู่ที่หน้านี้ อย่าสลับไปแท็บอื่น</b> (เบราว์เซอร์จะหน่วงแท็บที่ไม่ได้ดู ทำให้ช้าลงหลายเท่า)
          — เลื่อนดูในหน้านี้ได้ปกติ · กด "หยุด" แล้วเริ่มใหม่ได้ตลอด</div>
        <div class="fe-prog"><i id="feBar"></i></div>
        <div id="feProg" class="tiny">พร้อม</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primary" id="feGo" disabled onclick="Admin.feCompute()">▶ เริ่มคำนวณ</button>
          <button class="btn btn-ghost" onclick="Admin.feStop = true">⏸ หยุด</button>
        </div>
      </div>`;
  },

  feSetMatch(name, val) {
    const key = Object.keys(this.feGroups).find(k => k === name || esc(k) === name);
    if (key !== undefined) this.feMatch[key] = val;
  },

  async feCompute() {
    this.feStop = false;
    byId('feGo').disabled = true;
    const targets = Object.keys(this.feGroups).filter(n => this.feMatch[n]);
    if (!targets.length) { toast('ยังไม่ได้จับคู่ชื่อกับเจ้าหน้าที่', 'error'); byId('feGo').disabled = false; return; }

    byId('feProg').textContent = 'กำลังโหลดโมเดลใบหน้า...';
    try { await loadFaceModels(); }
    catch (e) { byId('feProg').textContent = '❌ ' + e.message; byId('feGo').disabled = false; return; }

    const files = targets.flatMap(n => this.feGroups[n].map(f => ({ n, f })));
    const recs = [], t0 = Date.now();
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < files.length; i++) {
      if (this.feStop) { byId('feProg').textContent = `หยุดแล้วที่ ${i}/${files.length} รูป`; break; }
      const { n, f } = files[i];
      let rec = { person: n, file: f.name, nFace: 0, score: 0, bw: 0, desc: null };
      try {
        const bmp = await createImageBitmap(f);
        cv.width = bmp.width; cv.height = bmp.height;
        cx.drawImage(bmp, 0, 0); bmp.close();
        const dets = await faceapi.detectAllFaces(cv, faceOpts()).withFaceLandmarks().withFaceDescriptors();
        rec.nFace = dets.length;
        if (dets.length) {
          const big = dets.reduce((a, b) => a.detection.box.width >= b.detection.box.width ? a : b);
          rec.score = big.detection.score; rec.bw = big.detection.box.width;
          rec.desc = Array.from(big.descriptor);
        }
      } catch { /* ไฟล์เสีย = ตกไปเป็น nFace 0 */ }
      recs.push(rec);
      // คืน event loop ให้แท็บไม่ค้าง — ทุก 8 รูป ไม่ใช่ทุก 3 เพราะแท็บที่ถูกซ่อน Chrome หน่วง setTimeout เป็น ~1 วิ
      if (i % 8 === 0 || i === files.length - 1) {
        const pct = Math.round((i + 1) / files.length * 100), per = (Date.now() - t0) / (i + 1);
        byId('feBar').style.width = pct + '%';
        byId('feProg').textContent = `${i + 1}/${files.length} (${pct}%) · เหลือ ~${Math.round(per * (files.length - i - 1) / 1000)} วิ · ${f.name}`
          + (document.hidden ? ' · ⚠️ กลับมาดูหน้านี้จะเร็วขึ้น' : '');
        await new Promise(r => setTimeout(r, 0));
      }
    }
    this.feResult = this.feHygiene(recs);
    this.feReport();
    byId('feGo').disabled = false;
  },

  /** คัดกรอง descriptor ต่อคน — ต้องเหมือนกับที่วัดไว้ตอนเลือกเกณฑ์ (facelab) เป๊ะ */
  feHygiene(recs) {
    const CAP = 12, MIN_SCORE = 0.5, MIN_BW = 80;
    const eu = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
    const cen = (L) => { const c = new Float64Array(128); for (const v of L) for (let i = 0; i < 128; i++) c[i] += v[i]; return c.map(x => x / L.length); };
    const med = (A) => { const s = [...A].sort((a, b) => a - b); const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };

    const byP = {};
    for (const r of recs) (byP[r.person] ||= []).push(r);
    const out = {};
    for (const [p, list] of Object.entries(byP)) {
      const drops = [];
      let keep = list.filter(r => {
        if (r.nFace === 0) { drops.push([r.file, 'ไม่พบใบหน้า']); return false; }
        if (r.nFace > 1)   { drops.push([r.file, `พบ ${r.nFace} หน้าในรูป`]); return false; }
        if (r.score < MIN_SCORE) { drops.push([r.file, 'ภาพไม่ชัดพอ']); return false; }
        if (r.bw < MIN_BW)       { drops.push([r.file, 'หน้าเล็กเกินไป']); return false; }
        return true;
      });
      // ตัดรูปที่ไกลจากกลุ่มของตัวเอง 2 รอบ — กันรูปคนอื่นที่ถูกบันทึกผิดชื่อ
      for (let pass = 0; pass < 2 && keep.length >= 4; pass++) {
        const c = cen(keep.map(r => r.desc)), ds = keep.map(r => eu(r.desc, c));
        const m = med(ds), lim = m + 2 * med(ds.map(v => Math.abs(v - m)));
        const next = [];
        keep.forEach((r, i) => ds[i] > lim ? drops.push([r.file, `หน้าไม่เหมือนรูปอื่นของคนนี้ (${ds[i].toFixed(2)})`]) : next.push(r));
        if (next.length === keep.length) break;
        keep = next;
      }
      out[p] = { keep, drops, total: list.length };
    }

    // เตือนถ้ารูปของคนหนึ่งไปใกล้คนอื่นมากกว่ากลุ่มตัวเอง (กันลงทะเบียนสลับคน)
    const people = Object.keys(out);
    for (const p of people) {
      out[p].cross = [];
      const c = out[p].keep.length ? cen(out[p].keep.map(r => r.desc)) : null;
      if (!c) continue;
      for (const r of out[p].keep) {
        const own = eu(r.desc, c);
        for (const q of people) {
          if (q === p || !out[q].keep.length) continue;
          const dq = Math.min(...out[q].keep.map(g => eu(r.desc, g.desc)));
          if (dq < own) { out[p].cross.push([r.file, q]); break; }
        }
      }
      // จำกัดจำนวน โดยเลือกให้กระจายท่าทาง (ไกลกันมากสุด) ไม่ใช่เอาแต่รูปที่คล้ายกัน
      if (out[p].keep.length > CAP) {
        const D = out[p].keep.map(r => r.desc);
        let seed = 0, bd = Infinity;
        D.forEach((d, i) => { const x = eu(d, c); if (x < bd) { bd = x; seed = i; } });
        const pick = [seed], dmin = D.map(d => eu(d, D[seed]));
        while (pick.length < CAP) {
          let bi = -1, bx = -1;
          for (let i = 0; i < D.length; i++) if (!pick.includes(i) && dmin[i] > bx) { bx = dmin[i]; bi = i; }
          pick.push(bi);
          for (let i = 0; i < D.length; i++) dmin[i] = Math.min(dmin[i], eu(D[i], D[bi]));
        }
        out[p].capped = pick.map(i => out[p].keep[i]);
      } else out[p].capped = out[p].keep;
    }
    return out;
  },

  feReport() {
    const R = this.feResult, names = Object.keys(R).sort();
    const uName = (id) => this.feUsers.find(u => String(u.id) === String(id))?.name || '?';
    const bad = names.filter(n => (R[n].cross || []).length);
    const thin = names.filter(n => (R[n].capped || []).length < this.feMinDesc);
    byId('feReport').innerHTML = `
      <div class="card"><h3>4️⃣ ผลการคัดกรอง</h3>
        ${bad.length ? `<div class="alert-bar" style="margin-bottom:10px">⛔ <b>${bad.length} คน</b> มีรูปที่หน้าไปเหมือนคนอื่นมากกว่าตัวเอง — อาจจับคู่ชื่อสลับ ตรวจก่อนบันทึก:
          ${bad.map(n => esc(n) + ' (' + R[n].cross.map(c => esc(c[1])).join(', ') + ')').join(' · ')}</div>` : ''}
        ${thin.length ? `<div class="alert-bar" style="margin-bottom:10px">⚠️ รูปไม่พอใช้งาน (ต้องมี ≥ ${this.feMinDesc}): <b>${thin.map(esc).join(', ')}</b>
          — ต้องถ่ายรูปหน้าตรงเพิ่มให้คนนี้</div>` : ''}
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>ชื่อจากไฟล์</th><th>ลงทะเบียนให้</th><th class="num">รูป</th><th class="num">ใช้ได้</th><th class="num">จะบันทึก</th></tr>
          ${names.map(n => `<tr>
            <td>${esc(n)}</td><td>${esc(uName(this.feMatch[n]))}</td>
            <td class="num">${R[n].total}</td><td class="num">${R[n].keep.length}</td>
            <td class="num"><b>${(R[n].capped || []).length}</b></td></tr>
            ${R[n].drops.length ? `<tr><td colspan="5" class="tiny" style="color:var(--ink-2);padding-left:16px">
              ตัดออก: ${R[n].drops.map(d => esc(d[0]) + ' (' + d[1] + ')').join(' · ')}</td></tr>` : ''}`).join('')}
        </table></div>
        <div class="tiny" style="margin-top:10px">💡 <b>ถ่ายรูปเพิ่มให้คนที่รูปไม่พอ:</b> เลือก "เลือกไฟล์รูปหลายไฟล์" ข้อ 1️⃣ → เลือกรูปหน้าตรง 3-5 รูปของคนนั้น
          → ชื่อไฟล์จะจับคู่ไม่ได้ (ปกติ) ให้เลือกชื่อคนจาก dropdown ให้ทุกแถว → ระบบรวมให้เป็นคนเดียวกันเอง</div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="Admin.feSaveAll()">💾 บันทึกใบหน้าทั้งหมดลงระบบ</button>
        <div id="feSaveProg" class="tiny" style="margin-top:8px"></div>
      </div>`;
  },

  async feSaveAll() {
    const R = this.feResult;
    // ⚠️ รวมกลุ่มที่จับคู่ไปยังคนเดียวกันก่อนบันทึก — เช่นเลือกรูปเดี่ยวหลายไฟล์ (ชื่อไฟล์ไม่ซ้ำ) ให้คนเดียว
    //    ถ้าไม่รวม จะยิง replace ทับกันเองเหลือรูปเดียว (เจอตอนคิดเคสถ่ายรูปเพิ่มให้คนที่รูปไม่พอ)
    const byUser = {};
    for (const n of Object.keys(R)) {
      const uid = this.feMatch[n];
      if (!uid || !(R[n].capped || []).length) continue;
      (byUser[uid] ||= []).push(...R[n].capped);
    }
    const ids = Object.keys(byUser);
    const uName = (id) => this.feUsers.find(u => String(u.id) === String(id))?.name || id;
    let done = 0;
    for (const uid of ids) {
      byId('feSaveProg').textContent = `กำลังบันทึก ${done + 1}/${ids.length} — ${uName(uid)}`;
      await App.api('face_enroll_save', {
        user_id: +uid, replace: 1,
        items: byUser[uid].slice(0, 12).map(r => ({ descriptor: r.desc, src_name: r.file })),
      });
      done++;
    }
    byId('feSaveProg').textContent = `บันทึกครบ ${done} คนแล้ว ✅`;
    await Swal.fire({ icon: 'success', title: 'ลงทะเบียนใบหน้าแล้ว',
      html: `บันทึก <b>${done}</b> คน<br><div class="tiny" style="margin-top:8px">เปิดสวิตช์ "ยืนยันใบหน้า" ที่เมนูตั้งค่าเพื่อเริ่มใช้งาน</div>`,
      confirmButtonText: 'ตกลง' });
  },

  /** ลงทะเบียนใบหน้ารายคนจากรูปที่ถ่ายมาใหม่ (คนใหม่ / คนที่รูปเดิมไม่พอ) — เพิ่มทับของเดิม */
  async feOneSave() {
    const uid = +byId('feOneUser').value;
    const files = [...byId('feOneFiles').files].filter(f => /\.(jpe?g|png|heic|webp)$/i.test(f.name) || f.type.startsWith('image/'));
    const out = byId('feOneOut');
    if (!files.length) { out.textContent = '⚠️ ยังไม่ได้เลือกรูป'; return; }

    out.textContent = 'กำลังโหลดโมเดล...';
    try { await loadFaceModels(); } catch (e) { out.textContent = '❌ ' + e.message; return; }

    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    const keep = [], drops = [];
    for (let i = 0; i < files.length; i++) {
      out.textContent = `กำลังวิเคราะห์ ${i + 1}/${files.length}...`;
      try {
        const bmp = await createImageBitmap(files[i]);
        cv.width = bmp.width; cv.height = bmp.height;
        cx.drawImage(bmp, 0, 0); bmp.close();
        const dets = await faceapi.detectAllFaces(cv, faceOpts()).withFaceLandmarks().withFaceDescriptors();
        if (dets.length !== 1) { drops.push([files[i].name, dets.length ? `พบ ${dets.length} หน้าในรูป` : 'ไม่พบใบหน้า']); continue; }
        const d = dets[0];
        if (d.detection.score < 0.5)      { drops.push([files[i].name, 'ภาพไม่ชัดพอ']); continue; }
        if (d.detection.box.width < 80)   { drops.push([files[i].name, 'หน้าเล็กเกินไป ถ่ายใกล้อีกนิด']); continue; }
        keep.push({ desc: Array.from(d.descriptor), file: files[i].name });
      } catch { drops.push([files[i].name, 'อ่านไฟล์ไม่ได้']); }
    }
    if (!keep.length) {
      out.innerHTML = `❌ ไม่มีรูปที่ใช้ได้เลย<br>${drops.map(d => `• ${esc(d[0])} — ${d[1]}`).join('<br>')}`;
      return;
    }

    // replace: 0 = เพิ่มทับของเดิม (ไม่ลบ) — ตรงกับที่การ์ดบอกว่าใช้ "ถ่ายเพิ่มให้คนที่รูปเดิมไม่พอ" ได้
    // ถ้าอยากเริ่มใหม่หมด ใช้ปุ่ม "ลบ" ในตารางเจ้าหน้าที่ก่อน
    const d = await App.api('face_enroll_save', { user_id: uid, replace: 0,
      items: keep.slice(0, 12).map(r => ({ descriptor: r.desc, src_name: r.file })) });
    out.innerHTML = `✅ ${esc(d.message)}${d.ready ? '' : ` <b style="color:var(--absent)">— ยังไม่พอใช้งาน ถ่ายเพิ่มอีก</b>`}
      ${drops.length ? `<br><span style="color:var(--late)">ข้ามไป ${drops.length} รูป:</span> ${drops.map(x => esc(x[0]) + ' (' + x[1] + ')').join(' · ')}` : ''}`;
    byId('feOneFiles').value = '';
    const u = await App.api('users_list');
    this.feUsers = u.users.filter(x => x.role === 'staff' && x.status !== 'pending');
  },

  async faceClear(id, name) {
    const c = await Swal.fire({ icon: 'warning', title: 'ลบข้อมูลใบหน้า?',
      text: `ลบใบหน้าที่ลงทะเบียนไว้ของ ${name} — คนนี้จะเช็คชื่อได้แต่ติดหมายเหตุว่ายังไม่ลงทะเบียน`,
      showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
    if (!c.isConfirmed) return;
    const d = await App.api('face_enroll_clear', { user_id: id });
    toast(d.message);
    this.vUsers();
  },

  /** รายชื่อ+รูป คนที่ยืนยันใบหน้าไม่ผ่านวันนี้ */
  faceFlagList() {
    const list = App.adminData.face_flags || [];
    Swal.fire({ icon: 'warning', title: 'ยืนยันใบหน้าไม่ผ่านวันนี้', width: 560,
      html: `<div style="text-align:left">${list.map(f => `
        <div class="list-row"><div class="lr-main"><div class="lr-title">${esc(f.name)}</div>
          <div class="lr-sub">เช็คชื่อ ${f.time_in ? f.time_in.substr(11, 5) : '—'} น.${f.face_dist ? ' · ระยะ ' + f.face_dist : ''}</div></div>
          ${f.face_photo ? `<a href="photo.php?p=${encodeURIComponent(f.face_photo)}&token=${App.token}" target="_blank">
            <img src="photo.php?p=${encodeURIComponent(f.face_photo)}&token=${App.token}" style="width:52px;height:52px;object-fit:cover;border-radius:8px"></a>` : '<span class="tiny">ไม่มีรูป</span>'}
        </div>`).join('')}</div>
        <div class="tiny" style="margin-top:10px;text-align:left">⚠️ ไม่ผ่านอาจเป็นแค่แสง/หมวก/แว่น — ดูรูปแล้วตัดสินเองนะคะ</div>`,
      confirmButtonText: 'ปิด' });
  },
};

/** ป้ายธงยืนยันใบหน้า (ใช้ในตารางรายชื่อ) */
function faceFlagChip(r) {
  if (+r.face_flag === 1) return ` <span class="face-flag" onclick="Admin.faceFlagList()">⚠️ ยืนยันหน้าไม่ผ่าน</span>`;
  if (+r.face_flag === 2) return ` <span class="face-flag f2">🆕 ยังไม่ลงทะเบียนหน้า</span>`;
  return '';
}
