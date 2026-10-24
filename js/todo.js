// ── TASKS ──
function updateBadge(){const n=tasks.filter(t=>!t.done).length;const b=document.getElementById('navBadge');b.textContent=n;b.style.display=n>0?'':'none';const bb=document.getElementById('bottomBadge');if(bb){bb.textContent=n;bb.style.display=n>0?'':'none';}}
function toggleAddTask(){const f=document.getElementById('addTaskForm');f.classList.toggle('open');if(f.classList.contains('open'))document.getElementById('taskTitle').focus();}
function addTask(){
  const title=document.getElementById('taskTitle').value.trim();
  if(!title){document.getElementById('taskTitle').focus();return;}
  const t={id:crypto.randomUUID(),title,category:document.getElementById('taskCategory').value,priority:document.getElementById('taskPriority').value,due:document.getElementById('taskDue').value,done:false,createdAt:new Date().toISOString(),tags:[],isPinned:false,completedAt:null,dueTime:null};
  t.tags=deriveInitialTags(t);
  tasks.unshift(t);
  saveTasks();
  document.getElementById('taskTitle').value='';
  document.getElementById('taskDue').value='';
  toggleAddTask();
  renderTodayView();renderHome();updateBadge();
}
function toggleTask(id){const t=tasks.find(t=>String(t.id)===String(id));if(t){t.done=!t.done;saveTasks();renderTodayView();renderHome();updateBadge();}}
function delTask(id){tasks=tasks.filter(t=>String(t.id)!==String(id));saveTasks();renderTodayView();renderHome();updateBadge();}

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

// ── VIEW / CAT / TAG FILTER SETTERS ──
function setViewFilter(f, el) {
  todoState.viewFilter = f;
  todoState.sectionFilter = null;
  todoState.tagFilter = null;
  document.querySelectorAll('#tvViewNav .ts-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === (f === null ? 'null' : f));
  });
  renderTodayView();
}
function setCatFilter(cat) {
  todoState.sectionFilter = (todoState.sectionFilter === cat ? null : cat);
  todoState.tagFilter = null;
  renderTodayView();
}
function setTagFilter(tag) {
  todoState.tagFilter = (todoState.tagFilter === tag ? null : tag);
  todoState.sectionFilter = null;
  renderTodayView();
}

// ── PIN ──
function togglePin(id) {
  const t = tasks.find(t => String(t.id) === String(id));
  if (!t) return;
  t.isPinned = !t.isPinned;
  saveTasks();
  renderTodayView();
}

// ── COMPLETE TASK (with fade animation) ──
function completeTask(id) {
  const t = tasks.find(t => String(t.id) === String(id));
  if (!t || t._completing) return;
  t._completing = true;
  const btn = document.querySelector(`[data-task-id="${id}"] .tv-done-btn`);
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
  const t = tasks.find(t => String(t.id) === String(_undoTaskId));
  if (t) { t.done = false; t.completedAt = null; saveTasks(); renderTodayView(); renderHome(); updateBadge(); }
  clearTimeout(_undoTimer);
  document.getElementById('undoToast').classList.remove('show');
  _undoTaskId = null;
}

// ── QUICK MEMO ──
function saveQuickMemo(val) { localStorage.setItem('hd_quick_memo', val); }
function loadQuickMemo() { return localStorage.getItem('hd_quick_memo') || ''; }

// ── DATA SAVE FUNCTIONS ──
function saveTasks() { localStorage.setItem('hd_tasks', JSON.stringify(tasks)); saveToSupabase(); }
function saveTaskNote(id, val) { setTaskNote(id, val); }
function saveTaskCategory(id, val) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.category = val;
  saveTasks();
  renderTodayView();
  renderHome();
}
function saveTaskDue(id, val) {
  const t = tasks.find(t => String(t.id) === String(id));
  if (!t) return;
  t.due = val;
  saveTasks();
  renderTodayView();
  renderHome();
}

// ── DUE DATE LABEL ──
function fmtTaskDueLabel(due) {
  if (!due) return { label: '＋ 期限', cls: 'tv-due-empty' };
  const today = getTodayDate();
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d - today) / 86400000);
  const thisYear = today.getFullYear();
  const shortLabel = d.getFullYear() === thisYear
    ? `${d.getMonth()+1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  if (diff < 0) return { label: shortLabel, cls: 'tv-due-overdue' };
  if (diff === 0) return { label: '今日', cls: 'tv-due-today' };
  if (diff === 1) return { label: '明日', cls: 'tv-due-soon' };
  return { label: shortLabel, cls: diff <= 7 ? 'tv-due-soon' : '' };
}

// ── OPEN DUE DATE PICKER ──
function openDuePicker(id, el) {
  const wrap = el.closest('.tv-due-wrap');
  const input = wrap.querySelector('.tv-due-input');
  const t = tasks.find(tt => String(tt.id) === String(id));
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

// ── TASK ROW HTML ──
function tvRowHTML(t) {
  const color = getCatColor(t.category);
  const isPinned = !!t.isPinned;
  const tags = [...new Set(t.tags || [])].slice(0, 3);
  const tagsHTML = tags.map(tag => `<span class="tv-tag-chip tag-${esc(tag)}">${esc(tag)}</span>`).join('');
  const timeHTML = t.dueTime ? `<span class="tv-time">${esc(t.dueTime)}</span>` : '';
  const dueInfo = fmtTaskDueLabel(t.due);
  const dueHTML = `<div class="tv-due-wrap"><span class="tv-due ${dueInfo.cls}" onclick="event.stopPropagation();openDuePicker('${esc(String(t.id))}',this)">${dueInfo.label}</span><input type="date" class="tv-due-input" tabindex="-1"></div>`;
  return `<div class="tv-row" data-task-id="${esc(t.id)}">
    <span class="tv-dot" style="background:${color}"></span>
    <div class="tv-title">${esc(t.title)}</div>
    ${dueHTML}
    ${timeHTML}
    <button class="tv-pin${isPinned ? ' pinned' : ''}" onclick="event.stopPropagation();togglePin('${esc(String(t.id))}')">${isPinned ? '★' : '☆'}</button>
    <span class="tv-cat" style="background:${color}">${esc(t.category)}</span>
    <div class="tv-tags" onclick="event.stopPropagation();openTvTagEditor('${esc(String(t.id))}',event)">${tagsHTML}${tags.length===0?'<span style="font-size:11px;color:var(--mute);cursor:pointer;">+ タグ</span>':''}</div>
    <button class="tv-done-btn" onclick="event.stopPropagation();completeTask('${esc(String(t.id))}')" title="完了にする">完了</button>
  </div>`;
}

// ── SECTION SORT (pinned first, then by due date) ──
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

// ── ACCORDION TOGGLE ──
function toggleSection(key) {
  tvOpenSections[key] = !tvOpenSections[key];
  renderTodayView();
}

// ── OPEN ADD FORM FOR SECTION ──
function openAddTaskForSection(sec) {
  const f = document.getElementById('addTaskForm');
  if (!f.classList.contains('open')) { f.classList.add('open'); }
  document.getElementById('taskTitle').focus();
  document.getElementById('taskDue').value = sec === 'today' ? new Date().toISOString().split('T')[0] : '';
}

// ── HELPER ──
function updateEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ── PROGRESS DONUT ──
function renderProgressDonut(todayDone, todayTotal) {
  if (todayTotal === 0) return '<div class="trs-donut-empty">今日のタスクなし</div>';
  const pct = Math.round((todayDone / todayTotal) * 100);
  const r = 56, c = 2 * Math.PI * r;
  const doneLen = (todayDone / todayTotal) * c;
  return `<svg viewBox="0 0 160 160" class="trs-donut-svg">
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="16"/>
    ${todayDone > 0 ? `<circle cx="80" cy="80" r="${r}" fill="none" stroke="#5a6b3a" stroke-width="16" stroke-dasharray="${doneLen} ${c - doneLen}" stroke-dashoffset="0" transform="rotate(-90 80 80)"/>` : ''}
    <text x="80" y="78" text-anchor="middle" class="trs-donut-num">${pct}%</text>
    <text x="80" y="98" text-anchor="middle" class="trs-donut-label">${todayDone}/${todayTotal}件完了</text>
  </svg>`;
}

// ── RENDER TODAY VIEW (main todo render) ──
function renderTodayView() {
  const now = getTodayDate();
  const thisSun = getThisWeekSunday(now);
  const pending = tasks.filter(t => !t.done);

  const todayTasks    = pending.filter(t => classifyTask(t, now, thisSun) === 'today');
  const thisweekTasks = pending.filter(t => classifyTask(t, now, thisSun) === 'thisweek');
  const laterTasks    = pending.filter(t => classifyTask(t, now, thisSun) === 'later');
  const undefTasks    = pending.filter(t => classifyTask(t, now, thisSun) === 'undef');

  // 1. 左サイドバー
  updateEl('tvCntAll', pending.length);
  updateEl('tvCntToday', todayTasks.length);
  updateEl('tvCntThisweek', thisweekTasks.length);
  updateEl('tvCntLater', laterTasks.length);
  updateEl('tvCntUndef', undefTasks.length);

  const catNav = document.getElementById('tvCatNav');
  if (catNav) {
    const cats = [...new Set(tasks.map(t => t.category))];
    catNav.innerHTML = cats.map(cat => {
      const cnt = pending.filter(t => t.category === cat).length;
      const isAct = todoState.sectionFilter === cat;
      const col = getCatColor(cat);
      return `<button class="ts-sec-item${isAct ? ' active' : ''}" onclick="setCatFilter('${esc(cat)}')">
        <span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0"></span>
        <span style="flex:1;margin-left:6px">${esc(cat)}</span>
        <span class="ts-sec-cnt">${cnt}</span>
      </button>`;
    }).join('');
  }

  const allTagsMap = {};
  pending.forEach(t => { (t.tags || []).forEach(tag => { allTagsMap[tag] = (allTagsMap[tag] || 0) + 1; }); });
  const sortedTags = Object.entries(allTagsMap).sort((a, b) => b[1] - a[1]);

  const tagNav = document.getElementById('tvTagNav');
  if (tagNav) {
    tagNav.innerHTML = sortedTags.slice(0, 8).map(([tag]) => {
      const isAct = todoState.tagFilter === tag;
      return `<button class="tv-sidebar-tag tv-tag-chip tag-${esc(tag)}${isAct ? ' active' : ''}" onclick="setTagFilter('${esc(tag)}')">${esc(tag)}</button>`;
    }).join('');
  }

  // 2. ヘッダー
  updateEl('tvMainTitle', '今日やること');
  updateEl('tvMainDate', fmtFull(new Date()));

  // 3. 統計カード
  const todayAllTasks = tasks.filter(t => t.due && new Date(t.due + 'T00:00:00') <= now);
  const todayDone = todayAllTasks.filter(t => t.done).length;
  const todayTotal = todayAllTasks.length;
  const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : null;
  const statsEl = document.getElementById('tvStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="tv-stat-card"><div class="tv-stat-label">今日</div><div class="tv-stat-num">${todayTasks.length}</div><div class="tv-stat-sub">件</div></div>
      <div class="tv-stat-card"><div class="tv-stat-label">今週</div><div class="tv-stat-num">${thisweekTasks.length}</div><div class="tv-stat-sub">件</div></div>
      <div class="tv-stat-card"><div class="tv-stat-label">未定</div><div class="tv-stat-num">${undefTasks.length}</div><div class="tv-stat-sub">件</div></div>
      <div class="tv-stat-card"><div class="tv-stat-label">進捗</div><div class="tv-stat-num">${pct !== null ? pct + '%' : '—'}</div><div class="tv-stat-sub">${todayTotal > 0 ? `${todayDone}/${todayTotal}件完了` : '今日のタスクなし'}</div></div>`;
  }

  // 4. フィルタリング
  let filtered = pending;
  if (todoState.sectionFilter) filtered = filtered.filter(t => t.category === todoState.sectionFilter);
  if (todoState.tagFilter) filtered = filtered.filter(t => (t.tags || []).includes(todoState.tagFilter));
  if (todoState.viewFilter === 'today')    filtered = filtered.filter(t => classifyTask(t, now, thisSun) === 'today');
  else if (todoState.viewFilter === 'thisweek') filtered = filtered.filter(t => classifyTask(t, now, thisSun) === 'thisweek');
  else if (todoState.viewFilter === 'later')    filtered = filtered.filter(t => classifyTask(t, now, thisSun) === 'later');
  else if (todoState.viewFilter === 'undef')    filtered = filtered.filter(t => classifyTask(t, now, thisSun) === 'undef');

  // 5/6. セクション描画
  const sections = [
    { key:'today',    label:'📅 今日', tasks: filtered.filter(t => classifyTask(t, now, thisSun) === 'today') },
    { key:'thisweek', label:'📆 今週', tasks: filtered.filter(t => classifyTask(t, now, thisSun) === 'thisweek') },
    { key:'later',    label:'🗓 後で', tasks: filtered.filter(t => classifyTask(t, now, thisSun) === 'later') },
    { key:'undef',    label:'💭 未定', tasks: filtered.filter(t => classifyTask(t, now, thisSun) === 'undef') },
  ];

  const sectionsEl = document.getElementById('tvSections');
  if (!sectionsEl) return;
  let html = '';
  sections.forEach(sec => {
    const sorted = sortSectionTasks(sec.tasks);
    if (sec.key === 'today') {
      html += `<div class="tv-section">
        <div class="tv-sec-hdr today-hdr">
          <span class="tv-sec-label">${sec.label}</span>
          <span class="tv-sec-count">&nbsp;(${sorted.length}件)</span>
          <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink3)">期限が近い順</span>
        </div>
        <div>${sorted.map(t => tvRowHTML(t)).join('')}</div>
        <div class="tv-add-row" onclick="openAddTaskForSection('today')">＋ タスクを追加</div>
      </div>`;
    } else {
      if (!sorted.length) return;
      const isOpen = tvOpenSections[sec.key];
      html += `<div class="tv-section">
        <div class="tv-sec-hdr" onclick="toggleSection('${sec.key}')">
          <span class="tv-sec-label">${sec.label}</span>
          <span class="tv-sec-count">&nbsp;(${sorted.length}件)</span>
          <span class="tv-sec-chevron">${isOpen ? '▲' : '▼'}</span>
        </div>`;
      if (isOpen) {
        html += `<div>${sorted.map(t => tvRowHTML(t)).join('')}</div>
        <div class="tv-add-row" onclick="openAddTaskForSection('${sec.key}')">＋ タスクを追加</div>`;
      } else {
        const preview = sorted.slice(0, 3);
        const remaining = sorted.length - 3;
        html += `<div class="tv-sec-preview">
          ${preview.map(t => `<span class="tv-sec-preview-item">・${esc(t.title)}</span>`).join('')}
          ${remaining > 0 ? `<span class="tv-sec-preview-more" onclick="toggleSection('${sec.key}')">+ さらに${remaining}件を表示</span>` : ''}
        </div>`;
      }
      html += `</div>`;
    }
  });
  if (!html) html = '<div class="empty" style="padding:40px 24px"><div class="ei">✓</div><div>タスクがありません</div></div>';
  sectionsEl.innerHTML = html;

  // 7. 右サイドバー
  const progressEl = document.getElementById('tvProgress');
  if (progressEl) {
    progressEl.innerHTML = renderProgressDonut(todayDone, todayTotal) +
      `<ul class="trs-donut-legend" style="margin-top:10px">
        <li><span class="dot" style="background:#dc2626"></span>今日<span class="n">${todayTasks.length}</span></li>
        <li><span class="dot" style="background:#f59e0b"></span>今週<span class="n">${thisweekTasks.length}</span></li>
        <li><span class="dot" style="background:#2563eb"></span>後で<span class="n">${laterTasks.length}</span></li>
        <li><span class="dot" style="background:#9ca3af"></span>未定<span class="n">${undefTasks.length}</span></li>
      </ul>`;
  }

  const days7 = '日月火水木金土'.split('');
  const upcomingEl = document.getElementById('tvUpcoming');
  if (upcomingEl) {
    const items = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      tasks.filter(t => !t.done && t.due === ds)
        .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''))
        .forEach(t => items.push({ date: d, task: t }));
    }
    upcomingEl.innerHTML = items.length
      ? items.slice(0, 8).map(({ date, task: t }) => {
          const ds2 = `${date.getMonth() + 1}/${date.getDate()}(${days7[date.getDay()]})`;
          const ts = t.dueTime ? ` ${t.dueTime}` : '';
          return `<div class="tv-upcoming-item"><span class="tv-upcoming-date">${ds2}${ts}</span><span class="tv-upcoming-title">${esc(t.title)}</span></div>`;
        }).join('')
      : '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--mute);padding:6px 0">今後7日間の予定はありません</div>';
  }

  const topTagsEl = document.getElementById('tvTopTags');
  if (topTagsEl) {
    topTagsEl.innerHTML = sortedTags.slice(0, 6).map(([tag]) => {
      const isAct = todoState.tagFilter === tag;
      return `<button class="trs-tag-btn tv-tag-chip tag-${esc(tag)}${isAct ? ' active' : ''}" onclick="setTagFilter('${esc(tag)}')">${esc(tag)}</button>`;
    }).join('');
  }

  const doneTodayEl = document.getElementById('tvDoneToday');
  if (doneTodayEl) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const doneTodayCnt = tasks.filter(t => t.done && t.completedAt && t.completedAt.startsWith(todayStr)).length;
    const doneAllCnt = tasks.filter(t => t.done).length;
    const doneTasks = tasks.filter(t => t.done);
    doneTodayEl.innerHTML = `
      <div style="font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:var(--ok)">${doneTodayCnt}件</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mute);margin-top:2px">今日完了</div>
      <div style="margin-top:8px;">
        <button onclick="toggleDoneList()" style="background:none;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink3);padding:0;text-decoration:underline;">累計 ${doneAllCnt}件完了 ›</button>
      </div>
      <div id="tvDoneList" style="display:none;margin-top:8px;max-height:200px;overflow-y:auto;">
        ${doneTasks.length ? doneTasks.map(t=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--rule);color:var(--ink2);display:flex;align-items:center;gap:6px;">
          <button onclick="undoCompleteById('${t.id}')" style="background:none;border:1px solid var(--rule);border-radius:3px;cursor:pointer;font-size:10px;padding:1px 5px;color:var(--ink3);flex-shrink:0;">戻す</button>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.title)}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--mute);padding:4px 0;">完了タスクなし</div>'}
      </div>`;
  }

  const memoEl = document.getElementById('tvQuickMemo');
  if (memoEl && !memoEl._loaded) {
    memoEl.value = loadQuickMemo();
    memoEl._loaded = true;
  }
}

function toggleDoneList() {
  const el = document.getElementById('tvDoneList');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── TAG EDITOR ──
let _tvTagEditId = null;
const TV_ALL_TAGS = ['重要','手続き','準備','連絡','見直し','家事','検討','レジャー','学習','経理','買い物','修理','引っ越し'];

function openTvTagEditor(id, e) {
  _tvTagEditId = id;
  const t = tasks.find(t => String(t.id) === String(id));
  if (!t) return;
  const tags = Array.isArray(t.tags) ? t.tags : [];
  // タスクが持つタグ ＋ 全既存タグ ＋ TV_ALL_TAGS の和集合
  const allTags = [...new Set([...TV_ALL_TAGS, ...tasks.flatMap(tt => tt.tags||[]), ...tags])];
  const pop = document.getElementById('tvTagPop');
  document.getElementById('tvTagPopGrid').innerHTML = allTags.map(tag =>
    `<span class="tv-tag-pop-chip tag-${esc(tag)}${tags.includes(tag)?' sel':''}" onclick="tvToggleTag('${esc(tag)}')">${esc(tag)}</span>`
  ).join('');
  document.getElementById('tvTagPopInput').value = '';
  // 位置計算
  const rect = e.currentTarget.getBoundingClientRect();
  pop.style.top = (rect.bottom + 4) + 'px';
  pop.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
  pop.classList.add('open');
  e.stopPropagation();
}

function tvToggleTag(tag) {
  const t = tasks.find(t => String(t.id) === String(_tvTagEditId));
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
    `<span class="tv-tag-pop-chip tag-${esc(tag2)}${(t.tags||[]).includes(tag2)?' sel':''}" onclick="tvToggleTag('${esc(tag2)}')">${esc(tag2)}</span>`
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

function undoCompleteById(id) {
  const t = tasks.find(t => String(t.id) === String(id));
  if (t) { t.done = false; t.completedAt = null; saveTasks(); renderTodayView(); renderHome(); updateBadge(); }
}
