// ── TASKS ──
function updateBadge(){const n=tasks.filter(t=>!t.done).length;const b=document.getElementById('navBadge');b.textContent=n;b.style.display=n>0?'':'none';const bb=document.getElementById('bottomBadge');if(bb){bb.textContent=n;bb.style.display=n>0?'':'none';}}
function tkFind(id){ return tasks.find(t => String(t.id) === String(id)); }
function toggleAddTask(){
  const f=document.getElementById('addTaskForm');
  const open=f.classList.toggle('open');
  todoState.addOpen=open;
  const b=document.getElementById('tkAddMoreBtn'); if(b) b.classList.toggle('active',open);
  if(open)document.getElementById('taskTitle').focus();
}
function addTask(){
  const titleEl=document.getElementById('taskTitle');
  const title=titleEl.value.trim();
  if(!title){titleEl.focus();return;}
  const due=document.getElementById('taskDue').value;
  const pickEl=document.getElementById('taskToday');
  const t={id:crypto.randomUUID(),title,category:document.getElementById('taskCategory').value,priority:document.getElementById('taskPriority').value,due,done:false,createdAt:new Date().toISOString(),tags:[],isPinned:false,completedAt:null,dueTime:null};
  // 「今日やる」にチェック、または 今日ビューで期限なしで追加 → 今日の分として登録（翌日には自動で外れる）
  if((pickEl&&pickEl.checked)||(todoState.viewFilter==='today'&&!due))t.todayDate=localDate();
  t.tags=deriveInitialTags(t);
  tasks.unshift(t);
  saveTasks();
  titleEl.value='';
  document.getElementById('taskDue').value='';
  if(pickEl)pickEl.checked=false;
  renderTodayView();renderHome();updateBadge();
  titleEl.focus();
}
function delTask(id){
  tasks=tasks.filter(t=>String(t.id)!==String(id));
  if(String(todoState.selectedId)===String(id))todoState.selectedId=null;
  saveTasks();renderTodayView();renderHome();updateBadge();
}

// ── CATEGORY COLOR MAP ──
const CAT_COLORS = {
  '仕事':'#3b82f6','手続き':'#8b5cf6','家事':'#10b981','買い物':'#f59e0b',
  '修理':'#ef4444','その他':'#6b7280','ダッシュボード改善案':'#ec4899'
};
function getCatColor(cat) { return CAT_COLORS[cat] || '#9ca3af'; }

// ── TASK CLASSIFICATION ──
function getTodayDate() { const n = new Date(); n.setHours(0,0,0,0); return n; }
function getThisWeekSunday(now) {
  const sun = new Date(now);
  const d = sun.getDay();
  sun.setDate(sun.getDate() + (d === 0 ? 0 : 7 - d));
  return sun;
}
function classifyTask(t, now, thisSun) {
  if (t.done) return 'done';
  if (!t.due) return 'undef';
  const d = new Date(t.due + 'T00:00:00');
  if (d <= now) return 'today';
  if (d <= thisSun) return 'thisweek';
  return 'later';
}
// 「今日やること」に入るか。期限切れ / 今日が期限 / 「今日やる」で今日付けにしたもの（翌日には自動で外れる）
function todayBucket(t, todayStr) {
  if (!t || t.done) return null;
  if (t.due && t.due < todayStr) return 'overdue';
  if (t.due && t.due === todayStr) return 'due';
  if (t.todayDate && t.todayDate === todayStr) return 'picked';
  return null;
}

// ── VIEW / CAT / TAG FILTER SETTERS ──
function setViewFilter(f) {
  todoState.viewFilter = (f === undefined ? null : f);
  todoState.sectionFilter = null;
  todoState.tagFilter = null;
  renderTodayView();
}
function setCatFilter(cat) {
  todoState.sectionFilter = cat || null;
  renderTodayView();
}
function setTagFilter(tag) {
  todoState.tagFilter = (todoState.tagFilter === tag ? null : tag);
  renderTodayView();
}

// ── PIN / 今日やる ──
function togglePin(id) {
  const t = tkFind(id);
  if (!t) return;
  t.isPinned = !t.isPinned;
  saveTasks();
  renderTodayView();
}
function togglePickToday(id) {
  const t = tkFind(id);
  if (!t) return;
  const today = localDate();
  if (t.todayDate === today) delete t.todayDate; else t.todayDate = today;
  saveTasks();
  renderTodayView();
}

// ── COMPLETE TASK (with fade animation) ──
function completeTask(id) {
  const t = tkFind(id);
  if (!t || t._completing) return;
  t._completing = true;
  const btn = document.querySelector(`[data-task-id="${id}"] .tk-check`);
  if (btn) btn.disabled = true;
  const row = document.querySelector(`[data-task-id="${id}"]`);
  if (row) { row.style.opacity = '0.3'; row.style.transition = 'opacity 0.4s'; }
  setTimeout(() => {
    t.done = true;
    t.completedAt = new Date().toISOString();
    delete t._completing;
    saveTasks();
    renderTodayView();
    renderHome();
    updateBadge();
    showUndoToast(id, t.title);
  }, 600);
}

// ── UNDO TOAST ──
let _undoTimer = null;
let _undoTaskId = null;
function showUndoToast(id, title) {
  _undoTaskId = id;
  clearTimeout(_undoTimer);
  document.getElementById('undoMsg').textContent = `「${title}」を完了しました`;
  document.getElementById('undoToast').classList.add('show');
  _undoTimer = setTimeout(() => {
    document.getElementById('undoToast').classList.remove('show');
    _undoTaskId = null;
  }, 5000);
}
function undoComplete() {
  if (!_undoTaskId) return;
  const t = tkFind(_undoTaskId);
  if (t) { t.done = false; t.completedAt = null; saveTasks(); renderTodayView(); renderHome(); updateBadge(); }
  clearTimeout(_undoTimer);
  document.getElementById('undoToast').classList.remove('show');
  _undoTaskId = null;
}
function undoCompleteById(id) {
  const t = tkFind(id);
  if (t) { t.done = false; t.completedAt = null; saveTasks(); renderTodayView(); renderHome(); updateBadge(); }
}

// ── QUICK MEMO ──
function saveQuickMemo(val) { localStorage.setItem('hd_quick_memo', val); }
function loadQuickMemo() { return localStorage.getItem('hd_quick_memo') || ''; }

// ── DATA SAVE FUNCTIONS ──
function saveTasks() { localStorage.setItem('hd_tasks', JSON.stringify(tasks)); saveToSupabase(); }
function saveTaskDue(id, val) {
  const t = tkFind(id);
  if (!t) return;
  t.due = val || null;
  saveTasks();
  renderTodayView();
  renderHome();
}

// ── DUE DATE LABEL ──
function fmtTaskDueLabel(due) {
  if (!due) return { label: '＋ 期限', cls: 'tk-due-empty' };
  const today = getTodayDate();
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d - today) / 86400000);
  const thisYear = today.getFullYear();
  const shortLabel = d.getFullYear() === thisYear
    ? `${d.getMonth()+1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  if (diff < 0) return { label: shortLabel, cls: 'tk-due-overdue' };
  if (diff === 0) return { label: '今日', cls: 'tk-due-today' };
  if (diff === 1) return { label: '明日', cls: 'tk-due-soon' };
  return { label: shortLabel, cls: diff <= 7 ? 'tk-due-soon' : '' };
}

// ── OPEN DUE DATE PICKER (行の期限チップ) ──
function openDuePicker(id, el) {
  const wrap = el.closest('.tk-due-wrap');
  const input = wrap.querySelector('.tk-due-input');
  const t = tkFind(id);
  input.value = t && t.due ? t.due : '';
  input.onchange = () => { saveTaskDue(String(id), input.value); };
  const showInline = () => {
    input.style.cssText = 'position:absolute;opacity:1;width:130px;height:28px;left:0;top:100%;z-index:100;pointer-events:auto;';
    input.onblur = () => { input.style.cssText = ''; };
    input.focus();
  };
  if (typeof input.showPicker === 'function') {
    try { input.showPicker(); } catch(e) { showInline(); }
  } else {
    showInline();
  }
}

// ── SORT (pinned first, then by due date) ──
function sortSectionTasks(items) {
  return [...items].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.due && b.due) return new Date(a.due) - new Date(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
}

// ── ROW ──
function tkRowHTML(t, todayStr) {
  const q = jsq(String(t.id));
  const done = !!t.done;
  const bucket = todayBucket(t, todayStr);
  const color = getCatColor(t.category);
  const sel = String(todoState.selectedId) === String(t.id);
  const tags = [...new Set(t.tags || [])].slice(0, 3);
  const tagsHTML = tags.map(tag => `<span class="tv-tag-chip tag-${esc(tag)}">${esc(tag)}</span>`).join('');
  const tagBox = done
    ? `<span class="tk-tags">${tagsHTML}</span>`
    : `<span class="tk-tags" onclick="event.stopPropagation();openTvTagEditor(${q},event)">${tagsHTML}${tags.length ? '' : '<span class="tk-tag-add">＋ タグ</span>'}</span>`;
  let dueHTML = '';
  if (done) {
    if (t.due) dueHTML = `<span class="tk-due">${esc(fmtTaskDueLabel(t.due).label)}</span>`;
  } else {
    const di = fmtTaskDueLabel(t.due);
    dueHTML = `<span class="tk-due-wrap${t.due ? '' : ' tk-due-none'}"><span class="tk-due ${di.cls}" onclick="event.stopPropagation();openDuePicker(${q},this)">${esc(di.label)}</span><input type="date" class="tk-due-input" tabindex="-1"></span>`;
  }
  const timeHTML = t.dueTime ? `<span class="tk-time">${esc(t.dueTime)}</span>` : '';
  const prioHTML = t.priority === 'high' ? '<span class="tk-prio" title="優先度 高">高</span>' : '';
  const pickChip = bucket === 'picked' ? '<span class="tk-chip tk-chip-pick">今日</span>' : '';
  let pickBtn = '';
  if (!done && bucket === null) pickBtn = `<button class="tk-pick" onclick="event.stopPropagation();togglePickToday(${q})">今日やる</button>`;
  else if (!done && bucket === 'picked') pickBtn = `<button class="tk-pick on" onclick="event.stopPropagation();togglePickToday(${q})">今日から外す</button>`;
  const pinBtn = done ? '' : `<button class="tk-pin${t.isPinned ? ' pinned' : ''}" onclick="event.stopPropagation();togglePin(${q})" aria-label="ピン留め">${t.isPinned ? '★' : '☆'}</button>`;
  const checkAct = done ? `undoCompleteById(${q})` : `completeTask(${q})`;
  return `<div class="tk-row${sel ? ' sel' : ''}${done ? ' done' : ''}${bucket === 'overdue' ? ' overdue' : ''}" data-task-id="${esc(t.id)}" onclick="tkRowClick(${q})">
    <button class="tk-check${done ? ' done' : ''}" onclick="event.stopPropagation();${checkAct}" aria-label="${done ? '未完了に戻す' : '完了にする'}"><span class="tk-check-box">${done ? '✓' : ''}</span></button>
    <div class="tk-row-body">
      <div class="tk-row-title">${esc(t.title)}</div>
      <div class="tk-row-meta">
        <span class="tk-chip"><span class="tk-dot" style="background:${color}"></span>${esc(t.category || '')}</span>
        ${dueHTML}${timeHTML}${prioHTML}${pickChip}${tagBox}
      </div>
    </div>
    ${pickBtn}${pinBtn}
  </div>`;
}

function tkRowClick(id) {
  if (window.matchMedia('(max-width: 640px)').matches) { openTaskEditSheet(id); return; }
  todoState.selectedId = String(id);
  renderTodayView();
}
function tkDeselect() { todoState.selectedId = null; renderTodayView(); }
function toggleDoneList() { todoState.showDone = !todoState.showDone; tkRenderMain(); }

// ── ICONS ──
const TK_ICONS = {
  today: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  over: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5M12 16.5v.01"/></svg>',
  week: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  prog: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></svg>'
};

// ── RENDER (main column) ──
function tkRenderMain() {
  const todayStr = localDate();
  const now = getTodayDate();
  const thisSun = getThisWeekSunday(now);
  const pending = tasks.filter(t => !t.done);
  const bucketOf = t => todayBucket(t, todayStr);
  const cls = t => classifyTask(t, now, thisSun);

  const todayTasks = pending.filter(t => bucketOf(t));
  const overdueTasks = pending.filter(t => bucketOf(t) === 'overdue');
  const weekTasks = pending.filter(t => cls(t) === 'thisweek');
  const laterTasks = pending.filter(t => cls(t) === 'later');
  const undefTasks = pending.filter(t => cls(t) === 'undef');
  const doneTasks = tasks.filter(t => t.done);
  const doneTodayN = doneTasks.filter(t => t.completedAt && localDate(new Date(t.completedAt)) === todayStr).length;
  const total = doneTodayN + todayTasks.length;
  const pct = total > 0 ? Math.round(doneTodayN / total * 100) : null;

  updateEl('tkDate', fmtFull(new Date()));

  // 1. サマリーカード
  const card = (icon, label, num, unit, extra, danger) =>
    `<div class="tk-stat-card${danger ? ' danger' : ''}"><span class="tk-stat-icon">${icon}</span><div class="tk-stat-body"><div class="tk-stat-label">${label}</div><div class="tk-stat-num-row"><span class="tk-stat-num">${num}</span><span class="tk-stat-unit">${unit}</span></div>${extra || ''}</div></div>`;
  const statsEl = document.getElementById('tkStats');
  if (statsEl) {
    statsEl.innerHTML =
      card(TK_ICONS.today, '今日', todayTasks.length, '件') +
      card(TK_ICONS.over, '期限切れ', overdueTasks.length, '件', '', overdueTasks.length > 0) +
      card(TK_ICONS.week, '今週', weekTasks.length, '件') +
      card(TK_ICONS.prog, '進捗', total > 0 ? `${doneTodayN}/${total}` : '—', total > 0 ? '完了' : '', `<div class="tk-bar"><span style="width:${pct || 0}%"></span></div>`);
  }

  // 2. ビュー切替ピル
  const views = [['today', '今日', todayTasks.length], ['thisweek', '今週', weekTasks.length], ['later', '後で', laterTasks.length], ['undef', '未定', undefTasks.length], [null, 'すべて', pending.length]];
  const viewsEl = document.getElementById('tkViews');
  if (viewsEl) {
    viewsEl.innerHTML = views.map(([v, label, n]) =>
      `<button class="ui-pill tk-pill${todoState.viewFilter === v ? ' active' : ''}" onclick="setViewFilter(${v === null ? 'null' : `'${v}'`})">${label} <span class="tk-pill-n">${n}</span></button>`
    ).join('') +
      `<button class="ui-pill tk-pill tk-pill-done${todoState.showDone ? ' active' : ''}" onclick="toggleDoneList()">完了 <span class="tk-pill-n">${doneTasks.length}</span></button>`;
  }

  // 3. カテゴリ・タグ
  const cats = [...new Set(pending.map(t => t.category).filter(Boolean))];
  if (todoState.sectionFilter && !cats.includes(todoState.sectionFilter)) cats.push(todoState.sectionFilter);
  const tagCount = {};
  pending.forEach(t => (t.tags || []).forEach(tag => { tagCount[tag] = (tagCount[tag] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  if (todoState.tagFilter && !topTags.includes(todoState.tagFilter)) topTags.push(todoState.tagFilter);
  const filtersEl = document.getElementById('tkFilters');
  if (filtersEl) {
    filtersEl.innerHTML = `<select class="tk-cat-sel" onchange="setCatFilter(this.value)" aria-label="カテゴリ">
      <option value="">すべてのカテゴリ</option>
      ${cats.map(c => `<option value="${esc(c)}"${todoState.sectionFilter === c ? ' selected' : ''}>${esc(c)}（${pending.filter(t => t.category === c).length}）</option>`).join('')}
    </select>` + topTags.map(tag =>
      `<button class="ui-pill tk-mini${todoState.tagFilter === tag ? ' active' : ''}" onclick="setTagFilter(${jsq(tag)})">#${esc(tag)}</button>`
    ).join('');
  }

  // 4. リスト
  let filtered = pending;
  if (todoState.sectionFilter) filtered = filtered.filter(t => t.category === todoState.sectionFilter);
  if (todoState.tagFilter) filtered = filtered.filter(t => (t.tags || []).includes(todoState.tagFilter));
  const v = todoState.viewFilter;
  let groups = [];
  if (v === 'today') {
    const od = filtered.filter(t => bucketOf(t) === 'overdue');
    const rest = filtered.filter(t => bucketOf(t) && bucketOf(t) !== 'overdue');
    if (od.length) {
      groups.push({ label: '期限切れ', danger: true, items: od });
      groups.push({ label: '今日', items: rest, hideEmpty: true });
    } else {
      groups.push({ label: '', items: rest });
    }
  } else if (v === null) {
    groups = [
      { label: '期限切れ', danger: true, items: filtered.filter(t => bucketOf(t) === 'overdue'), hideEmpty: true },
      { label: '今日', items: filtered.filter(t => bucketOf(t) && bucketOf(t) !== 'overdue'), hideEmpty: true },
      { label: '今週', items: filtered.filter(t => !bucketOf(t) && cls(t) === 'thisweek'), hideEmpty: true },
      { label: '後で', items: filtered.filter(t => !bucketOf(t) && cls(t) === 'later'), hideEmpty: true },
      { label: '未定', items: filtered.filter(t => !bucketOf(t) && cls(t) === 'undef'), hideEmpty: true },
    ];
  } else {
    groups.push({ label: '', items: filtered.filter(t => cls(t) === v) });
  }
  groups = groups.filter(g => !g.hideEmpty || g.items.length);

  let html = '';
  const anyItems = groups.some(g => g.items.length);
  groups.forEach(g => {
    if (!g.items.length) return;
    const sorted = sortSectionTasks(g.items);
    html += `<div class="tk-group">
      ${g.label ? `<div class="tk-group-hdr${g.danger ? ' danger' : ''}"><span class="tk-group-mark"></span><span class="tk-group-label">${g.label}</span><span class="tk-group-n">${g.items.length}件</span></div>` : ''}
      <div class="ui-card tk-group-card">${sorted.map(t => tkRowHTML(t, todayStr)).join('')}</div>
    </div>`;
  });
  if (!anyItems) {
    html = v === 'today'
      ? `<div class="ui-card tk-empty"><div class="tk-empty-title">今日やることはありません</div><div class="tk-empty-sub">他のタスクの「今日やる」を押すと、ここに加わります</div></div>`
      : `<div class="ui-card tk-empty"><div class="tk-empty-title">タスクがありません</div></div>`;
  }

  if (todoState.showDone) {
    let dl = doneTasks;
    if (todoState.sectionFilter) dl = dl.filter(t => t.category === todoState.sectionFilter);
    if (todoState.tagFilter) dl = dl.filter(t => (t.tags || []).includes(todoState.tagFilter));
    dl = [...dl].sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
    const shown = dl.slice(0, 30);
    html += `<div class="tk-group">
      <div class="tk-group-hdr"><span class="tk-group-label">完了済み</span><span class="tk-group-n">${dl.length}件</span></div>
      <div class="ui-card tk-group-card">${shown.length ? shown.map(t => tkRowHTML(t, todayStr)).join('') : '<div class="tk-empty-sub" style="padding:16px">完了したタスクはありません</div>'}</div>
      ${dl.length > shown.length ? `<div class="tk-more">ほか ${dl.length - shown.length} 件（新しい順に30件まで表示）</div>` : ''}
    </div>`;
  }
  const listEl = document.getElementById('tkList');
  if (listEl) listEl.innerHTML = html;
}

// ── RENDER (right detail panel) ──
function tkRenderPanel() {
  const el = document.getElementById('tkDetail');
  if (!el) return;
  const t = todoState.selectedId != null ? tkFind(todoState.selectedId) : null;
  if (!t) {
    todoState.selectedId = null;
    el.innerHTML = tkEmptyPanelHTML();
    return;
  }
  el.innerHTML = tkDetailHTML(t);
}

// 今後の予定（右パネルの空表示とスマホの下部ブロックで共用）
function tkUpcomingHTML() {
  const days7 = '日月火水木金土'.split('');
  const base = getTodayDate();
  const items = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i);
    const ds = localDate(d);
    tasks.filter(t => !t.done && t.due === ds)
      .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''))
      .forEach(t => items.push({ date: d, task: t }));
  }
  return items.length
    ? items.slice(0, 8).map(({ date, task: t }) => {
        const label = `${date.getMonth() + 1}/${date.getDate()}(${days7[date.getDay()]})${t.dueTime ? ' ' + t.dueTime : ''}`;
        return `<div class="tk-up-item"><span class="tk-up-date">${esc(label)}</span><span class="tk-up-title">${esc(t.title)}</span></div>`;
      }).join('')
    : '<div class="tk-d-hint">今後7日間の予定はありません</div>';
}
// クイックメモ（id は付けない: パネルとスマホ下部の両方に出るため。保存先は hd_quick_memo）
function tkMemoHTML() {
  return `<textarea class="tk-memo" placeholder="メモを追加" oninput="saveQuickMemo(this.value)">${esc(loadQuickMemo())}</textarea>`;
}

function tkEmptyPanelHTML() {
  return `<div class="tk-d-empty">
      <div class="tk-d-empty-text">タスクを選ぶと、ここで詳しく編集できます</div>
    </div>
    <div class="tk-d-sec"><h3 class="tk-d-sec-title">今後の予定</h3>${tkUpcomingHTML()}</div>
    <div class="tk-d-sec"><h3 class="tk-d-sec-title">クイックメモ</h3>${tkMemoHTML()}</div>`;
}

// スマホ（右パネルなし）用: リスト下部の折りたたみブロック。開閉状態は todoState に覚える
function tkRenderMobExtra() {
  const el = document.getElementById('tkMobExtra');
  if (!el) return;
  el.innerHTML = `<details class="ui-card tk-mob-det"${todoState.mobUp ? ' open' : ''} ontoggle="todoState.mobUp=this.open">
      <summary>今後の予定</summary><div class="tk-mob-det-body">${tkUpcomingHTML()}</div></details>
    <details class="ui-card tk-mob-det"${todoState.mobMemo ? ' open' : ''} ontoggle="todoState.mobMemo=this.open">
      <summary>クイックメモ</summary><div class="tk-mob-det-body">${tkMemoHTML()}</div></details>`;
}

function tkDetailHTML(t) {
  const q = jsq(String(t.id));
  const todayStr = localDate();
  const bucket = todayBucket(t, todayStr);
  const cats = [...new Set([...TV_CATEGORIES, t.category].filter(Boolean))];
  const pr = t.priority || 'medium';
  const noteVal = typeof t.note === 'string' ? t.note : (taskNotes[String(t.id)] || '');
  const tags = [...new Set(t.tags || [])];
  const tagsHTML = tags.map(tag => `<span class="tv-tag-chip tag-${esc(tag)}">${esc(tag)}</span>`).join('') || '';
  let todayCtl;
  if (t.done) todayCtl = '<span class="tk-d-hint">完了済み</span>';
  else if (bucket === 'overdue') todayCtl = '<span class="tk-d-hint danger">期限切れのため今日に表示中</span>';
  else if (bucket === 'due') todayCtl = '<span class="tk-d-hint">期限が今日のため今日に表示中</span>';
  else todayCtl = `<button class="ui-pill tk-d-pill${bucket === 'picked' ? ' active' : ''}" onclick="togglePickToday(${q})">${bucket === 'picked' ? '今日から外す' : '今日やる'}</button>`;
  const checkAct = t.done ? `undoCompleteById(${q})` : `completeTask(${q})`;
  return `<div class="tk-d-head" data-task-id="${esc(t.id)}">
      <button class="tk-check big${t.done ? ' done' : ''}" onclick="${checkAct}" aria-label="${t.done ? '未完了に戻す' : '完了にする'}"><span class="tk-check-box">${t.done ? '✓' : ''}</span></button>
      <input class="tk-d-title" type="text" value="${esc(t.title)}" onchange="tkSetTitle(${q},this)" onkeydown="if(event.key==='Enter'&&!event.isComposing)this.blur()" aria-label="タイトル">
      <button class="tk-d-close" onclick="tkDeselect()" aria-label="閉じる">✕</button>
    </div>
    <div class="tk-d-body">
      <div class="tk-d-row"><label class="tk-d-lbl">期限</label>
        <div class="tk-d-due"><input type="date" class="tk-d-in" value="${esc(t.due || '')}" onchange="tkSetDue(${q},this.value)"><input type="time" class="tk-d-in" value="${esc(t.dueTime || '')}" onchange="tkSetDueTime(${q},this.value)"></div></div>
      <div class="tk-d-row"><label class="tk-d-lbl">優先度</label>
        <div class="ui-seg tk-d-seg">
          <button class="ui-seg-btn${pr === 'high' ? ' active' : ''}" onclick="tkSetPriority(${q},'high')">高い</button>
          <button class="ui-seg-btn${pr === 'medium' ? ' active' : ''}" onclick="tkSetPriority(${q},'medium')">普通</button>
          <button class="ui-seg-btn${pr === 'low' ? ' active' : ''}" onclick="tkSetPriority(${q},'low')">低い</button>
        </div></div>
      <div class="tk-d-row"><label class="tk-d-lbl">カテゴリ</label>
        <select class="tk-d-in" onchange="tkSetCategory(${q},this.value)">${cats.map(c => `<option value="${esc(c)}"${t.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="tk-d-row"><label class="tk-d-lbl">タグ</label>
        <div class="tk-d-tags" onclick="openTvTagEditor(${q},event)">${tagsHTML}<span class="tk-tag-add always">＋ タグ</span></div></div>
      <div class="tk-d-row"><label class="tk-d-lbl">今日</label>
        <div class="tk-d-actions">${todayCtl}<button class="ui-pill tk-d-pill${t.isPinned ? ' active' : ''}" onclick="togglePin(${q})">${t.isPinned ? '★ ピン留め中' : '☆ ピン留め'}</button></div></div>
      <div class="tk-d-row col"><label class="tk-d-lbl">メモ</label>
        <textarea class="tk-memo" rows="4" placeholder="メモ" onchange="tkSetNote(${q},this.value)">${esc(noteVal)}</textarea></div>
    </div>
    <div class="tk-d-foot"><button class="tk-d-del" onclick="deleteTaskById(${q})">削除</button></div>`;
}

function renderTodayView() { tkRenderMain(); tkRenderPanel(); tkRenderMobExtra(); }

// ── 右パネルの編集（保存して一覧だけ描き直す。パネル自身は描き直さない = 入力中のフォーカスを奪わない） ──
function tkCommit(withPanel) {
  saveTasks();
  tkRenderMain();
  if (withPanel) tkRenderPanel();
  renderHome();
  updateBadge();
}
function tkSetTitle(id, input) {
  const t = tkFind(id); if (!t) return;
  const v = input.value.trim();
  if (!v) { input.value = t.title; return; }
  t.title = v;
  tkCommit(false);
}
function tkSetDue(id, val) { const t = tkFind(id); if (!t) return; t.due = val || null; tkCommit(true); }
function tkSetDueTime(id, val) { const t = tkFind(id); if (!t) return; t.dueTime = val || null; tkCommit(false); }
function tkSetPriority(id, p) { const t = tkFind(id); if (!t) return; t.priority = p; tkCommit(true); }
function tkSetCategory(id, c) { const t = tkFind(id); if (!t) return; t.category = c; tkCommit(true); }
function tkSetNote(id, val) {
  const t = tkFind(id); if (!t) return;
  setTaskNote(t.id, val); // setTaskNote は id を === で比べるので、元の型のまま渡す
}

async function deleteTaskById(id) {
  const t = tkFind(id);
  if (!t) return false;
  const ok = await uiConfirm(`「${t.title}」を削除しますか？`, {title:'タスクを削除', okLabel:'削除', danger:true});
  if (!ok) return false;
  delete taskNotes[String(id)];
  saveTaskNotes();
  delTask(id);
  return true;
}

// ── HELPER ──
function updateEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ── TAG EDITOR ──
let _tvTagEditId = null;
const TV_ALL_TAGS = ['重要','手続き','準備','連絡','見直し','家事','検討','レジャー','学習','経理','買い物','修理','引っ越し'];

function openTvTagEditor(id, e) {
  _tvTagEditId = id;
  const t = tkFind(id);
  if (!t) return;
  const tags = Array.isArray(t.tags) ? t.tags : [];
  // タスクが持つタグ ＋ 全既存タグ ＋ TV_ALL_TAGS の和集合
  const allTags = [...new Set([...TV_ALL_TAGS, ...tasks.flatMap(tt => tt.tags||[]), ...tags])];
  const pop = document.getElementById('tvTagPop');
  document.getElementById('tvTagPopGrid').innerHTML = allTags.map(tag =>
    `<span class="tv-tag-pop-chip tag-${esc(tag)}${tags.includes(tag)?' sel':''}" onclick="tvToggleTag(${jsq(tag)})">${esc(tag)}</span>`
  ).join('');
  document.getElementById('tvTagPopInput').value = '';
  // 位置計算
  const rect = e.currentTarget.getBoundingClientRect();
  pop.style.top = (rect.bottom + 4) + 'px';
  pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 230)) + 'px';
  pop.classList.add('open');
  e.stopPropagation();
}

function tvToggleTag(tag) {
  const t = tkFind(_tvTagEditId);
  if (!t) return;
  if (!Array.isArray(t.tags)) t.tags = [];
  const idx = t.tags.indexOf(tag);
  if (idx >= 0) t.tags.splice(idx, 1); else t.tags.push(tag);
  t.tags = [...new Set(t.tags)];
  saveTasks();
  renderTodayView();
  // ポップオーバーを再描画（選択状態を更新）
  const allTags = [...new Set([...TV_ALL_TAGS, ...tasks.flatMap(tt => tt.tags||[]), ...t.tags])];
  document.getElementById('tvTagPopGrid').innerHTML = allTags.map(tag2 =>
    `<span class="tv-tag-pop-chip tag-${esc(tag2)}${(t.tags||[]).includes(tag2)?' sel':''}" onclick="tvToggleTag(${jsq(tag2)})">${esc(tag2)}</span>`
  ).join('');
}

function tvTagPopKeydown(e) {
  if (e.key !== 'Enter') return;
  const val = e.target.value.trim();
  if (!val) return;
  tvToggleTag(val);
  e.target.value = '';
}

function closeTvTagPop() {
  document.getElementById('tvTagPop').classList.remove('open');
  _tvTagEditId = null;
}

// ── TASK EDIT SHEET (スマホ用。PC は右パネルで編集) ──
let _taskEditId = null;
let _taskEditTags = null;
const TV_CATEGORIES = ['仕事','手続き','家事','買い物','修理','ダッシュボード改善案','その他'];

function openTaskEditSheet(id) {
  const t = tkFind(id);
  if (!t) return;
  _taskEditId = String(id);
  _taskEditTags = [...(t.tags || [])];
  _renderTaskEditBody();
  document.getElementById('taskEditOverlay').classList.add('open');
  document.addEventListener('keydown', _taskEditKeydown);
  setTimeout(() => { const el = document.getElementById('teTitle'); if (el) el.focus(); }, 50);
}

function closeTaskEditSheet() {
  document.getElementById('taskEditOverlay').classList.remove('open');
  document.removeEventListener('keydown', _taskEditKeydown);
  _taskEditId = null;
  _taskEditTags = null;
}

function _taskEditKeydown(e) {
  if (e.key === 'Escape') closeTaskEditSheet();
}

function _renderTaskEditBody() {
  const t = tasks.find(t => String(t.id) === _taskEditId);
  if (!t) return;
  const tags = _taskEditTags || [];
  const allTags = [...new Set([...TV_ALL_TAGS, ...tasks.flatMap(tt => tt.tags||[]), ...tags])];
  const noteVal = typeof t.note === 'string' ? t.note : (taskNotes[_taskEditId] || '');
  const pr = t.priority || 'medium';
  const todayPicked = t.todayDate === localDate();

  document.getElementById('taskEditBody').innerHTML = `
    <div>
      <label class="ldr-modal-lbl">タイトル</label>
      <input class="ldr-modal-in" id="teTitle" type="text" value="${esc(t.title)}" placeholder="タスク名" oninput="document.getElementById('teSaveBtn').disabled=!this.value.trim()">
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:140px;">
        <label class="ldr-modal-lbl">期限</label>
        <input class="ldr-modal-in" id="teDue" type="date" value="${esc(t.due||'')}">
      </div>
      <div style="flex:1;min-width:120px;">
        <label class="ldr-modal-lbl">時刻</label>
        <input class="ldr-modal-in" id="teTime" type="time" value="${esc(t.dueTime||'')}">
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:140px;">
        <label class="ldr-modal-lbl">カテゴリ</label>
        <select class="ldr-modal-in" id="teCat">
          ${[...new Set([...TV_CATEGORIES, t.category].filter(Boolean))].map(c => `<option value="${esc(c)}"${t.category===c?' selected':''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1;min-width:120px;">
        <label class="ldr-modal-lbl">優先度</label>
        <select class="ldr-modal-in" id="tePrio">
          <option value="high"${pr==='high'?' selected':''}>高い</option>
          <option value="medium"${pr==='medium'?' selected':''}>普通</option>
          <option value="low"${pr==='low'?' selected':''}>低い</option>
        </select>
      </div>
    </div>
    <div>
      <label class="ldr-modal-lbl">タグ</label>
      <div id="teTagChips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;min-height:24px;">
        ${tags.map(tag => `<span class="tv-tag-chip tag-${esc(tag)}" style="display:inline-flex;align-items:center;gap:3px;">${esc(tag)}<button onclick="teRemoveTag(${jsq(tag)})" style="background:none;border:none;cursor:pointer;color:inherit;font-size:12px;padding:0 2px;line-height:1;" title="外す">×</button></span>`).join('')}
      </div>
      <div id="teTagCandidates" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
        ${allTags.filter(tag => !tags.includes(tag)).map(tag => `<span class="tv-tag-pop-chip tag-${esc(tag)}" onclick="teAddTag(${jsq(tag)})" style="cursor:pointer;">${esc(tag)}</span>`).join('')}
      </div>
      <input type="text" id="teTagInput" class="ldr-modal-in" placeholder="新規タグ（Enter で追加）" style="margin-top:4px;" onkeydown="teTagKeydown(event)">
    </div>
    <div>
      <label class="ldr-modal-lbl">メモ</label>
      <textarea class="ldr-modal-in" id="teNote" rows="3" style="resize:vertical;line-height:1.5;height:auto;" placeholder="メモ">${esc(noteVal)}</textarea>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;padding:4px 0;">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-size:13px;">
        <input type="checkbox" id="teToday"${todayPicked?' checked':''}> 今日やる
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-size:13px;">
        <input type="checkbox" id="tePinned"${t.isPinned?' checked':''}> ピン留め
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-size:13px;">
        <input type="checkbox" id="teDone"${t.done?' checked':''}> 完了済み
      </label>
    </div>
  `;

  document.getElementById('taskEditFtr').innerHTML = `
    <button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="deleteTaskFromSheet()">削除</button>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost" onclick="closeTaskEditSheet()">キャンセル</button>
      <button class="btn btn-primary" id="teSaveBtn" onclick="saveTaskEditSheet()"${!t.title.trim()?' disabled':''}>保存</button>
    </div>
  `;
}

function _teRefreshTags() {
  const tags = _taskEditTags || [];
  const allTags = [...new Set([...TV_ALL_TAGS, ...tasks.flatMap(tt => tt.tags||[]), ...tags])];
  const chipsEl = document.getElementById('teTagChips');
  if (chipsEl) chipsEl.innerHTML = tags.map(tag =>
    `<span class="tv-tag-chip tag-${esc(tag)}" style="display:inline-flex;align-items:center;gap:3px;">${esc(tag)}<button onclick="teRemoveTag(${jsq(tag)})" style="background:none;border:none;cursor:pointer;color:inherit;font-size:12px;padding:0 2px;line-height:1;" title="外す">×</button></span>`
  ).join('');
  const candidatesEl = document.getElementById('teTagCandidates');
  if (candidatesEl) candidatesEl.innerHTML = allTags.filter(tag => !tags.includes(tag)).map(tag =>
    `<span class="tv-tag-pop-chip tag-${esc(tag)}" onclick="teAddTag(${jsq(tag)})" style="cursor:pointer;">${esc(tag)}</span>`
  ).join('');
}

function teAddTag(tag) {
  if (!_taskEditTags) return;
  if (!_taskEditTags.includes(tag)) _taskEditTags.push(tag);
  _teRefreshTags();
}

function teRemoveTag(tag) {
  if (!_taskEditTags) return;
  _taskEditTags = _taskEditTags.filter(x => x !== tag);
  _teRefreshTags();
}

function teTagKeydown(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const val = e.target.value.trim();
  if (!val) return;
  teAddTag(val);
  e.target.value = '';
}

function saveTaskEditSheet() {
  if (!_taskEditId) return;
  const title = (document.getElementById('teTitle').value || '').trim();
  if (!title) return;
  const t = tasks.find(t => String(t.id) === _taskEditId);
  if (!t) return;
  t.title = title;
  t.due = document.getElementById('teDue').value || null;
  t.dueTime = document.getElementById('teTime').value || null;
  t.category = document.getElementById('teCat').value;
  t.priority = document.getElementById('tePrio').value;
  t.isPinned = document.getElementById('tePinned').checked;
  if (document.getElementById('teToday').checked) t.todayDate = localDate(); else if (t.todayDate === localDate()) delete t.todayDate;
  t.tags = [...(_taskEditTags || [])];
  const wasDone = t.done;
  t.done = document.getElementById('teDone').checked;
  if (!wasDone && t.done) t.completedAt = new Date().toISOString();
  if (wasDone && !t.done) t.completedAt = null;
  const noteVal = document.getElementById('teNote').value;
  setTaskNote(t.id, noteVal); // setTaskNote は id を === で比べるので、元の型（数値など）のまま渡す
  saveTasks();
  renderTodayView();
  renderHome();
  updateBadge();
  closeTaskEditSheet();
}

async function deleteTaskFromSheet() {
  if (!_taskEditId) return;
  if (await deleteTaskById(_taskEditId)) closeTaskEditSheet();
}
