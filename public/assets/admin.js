/* =====================================================
   FireCheck — หน้าแอดมิน (หัวหน้าสถานี)
   แท็บ: แดชบอร์ด / รายงาน / วันหยุด / เจ้าหน้าที่ / ตั้งค่า
   ===================================================== */

const C_OK = '#2e7d32', C_LATE = '#d97706', C_LEAVE = '#2563eb', C_ABSENT = '#dc2626';
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
      ${[['dash', '📊', 'แดชบอร์ด'], ['report', '📋', 'รายงาน'], ['dayoff', '🗓️', 'วันหยุด'], ['users', '👥', 'เจ้าหน้าที่'], ['develop', '📚', 'พัฒนา'], ['settings', '⚙️', 'ตั้งค่า']]
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
       users: () => this.vUsers(), develop: () => this.vDevelop(), settings: () => this.vSettings() })[tab]();
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
    if (d.over_quota.length) alerts += `<div class="alert-bar">⚠️ วันหยุดเกินโควต้า: <b>${d.over_quota.map(o =>
      `${esc(o.name)} (${o.n} วัน เดือน ${thaiMonth(o.ym)})`).join(', ')}</b>
      <button class="btn btn-sm btn-primary" onclick="Admin.go('dayoff')">ดูปฏิทิน</button></div>`;

    // วันหยุดสถานี — ไม่มีการเช็คชื่อ โชว์แค่ส่วนวิเคราะห์
    if (d.today.is_holiday) {
      byId('view').innerHTML = `${alerts}
        <div class="card" style="padding:14px 18px"><div style="font-size:16px;font-weight:500">📍 วันนี้ — ${esc(d.today.thai_date)}</div>
          <div class="tiny">วันอาทิตย์ วันหยุดสถานี</div></div>
        <div class="card empty"><span class="e-ico">🌴</span>วันนี้วันหยุดสถานี ไม่มีการเช็คชื่อ</div>
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
          <div><div class="rc-name">${esc(r.name)}</div>
          <div class="rc-sub">${r.time_in ? 'เข้า ' + r.time_in.substr(11, 5) + ' น.' :
            state === 'leave' ? offLabel(r.off_type) + (r.off_note ? ' — ' + esc(r.off_note) : '') : 'ยังไม่เช็คชื่อ'}</div></div>
        </div>`).join('')}</div>
    </div>`;
  },

  // ส่วนวิเคราะห์ด้านล่าง (อันดับความขยัน / สถิติรายวัน / กิจกรรมล่าสุด)
  analyticsHtml(d) {
    return `
      <div class="card">
        <h3>🏆 อันดับความขยันเดือนนี้ <span class="h-right">${d.score_mode === 'full' ? 'มา30+ตรง30+รายงาน20+ตรง20' : 'มา 60 + ตรงเวลา 40 คะแนน/วัน'}</span></h3>
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
          <td>${i + 1}</td><td><b>${esc(r.name)}</b><div class="tiny">${esc(r.position || '')}</div></td>
          <td class="num"><b style="color:${r.score === null ? 'var(--ink-3)' : r.score >= 80 ? C_OK : r.score >= 50 ? C_LATE : C_ABSENT}">${r.score ?? '—'}</b></td>
          <td class="num">${r.planned}</td><td class="num">${r.present}</td>
          <td class="num" style="color:${C_OK}">${r.ontime}</td><td class="num" style="color:${C_LATE}">${r.late}</td>
          <td class="num" style="color:${C_LEAVE}">${r.leave}</td><td class="num" style="color:${C_ABSENT}">${r.absent}</td>
          <td class="num">${r.avg_in ?? '—'}</td></tr>`).join('')}
      </table></div>`;
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
            <td>${thaiDate(a.work_date)}</td><td>${esc(a.name)}</td>
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
    const rows = [['วันที่', 'ชื่อ', 'เวลาเข้า', 'เวลาออก', 'สถานะ', 'ระยะ_เมตร', 'รายงาน']];
    d.attendance.forEach(a => rows.push([a.work_date, a.name, a.time_in.substr(11, 8),
      a.time_out ? a.time_out.substr(11, 8) : '', +a.late ? 'สาย' : 'ตรงเวลา', a.distance_m ?? '', (a.report_text || '').replace(/\n/g, ' ')]));
    rows.push([]); rows.push(['วันที่', 'ชื่อ', 'ประเภทลา', 'หมายเหตุ']);
    d.day_offs.forEach(o => rows.push([o.off_date, o.name, offLabel(o.type), o.note || '']));
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
    const [d, ul] = await Promise.all([App.api('dayoff_month', { ym: this.aYm }), App.api('users_list')]);
    const staff = ul.users.filter(u => u.role === 'staff' && u.status === 'active');
    const byDate = {};
    d.day_offs.forEach(o => (byDate[o.off_date] = byDate[o.off_date] || []).push(o));

    byId('view').innerHTML = `
      <div class="card">
        <div class="cal-head">
          <button class="cal-nav" onclick="Admin.aMove(-1)">‹</button>
          <span class="cal-title">ปฏิทินวันหยุด — ${thaiMonth(this.aYm)}</span>
          <button class="cal-nav" onclick="Admin.aMove(1)">›</button>
        </div>
        <div id="aCalList">${Object.keys(byDate).sort().map(ds => `
          <div class="list-row"><span class="dot dot-leave"></span>
            <div class="lr-main"><div class="lr-title">${thaiDate(ds)}</div>
              <div class="lr-sub">${byDate[ds].map(o =>
                `${esc(o.name)} (${offLabel(o.type)})${+o.over_quota ? ' ⚠️' : ''}
                 <button class="link-btn" style="color:var(--absent);font-size:12px" onclick="Admin.delOff(${o.id})">ลบ</button>`).join(' • ')}</div></div>
            <span class="chip chip-leave">${byDate[ds].length} คน</span>
          </div>`).join('') || '<div class="empty"><span class="e-ico">🌿</span>เดือนนี้ไม่มีวันหยุด/ลา</div>'}
        </div>
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
        <div class="field"><label>ตำแหน่ง</label><input class="input" id="nuPos" placeholder="เช่น พนักงานดับไฟป่า"></div>
        <button class="btn btn-primary btn-block" onclick="Admin.addUser()">เพิ่ม</button>
        <div class="tiny" style="margin-top:8px">เพิ่มแล้วให้เจ้าตัวเปิดเว็บ → "ลงทะเบียน" → เลือกชื่อ → ตั้งชื่อผู้ใช้+รหัสผ่านเอง ใช้ได้เลย</div>
      </div>

      <div class="card"><h3>👥 เจ้าหน้าที่ทั้งหมด (${staff.length})</h3>
        <div class="tbl-wrap"><table class="tbl">
          <tr><th>ชื่อ</th><th>สถานะ</th><th class="num">หยุดเดือนนี้</th><th></th></tr>
          ${staff.map(u => `<tr>
            <td><b>${esc(u.name)}</b><div class="tiny">${u.username ? '@' + esc(u.username) + ' ' : ''}${esc(u.position || '')}</div></td>
            <td>${{ active: '<span class="chip chip-ok">ใช้งาน</span>', unregistered: '<span class="chip chip-plain">ยังไม่ลงทะเบียน</span>',
                   disabled: '<span class="chip chip-absent">ปิดใช้งาน</span>' }[u.status] || u.status}</td>
            <td class="num">${u.quota_used}/${d.quota_max}</td>
            <td style="white-space:nowrap;text-align:right">
              ${u.status === 'active' ? `<button class="btn btn-ghost btn-sm" onclick="Admin.userAct('user_reset',${u.id},'รีเซ็ตรหัสผ่าน? เจ้าตัวต้องลงทะเบียนใหม่')">รีเซ็ตรหัส</button>
                <button class="btn btn-danger-ghost btn-sm" onclick="Admin.userAct('user_disable',${u.id},'ปิดใช้งานบัญชีนี้?')">ปิด</button>` : ''}
              ${u.status === 'disabled' ? `<button class="btn btn-ghost btn-sm" onclick="Admin.userAct('user_enable',${u.id})">เปิดใช้งาน</button>` : ''}
            </td></tr>`).join('') || '<tr><td colspan="4" class="empty">ยังไม่มีเจ้าหน้าที่</td></tr>'}
        </table></div>
      </div>`;
  },

  async addUser() {
    const d = await App.api('user_add', { name: byId('nuName').value.trim(), position: byId('nuPos').value.trim() });
    await Swal.fire({ icon: 'success', title: 'เพิ่มแล้ว', text: d.message, confirmButtonText: 'ตกลง' });
    this.vUsers();
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

  // =====================================================
  // พัฒนาตัวเอง — จัดการคลังความรู้
  // =====================================================
  libAdmin: null,
  libStaffN: 0,
  devTab: 'lib',

  devSegHtml() {
    const t = (v, l) => `<button class="${this.devTab === v ? 'active' : ''}" onclick="Admin.devSetTab('${v}')">${l}</button>`;
    return `<div class="seg">
      ${t('lib', '📚 คลังความรู้')}${t('quiz', '📝 แบบทดสอบ')}
      <button disabled title="เร็วๆ นี้">💪 กายภาพ</button>
    </div>`;
  },

  devSetTab(t) { this.devTab = t; this.vDevelop(); },

  async vDevelop() {
    this.devTab === 'quiz' ? await this.vDevelopQuiz() : await this.vDevelopLib();
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
      <div class="card"><h3>🎚️ สวิตช์ฟีเจอร์</h3>
        ${T('selfie_required', '🤳 บังคับเซลฟี่ตอนเช็คอิน', 'โค้ดพร้อมแล้ว เปิดเมื่อไหร่ก็ได้')}
        ${T('checkout_enabled', '📝 เช็คเอาท์ + รายงานผลงานเย็น', 'เปิดแล้วคะแนนความขยันเปลี่ยนเป็นสูตรเต็ม 30/30/20/20')}
        ${T('gps_enforce', '📍 บังคับ GPS ในรัศมีสถานี', 'ปิดชั่วคราวได้ตอนทดสอบระบบ')}
        ${T('sunday_off', '🌴 วันอาทิตย์เป็นวันหยุดสถานี', 'ไม่ต้องเช็คชื่อ ไม่นับขาด')}
      </div>
      <div class="card"><h3>⏰ เวลา</h3>
        <div class="grid-2">
          ${I('checkin_open', 'เปิดเช็คอิน (น.)', 'time')}${I('late_cutoff', 'หลังเวลานี้ = สาย', 'time')}
          ${I('checkout_open', 'เปิดส่งรายงาน', 'time')}${I('report_cutoff', 'หลังเวลานี้ = รายงานช้า', 'time')}
        </div>
      </div>
      <div class="card"><h3>📍 พิกัดสถานี</h3>
        <div class="grid-2">${I('gps_lat', 'ละติจูด')}${I('gps_lng', 'ลองจิจูด')}</div>
        <div class="grid-2">${I('gps_radius_m', 'รัศมี (เมตร)', 'number')}${I('off_quota_month', 'โควต้าวันหยุด (วัน/เดือน)', 'number')}</div>
        <button class="btn btn-ghost btn-sm" onclick="Admin.useHere()">📌 ใช้ตำแหน่งปัจจุบันของฉัน</button>
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
      'checkin_open', 'late_cutoff', 'checkout_open', 'report_cutoff',
      'gps_lat', 'gps_lng', 'gps_radius_m', 'off_quota_month', 'station_name', 'line_token', 'line_group_id',
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
};
