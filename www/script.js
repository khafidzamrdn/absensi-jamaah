/* ================== KONSTANTA ================== */
const PRAYERS = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];
const STATUSES = ['Mengikuti', 'Telat', 'Tidak mengikuti'];
const STATUS_EMOJI = { 'Mengikuti': '🟢', 'Telat': '🟡', 'Tidak mengikuti': '🔴' };
const STATUS_CLASS = { 'Mengikuti': 's-green', 'Telat': 's-yellow', 'Tidak mengikuti': 's-red' };
const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTHS_SHORT_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const DEFAULT_PIN = '1234';

/* ================== STATE ================== */
const state = {
  jamaah: [],
  absensi: {},       // id -> record {id, jamaahId, tanggal, waktu, status}
  currentScreen: 'dashboard',
  selectedDate: null,
  quickWaktu: 'Subuh',
  calMonth: null,    // Date object (first day of month)
  calSelected: null,
  selectedJamaahId: null,
  rekapTab: 'all',
  loggedIn: false,
  theme: 'light',
  jamaahSearch: '',
  jamaahKelasFilter: '',
};

/* ================== INDEXEDDB ================== */
const DB_NAME = 'absensi_jamaah_db';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('jamaah')) {
        const s = d.createObjectStore('jamaah', { keyPath: 'id' });
        s.createIndex('nama', 'nama');
        s.createIndex('kelas', 'kelas');
      }
      if (!d.objectStoreNames.contains('absensi')) {
        const s = d.createObjectStore('absensi', { keyPath: 'id' });
        s.createIndex('tanggal', 'tanggal');
        s.createIndex('jamaahId', 'jamaahId');
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function idbAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function idbPut(store, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(val);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
function idbClear(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

/* ================== UTIL ================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromISO(s) { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); }
function todayISO() { return toISO(new Date()); }

function formatLong(d) {
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}
function formatShort(d) {
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]}`;
}
function formatShortFull(d) {
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ================== PIN / SESSION ================== */
function getPin() { return localStorage.getItem('absensi_pin') || DEFAULT_PIN; }
function setPin(v) { localStorage.setItem('absensi_pin', v); }
function isLoggedIn() { return localStorage.getItem('absensi_logged_in') === '1'; }
function setLoggedIn(v) { v ? localStorage.setItem('absensi_logged_in', '1') : localStorage.removeItem('absensi_logged_in'); }

/* ================== TEMA ================== */
function applyTheme() {
  const t = state.theme;
  document.documentElement.setAttribute('data-theme', t);
  $('#btn-theme').textContent = t === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('absensi_theme', state.theme);
  applyTheme();
}

/* ================== NAVIGASI ================== */
function go(screen) {
  state.currentScreen = screen;
  $$('.screen').forEach(el => el.classList.remove('active'));
  $(`#screen-${screen}`)?.classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.go === screen));
  const nav = $('#bottom-nav');
  if (screen === 'login') nav.classList.add('hidden');
  else nav.classList.remove('hidden');
  if (screen === 'dashboard') renderDashboard();
  if (screen === 'absensi') renderAbsensi();
  if (screen === 'jamaah') renderJamaahList();
  if (screen === 'rekap') renderRekap();
  if (screen === 'kalender') renderKalender();
  if (screen === 'pengaturan') { /* static */ }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================== PENGELOLAAN JAMAAH ================== */
function nextJamaahId() {
  let max = 0;
  for (const j of state.jamaah) {
    const m = /^J(\d+)$/.exec(j.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'J' + String(max + 1).padStart(3, '0');
}

async function saveJamaah(j) {
  await idbPut('jamaah', j);
  const idx = state.jamaah.findIndex(x => x.id === j.id);
  if (idx >= 0) state.jamaah[idx] = j; else state.jamaah.push(j);
}

async function deleteJamaah(id) {
  await idbDelete('jamaah', id);
  state.jamaah = state.jamaah.filter(x => x.id !== id);
  // hapus semua absensi jamaah ini
  const keys = Object.keys(state.absensi).filter(k => state.absensi[k].jamaahId === id);
  for (const k of keys) {
    await idbDelete('absensi', k);
    delete state.absensi[k];
  }
}

/* ================== PENGELOLAAN ABSENSI ================== */
function absKey(jamaahId, tanggal, waktu) { return `${jamaahId}|${tanggal}|${waktu}`; }

async function setAbsensi(jamaahId, tanggal, waktu, status) {
  const id = absKey(jamaahId, tanggal, waktu);
  const rec = { id, jamaahId, tanggal, waktu, status };
  await idbPut('absensi', rec);
  state.absensi[id] = rec;
}

function getAbsensi(jamaahId, tanggal, waktu) {
  return state.absensi[absKey(jamaahId, tanggal, waktu)]?.status || null;
}

/* ================== PERIODE MINGGU ================== */
// Periode: Jumat → Kamis. Jika hari ini Kamis, periode = Jumat lalu sampai Kamis ini.
function getWeekPeriod(ref = new Date()) {
  const d = new Date(ref); d.setHours(0,0,0,0);
  const day = d.getDay(); // 0=Sun..4=Thu..5=Fri..6=Sat
  const daysSinceFri = (day - 5 + 7) % 7; // Fri=0, Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6
  const start = new Date(d); start.setDate(d.getDate() - daysSinceFri);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start, end };
}

function dateRange(start, end) {
  const arr = [];
  const cur = new Date(start);
  while (cur <= end) {
    arr.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
}

/* ================== REKAP ================== */
function computeRekap(startDate, endDate) {
  const dates = dateRange(startDate, endDate);
  const dateSet = new Set(dates);
  const perJamaah = {};
  for (const j of state.jamaah) {
    perJamaah[j.id] = {};
    for (const w of PRAYERS) {
      perJamaah[j.id][w] = { 'Mengikuti': 0, 'Telat': 0, 'Tidak mengikuti': 0 };
    }
  }
  const perWaktu = {};
  for (const w of PRAYERS) perWaktu[w] = { 'Mengikuti': 0, 'Telat': 0, 'Tidak mengikuti': 0, total: 0 };

  for (const rec of Object.values(state.absensi)) {
    if (!dateSet.has(rec.tanggal)) continue;
    if (!perJamaah[rec.jamaahId]) continue;
    if (!PRAYERS.includes(rec.waktu)) continue;
    if (!STATUSES.includes(rec.status)) continue;
    perJamaah[rec.jamaahId][rec.waktu][rec.status]++;
    perWaktu[rec.waktu][rec.status]++;
    perWaktu[rec.waktu].total++;
  }
  return { startDate, endDate, dates, perJamaah, perWaktu };
}

function jamaahTotals(jId, perJamaah) {
  const totals = { Mengikuti: 0, Telat: 0, 'Tidak mengikuti': 0 };
  if (!perJamaah[jId]) return totals;
  for (const w of PRAYERS) {
    totals['Mengikuti'] += perJamaah[jId][w]['Mengikuti'];
    totals['Telat'] += perJamaah[jId][w]['Telat'];
    totals['Tidak mengikuti'] += perJamaah[jId][w]['Tidak mengikuti'];
  }
  return totals;
}

/* ================== RENDER: DASHBOARD ================== */
function renderDashboard() {
  const today = new Date();
  $('#dash-date').textContent = formatLong(today);
  $('#dash-total').textContent = state.jamaah.length;

  const tgl = todayISO();
  const container = $('#dash-prayers');
  container.innerHTML = '';

  for (const w of PRAYERS) {
    let m = 0, t = 0, x = 0;
    for (const j of state.jamaah) {
      const st = getAbsensi(j.id, tgl, w);
      if (st === 'Mengikuti') m++;
      else if (st === 'Telat') t++;
      else if (st === 'Tidak mengikuti') x++;
    }
    const div = document.createElement('div');
    div.className = 'dash-prayer';
    div.innerHTML = `
      <h4>${w}</h4>
      <div class="row"><span>🟢 Mengikuti</span><b>${m}</b></div>
      <div class="row"><span>🟡 Telat</span><b>${t}</b></div>
      <div class="row"><span>🔴 Tidak</span><b>${x}</b></div>
    `;
    container.appendChild(div);
  }

  // Tombol rekap mingguan hanya jika hari Kamis
  $('#dash-thursday').classList.toggle('hidden', today.getDay() !== 4);
}

/* ================== RENDER: ABSENSI (CEpat) ================== */
function renderAbsensi() {
  if (!state.selectedDate) state.selectedDate = todayISO();
  const dateObj = fromISO(state.selectedDate);
  $('#abs-date-label').textContent = formatLong(dateObj);
  $('#abs-date-input').value = state.selectedDate;

  // tabs waktu
  const tabs = $('#abs-tabs');
  tabs.innerHTML = '';
  for (const w of PRAYERS) {
    const b = document.createElement('button');
    b.className = 'tab' + (w === state.quickWaktu ? ' active' : '');
    b.textContent = w;
    b.onclick = () => { state.quickWaktu = w; renderAbsensi(); };
    tabs.appendChild(b);
  }

  renderQuickList();
}

function renderQuickList() {
  const wrap = $('#abs-list');
  wrap.innerHTML = '';
  const tgl = state.selectedDate;
  const waktu = state.quickWaktu;

  if (state.jamaah.length === 0) {
    wrap.innerHTML = `<div class="card muted" style="text-align:center">Belum ada data jamaah. Buka menu <b>Data Jamaah</b> untuk menambah.</div>`;
    return;
  }

  const sorted = [...state.jamaah].sort((a, b) => a.nama.localeCompare(b.nama));

  for (const j of sorted) {
    const cur = getAbsensi(j.id, tgl, waktu);
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div>
        <div class="li-name">${escapeHtml(j.nama)}</div>
        <div class="li-sub">${escapeHtml(j.kelas || '-')} ${cur ? '· ' + STATUS_EMOJI[cur] + ' ' + cur : ''}</div>
      </div>
      <div class="status-btns">
        ${STATUSES.map(s => `
          <button class="status-btn ${STATUS_CLASS[s]} ${cur === s ? 'active' : ''}" data-status="${s}">
            <span class="se">${STATUS_EMOJI[s]}</span>
            <span>${s === 'Tidak mengikuti' ? 'Tidak' : s}</span>
          </button>`).join('')}
      </div>
    `;
    div.querySelectorAll('.status-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const status = btn.dataset.status;
        // toggle: jika sama, hapus
        if (cur === status) {
          const id = absKey(j.id, tgl, waktu);
          await idbDelete('absensi', id);
          delete state.absensi[id];
          toast('Dihapus');
        } else {
          await setAbsensi(j.id, tgl, waktu, status);
          toast(`${j.nama}: ${STATUS_EMOJI[status]} ${status}`, 1100);
        }
        renderQuickList();
      };
    });
    wrap.appendChild(div);
  }
}

/* ================== RENDER: JAMAAH ================== */
function renderJamaahList() {
  // update filter kelas
  const sel = $('#jamaah-filter-kelas');
  const kelasSet = [...new Set(state.jamaah.map(j => j.kelas).filter(Boolean))].sort();
  const curr = state.jamaahKelasFilter;
  sel.innerHTML = '<option value="">Semua Kelas/Kelompok</option>' +
    kelasSet.map(k => `<option value="${escapeHtml(k)}"${k === curr ? ' selected' : ''}>${escapeHtml(k)}</option>`).join('');

  const q = state.jamaahSearch.toLowerCase().trim();
  const filtered = state.jamaah
    .filter(j => !state.jamaahKelasFilter || j.kelas === state.jamaahKelasFilter)
    .filter(j => !q || j.nama.toLowerCase().includes(q) || (j.id || '').toLowerCase().includes(q))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const wrap = $('#jamaah-list');
  wrap.innerHTML = '';

  if (filtered.length === 0) {
    wrap.innerHTML = `<div class="card muted" style="text-align:center">Tidak ada data.</div>`;
    return;
  }

  for (const j of filtered) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div class="li-name">${escapeHtml(j.nama)}</div>
          <div class="li-sub">ID: ${escapeHtml(j.id)} · ${escapeHtml(j.kelas || '-')}</div>
          ${j.keterangan ? `<div class="li-sub">${escapeHtml(j.keterangan)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="icon-btn" data-act="edit" data-id="${escapeHtml(j.id)}">✏️</button>
          <button class="icon-btn" data-act="del" data-id="${escapeHtml(j.id)}">🗑</button>
        </div>
      </div>
    `;
    div.querySelector('[data-act="edit"]').onclick = () => openJamaahForm(j);
    div.querySelector('[data-act="del"]').onclick = () => confirmDeleteJamaah(j);
    wrap.appendChild(div);
  }
}

/* ================== MODAL: FORM JAMAAH ================== */
function openModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal-body').innerHTML = '';
}

function openJamaahForm(j = null) {
  const isEdit = !!j;
  const data = j || { id: nextJamaahId(), nama: '', kelas: '', keterangan: '' };
  openModal(`
    <h3 class="h3">${isEdit ? '✏️ Edit Jamaah' : '➕ Tambah Jamaah'}</h3>
    <div class="form-row mt12">
      <label>ID</label>
      <input class="input" id="f-id" value="${escapeHtml(data.id)}" ${isEdit ? 'readonly' : ''} />
    </div>
    <div class="form-row">
      <label>Nama *</label>
      <input class="input" id="f-nama" value="${escapeHtml(data.nama)}" placeholder="Contoh: Ahmad" />
    </div>
    <div class="form-row">
      <label>Kelas/Kelompok</label>
      <input class="input" id="f-kelas" value="${escapeHtml(data.kelas)}" placeholder="Contoh: XI" />
    </div>
    <div class="form-row">
      <label>Keterangan (opsional)</label>
      <input class="input" id="f-ket" value="${escapeHtml(data.keterangan || '')}" />
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="f-cancel">Batal</button>
      <button class="btn btn-primary" id="f-save">Simpan</button>
    </div>
  `);
  $('#f-cancel').onclick = closeModal;
  $('#f-save').onclick = async () => {
    const id = $('#f-id').value.trim();
    const nama = $('#f-nama').value.trim();
    const kelas = $('#f-kelas').value.trim();
    const ket = $('#f-ket').value.trim();
    if (!id || !nama) { toast('ID & Nama wajib diisi'); return; }
    if (!isEdit && state.jamaah.some(x => x.id === id)) { toast('ID sudah dipakai'); return; }
    await saveJamaah({ id, nama, kelas, keterangan: ket });
    closeModal();
    toast(isEdit ? 'Jamaah diperbarui' : 'Jamaah ditambahkan');
    renderJamaahList();
    renderDashboard();
  };
}

function confirmDeleteJamaah(j) {
  openModal(`
    <h3 class="h3">🗑 Hapus Jamaah</h3>
    <p class="muted mt12">Hapus <b>${escapeHtml(j.nama)}</b>? Semua absensi jamaah ini juga akan dihapus.</p>
    <div class="form-actions">
      <button class="btn btn-secondary" id="c-no">Batal</button>
      <button class="btn btn-danger" id="c-yes">Hapus</button>
    </div>
  `);
  $('#c-no').onclick = closeModal;
  $('#c-yes').onclick = async () => {
    await deleteJamaah(j.id);
    closeModal();
    toast('Jamaah dihapus');
    renderJamaahList();
    renderDashboard();
  };
}

/* ================== RENDER: REKAP ================== */
function renderRekap() {
  const { start, end } = getWeekPeriod(new Date());
  $('#rekap-period').textContent = `${formatShortFull(start)} — ${formatShortFull(end)}`;

  const rekap = computeRekap(start, end);

  // Tab: semua (tabel)
  const wrapAll = $('#rekap-all');
  if (state.jamaah.length === 0) {
    wrapAll.innerHTML = `<div class="card muted" style="text-align:center">Belum ada data jamaah.</div>`;
  } else {
    const rows = [...state.jamaah]
      .sort((a, b) => a.nama.localeCompare(b.nama))
      .map(j => {
        const t = jamaahTotals(j.id, rekap.perJamaah);
        return `<tr>
          <td>${escapeHtml(j.nama)}<div class="li-sub">${escapeHtml(j.kelas || '-')}</div></td>
          <td class="num c-green">${t['Mengikuti']}</td>
          <td class="num c-yellow">${t['Telat']}</td>
          <td class="num c-red">${t['Tidak mengikuti']}</td>
        </tr>`;
      }).join('');
    wrapAll.innerHTML = `
      <div class="card">
        <table class="rekap-table">
          <thead><tr>
            <th>Nama</th>
            <th style="text-align:right">🟢 Mengikuti</th>
            <th style="text-align:right">🟡 Telat</th>
            <th style="text-align:right">🔴 Tidak</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Tab: per waktu
  const wrapWaktu = $('#rekap-waktu');
  wrapWaktu.innerHTML = PRAYERS.map(w => {
    const d = rekap.perWaktu[w];
    const total = d.total || 1;
    const pm = Math.round(d['Mengikuti'] / total * 100) || 0;
    const pt = Math.round(d['Telat'] / total * 100) || 0;
    const px = Math.round(d['Tidak mengikuti'] / total * 100) || 0;
    return `
      <div class="card">
        <h3 class="h3">${w}</h3>
        <div class="stat-line"><span>🟢 Mengikuti</span><b>${pm}% <span class="muted small">(${d['Mengikuti']})</span></b></div>
        <div class="stat-line"><span>🟡 Telat</span><b>${pt}% <span class="muted small">(${d['Telat']})</span></b></div>
        <div class="stat-line"><span>🔴 Tidak mengikuti</span><b>${px}% <span class="muted small">(${d['Tidak mengikuti']})</span></b></div>
        <div class="bar">
          <div class="b-green" style="width:${pm}%"></div>
          <div class="b-yellow" style="width:${pt}%"></div>
          <div class="b-red" style="width:${px}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Tab: individu
  renderRekapIndividu(rekap);
}

function renderRekapIndividu(rekap) {
  const wrap = $('#rekap-individu');
  if (!state.selectedJamaahId || !state.jamaah.some(j => j.id === state.selectedJamaahId)) {
    state.selectedJamaahId = state.jamaah[0]?.id || null;
  }
  const j = state.jamaah.find(x => x.id === st
