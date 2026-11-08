// ── TRAVEL ──
let tripModalId = null;
let _currentTripId = null;
let _travelSubView = 'plan'; // 'plan' | 'review'
let _planItemModalId = null;
let _planItemTripId = null;
let _tripPhotoUploading = 0;
let _tripPhotoTargetId = null;
let _progressTripId = null; // which trip shown in progress card
let _ideaModalId = null;    // which idea is being edited (null = new)
let _todoEditTripId = null;  // trip that owns the todo being edited
let _todoEditId = null;      // todo id being edited (null = new)
let _coverPickTripId = null; // trip for cover pick modal
let _coverUploadFor = null;  // 'trip' | 'idea'
let _statusMenuTripId = null; // open status menu
let _progressDetailTripId = null; // step key shown in progress detail modal
let _progressDetailKey = null;
let _transportEditId = null;  // null = new
let _stayEditId = null;       // null = new
let _tripPhotoTargetDate = null; // date string for day-specific photo upload

const PLAN_KIND_LABELS = { move:'移動', stay:'宿', see:'観光', eat:'食事', memo:'メモ' };
const PLAN_KIND_COLORS = { move:'#3b82f6', stay:'#7c3aed', see:'#10b981', eat:'#f59e0b', memo:'#9ca3af' };

const PROGRESS_STEPS = [
  { key:'theme',     label:'目的・テーマ',  autoKey:null,        action:'detail' },
  { key:'schedule',  label:'日程',          autoKey:'schedule',  action:'detail' },
  { key:'route',     label:'行き先・ルート', autoKey:null,        action:'detail' },
  { key:'transport', label:'交通手段',       autoKey:'transport', action:'detail' },
  { key:'stay',      label:'宿泊',           autoKey:'stay',      action:'detail' },
  { key:'budget',    label:'予算',           autoKey:'budget',    action:'detail' },
  { key:'food',      label:'食事・体験',     autoKey:'food',      action:'detail' },
  { key:'prep',      label:'予約・持ち物',   autoKey:null,        action:'detail' },
];

const TRANSPORT_KIND_ICONS  = { flight:'✈', train:'🚄', bus:'🚌', car:'🚗', ship:'⛴', other:'🚆' };
const TRANSPORT_KIND_LABELS = { flight:'飛行機', train:'電車・新幹線', bus:'バス', car:'車', ship:'船', other:'その他' };

const TRIP_GRADIENTS = [
  'linear-gradient(150deg,#1e3a5f 0%,#2d6a9f 100%)',
  'linear-gradient(150deg,#1e3a2d 0%,#2d6a4a 100%)',
  'linear-gradient(150deg,#3a1e2d 0%,#7a3a52 100%)',
  'linear-gradient(150deg,#1e2d4a 0%,#2d4a7a 100%)',
  'linear-gradient(150deg,#3a2d1e 0%,#7a5a3a 100%)',
  'linear-gradient(150deg,#1e3a3a 0%,#2d7a7a 100%)',
  'linear-gradient(150deg,#2d1e3a 0%,#5a3a7a 100%)',
  'linear-gradient(150deg,#3a3a1e 0%,#6a6a2d 100%)',
];

function _strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function _tripGradient(dest) {
  return TRIP_GRADIENTS[_strHash(dest || '') % TRIP_GRADIENTS.length];
}

function _planKindSVG(kind) {
  const svgs = {
    move: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6.5" width="12" height="5" rx="1.5"/><path d="M4 6.5V5a1 1 0 011-1h6a1 1 0 011 1v1.5"/><path d="M4 9.5h1.5M10.5 9.5H12"/><circle cx="5" cy="12" r="0.9" fill="currentColor" stroke="none"/><circle cx="11" cy="12" r="0.9" fill="currentColor" stroke="none"/></svg>',
    stay: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="8.5" width="12" height="4" rx="1"/><path d="M2 12.5v1M14 12.5v1"/><rect x="5" y="5.5" width="5.5" height="3" rx="1"/><path d="M2 8.5V7a1 1 0 011-1h2"/></svg>',
    see: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 2C5.24 2 3 4.24 3 7c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z"/><circle cx="8" cy="7" r="1.5"/></svg>',
    eat: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M5 2v4a2 2 0 004 0V2"/><path d="M7 6v8"/><path d="M11 2v12"/><path d="M11 2c1 1 2 2.5 2 4S11 8 11 8"/></svg>',
    memo: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/></svg>'
  };
  return svgs[kind] || svgs.memo;
}

function fmtTripDateRange(t) {
  if (!t.startDate && !t.endDate) return t.timing || '';
  const sd = new Date(t.startDate + 'T00:00:00'), ed = new Date(t.endDate + 'T00:00:00');
  const curY = new Date().getFullYear();
  const days = Math.round((ed - sd) / 86400000) + 1;
  const sPfx = sd.getFullYear() !== curY ? `${sd.getFullYear()}/` : '';
  const ePfx = ed.getFullYear() !== curY && ed.getFullYear() !== sd.getFullYear() ? `${ed.getFullYear()}/` : '';
  return `${sPfx}${sd.getMonth()+1}/${sd.getDate()}〜${ePfx}${ed.getMonth()+1}/${ed.getDate()}（${days}日間）`;
}

function _fmtDetailDateRange(t) {
  const DN = '日月火水木金土'.split('');
  if (!t.startDate && !t.endDate) return t.timing || '';
  const sd = new Date(t.startDate + 'T00:00:00'), ed = new Date(t.endDate + 'T00:00:00');
  const curY = new Date().getFullYear();
  const days = Math.round((ed - sd) / 86400000) + 1;
  const sPfx = sd.getFullYear() !== curY ? `${sd.getFullYear()}/` : '';
  const ePfx = ed.getFullYear() !== curY && ed.getFullYear() !== sd.getFullYear() ? `${ed.getFullYear()}/` : '';
  return `${sPfx}${sd.getMonth()+1}/${sd.getDate()}（${DN[sd.getDay()]}）〜${ePfx}${ed.getMonth()+1}/${ed.getDate()}（${DN[ed.getDay()]}）・${days}日間`;
}

// ── DETAILS HELPERS ──
function _getTripDetails(t) {
  const det = t.details || {};
  return { transport: det.transport || [], stay: det.stay || [], notes: det.notes || {} };
}
function _ensureTripDetails(t) {
  if (!t.details) t.details = {};
  if (!t.details.transport) t.details.transport = [];
  if (!t.details.stay) t.details.stay = [];
  if (!t.details.notes) t.details.notes = {};
  return t.details;
}
function _linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s<>"']+)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const safeUrl = esc(part);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${safeUrl}</a>`;
    }
    return esc(part).replace(/\n/g, '<br>');
  }).join('');
}

function _tripProgressSummary(t, key) {
  const det = _getTripDetails(t);
  if (key === 'transport') {
    const items = [...det.transport].sort((a, b) =>
      ((a.depDate||'9999')+(a.depTime||'99:99')).localeCompare((b.depDate||'9999')+(b.depTime||'99:99')));
    if (!items.length) return '';
    const f = items[0];
    const icon = TRANSPORT_KIND_ICONS[f.kind] || '🚆';
    let s = icon;
    if (f.name) s += ' ' + f.name;
    if (f.from || f.to) s += ' ' + [f.from, f.to].filter(Boolean).join('→');
    if (f.depDate) { const d = new Date(f.depDate+'T00:00:00'); s += ' '+(d.getMonth()+1)+'/'+d.getDate(); }
    if (f.depTime) s += ' '+f.depTime;
    if (items.length > 1) s += `（ほか${items.length-1}件）`;
    return s;
  }
  if (key === 'stay') {
    const items = [...det.stay].sort((a, b) => (a.checkIn||'9999').localeCompare(b.checkIn||'9999'));
    if (!items.length) return '';
    const f = items[0];
    let s = '🏨';
    if (f.name) s += ' '+f.name;
    if (f.checkIn) {
      const ci = new Date(f.checkIn+'T00:00:00');
      s += ' '+(ci.getMonth()+1)+'/'+ci.getDate();
      if (f.checkOut) { const co = new Date(f.checkOut+'T00:00:00'); s += '〜'+(co.getMonth()+1)+'/'+co.getDate(); }
    }
    return s;
  }
  const noteText = (det.notes[key] || '').trim();
  if (!noteText) return '';
  const line = noteText.split('\n')[0];
  return line.length > 40 ? line.slice(0,40)+'…' : line;
}

// ── PROGRESS HELPERS ──
function _tripAutoProgress(t) {
  const plan = t.plan || [];
  const det = _getTripDetails(t);
  return {
    schedule:  !!(t.startDate && t.endDate) || !!(det.notes.schedule && det.notes.schedule.trim()),
    transport: plan.some(p => p.kind === 'move') || det.transport.length > 0,
    stay:      plan.some(p => p.kind === 'stay') || det.stay.length > 0,
    budget:    t.budget != null || !!(det.notes.budget && det.notes.budget.trim()),
    food:      plan.some(p => p.kind === 'eat' || p.kind === 'see') || !!(det.notes.food && det.notes.food.trim()),
    theme:     !!(det.notes.theme && det.notes.theme.trim()),
    route:     !!(det.notes.route && det.notes.route.trim()),
    prep:      !!(det.notes.prep && det.notes.prep.trim()),
  };
}

function _tripIsDone(t, key) {
  const auto = _tripAutoProgress(t);
  const manual = t.progress || {};
  if (auto[key]) return true;
  return !!manual[key];
}

function _tripDoneCount(t) {
  return PROGRESS_STEPS.filter(s => _tripIsDone(t, s.key)).length;
}

// ── LIST VIEW: NEW TRIP ──
function openNewTripModal() {
  tripModalId = null;
  document.getElementById('tripModalTitle').textContent = '旅を追加';
  document.getElementById('tripModalDest').value = '';
  document.getElementById('tripModalPlace').value = '';
  document.getElementById('tripModalStart').value = '';
  document.getElementById('tripModalEnd').value = '';
  document.getElementById('tripModalTiming').value = '';
  document.getElementById('tripModalBudget').value = '';
  document.getElementById('tripModalStatus').value = '検討中';
  document.getElementById('tripModalDesc').value = '';
  document.getElementById('tripModalNote').value = '';
  document.getElementById('tripModalDelWrap').innerHTML = '';
  _updateTripModalCoverPreview(null);
  document.getElementById('tripModal').classList.add('open');
  setTimeout(() => document.getElementById('tripModalDest').focus(), 50);
}

// ── EDIT MODAL ──
function openTripModal(id) {
  const t = trips.find(t => String(t.id) === String(id)); if (!t) return;
  tripModalId = String(t.id);
  document.getElementById('tripModalTitle').textContent = '旅行を編集';
  document.getElementById('tripModalDest').value = t.dest || '';
  document.getElementById('tripModalPlace').value = t.place || '';
  document.getElementById('tripModalStart').value = t.startDate || '';
  document.getElementById('tripModalEnd').value = t.endDate || '';
  document.getElementById('tripModalTiming').value = t.timing || '';
  document.getElementById('tripModalBudget').value = t.budget != null ? t.budget : '';
  document.getElementById('tripModalStatus').value = t.status || '検討中';
  document.getElementById('tripModalDesc').value = t.description || '';
  document.getElementById('tripModalNote').value = t.note || '';
  document.getElementById('tripModalDelWrap').innerHTML = `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="confirmDelTripModal();event.stopPropagation()">削除</button>`;
  _updateTripModalCoverPreview(t);
  document.getElementById('tripModal').classList.add('open');
}

function _updateTripModalCoverPreview(t) {
  const preview = document.getElementById('tripModalCoverPreview');
  const fromPhotosBtn = document.getElementById('tripModalCoverFromPhotosBtn');
  const clearBtn = document.getElementById('tripModalCoverClearBtn');
  const hasCover = t && t.coverPhoto && t.coverPhoto.path;
  const hasPhotos = t && (t.photos || []).length > 0;
  if (hasCover) {
    preview.innerHTML = `<img data-path="${esc(t.coverPhoto.path)}" class="tv-cover-preview-img" src="" alt="">`;
    fillSignedUrls(preview);
    clearBtn.style.display = '';
  } else {
    preview.innerHTML = '';
    clearBtn.style.display = 'none';
  }
  if (fromPhotosBtn) fromPhotosBtn.style.display = hasPhotos ? '' : 'none';
}

function closeTripModal() {
  document.getElementById('tripModal').classList.remove('open');
  tripModalId = null;
}

function saveTripModal() {
  const dest = document.getElementById('tripModalDest').value.trim();
  if (!dest) { document.getElementById('tripModalDest').focus(); return; }
  let sd = document.getElementById('tripModalStart').value;
  let ed = document.getElementById('tripModalEnd').value;
  if (sd && ed && ed < sd) { document.getElementById('tripModalEnd').focus(); return; }
  if (!sd && ed) sd = ed;

  if (tripModalId) {
    // Edit existing
    const t = trips.find(t => String(t.id) === tripModalId); if (!t) return;
    t.dest = dest;
    t.place = document.getElementById('tripModalPlace').value.trim() || null;
    t.startDate = sd || null; t.endDate = ed || null;
    t.timing = document.getElementById('tripModalTiming').value.trim();
    const b = document.getElementById('tripModalBudget').value;
    t.budget = b ? parseFloat(b) : null;
    t.status = document.getElementById('tripModalStatus').value;
    t.description = document.getElementById('tripModalDesc').value.trim() || null;
    t.note = document.getElementById('tripModalNote').value.trim();
  } else {
    // Create new
    const b = document.getElementById('tripModalBudget').value;
    trips.push({
      id: crypto.randomUUID(), dest,
      place: document.getElementById('tripModalPlace').value.trim() || null,
      timing: document.getElementById('tripModalTiming').value.trim(),
      startDate: sd || null, endDate: ed || null,
      budget: b ? parseFloat(b) : null,
      status: document.getElementById('tripModalStatus').value,
      description: document.getElementById('tripModalDesc').value.trim() || null,
      note: document.getElementById('tripModalNote').value.trim(),
      plan: [], review: { rating: 0, text: '', updatedAt: null }, photos: [],
      progress: {}, todos: []
    });
  }
  saveTrips(); closeTripModal(); renderTravel();
}

function confirmDelTripModal() {
  if (!tripModalId) return;
  document.getElementById('tripModalDelWrap').innerHTML = `<span class="ldr-del-confirm">削除しますか?</span><button class="btn btn-ghost btn-sm" style="color:var(--accent);margin-left:8px;" onclick="execDelTripModal();event.stopPropagation()">はい</button>`;
}

function execDelTripModal() {
  if (!tripModalId) return;
  if (_currentTripId === tripModalId) _currentTripId = null;
  if (_progressTripId === tripModalId) _progressTripId = null;
  trips = trips.filter(t => String(t.id) !== tripModalId);
  saveTrips(); closeTripModal(); renderTravel();
}

function setTripStatus(id, status) {
  const t = trips.find(t => String(t.id) === String(id));
  if (t) { t.status = status; saveTrips(); renderTravel(); }
}

function delTrip(id) {
  trips = trips.filter(t => String(t.id) !== String(id));
  if (_currentTripId === String(id)) _currentTripId = null;
  if (_progressTripId === String(id)) _progressTripId = null;
  saveTrips();
  renderTravel();
}

function saveTrips() { localStorage.setItem('hd_trips', JSON.stringify(trips)); saveToSupabase(); }

// ── STATUS MENU ──
function toggleStatusMenu(id, el) {
  event.stopPropagation();
  const existing = document.getElementById('tvStatusMenu');
  if (existing) {
    existing.remove();
    if (_statusMenuTripId === String(id)) { _statusMenuTripId = null; return; }
  }
  _statusMenuTripId = String(id);
  const menu = document.createElement('div');
  menu.id = 'tvStatusMenu';
  menu.className = 'tv-status-menu';
  menu.onclick = e => e.stopPropagation();
  const statuses = ['検討中','計画中','予約済み','完了'];
  menu.innerHTML = statuses.map(s =>
    `<button class="tv-status-menu-item" onclick="setTripStatus('${esc(String(id))}','${esc(s)}');closeStatusMenu()">${esc(s)}</button>`
  ).join('');
  el.parentElement.style.position = 'relative';
  el.parentElement.appendChild(menu);
  const closeOnClick = () => { closeStatusMenu(); document.removeEventListener('click', closeOnClick); };
  setTimeout(() => document.addEventListener('click', closeOnClick), 0);
}

function closeStatusMenu() {
  const m = document.getElementById('tvStatusMenu');
  if (m) m.remove();
  _statusMenuTripId = null;
}

// ── PROGRESS ──
function toggleProgressStep(tripId, key) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (!t.progress) t.progress = {};
  t.progress[key] = !t.progress[key];
  saveTrips();
  _renderTvProgress(trips.filter(t => !t.isIdea));
}

function switchProgressTrip(id) {
  _progressTripId = String(id);
  _renderTvProgress(trips.filter(t => !t.isIdea));
}

// ── TODOS ──
function openTripTodosModal() {
  _renderTripTodosModalBody();
  document.getElementById('tripTodosModal').classList.add('open');
}

function closeTripTodosModal() {
  document.getElementById('tripTodosModal').classList.remove('open');
}

function _renderTripTodosModalBody() {
  const realTrips = trips.filter(t => !t.isIdea && t.status !== '完了');
  const body = document.getElementById('tripTodosModalBody');
  if (!body) return;

  const allTodos = [];
  realTrips.forEach(t => {
    (t.todos || []).forEach(td => {
      allTodos.push({ todo: td, trip: t });
    });
  });

  if (!allTodos.length) {
    body.innerHTML = '<div style="color:var(--ink3);font-family:\'Space Grotesk\',sans-serif;font-size:14px;padding:8px 0">まだ追加されていません。</div>';
    return;
  }

  const priOrder = { high: 0, mid: 1, low: 2 };
  allTodos.sort((a, b) => {
    const po = (priOrder[a.todo.priority] || 1) - (priOrder[b.todo.priority] || 1);
    if (po !== 0) return po;
    const ad = a.todo.due || 'zzzz', bd = b.todo.due || 'zzzz';
    return ad.localeCompare(bd);
  });

  const undone = allTodos.filter(x => !x.todo.done);
  const done = allTodos.filter(x => x.todo.done);

  let html = '';
  if (undone.length) {
    html += '<div class="tv-todos-modal-group-lbl">未完了</div>';
    html += undone.map(({ todo, trip }) => _todoModalRowHTML(todo, trip)).join('');
  }
  if (done.length) {
    html += '<div class="tv-todos-modal-group-lbl" style="margin-top:16px">完了済み</div>';
    html += done.map(({ todo, trip }) => _todoModalRowHTML(todo, trip)).join('');
  }
  body.innerHTML = html;
}

function _todoModalRowHTML(todo, trip) {
  const tid = esc(String(trip.id));
  const tdid = esc(String(todo.id));
  const priColors = { high: 'rgba(220,38,38,0.1)', mid: 'rgba(202,138,4,0.1)', low: 'rgba(107,114,128,0.1)' };
  const priText = { high: '最優先', mid: '優先', low: '通常' };
  const priColor = priColors[todo.priority] || priColors.low;
  const priLabel = priText[todo.priority] || '通常';
  return `<div class="tv-todo-modal-row${todo.done ? ' done' : ''}">
    <button class="tv-todo-done-btn" onclick="toggleTripTodoDone('${tid}','${tdid}');event.stopPropagation()" title="${todo.done ? '取り消す' : '完了にする'}">
      ${todo.done ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--accent)" stroke="none"/><path d="M4.5 8l2.5 2.5L11.5 5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--rule)" stroke-width="1.5"/></svg>'}
    </button>
    <div class="tv-todo-modal-body">
      <div class="tv-todo-modal-title">${esc(todo.title)}</div>
      <div class="tv-todo-modal-meta">
        <span class="tv-todo-priority-pill" style="background:${priColor}">${esc(priLabel)}</span>
        <span style="color:var(--ink3);font-size:11px">${esc(trip.dest)}</span>
        ${todo.due ? `<span style="color:var(--ink3);font-size:11px">📅 ${esc(todo.due)}</span>` : ''}
      </div>
      ${todo.note ? `<div style="font-size:12px;color:var(--ink3);margin-top:2px">${esc(todo.note)}</div>` : ''}
    </div>
    <button class="tv-todo-edit-btn" onclick="openTripTodoEditModal('${tdid}','${tid}');event.stopPropagation()" title="編集">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M11 2l3 3L7 12H4v-3z"/></svg>
    </button>
  </div>`;
}

function openTripTodoEditModal(todoId, tripId) {
  const realTrips = trips.filter(t => !t.isIdea && t.status !== '完了');
  const sel = document.getElementById('todoEditTrip');
  sel.innerHTML = realTrips.map(t => `<option value="${esc(String(t.id))}">${esc(t.dest)}</option>`).join('');

  if (todoId) {
    _todoEditId = String(todoId);
    // find the trip
    let foundTrip = null, foundTodo = null;
    if (tripId) {
      foundTrip = trips.find(t => String(t.id) === String(tripId));
      if (foundTrip) foundTodo = (foundTrip.todos || []).find(td => String(td.id) === String(todoId));
    }
    if (!foundTodo) {
      trips.forEach(t => { const td = (t.todos || []).find(td => String(td.id) === String(todoId)); if (td) { foundTodo = td; foundTrip = t; } });
    }
    _todoEditTripId = foundTrip ? String(foundTrip.id) : null;
    document.getElementById('tripTodoEditTitle').textContent = 'Todoを編集';
    if (foundTrip) sel.value = String(foundTrip.id);
    document.getElementById('todoEditTitle').value = foundTodo ? foundTodo.title : '';
    document.getElementById('todoEditNote').value = foundTodo ? (foundTodo.note || '') : '';
    document.getElementById('todoEditPriority').value = foundTodo ? (foundTodo.priority || 'mid') : 'mid';
    document.getElementById('todoEditDue').value = foundTodo ? (foundTodo.due || '') : '';
    document.getElementById('tripTodoEditDelWrap').innerHTML = `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="deleteTripTodo('${esc(String(foundTrip ? foundTrip.id : ''))}','${esc(String(todoId))}');event.stopPropagation()">削除</button>`;
  } else {
    _todoEditId = null;
    _todoEditTripId = tripId ? String(tripId) : (realTrips[0] ? String(realTrips[0].id) : null);
    document.getElementById('tripTodoEditTitle').textContent = 'Todoを追加';
    if (_todoEditTripId) sel.value = _todoEditTripId;
    document.getElementById('todoEditTitle').value = '';
    document.getElementById('todoEditNote').value = '';
    document.getElementById('todoEditPriority').value = 'mid';
    document.getElementById('todoEditDue').value = '';
    document.getElementById('tripTodoEditDelWrap').innerHTML = '';
  }
  document.getElementById('tripTodoEditModal').classList.add('open');
  setTimeout(() => document.getElementById('todoEditTitle').focus(), 50);
}

function closeTripTodoEditModal() {
  document.getElementById('tripTodoEditModal').classList.remove('open');
  _todoEditId = null; _todoEditTripId = null;
}

function saveTripTodoEdit() {
  const title = document.getElementById('todoEditTitle').value.trim();
  if (!title) { document.getElementById('todoEditTitle').focus(); return; }
  const selectedTripId = document.getElementById('todoEditTrip').value;
  const t = trips.find(t => String(t.id) === String(selectedTripId)); if (!t) return;
  if (!t.todos) t.todos = [];

  if (_todoEditId) {
    // If trip changed, move the todo
    const oldTripId = _todoEditTripId;
    if (oldTripId && String(oldTripId) !== String(selectedTripId)) {
      const oldTrip = trips.find(t => String(t.id) === String(oldTripId));
      if (oldTrip) oldTrip.todos = (oldTrip.todos || []).filter(td => String(td.id) !== _todoEditId);
    }
    const existIdx = t.todos.findIndex(td => String(td.id) === _todoEditId);
    const item = {
      id: _todoEditId, title,
      note: document.getElementById('todoEditNote').value.trim(),
      priority: document.getElementById('todoEditPriority').value,
      due: document.getElementById('todoEditDue').value || '',
      done: existIdx >= 0 ? t.todos[existIdx].done : false
    };
    if (existIdx >= 0) t.todos[existIdx] = item; else t.todos.push(item);
  } else {
    t.todos.push({
      id: crypto.randomUUID(), title,
      note: document.getElementById('todoEditNote').value.trim(),
      priority: document.getElementById('todoEditPriority').value,
      due: document.getElementById('todoEditDue').value || '',
      done: false
    });
  }
  saveTrips();
  closeTripTodoEditModal();
  // If todos modal is open, refresh it
  if (document.getElementById('tripTodosModal').classList.contains('open')) _renderTripTodosModalBody();
  renderTravel();
}

function toggleTripTodoDone(tripId, todoId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const todo = (t.todos || []).find(td => String(td.id) === String(todoId)); if (!todo) return;
  todo.done = !todo.done;
  saveTrips();
  if (document.getElementById('tripTodosModal').classList.contains('open')) _renderTripTodosModalBody();
  renderTravel();
}

function deleteTripTodo(tripId, todoId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  t.todos = (t.todos || []).filter(td => String(td.id) !== String(todoId));
  saveTrips();
  closeTripTodoEditModal();
  if (document.getElementById('tripTodosModal').classList.contains('open')) _renderTripTodosModalBody();
  renderTravel();
}

// Complete a todo from the card ("決める" button)
async function completeTripTodoDirect(tripId, todoId) {
  if (!(await uiConfirm('このタスクを完了にしますか？', { title: '完了にする' }))) return;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const todo = (t.todos || []).find(td => String(td.id) === String(todoId)); if (!todo) return;
  todo.done = true;
  saveTrips();
  renderTravel();
}

// ── IDEA MODAL ──
function openIdeaModal(id) {
  if (id) {
    _ideaModalId = String(id);
    const idea = trips.find(t => String(t.id) === String(id) && t.isIdea);
    if (!idea) return;
    document.getElementById('ideaModalTitle').textContent = 'アイデアを編集';
    document.getElementById('ideaTitle').value = idea.dest || '';
    document.getElementById('ideaPlace').value = idea.place || '';
    document.getElementById('ideaNote').value = idea.note || '';
    document.getElementById('ideaUrl').value = (idea.plan && idea.plan[0] && idea.plan[0].url) ? idea.plan[0].url : '';
    document.getElementById('ideaModalDelWrap').innerHTML = `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="deleteIdea();event.stopPropagation()">削除</button>`;
    document.getElementById('ideaConvertBtn').style.display = '';
    _updateIdeaCoverPreview(idea);
  } else {
    _ideaModalId = null;
    document.getElementById('ideaModalTitle').textContent = 'アイデアを追加';
    document.getElementById('ideaTitle').value = '';
    document.getElementById('ideaPlace').value = '';
    document.getElementById('ideaNote').value = '';
    document.getElementById('ideaUrl').value = '';
    document.getElementById('ideaModalDelWrap').innerHTML = '';
    document.getElementById('ideaConvertBtn').style.display = 'none';
    _updateIdeaCoverPreview(null);
  }
  document.getElementById('tripIdeaModal').classList.add('open');
  setTimeout(() => document.getElementById('ideaTitle').focus(), 50);
}

function _updateIdeaCoverPreview(idea) {
  const preview = document.getElementById('ideaCoverPreview');
  const clearBtn = document.getElementById('ideaCoverClearBtn');
  const hasCover = idea && idea.coverPhoto && idea.coverPhoto.path;
  if (hasCover) {
    preview.innerHTML = `<img data-path="${esc(idea.coverPhoto.path)}" class="tv-cover-preview-img" src="" alt="">`;
    fillSignedUrls(preview);
    clearBtn.style.display = '';
  } else {
    preview.innerHTML = '';
    clearBtn.style.display = 'none';
  }
}

function closeIdeaModal() {
  document.getElementById('tripIdeaModal').classList.remove('open');
  _ideaModalId = null;
}

function saveIdeaModal() {
  const title = document.getElementById('ideaTitle').value.trim();
  if (!title) { document.getElementById('ideaTitle').focus(); return; }
  const url = document.getElementById('ideaUrl').value.trim();

  if (_ideaModalId) {
    const idea = trips.find(t => String(t.id) === _ideaModalId && t.isIdea); if (!idea) return;
    idea.dest = title;
    idea.place = document.getElementById('ideaPlace').value.trim() || null;
    idea.note = document.getElementById('ideaNote').value.trim();
    if (url) {
      if (!idea.plan) idea.plan = [];
      if (idea.plan.length > 0) idea.plan[0].url = url; else idea.plan.push({ id: crypto.randomUUID(), url, kind: 'memo', title: 'リンク', date: null, time: '', place: '', note: '' });
    }
  } else {
    trips.push({
      id: crypto.randomUUID(), dest: title, isIdea: true,
      place: document.getElementById('ideaPlace').value.trim() || null,
      note: document.getElementById('ideaNote').value.trim(),
      plan: url ? [{ id: crypto.randomUUID(), url, kind: 'memo', title: 'リンク', date: null, time: '', place: '', note: '' }] : [],
      photos: [], review: { rating: 0, text: '', updatedAt: null },
      status: null, startDate: null, endDate: null, budget: null, timing: ''
    });
  }
  saveTrips(); closeIdeaModal(); renderTravel();
}

function deleteIdea() {
  if (!_ideaModalId) return;
  trips = trips.filter(t => String(t.id) !== _ideaModalId);
  saveTrips(); closeIdeaModal(); renderTravel();
}

function convertIdeaToTrip() {
  if (!_ideaModalId) return;
  const idea = trips.find(t => String(t.id) === _ideaModalId && t.isIdea); if (!idea) return;
  idea.isIdea = false;
  idea.status = '検討中';
  idea.plan = [];
  if (!idea.todos) idea.todos = [];
  if (!idea.progress) idea.progress = {};
  saveTrips(); closeIdeaModal();
  openTripDetail(idea.id);
  renderTravel();
}

// ── COVER PHOTO ──
function openTripCoverInput() {
  _coverUploadFor = 'trip';
  document.getElementById('tripCoverInput').click();
}

function openIdeaCoverInput() {
  _coverUploadFor = 'idea';
  document.getElementById('ideaCoverInput').click();
}

function clearTripCover() {
  if (!tripModalId) return;
  const t = trips.find(t => String(t.id) === tripModalId); if (!t) return;
  t.coverPhoto = null;
  saveTrips();
  _updateTripModalCoverPreview(t);
}

function clearIdeaCover() {
  if (!_ideaModalId) return;
  const idea = trips.find(t => String(t.id) === _ideaModalId); if (!idea) return;
  idea.coverPhoto = null;
  saveTrips();
  _updateIdeaCoverPreview(idea);
}

async function handleTripCoverUpload(files, forWhat) {
  const errEl = document.getElementById(forWhat === 'idea' ? 'ideaCoverError' : 'tripModalCoverError');
  if (errEl) errEl.textContent = '';
  if (!files || !files.length) return;
  const file = files[0];
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('ログインが必要です');
    const targetId = forWhat === 'idea' ? _ideaModalId : tripModalId;
    if (!targetId) throw new Error('対象が見つかりません');
    const t = trips.find(t => String(t.id) === String(targetId));
    if (!t) throw new Error('対象が見つかりません');
    const blob = await resizeFoodImage(file);
    const photoId = crypto.randomUUID();
    const path = `${user.id}/trips/${targetId}/cover-${photoId}.jpg`;
    const { error } = await sb.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    // Remove old cover from storage if exists
    if (t.coverPhoto && t.coverPhoto.path) {
      try { await sb.storage.from('meal-photos').remove([t.coverPhoto.path]); } catch (e) {}
      delete _signedUrlCache[t.coverPhoto.path];
    }
    t.coverPhoto = { path };
    saveTrips();
    if (forWhat === 'idea') _updateIdeaCoverPreview(t);
    else _updateTripModalCoverPreview(t);
  } catch (e) {
    if (errEl) errEl.textContent = e.message || 'アップロード失敗';
  }
}

function openCoverPickModal() {
  if (!tripModalId) return;
  _coverPickTripId = tripModalId;
  const t = trips.find(t => String(t.id) === tripModalId); if (!t) return;
  const body = document.getElementById('coverPickModalBody');
  const photos = t.photos || [];
  if (!photos.length) { body.innerHTML = '<p style="color:var(--ink3);font-size:14px">記録の写真がありません。</p>'; }
  else {
    body.innerHTML = `<div class="tv-cover-pick-grid">${photos.map((p, i) =>
      `<div class="tv-cover-pick-thumb" onclick="selectCoverFromPhotos('${esc(String(p.id))}');event.stopPropagation()">
        <img data-path="${esc(p.path)}" src="" alt="">
        ${p.caption ? `<div class="tv-cover-pick-cap">${esc(p.caption)}</div>` : ''}
      </div>`
    ).join('')}</div>`;
    fillSignedUrls(body);
  }
  document.getElementById('tripCoverPickModal').classList.add('open');
}

function closeCoverPickModal() {
  document.getElementById('tripCoverPickModal').classList.remove('open');
  _coverPickTripId = null;
}

function selectCoverFromPhotos(photoId) {
  if (!_coverPickTripId) return;
  const t = trips.find(t => String(t.id) === _coverPickTripId); if (!t) return;
  const photo = (t.photos || []).find(p => String(p.id) === String(photoId)); if (!photo) return;
  t.coverPhoto = { path: photo.path };
  saveTrips();
  _updateTripModalCoverPreview(t);
  closeCoverPickModal();
}

// ── DETAIL NAVIGATION ──
function openTripDetail(id) {
  _currentTripId = String(id);
  const t = trips.find(t => String(t.id) === _currentTripId);
  if (t) _travelSubView = (t.status === '完了') ? 'review' : 'plan';
  renderTravel();
}

function closeTripDetail() {
  _currentTripId = null;
  renderTravel();
}

function setTravelSubView(view, el) {
  _travelSubView = view;
  document.querySelectorAll('#tripDetailSeg .ui-seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const pv = document.getElementById('tripPlanView');
  const bv = document.getElementById('tripBookingView');
  const rv = document.getElementById('tripReviewView');
  if (pv) pv.style.display = view === 'plan' ? '' : 'none';
  if (bv) bv.style.display = view === 'booking' ? '' : 'none';
  if (rv) rv.style.display = view === 'review' ? '' : 'none';
  const t = trips.find(t => String(t.id) === _currentTripId);
  if (!t) return;
  if (view === 'plan') _renderTripPlan(t);
  else if (view === 'booking') _renderTripBooking(t);
  else _renderTripReview(t);
}

// ── PLAN ITEM MODAL ──
function openPlanItemModal(tripId, itemId, prefillDate) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  _planItemTripId = String(tripId);
  _planItemModalId = itemId ? String(itemId) : null;

  const DN = '日月火水木金土'.split('');
  const dateSelect = document.getElementById('planItemDate');
  const opts = [];
  if (t.startDate && t.endDate) {
    const sdObj = new Date(t.startDate + 'T00:00:00');
    const edObj = new Date(t.endDate + 'T00:00:00');
    let dayNum = 0;
    for (let d = new Date(sdObj); d <= edObj; d.setDate(d.getDate() + 1)) {
      dayNum++;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      opts.push(`<option value="${esc(ds)}">${dayNum}日目 ${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）</option>`);
    }
  }
  opts.push('<option value="">日付未定</option>');
  dateSelect.innerHTML = opts.join('');

  document.getElementById('tripPlanModalTitle').textContent = itemId ? '予定を編集' : '予定を追加';

  if (itemId) {
    const item = (t.plan || []).find(p => String(p.id) === String(itemId));
    if (item) {
      dateSelect.value = item.date || '';
      document.getElementById('planItemTime').value = item.time || '';
      document.getElementById('planItemKind').value = item.kind || 'see';
      document.getElementById('planItemTitle').value = item.title || '';
      document.getElementById('planItemPlace').value = item.place || '';
      document.getElementById('planItemUrl').value = item.url || '';
      document.getElementById('planItemNote').value = item.note || '';
    }
    document.getElementById('planItemDelWrap').innerHTML = `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="confirmDelPlanItem();event.stopPropagation()">削除</button>`;
  } else {
    if (prefillDate !== undefined) dateSelect.value = prefillDate || '';
    document.getElementById('planItemTime').value = '';
    document.getElementById('planItemKind').value = 'see';
    document.getElementById('planItemTitle').value = '';
    document.getElementById('planItemPlace').value = '';
    document.getElementById('planItemUrl').value = '';
    document.getElementById('planItemNote').value = '';
    document.getElementById('planItemDelWrap').innerHTML = '';
  }

  document.getElementById('tripPlanModal').classList.add('open');
  setTimeout(() => document.getElementById('planItemTitle').focus(), 50);
}

function closePlanItemModal() {
  document.getElementById('tripPlanModal').classList.remove('open');
  _planItemTripId = null;
  _planItemModalId = null;
}

function savePlanItem() {
  if (!_planItemTripId) return;
  const t = trips.find(t => String(t.id) === _planItemTripId); if (!t) return;
  const title = document.getElementById('planItemTitle').value.trim();
  if (!title) { document.getElementById('planItemTitle').focus(); return; }
  if (!t.plan) t.plan = [];
  const item = {
    id: _planItemModalId || crypto.randomUUID(),
    date: document.getElementById('planItemDate').value || null,
    time: document.getElementById('planItemTime').value || '',
    kind: document.getElementById('planItemKind').value || 'see',
    title,
    place: document.getElementById('planItemPlace').value.trim(),
    url: document.getElementById('planItemUrl').value.trim(),
    note: document.getElementById('planItemNote').value.trim()
  };
  if (_planItemModalId) {
    const idx = t.plan.findIndex(p => String(p.id) === _planItemModalId);
    if (idx >= 0) t.plan[idx] = item; else t.plan.push(item);
  } else {
    t.plan.push(item);
  }
  saveTrips();
  closePlanItemModal();
  _renderTripPlan(t);
}

function confirmDelPlanItem() {
  document.getElementById('planItemDelWrap').innerHTML = `<span class="ldr-del-confirm">削除しますか?</span><button class="btn btn-ghost btn-sm" style="color:var(--accent);margin-left:8px;" onclick="execDelPlanItem();event.stopPropagation()">はい</button>`;
}

function execDelPlanItem() {
  if (!_planItemTripId || !_planItemModalId) return;
  const t = trips.find(t => String(t.id) === _planItemTripId); if (!t) return;
  t.plan = (t.plan || []).filter(p => String(p.id) !== _planItemModalId);
  saveTrips();
  closePlanItemModal();
  _renderTripPlan(t);
}

// ── REVIEW ──
function setTripRating(tripId, rating) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (!t.review) t.review = { rating: 0, text: '', updatedAt: null };
  t.review.rating = (t.review.rating === rating) ? 0 : rating;
  t.review.updatedAt = new Date().toISOString();
  saveTrips();
  const stars = document.querySelectorAll('#tripReviewView .trip-star-btn');
  stars.forEach((btn, i) => btn.classList.toggle('active', i + 1 <= t.review.rating));
}

function saveTripReviewText(tripId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const ta = document.getElementById(`tripReviewTa-${tripId}`);
  if (!ta) return;
  if (!t.review) t.review = { rating: 0, text: '', updatedAt: null };
  t.review.text = ta.value;
  t.review.updatedAt = new Date().toISOString();
  saveTrips();
}

// ── PHOTOS ──
function openTripPhotoInput(tripId) {
  _tripPhotoTargetId = String(tripId);
  document.getElementById('tripPhotoInput').click();
}

async function handleTripPhotoUpload(files) {
  const tripId = _tripPhotoTargetId;
  const photoDate = _tripPhotoTargetDate; // capture before any async
  _tripPhotoTargetDate = null;            // clear immediately
  if (!tripId || !files || !files.length) return;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (!t.photos) t.photos = [];
  const errors = [];
  _tripPhotoUploading++;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('ログインが必要です');
    for (const file of Array.from(files)) {
      try {
        const blob = await resizeFoodImage(file);
        const photoId = crypto.randomUUID();
        const path = `${user.id}/trips/${tripId}/${photoId}.jpg`;
        const { error } = await sb.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        t.photos.push({ id: photoId, path, date: photoDate || t.startDate || null, caption: '' });
      } catch (e) {
        errors.push(`${file.name}: ${e.message || 'アップロード失敗'}`);
      }
    }
  } catch (e) {
    errors.push(e.message || 'アップロード失敗');
  }
  _tripPhotoUploading--;
  saveTrips();
  if (_currentTripId === String(tripId) && _travelSubView === 'review') {
    _renderTripReview(t);
    if (errors.length) {
      const errEl = document.getElementById('tripPhotoError');
      if (errEl) errEl.textContent = `エラー: ${errors.join(' / ')}`;
    }
  } else if (_currentTripId === String(tripId)) {
    const errEl = document.getElementById('tripPhotoError');
    if (errEl) errEl.textContent = errors.length ? `エラー: ${errors.join(' / ')}` : '';
    const wrap = document.getElementById(`tripPhotosWrap-${tripId}`);
    if (wrap) { wrap.innerHTML = _renderTripPhotosHTML(t); fillSignedUrls(wrap); }
  }
}

async function deleteTripPhoto(tripId, photoId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t || !t.photos) return;
  const photo = t.photos.find(p => String(p.id) === String(photoId)); if (!photo) return;
  if (!(await uiConfirm('この写真を削除しますか？', { title: '写真の削除', danger: true }))) return;
  try { await sb.storage.from('meal-photos').remove([photo.path]); } catch (e) {}
  delete _signedUrlCache[photo.path];
  t.photos = t.photos.filter(p => String(p.id) !== String(photoId));
  saveTrips();
  if (_currentTripId === String(tripId) && _travelSubView === 'review') {
    _renderTripReview(t);
  } else {
    const wrap = document.getElementById(`tripPhotosWrap-${tripId}`);
    if (wrap) { wrap.innerHTML = _renderTripPhotosHTML(t); fillSignedUrls(wrap); }
  }
}

function setTripPhotoDate(tripId, photoId, date) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t || !t.photos) return;
  const photo = t.photos.find(p => String(p.id) === String(photoId)); if (!photo) return;
  photo.date = date || null;
  saveTrips();
  if (_currentTripId === String(tripId) && _travelSubView === 'review') {
    _renderTripReview(t);
  } else {
    const wrap = document.getElementById(`tripPhotosWrap-${tripId}`);
    if (wrap) { wrap.innerHTML = _renderTripPhotosHTML(t); fillSignedUrls(wrap); }
  }
}

function saveTripPhotoCaption(tripId, photoId, caption) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t || !t.photos) return;
  const photo = t.photos.find(p => String(p.id) === String(photoId)); if (!photo) return;
  photo.caption = (caption || '').trim();
  saveTrips();
}

function openTripPhotoLightbox(tripId, photoIndex) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  openFoodLightbox((t.photos || []).map(p => p.path), photoIndex);
}

function tripPhotoDragOver(e) {
  if (!Array.from((e.dataTransfer ? e.dataTransfer.types : null) || []).includes('Files')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  e.currentTarget.classList.add('drag-over');
}

function tripPhotoDragLeave(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return;
  e.currentTarget.classList.remove('drag-over');
}

function tripPhotoDrop(e, tripId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) return;
  _tripPhotoTargetId = String(tripId);
  handleTripPhotoUpload(files);
}

// ── RENDER HELPERS ──
function _buildTripDateOptions(t, selectedDate) {
  const DN = '日月火水木金土'.split('');
  const opts = [];
  if (t.startDate && t.endDate) {
    const sdObj = new Date(t.startDate + 'T00:00:00');
    const edObj = new Date(t.endDate + 'T00:00:00');
    let dayNum = 0;
    for (let d = new Date(sdObj); d <= edObj; d.setDate(d.getDate() + 1)) {
      dayNum++;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const sel = ds === selectedDate ? ' selected' : '';
      opts.push(`<option value="${esc(ds)}"${sel}>${dayNum}日目 ${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）</option>`);
    }
  }
  const unsel = (!selectedDate || selectedDate === '') ? ' selected' : '';
  opts.push(`<option value=""${unsel}>日付未定</option>`);
  return opts.join('');
}

function _planItemHTML(t, item) {
  const tid = esc(String(t.id));
  const iid = esc(String(item.id));
  const color = PLAN_KIND_COLORS[item.kind] || '#9ca3af';
  const icon = _planKindSVG(item.kind);
  const label = PLAN_KIND_LABELS[item.kind] || item.kind;
  const isValidUrl = /^https?:\/\//.test(item.url || '');
  return `<div class="trip-plan-item" onclick="openPlanItemModal('${tid}','${iid}');event.stopPropagation()">
    <span class="trip-plan-kind-icon" style="color:${color}" title="${esc(label)}">${icon}</span>
    <span class="trip-plan-time">${item.time ? esc(item.time) : ''}</span>
    <div class="trip-plan-item-body">
      <div class="trip-plan-item-title">${esc(item.title)}</div>
      ${item.place ? `<div class="trip-plan-item-place">${esc(item.place)}</div>` : ''}
      ${isValidUrl ? `<a class="trip-plan-item-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">リンク ↗</a>` : ''}
      ${item.note ? `<div class="trip-plan-item-note">${esc(item.note)}</div>` : ''}
    </div>
  </div>`;
}

function _renderTripPhotosHTML(t) {
  const photos = t.photos || [];
  const tid = esc(String(t.id));
  if (!photos.length) return '<div class="trip-photos-empty">写真はまだありません<br><small>「写真を追加」またはここにドラッグ＆ドロップで追加できます</small></div>';
  const DN = '日月火水木金土'.split('');
  const groups = {};
  photos.forEach(p => {
    const key = p.date || '__undated__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  let html = '';
  Object.entries(groups).sort(([a], [b]) => {
    if (a === '__undated__') return 1;
    if (b === '__undated__') return -1;
    return a.localeCompare(b);
  }).forEach(([dateKey, datePhotos]) => {
    let dateLabel = dateKey === '__undated__' ? '日付未定' : (() => {
      const d = new Date(dateKey + 'T00:00:00');
      return `${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）`;
    })();
    const thumbs = datePhotos.map(p => {
      const pid = esc(String(p.id));
      const pidx = photos.indexOf(p);
      const dateOpts = _buildTripDateOptions(t, p.date || '');
      return `<div class="trip-photo-thumb">
        <img data-path="${esc(p.path)}" src="" alt="${esc(p.caption||'')}"
          onclick="event.stopPropagation();openTripPhotoLightbox('${tid}',${pidx})">
        <button class="trip-photo-del" onclick="event.stopPropagation();deleteTripPhoto('${tid}','${pid}')" title="削除">✕</button>
        <select class="trip-photo-date-sel" onclick="event.stopPropagation()" onchange="setTripPhotoDate('${tid}','${pid}',this.value)">${dateOpts}</select>
        <div class="trip-photo-caption" contenteditable="true"
          onblur="saveTripPhotoCaption('${tid}','${pid}',this.textContent)"
          onclick="event.stopPropagation()"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
        >${esc(p.caption||'')}</div>
      </div>`;
    }).join('');
    html += `<div class="trip-photo-group">
      <div class="trip-photo-date-label">${esc(dateLabel)}</div>
      <div class="trip-photo-grid">${thumbs}</div>
    </div>`;
  });
  return html;
}

function _buildAutoItems(t) {
  const det = _getTripDetails(t);
  const result = {}; // dateStr -> [{time, label, icon, sourceId, source}]
  const add = (dateStr, time, label, icon, sourceId, source) => {
    if (!result[dateStr]) result[dateStr] = [];
    result[dateStr].push({ time: time || '', label, icon, sourceId, source });
  };
  for (const tr of det.transport) {
    const icon = TRANSPORT_KIND_ICONS[tr.kind] || '🚆';
    const name = tr.name || (tr.from && tr.to ? `${tr.from}→${tr.to}` : TRANSPORT_KIND_LABELS[tr.kind] || '');
    if (tr.depDate) {
      add(tr.depDate, tr.depTime, `${name}${tr.from ? ' ('+tr.from+' 出発)' : ' 出発'}`, icon, tr.id, 'transport');
    }
    if (tr.arrDate && tr.arrDate !== tr.depDate) {
      add(tr.arrDate, tr.arrTime, `${name}${tr.to ? ' ('+tr.to+' 到着)' : ' 到着'}`, icon, tr.id, 'transport');
    }
  }
  for (const st of det.stay) {
    if (st.checkIn)  add(st.checkIn,  st.checkInTime,  `${st.name||'宿泊先'} チェックイン`,    '🏨', st.id, 'stay');
    if (st.checkOut) add(st.checkOut, st.checkOutTime, `${st.name||'宿泊先'} チェックアウト`, '🏨', st.id, 'stay');
  }
  return result;
}

function _autoItemHTML(t, autoItem) {
  const tid = esc(String(t.id));
  const sourceId = esc(String(autoItem.sourceId));
  const fn = autoItem.source === 'transport'
    ? `openTransportEditModal('${tid}','${sourceId}')`
    : `openStayEditModal('${tid}','${sourceId}')`;
  return `<div class="trip-plan-item trip-plan-auto-item" onclick="${fn};event.stopPropagation()">
    <span class="trip-plan-auto-icon">${esc(autoItem.icon)}</span>
    <span class="trip-plan-time">${autoItem.time ? esc(autoItem.time) : ''}</span>
    <div class="trip-plan-item-body">
      <div class="trip-plan-item-title trip-plan-auto-title">${esc(autoItem.label)}</div>
    </div>
  </div>`;
}

function _renderTripPlan(t) {
  const container = document.getElementById('tripPlanView'); if (!container) return;
  const DN = '日月火水木金土'.split('');
  const plan = t.plan || [];
  const tid = esc(String(t.id));
  const autoByDate = _buildAutoItems(t);
  const inPeriod = new Set();

  let html = '<div class="trip-plan">';
  if (t.startDate && t.endDate) {
    const sdObj = new Date(t.startDate + 'T00:00:00');
    const edObj = new Date(t.endDate + 'T00:00:00');
    let dayNum = 0;
    for (let d = new Date(sdObj); d <= edObj; d.setDate(d.getDate() + 1)) {
      dayNum++;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      inPeriod.add(ds);
      const manualItems = plan.filter(p => p.date === ds);
      const autoDay = autoByDate[ds] || [];
      // Merge: sort by time; no-time items go last
      const all = [
        ...manualItems.map(item => ({ ...item, _auto: false })),
        ...autoDay.map(item => ({ ...item, _auto: true }))
      ].sort((a, b) => {
        const at = a.time || '', bt = b.time || '';
        if (at && bt) return at.localeCompare(bt);
        if (at) return -1; if (bt) return 1;
        return 0;
      });
      const dayLabel = `${dayNum}日目 ${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）`;
      html += `<div class="trip-day-group">
        <div class="trip-day-hdr">
          <span class="trip-day-label">${esc(dayLabel)}</span>
          <button class="trip-plan-add-btn" onclick="openPlanItemModal('${tid}',null,'${esc(ds)}');event.stopPropagation()">＋ 予定</button>
        </div>
        <div class="trip-day-items">${
          all.length
            ? all.map(item => item._auto ? _autoItemHTML(t, item) : _planItemHTML(t, item)).join('')
            : '<div class="trip-day-empty">予定なし</div>'
        }</div>
      </div>`;
    }
  }

  // Undated manual items
  const undated = plan.filter(p => !p.date).sort((a, b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
  html += `<div class="trip-day-group trip-undated-group">
    <div class="trip-day-hdr">
      <span class="trip-day-label">日付未定のアイデア</span>
      <button class="trip-plan-add-btn" onclick="openPlanItemModal('${tid}',null,'');event.stopPropagation()">＋ アイデア</button>
    </div>
    <div class="trip-day-items">${undated.length ? undated.map(item => _planItemHTML(t, item)).join('') : '<div class="trip-day-empty">アイデアなし</div>'}</div>
  </div>`;

  // Out-of-period auto items (only if trip has defined period)
  if (t.startDate && t.endDate) {
    const oop = [];
    Object.entries(autoByDate).forEach(([ds, dayItems]) => {
      if (!inPeriod.has(ds)) dayItems.forEach(item => oop.push({ ...item, _ds: ds }));
    });
    if (oop.length) {
      oop.sort((a, b) => (a._ds+a.time).localeCompare(b._ds+b.time));
      html += `<div class="trip-day-group trip-undated-group">
        <div class="trip-day-hdr"><span class="trip-day-label">期間外の移動・宿泊</span></div>
        <div class="trip-day-items">${oop.map(item => _autoItemHTML(t, item)).join('')}</div>
      </div>`;
    }
  }

  html += '</div>';
  container.innerHTML = html;
}

// ── REVIEW: DAY CARD HELPERS ──

function _reviewDayStayAuto(t, ds) {
  const det = _getTripDetails(t);
  for (const st of det.stay) {
    if (st.checkIn && st.checkIn <= ds && (!st.checkOut || st.checkOut > ds)) {
      return st.name || '宿泊先';
    }
  }
  const planStay = (t.plan || []).find(p => p.kind === 'stay' && p.date === ds);
  if (planStay) return planStay.title || planStay.place || '宿泊先';
  return '';
}

function _reviewDayMoveAutoItems(t, ds) {
  const det = _getTripDetails(t);
  const items = [];
  for (const tr of det.transport) {
    if (tr.depDate === ds) {
      const icon = TRANSPORT_KIND_ICONS[tr.kind] || '🚆';
      let label = icon;
      if (tr.from || tr.to) label += ' ' + [tr.from, tr.to].filter(Boolean).join('→');
      if (tr.name) label += ' ' + tr.name;
      if (tr.depTime) label += ' ' + tr.depTime;
      items.push(label.trim());
    }
  }
  for (const p of (t.plan || [])) {
    if (p.kind === 'move' && p.date === ds) {
      let label = p.title || '';
      if (p.place) label += (label ? '→' : '') + p.place;
      if (p.time) label += (label ? ' ' : '') + p.time;
      items.push(label || '移動');
    }
  }
  return items;
}

function _reviewPlaceItemHTML(t, item, tid) {
  const iid = esc(String(item.id));
  const teid = esc(String(t.id));
  const kindLabel = PLAN_KIND_LABELS[item.kind] || item.kind;
  const visited = item.visited || false;
  const rating = item.rating || 0;
  const comment = item.comment || '';
  const starsHTML = [1,2,3,4,5].map(n =>
    `<button class="trip-drv-star-btn${n <= rating ? ' active' : ''}" onclick="event.stopPropagation();setPlanItemRating('${teid}','${iid}',${n})">★</button>`
  ).join('');
  return `<div class="trip-drv-place-item${visited ? ' visited' : ''}" id="trPlaceItem-${teid}-${iid}">
    <button class="trip-drv-visit-btn${visited ? ' active' : ''}" onclick="event.stopPropagation();togglePlanItemVisited('${teid}','${iid}')" title="${visited ? '訪問済み' : '未訪問'}">☑</button>
    <div class="trip-drv-place-info">
      <div class="trip-drv-place-name-row">
        <span class="trip-drv-place-name">${esc(item.title || item.place || '（名前なし）')}</span>
        <span class="trip-drv-place-kind ui-pill trip-drv-pill-${esc(item.kind)}">${esc(kindLabel)}</span>
        <button class="trip-drv-place-del" onclick="event.stopPropagation();deleteReviewPlanItem('${teid}',${jsq(item.date||'')},'${iid}')" title="削除">✕</button>
      </div>
      <div class="trip-drv-place-stars">${starsHTML}</div>
      <input class="trip-drv-place-comment" type="text" value="${esc(comment)}"
        placeholder="ひとこと…"
        onblur="savePlanItemComment('${teid}','${iid}',this.value)"
        onclick="event.stopPropagation()">
    </div>
  </div>`;
}

function _reviewDayPhotosHTML(t, ds) {
  const tid = esc(String(t.id));
  const allPhotos = t.photos || [];
  const photos = allPhotos.filter(p => p.date === ds);
  if (!photos.length) return '<div class="trip-drv-photos-empty">ここにドラッグ＆ドロップ</div>';
  return `<div class="trip-photo-grid">${photos.map(p => {
    const pid = esc(String(p.id));
    const pidx = allPhotos.indexOf(p);
    return `<div class="trip-photo-thumb">
      <img data-path="${esc(p.path)}" src="" alt="${esc(p.caption||'')}"
        onclick="event.stopPropagation();openTripPhotoLightbox('${tid}',${pidx})">
      <button class="trip-photo-del" onclick="event.stopPropagation();deleteTripPhoto('${tid}','${pid}')" title="削除">✕</button>
      <div class="trip-photo-caption" contenteditable="true"
        onblur="saveTripPhotoCaption('${tid}','${pid}',this.textContent)"
        onclick="event.stopPropagation()"
        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
      >${esc(p.caption||'')}</div>
    </div>`;
  }).join('')}</div>`;
}

function _reviewMealItemHTML(meal) {
  const mid = esc(String(meal.id));
  const dishes = (meal.sittings || []).flatMap(s => {
    const kindLabel = (typeof KIND_LABELS !== 'undefined' && KIND_LABELS[s.kind]) || s.kind;
    return (s.dishes || []).filter(d => d.name).map(d => {
      let label = kindLabel + ' ' + d.name;
      if (d.type === 'out' && d.place) label += '（' + d.place + '）';
      return label;
    });
  });
  const text = dishes.length ? dishes.join('、') : '（記録あり）';
  return `<div class="trip-drv-meal-item" onclick="event.stopPropagation();openFoodDetailPopup('${mid}')">${esc(text)}</div>`;
}

function _reviewBuyItemHTML(t, ds, buy, tid) {
  const bid = esc(String(buy.id));
  return `<div class="trip-drv-buy-item">
    <span class="trip-drv-buy-name">${esc(buy.name)}</span>
    ${buy.note ? `<span class="trip-drv-buy-note">${esc(buy.note)}</span>` : ''}
    <button class="trip-drv-buy-del" onclick="event.stopPropagation();deleteReviewBuy('${esc(String(t.id))}',${jsq(ds)},'${bid}')" title="削除">✕</button>
  </div>`;
}

function _renderUndatedPhotosHTML(t, periodDates) {
  const tid = esc(String(t.id));
  const allPhotos = t.photos || [];
  const photos = allPhotos.filter(p => !p.date || !periodDates.has(p.date));
  if (!photos.length) return '<div class="trip-photos-empty">写真なし</div>';
  const DN = '日月火水木金土'.split('');
  const groups = {};
  photos.forEach(p => {
    const key = p.date || '__undated__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  let html = '';
  Object.entries(groups).sort(([a], [b]) => {
    if (a === '__undated__') return 1; if (b === '__undated__') return -1;
    return a.localeCompare(b);
  }).forEach(([dateKey, datePhotos]) => {
    const dateLabel = dateKey === '__undated__' ? '日付未定' : (() => {
      const d = new Date(dateKey + 'T00:00:00');
      return `${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）`;
    })();
    const thumbs = datePhotos.map(p => {
      const pid = esc(String(p.id));
      const pidx = allPhotos.indexOf(p);
      const dateOpts = _buildTripDateOptions(t, p.date || '');
      return `<div class="trip-photo-thumb">
        <img data-path="${esc(p.path)}" src="" alt="${esc(p.caption||'')}"
          onclick="event.stopPropagation();openTripPhotoLightbox('${tid}',${pidx})">
        <button class="trip-photo-del" onclick="event.stopPropagation();deleteTripPhoto('${tid}','${pid}')" title="削除">✕</button>
        <select class="trip-photo-date-sel" onclick="event.stopPropagation()" onchange="setTripPhotoDate('${tid}','${pid}',this.value)">${dateOpts}</select>
        <div class="trip-photo-caption" contenteditable="true"
          onblur="saveTripPhotoCaption('${tid}','${pid}',this.textContent)"
          onclick="event.stopPropagation()"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
        >${esc(p.caption||'')}</div>
      </div>`;
    }).join('');
    html += `<div class="trip-photo-group">
      <div class="trip-photo-date-label">${esc(dateLabel)}</div>
      <div class="trip-photo-grid">${thumbs}</div>
    </div>`;
  });
  return html;
}

function _reviewDayCardHTML(t, ds, dayNum, dateObj, isLastDay) {
  const tid = esc(String(t.id));
  const DN = '日月火水木金土'.split('');
  const log = t.log || {};
  const dayLog = log[ds] || {};
  const dsQ = jsq(ds);
  const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}（${DN[dateObj.getDay()]}）`;

  // 🏨 Stay (omitted on last day)
  const autoStay = isLastDay ? '' : _reviewDayStayAuto(t, ds);
  const savedStay = dayLog.stay || '';
  const stayHTML = isLastDay ? '' : `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">🏨</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label">泊まったところ</div>
      <input class="trip-drv-input" type="text"
        id="trDayStay-${tid}-${ds}"
        value="${esc(savedStay)}"
        placeholder="${esc(autoStay || '宿名を入力…')}"
        onblur="saveTripDayField('${tid}',${dsQ},'stay',this.value)"
        onclick="event.stopPropagation()">
    </div>
  </div>`;

  // 🚃 Transport
  const autoMoveItems = _reviewDayMoveAutoItems(t, ds);
  const autoMoveHTML = autoMoveItems.length
    ? `<div class="trip-drv-auto-items">${autoMoveItems.map(s => `<div class="trip-drv-auto-item">${esc(s)}</div>`).join('')}</div>`
    : '';
  const moveHTML = `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">🚃</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label">移動</div>
      ${autoMoveHTML}
      <input class="trip-drv-input" type="text"
        id="trDayMove-${tid}-${ds}"
        value="${esc(dayLog.move || '')}"
        placeholder="移動メモを追加…"
        onblur="saveTripDayField('${tid}',${dsQ},'move',this.value)"
        onclick="event.stopPropagation()">
    </div>
  </div>`;

  // 📍 Places (non-move, non-stay plan items for this day)
  const planItems = (t.plan || []).filter(p => p.date === ds && p.kind !== 'move' && p.kind !== 'stay');
  const placesHTML = `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">📍</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label">行ったところ</div>
      <div id="trPlaces-${tid}-${ds}" class="trip-drv-places">${planItems.map(item => _reviewPlaceItemHTML(t, item, tid)).join('')}</div>
      <input class="trip-drv-add-in" type="text"
        id="trAddPlace-${tid}-${ds}"
        placeholder="＋ 行ったところを追加…"
        onkeydown="if(event.key==='Enter'){event.stopPropagation();addReviewPlace('${tid}',${dsQ},this)}"
        onclick="event.stopPropagation()">
    </div>
  </div>`;

  // 🍴 Food (from global meals array)
  const dayMeals = (typeof meals !== 'undefined' ? meals : []).filter(m => m.date === ds);
  const foodHTML = `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">🍴</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label">食べたもの</div>
      ${dayMeals.length ? `<div class="trip-drv-food-list">${dayMeals.map(m => _reviewMealItemHTML(m)).join('')}</div>` : ''}
      <button class="trip-drv-add-btn" onclick="event.stopPropagation();openFoodModalNew(${dsQ})">＋ 食べたものを追加</button>
    </div>
  </div>`;

  // 🛍 Buys
  const buys = dayLog.buys || [];
  const buysHTML = `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">🛍</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label">買ったもの・お土産</div>
      <div id="trBuys-${tid}-${ds}" class="trip-drv-buys">${buys.map(b => _reviewBuyItemHTML(t, ds, b, tid)).join('')}</div>
      <input class="trip-drv-add-in" type="text"
        id="trAddBuy-${tid}-${ds}"
        placeholder="＋ 品名を追加…"
        onkeydown="if(event.key==='Enter'){event.stopPropagation();addReviewBuy('${tid}',${dsQ},this)}"
        onclick="event.stopPropagation()">
    </div>
  </div>`;

  // 📷 Photos
  const photosHTML = `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">📷</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label-row">
        <div class="trip-drv-row-label">写真</div>
        <button class="trip-drv-add-btn-sm" onclick="event.stopPropagation();openTripPhotoInputForDay('${tid}',${dsQ})">＋</button>
      </div>
      <div id="trDayPhotos-${tid}-${ds}"
        class="trip-photos-drop-zone"
        ondragover="tripPhotoDragOver(event)"
        ondragleave="tripPhotoDragLeave(event)"
        ondrop="tripPhotoDropForDay(event,'${tid}',${dsQ})">
        ${_reviewDayPhotosHTML(t, ds)}
      </div>
    </div>
  </div>`;

  // ✏ Note
  const noteHTML = `<div class="trip-drv-row">
    <div class="trip-drv-row-icon" aria-hidden="true">✏</div>
    <div class="trip-drv-row-body">
      <div class="trip-drv-row-label">ひとこと</div>
      <textarea class="trip-drv-ta"
        id="trDayNote-${tid}-${ds}"
        placeholder="この日のひとこと…"
        onblur="saveTripDayField('${tid}',${dsQ},'note',this.value)"
        onclick="event.stopPropagation()"
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
      >${esc(dayLog.note || '')}</textarea>
    </div>
  </div>`;

  return `<div class="trip-day-review-card ui-card">
    <div class="trip-drv-hdr">
      <div class="trip-drv-day-num">${dayNum}日目</div>
      <div class="trip-drv-date">${esc(dateLabel)}</div>
    </div>
    ${stayHTML}${moveHTML}${placesHTML}${foodHTML}${buysHTML}${photosHTML}${noteHTML}
  </div>`;
}

// ── REVIEW: RENDER ──

function _renderTripReview(t) {
  const container = document.getElementById('tripReviewView'); if (!container) return;
  const review = t.review || { rating: 0, text: '', updatedAt: null };
  const tid = esc(String(t.id));

  // Build period dates set for undated-photo detection
  const periodDates = new Set();
  if (t.startDate && t.endDate) {
    const sdObj = new Date(t.startDate + 'T00:00:00');
    const edObj = new Date(t.endDate + 'T00:00:00');
    for (let d = new Date(sdObj); d <= edObj; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      periodDates.add(ds);
    }
  }

  // Stars (overall rating)
  const starsHTML = [1,2,3,4,5].map(n =>
    `<button class="trip-star-btn${n <= (review.rating||0) ? ' active' : ''}" onclick="setTripRating('${tid}',${n});event.stopPropagation()">★</button>`
  ).join('');

  // Section 2: undated/out-of-period photos (only when trip has period)
  const allPhotos = t.photos || [];
  const undatedPhotos = allPhotos.filter(p => !p.date || !periodDates.has(p.date));
  const undatedSection = (undatedPhotos.length && t.startDate && t.endDate) ? `<div class="trip-review-section">
    <div class="trip-review-lbl-row">
      <div class="trip-review-lbl">日付なしの写真</div>
      <button class="trip-photo-add-btn-text" onclick="openTripPhotoInput('${tid}');event.stopPropagation()">＋ 写真を追加</button>
    </div>
    <div id="tripUndatedPhotosWrap-${tid}"
      class="trip-photos-drop-zone"
      ondragover="tripPhotoDragOver(event)"
      ondragleave="tripPhotoDragLeave(event)"
      ondrop="tripPhotoDrop(event,'${tid}')">
      ${_renderUndatedPhotosHTML(t, periodDates)}
    </div>
  </div>` : '';

  // Section 3: day cards or no-period fallback
  let dayContent = '';
  if (t.startDate && t.endDate) {
    const sdObj = new Date(t.startDate + 'T00:00:00');
    const edObj = new Date(t.endDate + 'T00:00:00');
    let dayNum = 0, cards = '';
    for (let d = new Date(sdObj); d <= edObj; d.setDate(d.getDate() + 1)) {
      dayNum++;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const isLastDay = (ds === t.endDate);
      cards += _reviewDayCardHTML(t, ds, dayNum, new Date(d), isLastDay);
    }
    dayContent = `<div class="trip-review-day-cards">${cards}</div>`;
  } else {
    dayContent = `<div class="trip-review-no-period">
      <p>期間を設定すると、日ごとに記録できます。</p>
      <div class="trip-review-section">
        <div class="trip-review-lbl-row">
          <div class="trip-review-lbl">写真</div>
          <button class="trip-photo-add-btn-text" onclick="openTripPhotoInput('${tid}');event.stopPropagation()">＋ 写真を追加</button>
        </div>
        <div id="tripPhotosWrap-${tid}"
          class="trip-photos-drop-zone"
          ondragover="tripPhotoDragOver(event)"
          ondragleave="tripPhotoDragLeave(event)"
          ondrop="tripPhotoDrop(event,'${tid}')">
          ${_renderTripPhotosHTML(t)}
        </div>
      </div>
    </div>`;
  }

  // Section 4: reflections (所感) for the trip period
  const reflectionsHTML = _renderReviewReflections(t);

  container.innerHTML = `<div class="trip-review">
    <div class="trip-review-section">
      <div class="trip-review-lbl">総合評価</div>
      <div class="trip-stars">${starsHTML}</div>
    </div>
    <div class="trip-review-section">
      <div class="trip-review-lbl">総合感想</div>
      <textarea class="trip-review-ta" id="tripReviewTa-${tid}"
        placeholder="旅の感想を書いてください…"
        onblur="saveTripReviewText('${tid}')"
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
      >${esc(review.text || '')}</textarea>
    </div>
    ${undatedSection}
    ${dayContent}
    ${reflectionsHTML}
    <div id="tripPhotoError" class="food-photo-error"></div>
  </div>`;

  const ta = document.getElementById(`tripReviewTa-${String(t.id)}`);
  if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  container.querySelectorAll('.trip-drv-ta').forEach(el => {
    el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px';
  });
  fillSignedUrls(container);
}

function _renderReviewReflections(t) {
  if (!t.startDate || !t.endDate) return '';
  const DN = '日月火水木金土'.split('');
  const tripNotes = (typeof reflections !== 'undefined' ? reflections : [])
    .filter(r => r.date && r.date >= t.startDate && r.date <= t.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!tripNotes.length) return '';
  let html = `<div class="trip-review-section">
    <div class="trip-review-lbl">この期間の所感</div>
    <div class="trip-period-notes">`;
  tripNotes.forEach(r => {
    const d = new Date(r.date + 'T00:00:00');
    const dateLabel = `${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）`;
    const excerpt = (r.body || '').slice(0, 80) + ((r.body || '').length > 80 ? '…' : '');
    html += `<div class="trip-period-note-item" onclick="nav('notes');setTimeout(()=>notesCalCellClick('${esc(r.date)}'),100)">
      <div class="trip-period-note-date">${esc(dateLabel)}</div>
      <div class="trip-period-note-text">${esc(excerpt)}</div>
    </div>`;
  });
  html += `</div></div>`;
  return html;
}

// ── REVIEW: SAVE / UPDATE FUNCTIONS ──

function saveTripDayField(tripId, ds, field, value) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (!t.log) t.log = {};
  if (!t.log[ds]) t.log[ds] = {};
  t.log[ds][field] = value;
  saveTrips();
}

function togglePlanItemVisited(tripId, itemId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const item = (t.plan || []).find(p => String(p.id) === String(itemId)); if (!item) return;
  item.visited = !item.visited;
  saveTrips();
  _updateReviewPlaceItem(tripId, itemId);
}

function setPlanItemRating(tripId, itemId, n) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const item = (t.plan || []).find(p => String(p.id) === String(itemId)); if (!item) return;
  item.rating = (item.rating === n) ? 0 : n;
  saveTrips();
  _updateReviewPlaceItem(tripId, itemId);
}

function savePlanItemComment(tripId, itemId, val) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const item = (t.plan || []).find(p => String(p.id) === String(itemId)); if (!item) return;
  item.comment = (val || '').trim();
  saveTrips();
}

function _updateReviewPlaceItem(tripId, itemId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const item = (t.plan || []).find(p => String(p.id) === String(itemId)); if (!item) return;
  const el = document.getElementById(`trPlaceItem-${String(tripId)}-${String(itemId)}`);
  if (el) el.outerHTML = _reviewPlaceItemHTML(t, item, String(tripId));
}

function addReviewPlace(tripId, ds, inputEl) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const title = inputEl.value.trim(); if (!title) return;
  if (!t.plan) t.plan = [];
  t.plan.push({ id: crypto.randomUUID(), date: ds, time: '', kind: 'see', title, place: '', url: '', note: '', visited: true });
  saveTrips();
  inputEl.value = '';
  const container = document.getElementById(`trPlaces-${String(tripId)}-${ds}`);
  if (container) {
    const planItems = (t.plan || []).filter(p => p.date === ds && p.kind !== 'move' && p.kind !== 'stay');
    container.innerHTML = planItems.map(item => _reviewPlaceItemHTML(t, item, String(tripId))).join('');
  }
}

function deleteReviewPlanItem(tripId, ds, itemId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  t.plan = (t.plan || []).filter(p => String(p.id) !== String(itemId));
  saveTrips();
  const container = document.getElementById(`trPlaces-${String(tripId)}-${ds}`);
  if (container) {
    const planItems = (t.plan || []).filter(p => p.date === ds && p.kind !== 'move' && p.kind !== 'stay');
    container.innerHTML = planItems.map(item => _reviewPlaceItemHTML(t, item, String(tripId))).join('');
  }
}

function addReviewBuy(tripId, ds, inputEl) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const name = inputEl.value.trim(); if (!name) return;
  if (!t.log) t.log = {};
  if (!t.log[ds]) t.log[ds] = {};
  if (!t.log[ds].buys) t.log[ds].buys = [];
  t.log[ds].buys.push({ id: crypto.randomUUID(), name, note: '' });
  saveTrips();
  inputEl.value = '';
  const container = document.getElementById(`trBuys-${String(tripId)}-${ds}`);
  if (container) container.innerHTML = (t.log[ds].buys || []).map(b => _reviewBuyItemHTML(t, ds, b, String(tripId))).join('');
}

function deleteReviewBuy(tripId, ds, buyId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (!t.log || !t.log[ds] || !t.log[ds].buys) return;
  t.log[ds].buys = t.log[ds].buys.filter(b => String(b.id) !== String(buyId));
  saveTrips();
  const container = document.getElementById(`trBuys-${String(tripId)}-${ds}`);
  if (container) container.innerHTML = (t.log[ds].buys || []).map(b => _reviewBuyItemHTML(t, ds, b, String(tripId))).join('');
}

function openTripPhotoInputForDay(tripId, ds) {
  _tripPhotoTargetId = String(tripId);
  _tripPhotoTargetDate = ds;
  document.getElementById('tripPhotoInput').click();
}

function tripPhotoDropForDay(e, tripId, ds) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) return;
  _tripPhotoTargetId = String(tripId);
  _tripPhotoTargetDate = ds;
  handleTripPhotoUpload(files);
}

function _renderTripDetail(tripId) {
  const t = trips.find(t => String(t.id) === String(tripId));
  if (!t) { closeTripDetail(); return; }
  const dateRange = _fmtDetailDateRange(t);
  const budgetStr = t.budget != null ? `¥${fmt(t.budget)}` : '';
  const tid = esc(String(t.id));
  const planActive     = _travelSubView === 'plan';
  const bookingActive  = _travelSubView === 'booking';
  const reviewActive   = _travelSubView === 'review';
  const detailView = document.getElementById('tripDetailView');
  detailView.innerHTML = `
    <div class="trip-detail-hdr">
      <button class="trip-detail-back" onclick="closeTripDetail()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        一覧
      </button>
      <div class="trip-detail-meta">
        <h1 class="trip-detail-dest">${esc(t.dest)}</h1>
        <div class="trip-detail-meta-row">
          <span class="trip-badge ${esc(t.status)}">${esc(t.status)}</span>
          ${dateRange ? `<span class="trip-detail-dates">${esc(dateRange)}</span>` : ''}
          ${budgetStr ? `<span class="trip-detail-budget">${esc(budgetStr)}</span>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="openTripModal('${tid}');event.stopPropagation()">編集</button>
        </div>
      </div>
    </div>
    <div class="trip-detail-seg-wrap">
      <div class="ui-seg" id="tripDetailSeg">
        <button class="ui-seg-btn${planActive ? ' active' : ''}" onclick="setTravelSubView('plan',this)">日程表</button>
        <button class="ui-seg-btn${bookingActive ? ' active' : ''}" onclick="setTravelSubView('booking',this)">予約・手配</button>
        <button class="ui-seg-btn${reviewActive ? ' active' : ''}" onclick="setTravelSubView('review',this)">記録</button>
      </div>
    </div>
    <div id="tripPlanView" style="display:${planActive ? '' : 'none'}"></div>
    <div id="tripBookingView" style="display:${bookingActive ? '' : 'none'}"></div>
    <div id="tripReviewView" style="display:${reviewActive ? '' : 'none'}"></div>
  `;
  if (planActive) _renderTripPlan(t);
  else if (bookingActive) _renderTripBooking(t);
  else _renderTripReview(t);
}

// ── RENDER LIST: SUMMARY BAR ──
function _renderTvSummaryBar(realTrips) {
  const bar = document.getElementById('tvSummaryBar'); if (!bar) return;
  const planning = realTrips.filter(t => ['検討中','計画中','予約済み'].includes(t.status)).length;
  const budgetTotal = realTrips.filter(t => t.budget && t.status !== '完了').reduce((s, t) => s + (t.budget || 0), 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextTrip = realTrips
    .filter(t => t.startDate && t.status !== '完了' && t.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  let nextHTML = '未定';
  if (nextTrip) {
    const sd = new Date(nextTrip.startDate + 'T00:00:00');
    const m = sd.getMonth() + 1, d = sd.getDate();
    const y = sd.getFullYear() !== new Date().getFullYear() ? `${sd.getFullYear()}年` : '';
    nextHTML = `${y}${m}月${d}日〜 ${esc(nextTrip.dest)}`;
  }

  bar.innerHTML = `
    <div class="tv-sum-item">
      <span class="tv-sum-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="3" width="14" height="13" rx="1.5"/><path d="M2 7h14"/><path d="M6 1v3M12 1v3"/></svg>
      </span>
      <span class="tv-sum-label">計画中の旅</span>
      <span class="tv-sum-value">${planning} 件</span>
    </div>
    <div class="tv-sum-divider"></div>
    <div class="tv-sum-item tv-sum-item-next">
      <span class="tv-sum-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 2C6.24 2 4 4.24 4 7c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-4-5-5z"/><circle cx="9" cy="7" r="1.5"/></svg>
      </span>
      <span class="tv-sum-label">次の旅</span>
      <span class="tv-sum-value tv-sum-next-val">${nextHTML}</span>
    </div>
    <div class="tv-sum-divider"></div>
    <div class="tv-sum-item tv-sum-item-budget">
      <span class="tv-sum-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="1" y="4.5" width="16" height="10" rx="1.5"/><circle cx="9" cy="9.5" r="2.5"/></svg>
      </span>
      <span class="tv-sum-label">総予算（予定）</span>
      <span class="tv-sum-value tv-sum-budget-val" style="font-family:'JetBrains Mono',monospace">¥${fmt(budgetTotal)}</span>
    </div>
  `;
}

// ── RENDER LIST: TRIP CARDS ──
function _tripCoverHTML(t, height) {
  const tid = esc(String(t.id));
  const grad = _tripGradient(t.dest);
  const hasCover = t.coverPhoto && t.coverPhoto.path;
  const bgStyle = hasCover ? '' : `background:${grad}`;
  return `<div class="tv-card-cover" style="height:${height}px;${bgStyle}">
    ${hasCover ? `<img data-path="${esc(t.coverPhoto.path)}" class="tv-card-cover-img" src="" alt="">` : `
      <svg class="tv-mountain-svg" viewBox="0 0 400 160" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M0 160L80 60L160 110L260 20L340 80L400 160Z" fill="rgba(255,255,255,0.07)"/>
        <path d="M0 160L100 80L200 120L300 40L400 160Z" fill="rgba(255,255,255,0.05)"/>
      </svg>`}
    <div class="tv-card-overlay"></div>
    <div class="tv-card-cover-top">
      <span class="tv-badge-pill ${esc(t.status)}">${esc(t.status)}</span>
      <div class="tv-status-btn-wrap" onclick="event.stopPropagation()">
        <button class="tv-status-btn" onclick="toggleStatusMenu('${tid}',this);event.stopPropagation()">ステータス ▾</button>
      </div>
    </div>
    <div class="tv-card-cover-bottom">
      <div class="tv-card-cover-info">
        <div class="tv-card-name">${esc(t.dest)}</div>
        ${t.startDate ? `<div class="tv-card-date-line">📅 ${fmtTripDateRange(t)}</div>` : (t.timing ? `<div class="tv-card-date-line">📅 ${esc(t.timing)}</div>` : '')}
        ${(t.place || t.dest) ? `<div class="tv-card-place-line">📍 ${esc(t.place || t.dest)}</div>` : ''}
      </div>
      ${t.budget != null ? `<div class="tv-card-budget-pill">¥${fmt(t.budget)}</div>` : ''}
    </div>
  </div>`;
}

function _renderTvCards(realTrips) {
  const col = document.getElementById('tvCardsCol'); if (!col) return;
  const active = realTrips.filter(t => t.status !== '完了').sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.startDate) return -1; if (b.startDate) return 1;
    return 0;
  });
  const done = realTrips.filter(t => t.status === '完了');

  if (!active.length && !done.length) {
    col.innerHTML = `<div class="tv-empty">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--ink3)" stroke-width="1.2" stroke-linecap="round"><circle cx="24" cy="24" r="20"/><path d="M24 8v5M24 35v5M8 24h5M35 24h5"/><polygon points="24,14 28,30 24,27 20,30" fill="var(--ink3)" stroke="none" opacity="0.4"/></svg>
      <div style="color:var(--ink3);font-size:15px;margin-top:12px">旅のプランをまだ追加していません</div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="openNewTripModal()">＋ 旅を追加</button>
    </div>`;
    return;
  }

  let html = '';

  if (active.length === 1) {
    // Single card: full width
    const feat = active[0];
    const ftid = esc(String(feat.id));
    const desc = feat.description || feat.note || '';
    const descTrunc = desc.length > 120 ? desc.slice(0, 120) + '…' : desc;
    html += `<div class="tv-feat-card" onclick="openTripDetail('${ftid}')">
      ${_tripCoverHTML(feat, 300)}
      <div class="tv-feat-card-body">
        ${descTrunc ? `<div class="tv-card-desc">${esc(descTrunc)}</div>` : ''}
        <span class="tv-card-detail-arrow" onclick="openTripDetail('${ftid}');event.stopPropagation()">›</span>
      </div>
    </div>`;
  } else if (active.length >= 2) {
    // 2+ cards: uniform 2-column grid, same cover height
    html += '<div class="tv-cards-grid">';
    active.forEach(t => {
      const tid = esc(String(t.id));
      const desc = t.description || t.note || '';
      const descTrunc = desc.length > 80 ? desc.slice(0, 80) + '…' : desc;
      html += `<div class="tv-feat-card tv-feat-card-grid" onclick="openTripDetail('${tid}')">
        ${_tripCoverHTML(t, 200)}
        <div class="tv-feat-card-body">
          ${descTrunc ? `<div class="tv-card-desc">${esc(descTrunc)}</div>` : ''}
          <span class="tv-card-detail-arrow" onclick="openTripDetail('${tid}');event.stopPropagation()">›</span>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // Completed trips
  if (done.length) {
    html += '<div class="tv-done-section">';
    html += '<div class="tv-done-section-lbl">旅の記録</div>';
    html += '<div class="tv-done-cards">';
    done.forEach(t => {
      const tid = esc(String(t.id));
      const rating = (t.review || {}).rating || 0;
      const hasCover = t.coverPhoto && t.coverPhoto.path;
      const hasPhoto = (t.photos || []).length > 0;
      html += `<div class="tv-done-card" onclick="openTripDetail('${tid}')">
        <div class="tv-done-card-cover" style="${hasCover ? '' : (hasPhoto ? '' : `background:${_tripGradient(t.dest)}`)}">
          ${hasCover ? `<img data-path="${esc(t.coverPhoto.path)}" class="tv-done-cover-img" src="" alt="">` :
            hasPhoto ? `<img data-path="${esc(t.photos[0].path)}" class="tv-done-cover-img" src="" alt="">` :
            `<svg viewBox="0 0 200 100" fill="none" style="width:100%;height:100%"><path d="M0 100L30 40L70 65L120 15L160 50L200 100Z" fill="rgba(255,255,255,0.1)"/></svg>`}
        </div>
        <div class="tv-done-card-body">
          <div class="tv-done-card-name">${esc(t.dest)}</div>
          ${rating > 0 ? `<div class="tv-done-card-rating">${'★'.repeat(rating)}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div></div>';
  }

  col.innerHTML = html;
  fillSignedUrls(col);
}

// ── RENDER LIST: PROGRESS CARD ──
function _renderTvProgress(realTrips) {
  const card = document.getElementById('tvProgressCard'); if (!card) return;
  const active = realTrips.filter(t => t.status !== '完了');
  if (!active.length) {
    card.innerHTML = '<div style="color:var(--ink3);font-size:14px;padding:8px 0">計画中の旅がありません</div>';
    return;
  }

  // Determine which trip to show
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!_progressTripId || !active.find(t => String(t.id) === _progressTripId)) {
    const next = active.filter(t => t.startDate && t.startDate >= todayStr).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    _progressTripId = next ? String(next.id) : String(active[0].id);
  }
  const t = active.find(t => String(t.id) === _progressTripId) || active[0];
  const tid = esc(String(t.id));

  const doneCount = _tripDoneCount(t);
  const total = PROGRESS_STEPS.length;
  const pct = Math.round(doneCount / total * 100);

  // Selector for multiple trips
  const selectorHTML = active.length > 1
    ? `<select class="tv-progress-trip-sel" onchange="switchProgressTrip(this.value)" onclick="event.stopPropagation()">
        ${active.map(a => `<option value="${esc(String(a.id))}"${String(a.id)===String(t.id)?' selected':''}>${esc(a.dest)}</option>`).join('')}
       </select>`
    : `<span class="tv-progress-trip-name">${esc(t.dest)}</span>`;

  const stepsHTML = PROGRESS_STEPS.map((step, idx) => {
    const done = _tripIsDone(t, step.key);
    const summary = _tripProgressSummary(t, step.key);
    return `<div class="tv-progress-step" onclick="openProgressDetailModal('${tid}',${jsq(step.key)});event.stopPropagation()">
      <div class="tv-progress-step-num${done ? ' done' : ''}">${idx + 1}</div>
      <div class="tv-progress-step-name-wrap">
        <div class="tv-progress-step-name">${esc(step.label)}</div>
        ${summary ? `<div class="tv-progress-step-summary">${esc(summary)}</div>` : ''}
      </div>
      <button class="tv-progress-toggle${done ? ' done' : ''}" onclick="toggleProgressStep('${tid}',${jsq(step.key)});event.stopPropagation()" title="${done ? '完了を取り消す' : '完了にする'}">
        ${done ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="var(--accent)" stroke="none"/><path d="M3.5 7l2.5 2.5L10.5 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
               : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="var(--rule)" stroke-width="1.5"/></svg>'}
      </button>
    </div>`;
  }).join('');

  card.innerHTML = `
    <div class="tv-progress-hdr">
      <div class="tv-progress-title">旅の計画進捗</div>
      <div class="tv-progress-count">${doneCount} / ${total} 完了</div>
    </div>
    <div class="tv-progress-trip-row">${selectorHTML}</div>
    <div class="tv-progress-bar-wrap">
      <div class="tv-progress-bar" style="width:${pct}%"></div>
    </div>
    <div class="tv-progress-pct">${pct}%</div>
    <div class="tv-progress-steps">${stepsHTML}</div>
  `;
}

// ── PROGRESS DETAIL MODAL ──
function openProgressDetailModal(tripId, key) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  _progressDetailTripId = String(tripId);
  _progressDetailKey = String(key);
  const step = PROGRESS_STEPS.find(s => s.key === key);
  document.getElementById('progressDetailModalTitle').textContent = step ? step.label : key;
  _renderProgressDetailContent(t, key);
  document.getElementById('tripProgressDetailModal').classList.add('open');
}

function closeProgressDetailModal() {
  document.getElementById('tripProgressDetailModal').classList.remove('open');
  _progressDetailTripId = null;
  _progressDetailKey = null;
}

function _renderProgressDetailContent(t, key) {
  const body = document.getElementById('progressDetailModalBody'); if (!body) return;
  const tid = esc(String(t.id));
  const det = _getTripDetails(t);

  if (key === 'transport') {
    const items = [...det.transport].sort((a, b) =>
      ((a.depDate||'9999')+(a.depTime||'99:99')).localeCompare((b.depDate||'9999')+(b.depTime||'99:99')));
    let html = `<div class="tv-detail-list">`;
    if (!items.length) {
      html += `<div class="tv-detail-empty">登録されている交通手段はありません。</div>`;
    } else {
      items.forEach(tr => {
        const icon = TRANSPORT_KIND_ICONS[tr.kind] || '🚆';
        const iid = esc(String(tr.id));
        const fromTo = [tr.from, tr.to].filter(Boolean).join(' → ');
        const depFmt = tr.depDate ? (() => { const d = new Date(tr.depDate+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate()+(tr.depTime?' '+tr.depTime:''); })() : '';
        const arrFmt = tr.arrDate && tr.arrDate !== tr.depDate ? (() => { const d = new Date(tr.arrDate+'T00:00:00'); return ' → '+(d.getMonth()+1)+'/'+d.getDate()+(tr.arrTime?' '+tr.arrTime:''); })() : (tr.arrTime?' → '+tr.arrTime:'');
        html += `<div class="tv-detail-item">
          <div class="tv-detail-item-icon">${icon}</div>
          <div class="tv-detail-item-body">
            <div class="tv-detail-item-name">${esc(tr.name || TRANSPORT_KIND_LABELS[tr.kind] || '')}</div>
            ${fromTo ? `<div class="tv-detail-item-sub">${esc(fromTo)}</div>` : ''}
            ${depFmt ? `<div class="tv-detail-item-sub">${esc(depFmt+arrFmt)}</div>` : ''}
            ${tr.confNo ? `<div class="tv-detail-item-sub">予約番号: <strong>${esc(tr.confNo)}</strong></div>` : ''}
            ${tr.price != null ? `<div class="tv-detail-item-sub">¥${fmt(tr.price)}</div>` : ''}
          </div>
          <button class="tv-detail-item-edit" onclick="openTransportEditModal('${tid}','${iid}');event.stopPropagation()">編集</button>
        </div>`;
      });
    }
    html += `</div><div style="margin-top:12px"><button class="btn btn-ghost btn-sm" onclick="openTransportEditModal('${tid}',null);event.stopPropagation()">＋ 交通を追加</button></div>`;
    body.innerHTML = html;
    return;
  }

  if (key === 'stay') {
    const items = [...det.stay].sort((a, b) => (a.checkIn||'9999').localeCompare(b.checkIn||'9999'));
    let html = `<div class="tv-detail-list">`;
    if (!items.length) {
      html += `<div class="tv-detail-empty">登録されている宿泊先はありません。</div>`;
    } else {
      items.forEach(st => {
        const sid = esc(String(st.id));
        const dateRange = st.checkIn ? (() => {
          const ci = new Date(st.checkIn+'T00:00:00');
          let s = (ci.getMonth()+1)+'/'+ci.getDate()+(st.checkInTime?' '+st.checkInTime:'');
          if (st.checkOut) { const co = new Date(st.checkOut+'T00:00:00'); s += ' 〜 '+(co.getMonth()+1)+'/'+co.getDate()+(st.checkOutTime?' '+st.checkOutTime:''); }
          return s;
        })() : '';
        html += `<div class="tv-detail-item">
          <div class="tv-detail-item-icon">🏨</div>
          <div class="tv-detail-item-body">
            <div class="tv-detail-item-name">${esc(st.name || '宿泊先')}</div>
            ${dateRange ? `<div class="tv-detail-item-sub">${esc(dateRange)}</div>` : ''}
            ${st.confNo ? `<div class="tv-detail-item-sub">予約番号: <strong>${esc(st.confNo)}</strong></div>` : ''}
            ${st.price != null ? `<div class="tv-detail-item-sub">¥${fmt(st.price)}</div>` : ''}
          </div>
          <button class="tv-detail-item-edit" onclick="openStayEditModal('${tid}','${sid}');event.stopPropagation()">編集</button>
        </div>`;
      });
    }
    html += `</div><div style="margin-top:12px"><button class="btn btn-ghost btn-sm" onclick="openStayEditModal('${tid}',null);event.stopPropagation()">＋ 宿泊を追加</button></div>`;
    body.innerHTML = html;
    return;
  }

  // Notes-based steps
  const noteVal = det.notes[key] || '';
  body.innerHTML = `<div>
    <textarea class="ldr-modal-in tv-notes-ta" id="progressNoteTA-${esc(key)}"
      rows="6" placeholder="メモを入力してください…" style="resize:vertical;width:100%;box-sizing:border-box"
    >${esc(noteVal)}</textarea>
    <div style="text-align:right;margin-top:8px">
      <button class="btn btn-primary btn-sm" onclick="saveProgressNote('${tid}',${jsq(key)});event.stopPropagation()">保存</button>
    </div>
    ${noteVal.trim() ? `<div class="tv-notes-display-wrap"><div class="tv-notes-display">${_linkify(noteVal)}</div></div>` : ''}
  </div>`;
}

function saveProgressNote(tripId, key) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const ta = document.getElementById(`progressNoteTA-${key}`); if (!ta) return;
  _ensureTripDetails(t);
  t.details.notes[key] = ta.value;
  saveTrips();
  _renderProgressDetailContent(t, key);
  _renderTvProgress(trips.filter(tv => !tv.isIdea));
}

// ── TRANSPORT EDIT ──
function openTransportEditModal(tripId, itemId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  document.getElementById('tripTransportEditModal').dataset.tripId = String(tripId);
  _transportEditId = itemId ? String(itemId) : null;
  if (_transportEditId) {
    const item = (_getTripDetails(t).transport || []).find(tr => String(tr.id) === _transportEditId);
    document.getElementById('transportEditTitle').textContent = '交通を編集';
    if (item) {
      setTransportKind(item.kind || 'flight');
      document.getElementById('transportName').value = item.name || '';
      document.getElementById('transportFrom').value = item.from || '';
      document.getElementById('transportTo').value = item.to || '';
      document.getElementById('transportDepDate').value = item.depDate || '';
      document.getElementById('transportDepTime').value = item.depTime || '';
      document.getElementById('transportArrDate').value = item.arrDate || '';
      document.getElementById('transportArrTime').value = item.arrTime || '';
      document.getElementById('transportConfNo').value = item.confNo || '';
      document.getElementById('transportPrice').value = item.price != null ? item.price : '';
      document.getElementById('transportUrl').value = item.url || '';
      document.getElementById('transportNote').value = item.note || '';
    }
    document.getElementById('transportEditDelWrap').innerHTML =
      `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="confirmDeleteTransport(${jsq(String(tripId))},${jsq(String(itemId))});event.stopPropagation()">削除</button>`;
  } else {
    document.getElementById('transportEditTitle').textContent = '交通を追加';
    setTransportKind('flight');
    ['transportName','transportFrom','transportTo','transportDepDate','transportDepTime',
     'transportArrDate','transportArrTime','transportConfNo','transportPrice','transportUrl','transportNote']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('transportEditDelWrap').innerHTML = '';
  }
  document.getElementById('tripTransportEditModal').classList.add('open');
  setTimeout(() => document.getElementById('transportName').focus(), 50);
}

function setTransportKind(kind) {
  document.getElementById('transportKind').value = kind;
  document.querySelectorAll('#transportKindSeg .ui-seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kind === kind);
  });
}

function closeTransportEditModal() {
  document.getElementById('tripTransportEditModal').classList.remove('open');
  const tripId = document.getElementById('tripTransportEditModal').dataset.tripId;
  _transportEditId = null;
  _afterDetailsEdit(tripId);
}

function saveTransportEdit() {
  const modal = document.getElementById('tripTransportEditModal');
  const tripId = modal.dataset.tripId;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  _ensureTripDetails(t);
  const pv = document.getElementById('transportPrice').value;
  const item = {
    id: _transportEditId || crypto.randomUUID(),
    kind: document.getElementById('transportKind').value || 'other',
    name: document.getElementById('transportName').value.trim(),
    from: document.getElementById('transportFrom').value.trim(),
    to: document.getElementById('transportTo').value.trim(),
    depDate: document.getElementById('transportDepDate').value || null,
    depTime: document.getElementById('transportDepTime').value || '',
    arrDate: document.getElementById('transportArrDate').value || null,
    arrTime: document.getElementById('transportArrTime').value || '',
    confNo: document.getElementById('transportConfNo').value.trim(),
    price: pv !== '' ? parseFloat(pv) : null,
    url: document.getElementById('transportUrl').value.trim(),
    note: document.getElementById('transportNote').value.trim()
  };
  if (_transportEditId) {
    const idx = t.details.transport.findIndex(tr => String(tr.id) === _transportEditId);
    if (idx >= 0) t.details.transport[idx] = item; else t.details.transport.push(item);
  } else {
    t.details.transport.push(item);
  }
  saveTrips();
  modal.classList.remove('open');
  _transportEditId = null;
  _afterDetailsEdit(tripId);
}

async function confirmDeleteTransport(tripId, itemId) {
  if (!(await uiConfirm('この交通情報を削除しますか？', { title: '削除', danger: true }))) return;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  _ensureTripDetails(t);
  t.details.transport = t.details.transport.filter(tr => String(tr.id) !== String(itemId));
  saveTrips();
  document.getElementById('tripTransportEditModal').classList.remove('open');
  _transportEditId = null;
  _afterDetailsEdit(tripId);
}

// ── STAY EDIT ──
function openStayEditModal(tripId, itemId) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  document.getElementById('tripStayEditModal').dataset.tripId = String(tripId);
  _stayEditId = itemId ? String(itemId) : null;
  if (_stayEditId) {
    const item = (_getTripDetails(t).stay || []).find(st => String(st.id) === _stayEditId);
    document.getElementById('stayEditTitle').textContent = '宿泊を編集';
    if (item) {
      document.getElementById('stayName').value = item.name || '';
      document.getElementById('stayAddress').value = item.address || '';
      document.getElementById('stayCheckIn').value = item.checkIn || '';
      document.getElementById('stayCheckInTime').value = item.checkInTime || '';
      document.getElementById('stayCheckOut').value = item.checkOut || '';
      document.getElementById('stayCheckOutTime').value = item.checkOutTime || '';
      document.getElementById('stayConfNo').value = item.confNo || '';
      document.getElementById('stayPrice').value = item.price != null ? item.price : '';
      document.getElementById('stayUrl').value = item.url || '';
      document.getElementById('stayNote').value = item.note || '';
    }
    document.getElementById('stayEditDelWrap').innerHTML =
      `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="confirmDeleteStay(${jsq(String(tripId))},${jsq(String(itemId))});event.stopPropagation()">削除</button>`;
  } else {
    document.getElementById('stayEditTitle').textContent = '宿泊を追加';
    ['stayName','stayAddress','stayCheckIn','stayCheckInTime','stayCheckOut','stayCheckOutTime',
     'stayConfNo','stayPrice','stayUrl','stayNote']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('stayEditDelWrap').innerHTML = '';
  }
  document.getElementById('tripStayEditModal').classList.add('open');
  setTimeout(() => document.getElementById('stayName').focus(), 50);
}

function closeStayEditModal() {
  document.getElementById('tripStayEditModal').classList.remove('open');
  const tripId = document.getElementById('tripStayEditModal').dataset.tripId;
  _stayEditId = null;
  _afterDetailsEdit(tripId);
}

function saveStayEdit() {
  const modal = document.getElementById('tripStayEditModal');
  const tripId = modal.dataset.tripId;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  const name = document.getElementById('stayName').value.trim();
  if (!name) { document.getElementById('stayName').focus(); return; }
  _ensureTripDetails(t);
  const pv = document.getElementById('stayPrice').value;
  const item = {
    id: _stayEditId || crypto.randomUUID(),
    name,
    address: document.getElementById('stayAddress').value.trim(),
    checkIn: document.getElementById('stayCheckIn').value || null,
    checkInTime: document.getElementById('stayCheckInTime').value || '',
    checkOut: document.getElementById('stayCheckOut').value || null,
    checkOutTime: document.getElementById('stayCheckOutTime').value || '',
    confNo: document.getElementById('stayConfNo').value.trim(),
    price: pv !== '' ? parseFloat(pv) : null,
    url: document.getElementById('stayUrl').value.trim(),
    note: document.getElementById('stayNote').value.trim()
  };
  if (_stayEditId) {
    const idx = t.details.stay.findIndex(st => String(st.id) === _stayEditId);
    if (idx >= 0) t.details.stay[idx] = item; else t.details.stay.push(item);
  } else {
    t.details.stay.push(item);
  }
  saveTrips();
  modal.classList.remove('open');
  _stayEditId = null;
  _afterDetailsEdit(tripId);
}

async function confirmDeleteStay(tripId, itemId) {
  if (!(await uiConfirm('この宿泊情報を削除しますか？', { title: '削除', danger: true }))) return;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  _ensureTripDetails(t);
  t.details.stay = t.details.stay.filter(st => String(st.id) !== String(itemId));
  saveTrips();
  document.getElementById('tripStayEditModal').classList.remove('open');
  _stayEditId = null;
  _afterDetailsEdit(tripId);
}

function _afterDetailsEdit(tripId) {
  if (!tripId) return;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (_progressDetailTripId === String(tripId) && _progressDetailKey) {
    _renderProgressDetailContent(t, _progressDetailKey);
  }
  if (_currentTripId === String(tripId) && _travelSubView === 'booking') _renderTripBooking(t);
  if (_currentTripId === String(tripId) && _travelSubView === 'plan') _renderTripPlan(t);
  _renderTvProgress(trips.filter(tv => !tv.isIdea));
}

// ── BOOKING TAB ──
function _renderTripBooking(t) {
  const container = document.getElementById('tripBookingView'); if (!container) return;
  const det = _getTripDetails(t);
  const tid = esc(String(t.id));
  const hasTransport = det.transport.length > 0;
  const hasStay = det.stay.length > 0;
  const noteSteps = PROGRESS_STEPS.filter(s => s.key !== 'transport' && s.key !== 'stay' && (det.notes[s.key]||'').trim());

  if (!hasTransport && !hasStay && !noteSteps.length) {
    container.innerHTML = `<div class="trip-booking">
      <div class="trip-booking-empty">
        <div style="color:var(--ink3);font-size:14px;margin-bottom:16px">進捗の項目から、フライトやホテルを登録できます。</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="openTransportEditModal('${tid}',null);event.stopPropagation()">＋ 交通を追加</button>
          <button class="btn btn-ghost btn-sm" onclick="openStayEditModal('${tid}',null);event.stopPropagation()">＋ 宿泊を追加</button>
        </div>
      </div>
    </div>`;
    return;
  }

  let html = '<div class="trip-booking">';

  if (hasTransport) {
    const items = [...det.transport].sort((a, b) =>
      ((a.depDate||'9999')+(a.depTime||'99:99')).localeCompare((b.depDate||'9999')+(b.depTime||'99:99')));
    html += `<div class="trip-booking-section">
      <div class="trip-booking-section-hdr">
        <div class="trip-review-lbl">交通手段</div>
        <button class="btn btn-ghost btn-sm" onclick="openTransportEditModal('${tid}',null);event.stopPropagation()">＋ 追加</button>
      </div>`;
    items.forEach(tr => {
      const icon = TRANSPORT_KIND_ICONS[tr.kind] || '🚆';
      const iid = esc(String(tr.id));
      const fromTo = [tr.from, tr.to].filter(Boolean).join(' → ');
      const depFmt = tr.depDate ? (() => { const d = new Date(tr.depDate+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate()+(tr.depTime?' '+tr.depTime:''); })() : '';
      const arrFmt = (() => {
        if (tr.arrDate && tr.arrDate !== tr.depDate) { const d = new Date(tr.arrDate+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate()+(tr.arrTime?' '+tr.arrTime:''); }
        return tr.arrTime || '';
      })();
      html += `<div class="trip-booking-card">
        <div class="trip-booking-card-top">
          <span class="trip-booking-kind-icon">${icon}</span>
          <div class="trip-booking-card-info">
            <div class="trip-booking-card-name">${esc(tr.name || TRANSPORT_KIND_LABELS[tr.kind] || '')}</div>
            ${fromTo ? `<div class="trip-booking-card-sub">${esc(fromTo)}</div>` : ''}
            ${depFmt ? `<div class="trip-booking-card-sub">${esc(depFmt)}${arrFmt ? ' → '+esc(arrFmt) : ''}</div>` : ''}
            ${tr.price != null ? `<div class="trip-booking-card-price">¥${fmt(tr.price)}</div>` : ''}
          </div>
          <button class="trip-booking-edit-btn" onclick="openTransportEditModal('${tid}','${iid}');event.stopPropagation()">編集</button>
        </div>
        ${tr.confNo ? `<div class="trip-booking-confno-row">
          <span class="trip-booking-confno-lbl">予約番号</span>
          <span class="trip-booking-confno" onclick="copyBookingConfNo(${jsq(tr.confNo)},this);event.stopPropagation()" title="クリックでコピー">${esc(tr.confNo)}</span>
        </div>` : ''}
        ${tr.url ? `<div class="trip-booking-url-row"><a href="${esc(tr.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="trip-booking-link">予約ページ ↗</a></div>` : ''}
        ${tr.note ? `<div class="trip-booking-note">${esc(tr.note)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  }

  if (hasStay) {
    const items = [...det.stay].sort((a, b) => (a.checkIn||'9999').localeCompare(b.checkIn||'9999'));
    html += `<div class="trip-booking-section">
      <div class="trip-booking-section-hdr">
        <div class="trip-review-lbl">宿泊</div>
        <button class="btn btn-ghost btn-sm" onclick="openStayEditModal('${tid}',null);event.stopPropagation()">＋ 追加</button>
      </div>`;
    items.forEach(st => {
      const sid = esc(String(st.id));
      const ciStr = st.checkIn ? (() => { const d = new Date(st.checkIn+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate()+(st.checkInTime?' '+st.checkInTime:''); })() : '';
      const coStr = st.checkOut ? (() => { const d = new Date(st.checkOut+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate()+(st.checkOutTime?' '+st.checkOutTime:''); })() : '';
      html += `<div class="trip-booking-card">
        <div class="trip-booking-card-top">
          <span class="trip-booking-kind-icon">🏨</span>
          <div class="trip-booking-card-info">
            <div class="trip-booking-card-name">${esc(st.name)}</div>
            ${st.address ? `<div class="trip-booking-card-sub">${esc(st.address)}</div>` : ''}
            ${ciStr || coStr ? `<div class="trip-booking-card-sub">${ciStr?'IN: '+esc(ciStr):''}${coStr?'　OUT: '+esc(coStr):''}</div>` : ''}
            ${st.price != null ? `<div class="trip-booking-card-price">¥${fmt(st.price)}</div>` : ''}
          </div>
          <button class="trip-booking-edit-btn" onclick="openStayEditModal('${tid}','${sid}');event.stopPropagation()">編集</button>
        </div>
        ${st.confNo ? `<div class="trip-booking-confno-row">
          <span class="trip-booking-confno-lbl">予約番号</span>
          <span class="trip-booking-confno" onclick="copyBookingConfNo(${jsq(st.confNo)},this);event.stopPropagation()" title="クリックでコピー">${esc(st.confNo)}</span>
        </div>` : ''}
        ${st.url ? `<div class="trip-booking-url-row"><a href="${esc(st.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="trip-booking-link">予約ページ ↗</a></div>` : ''}
        ${st.note ? `<div class="trip-booking-note">${esc(st.note)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  }

  if (noteSteps.length) {
    html += `<div class="trip-booking-section"><div class="trip-review-lbl">メモ</div>`;
    noteSteps.forEach(s => {
      html += `<div class="trip-booking-note-block">
        <div class="trip-booking-note-lbl">${esc(s.label)}</div>
        <div class="tv-notes-display">${_linkify(det.notes[s.key] || '')}</div>
      </div>`;
    });
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

async function copyBookingConfNo(text, el) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = el.textContent;
    el.textContent = 'コピー完了!';
    setTimeout(() => { el.textContent = orig; }, 1500);
  } catch (e) { /* silent */ }
}

// ── RENDER LIST: TODOS CARD ──
function _renderTvTodos() {
  const card = document.getElementById('tvTodosCard'); if (!card) return;
  const realTrips = trips.filter(t => !t.isIdea);
  const allTodos = [];
  realTrips.forEach(t => {
    (t.todos || []).filter(td => !td.done).forEach(td => {
      allTodos.push({ todo: td, trip: t });
    });
  });

  const priOrder = { high: 0, mid: 1, low: 2 };
  allTodos.sort((a, b) => {
    const po = (priOrder[a.todo.priority] || 1) - (priOrder[b.todo.priority] || 1);
    if (po !== 0) return po;
    const ad = a.todo.due || 'zzzz', bd = b.todo.due || 'zzzz';
    return ad.localeCompare(bd);
  });

  const top5 = allTodos.slice(0, 5);
  const priColors = { high: 'rgba(220,38,38,0.12)', mid: 'rgba(202,138,4,0.12)', low: 'rgba(107,114,128,0.10)' };
  const priText = { high: '最優先', mid: '優先', low: '通常' };
  const priTextColors = { high: '#dc2626', mid: '#b45309', low: '#6b7280' };

  let rowsHTML = '';
  if (top5.length) {
    rowsHTML = top5.map(({ todo, trip }) => {
      const tid = esc(String(trip.id));
      const tdid = esc(String(todo.id));
      const pc = priColors[todo.priority] || priColors.low;
      const pt = priText[todo.priority] || '通常';
      const ptc = priTextColors[todo.priority] || priTextColors.low;
      return `<div class="tv-todo-row">
        <div class="tv-todo-meta">
          <span class="tv-todo-priority-pill" style="background:${pc};color:${ptc}">${esc(pt)}</span>
        </div>
        <div class="tv-todo-body">
          <div class="tv-todo-title">${esc(todo.title)}</div>
          <div class="tv-todo-sub">${esc(trip.dest)}${todo.due ? ' · 📅 ' + esc(todo.due) : ''}${todo.note ? ' · ' + esc(todo.note) : ''}</div>
        </div>
        <button class="tv-todo-decide-btn" onclick="completeTripTodoDirect('${tid}','${tdid}');event.stopPropagation()">決める ›</button>
      </div>`;
    }).join('');
  } else {
    rowsHTML = '<div class="tv-todos-empty">未完了のタスクはありません</div>';
  }

  card.innerHTML = `
    <div class="tv-section-hdr">
      <div class="tv-section-title">次に決めること</div>
      <button class="tv-section-link" onclick="openTripTodosModal();event.stopPropagation()">すべて見る ›</button>
    </div>
    <div class="tv-todos-tagline">優先度の高い順に、やることをまとめています。</div>
    <div class="tv-todos-list">${rowsHTML}</div>
  `;
}

// ── RENDER LIST: IDEAS CARD ──
function _renderTvIdeas() {
  const card = document.getElementById('tvIdeasCard'); if (!card) return;
  const ideas = trips.filter(t => t.isIdea);

  const thumbs = ideas.slice(0, 3).map(idea => {
    const iid = esc(String(idea.id));
    const hasCover = idea.coverPhoto && idea.coverPhoto.path;
    const hasPhoto = (idea.photos || []).length > 0;
    const bgStyle = hasCover || hasPhoto ? '' : `background:${_tripGradient(idea.dest)}`;
    return `<div class="tv-idea-thumb" onclick="openIdeaModal('${iid}');event.stopPropagation()">
      <div class="tv-idea-thumb-img" style="${bgStyle}">
        ${hasCover ? `<img data-path="${esc(idea.coverPhoto.path)}" src="" alt="">` :
          hasPhoto ? `<img data-path="${esc(idea.photos[0].path)}" src="" alt="">` :
          `<svg viewBox="0 0 180 120" fill="none" style="width:100%;height:100%"><path d="M0 120L40 50L90 80L140 20L180 120Z" fill="rgba(255,255,255,0.1)"/></svg>`}
        <span class="tv-idea-bookmark">🔖</span>
      </div>
      <div class="tv-idea-info">
        <div class="tv-idea-name">${esc(idea.dest)}</div>
        ${idea.place ? `<div class="tv-idea-place">📍 ${esc(idea.place)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const bulbSVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 2a4 4 0 014 4c0 1.5-.8 2.8-2 3.5V11H6v-1.5C4.8 8.8 4 7.5 4 6a4 4 0 014-4z"/><path d="M6 13h4"/><path d="M6.5 15h3"/></svg>`;

  card.innerHTML = `
    <div class="tv-section-hdr">
      <div class="tv-section-title">${bulbSVG} インスピレーション</div>
      <button class="tv-section-link" onclick="openIdeaModal(null);event.stopPropagation()">＋ 追加</button>
    </div>
    <div class="tv-ideas-grid">
      ${thumbs.length ? thumbs : '<div class="tv-todos-empty">行きたい場所を追加してみましょう</div>'}
    </div>
    ${ideas.length > 0 ? `<div style="text-align:right;margin-top:8px"><button class="tv-section-link" onclick="openIdeasListModal();event.stopPropagation()">すべて見る（${ideas.length} 件）</button></div>` : ''}
  `;

  fillSignedUrls(card);
}

// ── TRIP DAY MAP (for Food markers) ──
function _buildTripDayMap() {
  const map = {};
  const realTrips = (typeof trips !== 'undefined' ? trips : []).filter(t => !t.isIdea && t.startDate && t.endDate);
  for (const t of realTrips) {
    let d = new Date(t.startDate + 'T00:00:00');
    const end = new Date(t.endDate + 'T00:00:00');
    while (d <= end) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[ds]) map[ds] = [];
      map[ds].push(t);
      d.setDate(d.getDate() + 1);
    }
  }
  return map;
}

// ── IDEAS LIST MODAL ──
function openIdeasListModal() {
  _renderIdeasListModal();
  document.getElementById('tripIdeasListModal').classList.add('open');
}

function closeIdeasListModal() {
  document.getElementById('tripIdeasListModal').classList.remove('open');
}

function _renderIdeasListModal() {
  const body = document.getElementById('ideasListModalBody');
  if (!body) return;
  const ideas = trips.filter(t => t.isIdea);

  let html = `<div style="margin-bottom:14px"><button class="btn btn-primary btn-sm" onclick="closeIdeasListModal();openIdeaModal(null)">＋ アイデアを追加</button></div>`;

  if (!ideas.length) {
    html += `<div style="color:var(--ink3);font-family:'Space Grotesk',sans-serif;font-size:14px;padding:16px 0;text-align:center">アイデアはまだありません。<br>行きたい場所を追加してみましょう。</div>`;
    body.innerHTML = html;
    return;
  }

  html += '<div class="tv-ideas-list-modal">';
  ideas.forEach(idea => {
    const iid = esc(String(idea.id));
    const hasCover = idea.coverPhoto && idea.coverPhoto.path;
    const hasPhoto = (idea.photos || []).length > 0;
    const bgStyle = hasCover || hasPhoto ? '' : `background:${_tripGradient(idea.dest)};`;
    const noteFirst = (idea.note || '').split('\n')[0].slice(0, 80);
    html += `<div class="tv-ideas-list-row">
      <div class="tv-ideas-list-thumb" style="${bgStyle}">
        ${hasCover ? `<img data-path="${esc(idea.coverPhoto.path)}" src="" alt="">` :
          hasPhoto ? `<img data-path="${esc(idea.photos[0].path)}" src="" alt="">` :
          `<svg viewBox="0 0 180 120" fill="none" style="width:100%;height:100%"><path d="M0 120L40 50L90 80L140 20L180 120Z" fill="rgba(255,255,255,0.12)"/></svg>`}
      </div>
      <div class="tv-ideas-list-info">
        <div class="tv-ideas-list-name">${esc(idea.dest)}</div>
        ${idea.place ? `<div class="tv-ideas-list-place">📍 ${esc(idea.place)}</div>` : ''}
        ${noteFirst ? `<div class="tv-ideas-list-note">${esc(noteFirst)}</div>` : ''}
      </div>
      <div class="tv-ideas-list-acts">
        <button class="btn btn-ghost btn-sm" onclick="closeIdeasListModal();openIdeaModal('${iid}');event.stopPropagation()">編集</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="deleteIdeaFromList('${iid}');event.stopPropagation()">削除</button>
        <button class="btn btn-ghost btn-sm" onclick="convertIdeaToTripFromList('${iid}');event.stopPropagation()">旅を作る</button>
      </div>
    </div>`;
  });
  html += '</div>';
  body.innerHTML = html;
  fillSignedUrls(body);
}

async function deleteIdeaFromList(id) {
  if (!(await uiConfirm('このアイデアを削除しますか？', { title: '削除', danger: true }))) return;
  trips = trips.filter(t => String(t.id) !== String(id));
  saveTrips();
  _renderIdeasListModal();
  renderTravel();
}

function convertIdeaToTripFromList(id) {
  const idea = trips.find(t => String(t.id) === String(id) && t.isIdea);
  if (!idea) return;
  idea.isIdea = false;
  idea.status = '検討中';
  idea.plan = [];
  if (!idea.todos) idea.todos = [];
  if (!idea.progress) idea.progress = {};
  saveTrips();
  closeIdeasListModal();
  openTripDetail(idea.id);
  renderTravel();
}

// ── RENDER MAIN ──
function renderTravel() {
  const listView = document.getElementById('tripListView');
  const detailView = document.getElementById('tripDetailView');
  if (_currentTripId) {
    listView.style.display = 'none';
    detailView.style.display = '';
    _renderTripDetail(_currentTripId);
  } else {
    listView.style.display = '';
    detailView.style.display = 'none';
    const realTrips = trips.filter(t => !t.isIdea);
    _renderTvSummaryBar(realTrips);
    _renderTvCards(realTrips);
    _renderTvProgress(realTrips);
    _renderTvTodos();
    _renderTvIdeas();
  }
}
