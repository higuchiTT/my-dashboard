// ── REFLECTIONS (Notes) ──
function saveReflections() { localStorage.setItem('reflections', JSON.stringify(reflections)); saveToSupabase(); }

function renderNotes() {
  // Initialize date input to today if empty
  const dateIn = document.getElementById('notesDateInput');
  if (dateIn && !dateIn.value) dateIn.value = today();
  _renderNotesInputChips();
  _renderNotesFilterPills();
  _renderNotesList();
  _renderNotesCalendar();
  // Mobile: restore open state
  try {
    const open = localStorage.getItem('notes_cal_open') === '1';
    const body = document.getElementById('notesCalMobBody');
    const arrow = document.getElementById('notesCalMobArrow');
    if (body && open) { body.classList.add('open'); if (arrow) arrow.textContent = '▴'; }
  } catch(e) {}
}

function _getTagUsage() {
  const map = {};
  reflections.forEach(r => { (r.tags||[]).forEach(t => { map[t] = (map[t]||0)+1; }); });
  return map;
}

function _renderNotesInputChips() {
  const el = document.getElementById('notesInputTagChips');
  if (!el) return;
  el.innerHTML = notesNewTags.map((t,i) =>
    `<span class="notes-tag-chip-in">${esc(t)}<button type="button" class="notes-tag-chip-in-x" onclick="event.stopPropagation();notesRemoveInputTag(${i})">×</button></span>`
  ).join('');
}

function notesRemoveInputTag(i) {
  notesNewTags.splice(i, 1);
  _renderNotesInputChips();
  document.getElementById('notesTagTextIn')?.focus();
}

function notesBodyInput(e) {
  const ta = e.target;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function notesNewBodyKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNewNote(); }
}

function notesInputTagKeydown(e) {
  const input = e.target;
  const val = input.value;
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const tag = val.trim().replace(/,/g, '');
    if (tag && !notesNewTags.includes(tag)) { notesNewTags.push(tag); }
    input.value = '';
    _renderNotesInputChips();
    _notesHideInputAC();
  } else if (e.key === 'Backspace' && !val && notesNewTags.length > 0) {
    notesNewTags.pop();
    _renderNotesInputChips();
  }
}

function notesInputTagOninput(e) {
  const val = e.target.value;
  if (val.endsWith(',')) {
    const tag = val.slice(0, -1).trim();
    if (tag && !notesNewTags.includes(tag)) { notesNewTags.push(tag); }
    e.target.value = '';
    _renderNotesInputChips();
    _notesHideInputAC();
    return;
  }
  _notesShowAC('notesInputTagAC', val, notesNewTags, notesPickInputAcTag);
}

function _notesHideInputAC() {
  document.getElementById('notesInputTagAC')?.classList.remove('open');
}

function _notesShowAC(acId, q, existingTags, pickFn) {
  const ac = document.getElementById(acId);
  if (!ac) return;
  if (!q.trim()) { ac.classList.remove('open'); return; }
  const usage = _getTagUsage();
  const matches = Object.entries(usage)
    .filter(([t]) => t.toLowerCase().includes(q.toLowerCase()) && !existingTags.includes(t))
    .sort((a,b) => b[1]-a[1]).slice(0, 6);
  if (!matches.length) { ac.classList.remove('open'); return; }
  ac.innerHTML = matches.map(([t]) =>
    `<div class="notes-tag-ac-item" onmousedown="event.preventDefault();${pickFn.name}(${jsq(t)})">${esc(t)}</div>`
  ).join('');
  ac.classList.add('open');
}

function notesPickInputAcTag(tag) {
  if (!notesNewTags.includes(tag)) notesNewTags.push(tag);
  const inp = document.getElementById('notesTagTextIn');
  if (inp) inp.value = '';
  _renderNotesInputChips();
  _notesHideInputAC();
  inp?.focus();
}

function saveNewNote() {
  const body = document.getElementById('notesBodyInput')?.value.trim();
  if (!body) { document.getElementById('notesBodyInput')?.focus(); return; }
  const date = document.getElementById('notesDateInput')?.value || today();
  const now = new Date().toISOString();
  const note = { id: crypto.randomUUID(), date, body, tags: [...notesNewTags], createdAt: now, updatedAt: now };
  reflections.unshift(note);
  saveReflections();
  // Reset input
  const ta = document.getElementById('notesBodyInput');
  if (ta) { ta.value = ''; ta.style.height = ''; }
  const dateIn = document.getElementById('notesDateInput');
  if (dateIn) dateIn.value = today();
  notesNewTags = [];
  _renderNotesInputChips();
  _notesHideInputAC();
  notesVisibleCount = 50;
  _renderNotesFilterPills();
  _renderNotesList();
  _renderNotesCalendar();
  // Scroll to the newly saved note's date and highlight
  const savedDate = note.date;
  setTimeout(() => {
    const dayEl = document.getElementById(`notesDay-${savedDate}`);
    if (dayEl) {
      dayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const lbl = dayEl.querySelector('.notes-date-label');
      if (lbl) {
        lbl.classList.remove('notes-date-hl');
        void lbl.offsetWidth;
        lbl.classList.add('notes-date-hl');
      }
    }
  }, 60);
}

function setNotesTagFilter(tag) {
  notesFilter.tag = (tag && notesFilter.tag !== tag) ? tag : null; // 同じタグをもう一度押すと解除
  notesVisibleCount = 50;
  _renderNotesFilterPills();
  _renderNotesList();
  _renderNotesCalendar();
}

function setNotesSearch(val) {
  notesFilter.search = val;
  notesVisibleCount = 50;
  _renderNotesList();
  _renderNotesCalendar();
}

function _renderNotesFilterPills() {
  const usage = _getTagUsage();
  const topTags = Object.entries(usage).sort((a,b) => b[1]-a[1]).slice(0, 15).map(([t]) => t);
  const el = document.getElementById('notesTagPills');
  if (!el) return;
  el.innerHTML = `<button class="ui-pill${!notesFilter.tag?' active':''}" onclick="setNotesTagFilter(null)">すべて</button>`
    + topTags.map(t => `<button class="ui-pill${notesFilter.tag===t?' active':''}" onclick="setNotesTagFilter(${jsq(t)})">${esc(t)}</button>`).join('');
}

function _getFilteredReflections() {
  let list = reflections.slice();
  if (notesFilter.tag) list = list.filter(r => (r.tags||[]).includes(notesFilter.tag));
  if (notesFilter.search) {
    const q = notesFilter.search.toLowerCase();
    list = list.filter(r => (r.body||'').toLowerCase().includes(q) || (r.tags||[]).some(t => t.toLowerCase().includes(q)));
  }
  return list;
}

function _noteNeedsExpand(body) {
  const lines = (body||'').split('\n');
  return lines.length > 6 || (body||'').length > 350;
}

function _renderNotesList() {
  const el = document.getElementById('notesList');
  if (!el) return;
  const list = _getFilteredReflections();
  list.sort((a,b) => {
    if (b.date !== a.date) return b.date < a.date ? -1 : 1;
    return (b.createdAt||'') < (a.createdAt||'') ? -1 : 1;
  });
  if (list.length === 0) {
    const msg = (notesFilter.tag || notesFilter.search)
      ? '該当するメモはありません'
      : 'まだメモがありません。気づいたことを書いてみましょう';
    el.innerHTML = `<div class="notes-empty">${esc(msg)}</div>`;
    return;
  }
  const visible = list.slice(0, notesVisibleCount);
  const hasMore = list.length > notesVisibleCount;
  const groups = {};
  const dateOrder = [];
  visible.forEach(r => {
    if (!groups[r.date]) { groups[r.date] = []; dateOrder.push(r.date); }
    groups[r.date].push(r);
  });
  const uniqueDates = [...new Set(dateOrder)];
  const todayStr = today();
  const yesterdayStr = localDate(new Date(new Date(todayStr+'T00:00:00').getTime() - 86400000));
  const currentYear = new Date().getFullYear();
  const DOW = '日月火水木金土'.split('');
  // 月ごとの件数（絞り込み後の全件で数える）
  const monthCount = {};
  list.forEach(r => { const ym = (r.date||'').slice(0,7); monthCount[ym] = (monthCount[ym]||0) + 1; });
  const mast = document.querySelector('.masthead');
  if (mast) document.documentElement.style.setProperty('--mast-h', mast.offsetHeight + 'px');
  let html = '';
  let curYm = null;
  uniqueDates.forEach(date => {
    const ym = date.slice(0,7);
    if (ym !== curYm) {
      curYm = ym;
      const [yy, mm] = ym.split('-').map(Number);
      html += `<div class="notes-month-hdr" id="notesMonth-${esc(ym)}"><span class="notes-month-label">${yy}年${mm}月</span><span class="notes-month-count">${monthCount[ym]||0}件</span></div>`;
    }
    const dObj = new Date(date + 'T00:00:00');
    const dowCls = dObj.getDay()===6 ? ' is-sat' : dObj.getDay()===0 ? ' is-sun' : '';
    let label;
    if (date === todayStr) label = '今日';
    else if (date === yesterdayStr) label = '昨日';
    else {
      const d = new Date(date + 'T00:00:00');
      const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate(), dow = DOW[d.getDay()];
      label = y === currentYear ? `${m}/${day}（${dow}）` : `${y}/${m}/${day}（${dow}）`;
    }
    html += `<div class="notes-date-group" id="notesDay-${esc(date)}">
      <div class="notes-date-label${dowCls}">${esc(label)}</div>
      ${groups[date].map(r => _notesRenderCard(r)).join('')}
    </div>`;
  });
  if (hasMore) {
    html += `<div class="notes-load-more"><button class="notes-load-more-btn" onclick="notesLoadMore()">もっと見る（あと${list.length - notesVisibleCount}件）</button></div>`;
  }
  el.innerHTML = html;
}

function _notesRenderCard(r) {
  const isEditing = notesEditId === String(r.id);
  if (isEditing) {
    return `<div class="notes-card notes-card-pos" id="notes-card-${esc(String(r.id))}">
      <div class="notes-edit-area">
        <textarea class="notes-edit-body-ta" id="notesEditBodyInput" oninput="notesBodyInput(event)"
          onkeydown="notesEditBodyKeydown(event,'${esc(String(r.id))}')">${esc(r.body||'')}</textarea>
        <div class="notes-edit-bottom">
          <input type="date" class="notes-edit-date-in" id="notesEditDateInput" value="${esc(r.date||'')}">
          <div class="notes-tag-wrap" id="notesEditTagWrap" onclick="event.stopPropagation();document.getElementById('notesEditTagTextIn')?.focus()">
            <span id="notesEditTagChips">${notesEditTags.map((t,i)=>`<span class="notes-tag-chip-in">${esc(t)}<button type="button" class="notes-tag-chip-in-x" onclick="event.stopPropagation();notesEditRemoveTag(${i})">×</button></span>`).join('')}</span>
            <input type="text" id="notesEditTagTextIn" class="notes-tag-text-in" placeholder="タグを追加（Enter）"
              onkeydown="notesEditTagKeydown(event)" oninput="notesEditTagOninput(event)" onblur="document.getElementById('notesEditTagAC')?.classList.remove('open')">
            <div class="notes-tag-autocomplete" id="notesEditTagAC"></div>
          </div>
        </div>
        <div class="notes-edit-actions">
          <button class="draft-btn-cancel" onclick="cancelNotesEdit()">キャンセル</button>
          <button class="draft-btn-save" onclick="saveNotesEdit('${esc(String(r.id))}')">保存</button>
        </div>
      </div>
    </div>`;
  }
  const needsExpand = _noteNeedsExpand(r.body||'');
  const time = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'}) : '';
  const edited = r.updatedAt && r.updatedAt !== r.createdAt ? '<span style="font-size:10px;color:var(--mute);margin-left:4px;">編集済</span>' : '';
  const tagsHtml = (r.tags||[]).length
    ? `<div class="notes-card-tags">${(r.tags||[]).map(t=>`<button class="notes-card-tag${notesFilter.tag===t?' active':''}" onclick="event.stopPropagation();setNotesTagFilter(${jsq(t)})">${esc(t)}</button>`).join('')}</div>`
    : '';
  return `<div class="notes-card notes-card-pos" id="notes-card-${esc(String(r.id))}">
    <div class="notes-card-header">
      <span class="notes-card-time">${esc(time)}${edited}</span>
      <button class="notes-card-more-btn" onclick="event.stopPropagation();notesToggleMenu('${esc(String(r.id))}')" aria-label="メニュー">…</button>
      <div class="notes-card-menu" id="notes-menu-${esc(String(r.id))}" onclick="event.stopPropagation()">
        <button onclick="event.stopPropagation();startNotesEdit('${esc(String(r.id))}')">編集</button>
        <button class="danger" onclick="event.stopPropagation();notesShowDelConfirm('${esc(String(r.id))}')">削除</button>
      </div>
    </div>
    <div class="notes-card-body${needsExpand?' collapsed':''}" id="notes-body-${esc(String(r.id))}">${esc(r.body||'')}</div>
    ${needsExpand ? `<button class="notes-card-expand-btn" id="notes-expand-${esc(String(r.id))}" onclick="event.stopPropagation();notesToggleExpand('${esc(String(r.id))}')">続きを読む</button>` : ''}
    ${tagsHtml}
    <div class="notes-del-confirm" id="notes-del-${esc(String(r.id))}" onclick="event.stopPropagation()">
      <div class="notes-del-confirm-text">このメモを削除しますか？</div>
      <div class="notes-del-confirm-btns">
        <button class="notes-del-yes" onclick="event.stopPropagation();deleteNote('${esc(String(r.id))}')">削除する</button>
        <button class="notes-del-no" onclick="event.stopPropagation();notesHideDelConfirm('${esc(String(r.id))}')">キャンセル</button>
      </div>
    </div>
  </div>`;
}

function notesToggleMenu(id) {
  const menuEl = document.getElementById('notes-menu-'+id);
  if (!menuEl) return;
  const wasOpen = menuEl.classList.contains('open');
  document.querySelectorAll('.notes-card-menu.open').forEach(m => m.classList.remove('open'));
  if (!wasOpen) menuEl.classList.add('open');
}

function startNotesEdit(id) {
  const r = reflections.find(r => String(r.id) === String(id));
  if (!r) return;
  notesEditId = String(id);
  notesEditTags = [...(r.tags||[])];
  document.querySelectorAll('.notes-card-menu.open').forEach(m => m.classList.remove('open'));
  _renderNotesList();
  setTimeout(() => {
    const ta = document.getElementById('notesEditBodyInput');
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight+'px'; ta.focus(); }
  }, 30);
}

function cancelNotesEdit() {
  notesEditId = null;
  notesEditTags = [];
  _renderNotesList();
}

function notesEditBodyKeydown(e, id) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNotesEdit(id); }
  if (e.key === 'Escape') { e.preventDefault(); cancelNotesEdit(); }
}

function saveNotesEdit(id) {
  const r = reflections.find(r => String(r.id) === String(id));
  if (!r) return;
  const body = document.getElementById('notesEditBodyInput')?.value.trim();
  if (!body) return;
  const date = document.getElementById('notesEditDateInput')?.value || r.date;
  r.body = body;
  r.date = date;
  r.tags = [...notesEditTags];
  r.updatedAt = new Date().toISOString();
  notesEditId = null;
  notesEditTags = [];
  saveReflections();
  _renderNotesList();
  _renderNotesCalendar();
}

function notesEditRemoveTag(i) {
  notesEditTags.splice(i, 1);
  _renderEditTagChips();
  document.getElementById('notesEditTagTextIn')?.focus();
}

function _renderEditTagChips() {
  const el = document.getElementById('notesEditTagChips');
  if (!el) return;
  el.innerHTML = notesEditTags.map((t,i) =>
    `<span class="notes-tag-chip-in">${esc(t)}<button type="button" class="notes-tag-chip-in-x" onclick="event.stopPropagation();notesEditRemoveTag(${i})">×</button></span>`
  ).join('');
}

function notesEditTagKeydown(e) {
  const input = e.target;
  const val = input.value;
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const tag = val.trim().replace(/,/g, '');
    if (tag && !notesEditTags.includes(tag)) { notesEditTags.push(tag); }
    input.value = '';
    _renderEditTagChips();
    document.getElementById('notesEditTagAC')?.classList.remove('open');
  } else if (e.key === 'Backspace' && !val && notesEditTags.length > 0) {
    notesEditTags.pop();
    _renderEditTagChips();
  }
}

function notesEditTagOninput(e) {
  const val = e.target.value;
  if (val.endsWith(',')) {
    const tag = val.slice(0,-1).trim();
    if (tag && !notesEditTags.includes(tag)) { notesEditTags.push(tag); }
    e.target.value = '';
    _renderEditTagChips();
    document.getElementById('notesEditTagAC')?.classList.remove('open');
    return;
  }
  const ac = document.getElementById('notesEditTagAC');
  if (!ac || !val.trim()) { ac?.classList.remove('open'); return; }
  const usage = _getTagUsage();
  const matches = Object.entries(usage)
    .filter(([t]) => t.toLowerCase().includes(val.toLowerCase()) && !notesEditTags.includes(t))
    .sort((a,b) => b[1]-a[1]).slice(0, 6);
  if (!matches.length) { ac.classList.remove('open'); return; }
  ac.innerHTML = matches.map(([t]) =>
    `<div class="notes-tag-ac-item" onmousedown="event.preventDefault();notesEditPickAcTag(${jsq(t)})">${esc(t)}</div>`
  ).join('');
  ac.classList.add('open');
}

function notesEditPickAcTag(tag) {
  if (!notesEditTags.includes(tag)) notesEditTags.push(tag);
  const inp = document.getElementById('notesEditTagTextIn');
  if (inp) inp.value = '';
  _renderEditTagChips();
  document.getElementById('notesEditTagAC')?.classList.remove('open');
  inp?.focus();
}

function notesShowDelConfirm(id) {
  document.querySelectorAll('.notes-card-menu.open').forEach(m => m.classList.remove('open'));
  const el = document.getElementById('notes-del-'+id);
  if (el) el.classList.add('open');
}

function notesHideDelConfirm(id) {
  const el = document.getElementById('notes-del-'+id);
  if (el) el.classList.remove('open');
}

function deleteNote(id) {
  reflections = reflections.filter(r => String(r.id) !== String(id));
  saveReflections();
  _renderNotesList();
  _renderNotesFilterPills();
  _renderNotesCalendar();
}

function notesToggleExpand(id) {
  const body = document.getElementById('notes-body-'+id);
  const btn = document.getElementById('notes-expand-'+id);
  if (!body || !btn) return;
  const isCollapsed = body.classList.contains('collapsed');
  body.classList.toggle('collapsed', !isCollapsed);
  btn.textContent = isCollapsed ? '折りたたむ' : '続きを読む';
}

function notesLoadMore() {
  notesVisibleCount += 50;
  _renderNotesList();
  _renderNotesCalendar();
}

// ── NOTES CALENDAR ──
function _getNotesDateMap() {
  // Returns map: dateStr -> count of matching reflections
  const filtered = _getFilteredReflections();
  const map = {};
  filtered.forEach(r => { map[r.date] = (map[r.date]||0) + 1; });
  return map;
}

function _renderNotesCalendar() {
  const months = '1月 2月 3月 4月 5月 6月 7月 8月 9月 10月 11月 12月'.split(' ');
  const { y, m } = _notesCal;
  const todayStr = today();
  const dateMap = _getNotesDateMap();

  const calHTML = `
    <div class="notes-mcal-top">
      <button class="notes-mcal-nav" onclick="notesCalNav(-1)">‹</button>
      <div class="notes-mcal-month">${y}年 ${months[m]}</div>
      <button class="notes-mcal-nav" onclick="notesCalNav(1)">›</button>
      <button class="notes-mcal-today-btn" onclick="notesCalToday()">今月</button>
    </div>
    <div class="notes-mcal-dow-row">
      <div class="notes-mcal-dow dow-sun">日</div>
      <div class="notes-mcal-dow">月</div>
      <div class="notes-mcal-dow">火</div>
      <div class="notes-mcal-dow">水</div>
      <div class="notes-mcal-dow">木</div>
      <div class="notes-mcal-dow">金</div>
      <div class="notes-mcal-dow dow-sat">土</div>
    </div>
    <div class="notes-mcal-grid">${_buildNotesMiniCalGrid(y, m, todayStr, dateMap)}</div>
  `;
  const pc = document.getElementById('notesMiniCal');
  if (pc) pc.innerHTML = calHTML;
  const mob = document.getElementById('notesCalMobBody');
  if (mob) mob.innerHTML = calHTML;
}

function _buildNotesMiniCalGrid(y, m, todayStr, dateMap) {
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ d: prevDays - i, other: true, dow: (7 - firstDow + (firstDow - 1 - i)) % 7 });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, other: false, dow: (firstDow + d - 1) % 7 });
  while (cells.length % 7 !== 0) cells.push({ d: cells.length - daysInMonth - firstDow + 1, other: true, dow: cells.length % 7 });

  return cells.map(c => {
    if (c.other) return `<div class="notes-mcal-cell notes-mcal-other"><span class="notes-mcal-num">${c.d}</span></div>`;
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(c.d).padStart(2,'0')}`;
    const isToday = ds === todayStr;
    const cnt = dateMap[ds] || 0;
    const dowCls = c.dow === 0 ? ' dow-sun' : c.dow === 6 ? ' dow-sat' : '';
    const dotHTML = cnt > 0 ? `<div class="notes-mcal-dot${cnt >= 2 ? ' many' : ''}"></div>` : '';
    return `<div class="notes-mcal-cell${isToday?' notes-mcal-today':''}" onclick="notesCalCellClick('${esc(ds)}')">
      <span class="notes-mcal-num${dowCls}">${c.d}</span>
      ${dotHTML}
    </div>`;
  }).join('');
}

function notesCalNav(delta) {
  _notesCal.m += delta;
  if (_notesCal.m > 11) { _notesCal.m = 0; _notesCal.y++; }
  if (_notesCal.m < 0)  { _notesCal.m = 11; _notesCal.y--; }
  _renderNotesCalendar();
  // If navigating to a month that has notes, scroll to it
  const ym = `${_notesCal.y}-${String(_notesCal.m+1).padStart(2,'0')}`;
  setTimeout(() => {
    const el = document.getElementById(`notesMonth-${ym}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function notesCalToday() {
  const now = new Date();
  _notesCal.y = now.getFullYear();
  _notesCal.m = now.getMonth();
  _renderNotesCalendar();
}

function notesCalCellClick(dateStr) {
  const cnt = _getNotesDateMap()[dateStr] || 0;
  if (cnt === 0) {
    // Set input date to this day and focus body
    const dateIn = document.getElementById('notesDateInput');
    if (dateIn) dateIn.value = dateStr;
    const ta = document.getElementById('notesBodyInput');
    if (ta) { ta.focus(); ta.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return;
  }
  // Ensure date is visible (expand notesVisibleCount if needed)
  const filtered = _getFilteredReflections();
  filtered.sort((a,b) => {
    if (b.date !== a.date) return b.date < a.date ? -1 : 1;
    return (b.createdAt||'') < (a.createdAt||'') ? -1 : 1;
  });
  const idx = filtered.findIndex(r => r.date === dateStr);
  if (idx >= notesVisibleCount) {
    notesVisibleCount = idx + 50;
    _renderNotesList();
  }
  // Scroll to the day header
  setTimeout(() => {
    const el = document.getElementById(`notesDay-${dateStr}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Briefly highlight date label
      const lbl = el.querySelector('.notes-date-label');
      if (lbl) {
        lbl.classList.remove('notes-date-hl');
        void lbl.offsetWidth;
        lbl.classList.add('notes-date-hl');
      }
    }
  }, 60);
}

function notesCalToggleMobile() {
  const body = document.getElementById('notesCalMobBody');
  const arrow = document.getElementById('notesCalMobArrow');
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (arrow) arrow.textContent = isOpen ? '▴' : '▾';
  try { localStorage.setItem('notes_cal_open', isOpen ? '1' : '0'); } catch(e) {}
  if (isOpen) _renderNotesCalendar();
}
