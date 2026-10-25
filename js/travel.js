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

const PLAN_KIND_LABELS = { move:'移動', stay:'宿', see:'観光', eat:'食事', memo:'メモ' };
const PLAN_KIND_COLORS = { move:'#3b82f6', stay:'#7c3aed', see:'#10b981', eat:'#f59e0b', memo:'#9ca3af' };

const PROGRESS_STEPS = [
  { key:'theme',     label:'目的・テーマ',  autoKey:null,        action:'toggle' },
  { key:'schedule',  label:'日程',          autoKey:'schedule',  action:'modal'  },
  { key:'route',     label:'行き先・ルート', autoKey:null,        action:'toggle' },
  { key:'transport', label:'交通手段',       autoKey:'transport', action:'detail' },
  { key:'stay',      label:'宿泊',           autoKey:'stay',      action:'detail' },
  { key:'budget',    label:'予算',           autoKey:'budget',    action:'modal'  },
  { key:'food',      label:'食事・体験',     autoKey:'food',      action:'detail' },
  { key:'prep',      label:'予約・持ち物',   autoKey:null,        action:'toggle' },
];

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

// ── PROGRESS HELPERS ──
function _tripAutoProgress(t) {
  const plan = t.plan || [];
  return {
    schedule:  !!(t.startDate && t.endDate),
    transport: plan.some(p => p.kind === 'move'),
    stay:      plan.some(p => p.kind === 'stay'),
    budget:    t.budget != null,
    food:      plan.some(p => p.kind === 'eat' || p.kind === 'see'),
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

function _progressTripAction(tripId, step) {
  event.stopPropagation();
  if (step.action === 'toggle') {
    toggleProgressStep(tripId, step.key);
  } else if (step.action === 'modal') {
    openTripModal(tripId);
  } else if (step.action === 'detail') {
    openTripDetail(tripId);
  }
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
  const rv = document.getElementById('tripReviewView');
  if (pv) pv.style.display = view === 'plan' ? '' : 'none';
  if (rv) rv.style.display = view === 'review' ? '' : 'none';
  const t = trips.find(t => String(t.id) === _currentTripId);
  if (!t) return;
  if (view === 'plan') _renderTripPlan(t);
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
  if (!tripId || !files || !files.length) return;
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t) return;
  if (!t.photos) t.photos = [];
  const errEl = document.getElementById('tripPhotoError');
  if (errEl) errEl.textContent = '';
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
        t.photos.push({ id: photoId, path, date: t.startDate || null, caption: '' });
      } catch (e) {
        errors.push(`${file.name}: ${e.message || 'アップロード失敗'}`);
      }
    }
  } catch (e) {
    errors.push(e.message || 'アップロード失敗');
  }
  _tripPhotoUploading--;
  if (errEl) errEl.textContent = errors.length ? `エラー: ${errors.join(' / ')}` : '';
  saveTrips();
  if (_currentTripId === String(tripId)) {
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
  const wrap = document.getElementById(`tripPhotosWrap-${tripId}`);
  if (wrap) { wrap.innerHTML = _renderTripPhotosHTML(t); fillSignedUrls(wrap); }
}

function setTripPhotoDate(tripId, photoId, date) {
  const t = trips.find(t => String(t.id) === String(tripId)); if (!t || !t.photos) return;
  const photo = t.photos.find(p => String(p.id) === String(photoId)); if (!photo) return;
  photo.date = date || null;
  saveTrips();
  const wrap = document.getElementById(`tripPhotosWrap-${tripId}`);
  if (wrap) { wrap.innerHTML = _renderTripPhotosHTML(t); fillSignedUrls(wrap); }
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

function _renderPeriodContent(t) {
  if (!t.startDate || !t.endDate) return '';
  const DN = '日月火水木金土'.split('');
  const tripMeals = (meals || []).filter(m => m.date >= t.startDate && m.date <= t.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const tripNotes = (reflections || []).filter(r => r.date && r.date >= t.startDate && r.date <= t.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!tripMeals.length && !tripNotes.length) return '';
  let html = '';
  if (tripMeals.length) {
    html += `<div class="trip-review-section">
      <div class="trip-review-lbl">この期間の食事</div>
      <div class="trip-period-meals">`;
    tripMeals.forEach(m => {
      const d = new Date(m.date + 'T00:00:00');
      const dateLabel = `${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）`;
      const dishes = (m.sittings || []).flatMap(s => s.dishes || []);
      const dishNames = dishes.filter(dh => dh.name).map(dh => dh.name).join('、');
      const firstPhoto = dishes.find(dh => dh.photos && dh.photos.length > 0);
      const fp = firstPhoto ? firstPhoto.photos[0] : null;
      const mid = esc(String(m.id));
      html += `<div class="trip-period-meal-item" onclick="nav('food');setTimeout(()=>openFoodDetailPopup('${mid}'),100)">
        ${fp ? `<img data-path="${esc(fp.path)}" class="trip-period-meal-thumb" src="" alt="">` : '<div class="trip-period-meal-thumb-empty"></div>'}
        <div class="trip-period-meal-info">
          <div class="trip-period-meal-date">${esc(dateLabel)}</div>
          <div class="trip-period-meal-dishes">${esc(dishNames || '（メモあり）')}</div>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }
  if (tripNotes.length) {
    html += `<div class="trip-review-section">
      <div class="trip-review-lbl">この期間のメモ</div>
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
  }
  return html;
}

function _renderTripPlan(t) {
  const container = document.getElementById('tripPlanView'); if (!container) return;
  const DN = '日月火水木金土'.split('');
  const plan = t.plan || [];
  const tid = esc(String(t.id));
  let html = '<div class="trip-plan">';
  if (t.startDate && t.endDate) {
    const sdObj = new Date(t.startDate + 'T00:00:00');
    const edObj = new Date(t.endDate + 'T00:00:00');
    let dayNum = 0;
    for (let d = new Date(sdObj); d <= edObj; d.setDate(d.getDate() + 1)) {
      dayNum++;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayItems = plan.filter(p => p.date === ds).sort((a, b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
      const dayLabel = `${dayNum}日目 ${d.getMonth()+1}/${d.getDate()}（${DN[d.getDay()]}）`;
      html += `<div class="trip-day-group">
        <div class="trip-day-hdr">
          <span class="trip-day-label">${esc(dayLabel)}</span>
          <button class="trip-plan-add-btn" onclick="openPlanItemModal('${tid}',null,'${esc(ds)}');event.stopPropagation()">＋ 予定</button>
        </div>
        <div class="trip-day-items">${dayItems.length ? dayItems.map(item => _planItemHTML(t, item)).join('') : '<div class="trip-day-empty">予定なし</div>'}</div>
      </div>`;
    }
  }
  const undated = plan.filter(p => !p.date).sort((a, b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
  html += `<div class="trip-day-group trip-undated-group">
    <div class="trip-day-hdr">
      <span class="trip-day-label">日付未定のアイデア</span>
      <button class="trip-plan-add-btn" onclick="openPlanItemModal('${tid}',null,'');event.stopPropagation()">＋ アイデア</button>
    </div>
    <div class="trip-day-items">${undated.length ? undated.map(item => _planItemHTML(t, item)).join('') : '<div class="trip-day-empty">アイデアなし</div>'}</div>
  </div>`;
  html += '</div>';
  container.innerHTML = html;
}

function _renderTripReview(t) {
  const container = document.getElementById('tripReviewView'); if (!container) return;
  const review = t.review || { rating: 0, text: '', updatedAt: null };
  const tid = esc(String(t.id));
  const starsHTML = [1,2,3,4,5].map(n =>
    `<button class="trip-star-btn${n <= (review.rating||0) ? ' active' : ''}" onclick="setTripRating('${tid}',${n});event.stopPropagation()">★</button>`
  ).join('');
  const periodHTML = _renderPeriodContent(t);
  container.innerHTML = `<div class="trip-review">
    <div class="trip-review-section">
      <div class="trip-review-lbl">評価</div>
      <div class="trip-stars">${starsHTML}</div>
    </div>
    <div class="trip-review-section">
      <div class="trip-review-lbl">感想</div>
      <textarea class="trip-review-ta" id="tripReviewTa-${tid}"
        placeholder="旅の感想を書いてください…"
        onblur="saveTripReviewText('${tid}')"
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
      >${esc(review.text || '')}</textarea>
    </div>
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
      <div id="tripPhotoError" class="food-photo-error"></div>
    </div>
    ${periodHTML}
  </div>`;
  const ta = document.getElementById(`tripReviewTa-${String(t.id)}`);
  if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  fillSignedUrls(container);
}

function _renderTripDetail(tripId) {
  const t = trips.find(t => String(t.id) === String(tripId));
  if (!t) { closeTripDetail(); return; }
  const dateRange = _fmtDetailDateRange(t);
  const budgetStr = t.budget != null ? `¥${fmt(t.budget)}` : '';
  const tid = esc(String(t.id));
  const planActive = _travelSubView === 'plan';
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
        <button class="ui-seg-btn${!planActive ? ' active' : ''}" onclick="setTravelSubView('review',this)">記録</button>
      </div>
    </div>
    <div id="tripPlanView" style="display:${planActive ? '' : 'none'}"></div>
    <div id="tripReviewView" style="display:${!planActive ? '' : 'none'}"></div>
  `;
  if (planActive) _renderTripPlan(t);
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

  if (active.length) {
    // First card (featured, large)
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

    // Remaining active cards (smaller, wrap)
    if (active.length > 1) {
      html += '<div class="tv-sub-cards">';
      active.slice(1).forEach(t => {
        const tid = esc(String(t.id));
        const desc2 = t.description || t.note || '';
        const descTrunc2 = desc2.length > 60 ? desc2.slice(0, 60) + '…' : desc2;
        html += `<div class="tv-sub-card" onclick="openTripDetail('${tid}')">
          ${_tripCoverHTML(t, 180)}
          <div class="tv-sub-card-body">
            ${descTrunc2 ? `<div class="tv-card-desc tv-card-desc-sm">${esc(descTrunc2)}</div>` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    }
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
    const manual = t.progress && t.progress[step.key];
    return `<div class="tv-progress-step" onclick="_progressStepClick('${tid}','${idx}');event.stopPropagation()">
      <div class="tv-progress-step-num${done ? ' done' : ''}">${idx + 1}</div>
      <div class="tv-progress-step-name">${esc(step.label)}</div>
      <button class="tv-progress-toggle${done ? ' done' : ''}" onclick="toggleProgressStep('${tid}','${esc(step.key)}');event.stopPropagation()" title="${done ? '完了を取り消す' : '完了にする'}">
        ${done ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="var(--accent)" stroke="none"/><path d="M3.5 7l2.5 2.5L10.5 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
               : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="var(--rule)" stroke-width="1.5"/></svg>'}
      </button>
      <button class="tv-progress-arrow" onclick="_progressStepClick('${tid}','${idx}');event.stopPropagation()">›</button>
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

function _progressStepClick(tripId, idx) {
  const step = PROGRESS_STEPS[idx];
  if (!step) return;
  if (step.action === 'toggle') {
    toggleProgressStep(tripId, step.key);
  } else if (step.action === 'modal') {
    openTripModal(tripId);
  } else if (step.action === 'detail') {
    openTripDetail(tripId);
  }
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
    ${ideas.length > 3 ? `<div style="text-align:right;margin-top:8px"><button class="tv-section-link" onclick="openIdeaModal(null);event.stopPropagation()">すべて見る（${ideas.length} 件）</button></div>` : ''}
  `;

  fillSignedUrls(card);
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
