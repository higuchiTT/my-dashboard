// ── TRAVEL ──
let tripModalId = null;
let _currentTripId = null;
let _travelSubView = 'plan'; // 'plan' | 'review'
let _planItemModalId = null;
let _planItemTripId = null;
let _tripPhotoUploading = 0;
let _tripPhotoTargetId = null;

const PLAN_KIND_LABELS = { move:'移動', stay:'宿', see:'観光', eat:'食事', memo:'メモ' };
const PLAN_KIND_COLORS = { move:'#3b82f6', stay:'#7c3aed', see:'#10b981', eat:'#f59e0b', memo:'#9ca3af' };

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

// ── LIST VIEW ──
function toggleAddTrip() {
  const f = document.getElementById('addTripForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) document.getElementById('tripDest').focus();
}

function addTrip() {
  const dest = document.getElementById('tripDest').value.trim();
  if (!dest) { document.getElementById('tripDest').focus(); return; }
  const b = document.getElementById('tripBudgetInput').value;
  let sd = document.getElementById('tripStartDate').value;
  let ed = document.getElementById('tripEndDate').value;
  if (sd && ed && ed < sd) { document.getElementById('tripEndDate').focus(); return; }
  if (!sd && ed) sd = ed;
  trips.push({
    id: crypto.randomUUID(), dest,
    timing: document.getElementById('tripTiming').value.trim(),
    startDate: sd || null, endDate: ed || null,
    budget: b ? parseFloat(b) : null,
    status: document.getElementById('tripStatus').value,
    note: document.getElementById('tripNote').value.trim(),
    plan: [], review: { rating: 0, text: '', updatedAt: null }, photos: []
  });
  saveTrips();
  ['tripDest','tripTiming','tripBudgetInput','tripNote'].forEach(id => { document.getElementById(id).value = ''; });
  ['tripStartDate','tripEndDate'].forEach(id => { document.getElementById(id).value = ''; });
  toggleAddTrip();
  renderTravel();
}

function setTripStatus(id, status) {
  const t = trips.find(t => String(t.id) === String(id));
  if (t) { t.status = status; saveTrips(); renderTravel(); }
}

function delTrip(id) {
  trips = trips.filter(t => String(t.id) !== String(id));
  if (_currentTripId === String(id)) _currentTripId = null;
  saveTrips();
  renderTravel();
}

function saveTrips() { localStorage.setItem('hd_trips', JSON.stringify(trips)); saveToSupabase(); }

function setTripF(f, el) {
  tripFilter = f;
  document.querySelectorAll('#page-travel .fchip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderTravel();
}

// ── EDIT MODAL ──
function openTripModal(id) {
  const t = trips.find(t => String(t.id) === String(id)); if (!t) return;
  tripModalId = String(t.id);
  document.getElementById('tripModalDest').value = t.dest || '';
  document.getElementById('tripModalStart').value = t.startDate || '';
  document.getElementById('tripModalEnd').value = t.endDate || '';
  document.getElementById('tripModalTiming').value = t.timing || '';
  document.getElementById('tripModalBudget').value = t.budget != null ? t.budget : '';
  document.getElementById('tripModalStatus').value = t.status || '検討中';
  document.getElementById('tripModalNote').value = t.note || '';
  document.getElementById('tripModalDelWrap').innerHTML = `<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="confirmDelTripModal();event.stopPropagation()">削除</button>`;
  document.getElementById('tripModal').classList.add('open');
}

function closeTripModal() { document.getElementById('tripModal').classList.remove('open'); tripModalId = null; }

function saveTripModal() {
  if (!tripModalId) return;
  const t = trips.find(t => String(t.id) === tripModalId); if (!t) return;
  const dest = document.getElementById('tripModalDest').value.trim();
  if (!dest) { document.getElementById('tripModalDest').focus(); return; }
  let sd = document.getElementById('tripModalStart').value;
  let ed = document.getElementById('tripModalEnd').value;
  if (sd && ed && ed < sd) { document.getElementById('tripModalEnd').focus(); return; }
  if (!sd && ed) sd = ed;
  t.dest = dest;
  t.startDate = sd || null; t.endDate = ed || null;
  t.timing = document.getElementById('tripModalTiming').value.trim();
  const b = document.getElementById('tripModalBudget').value;
  t.budget = b ? parseFloat(b) : null;
  t.status = document.getElementById('tripModalStatus').value;
  t.note = document.getElementById('tripModalNote').value.trim();
  saveTrips(); closeTripModal(); renderTravel();
}

function confirmDelTripModal() {
  if (!tripModalId) return;
  document.getElementById('tripModalDelWrap').innerHTML = `<span class="ldr-del-confirm">削除しますか?</span><button class="btn btn-ghost btn-sm" style="color:var(--accent);margin-left:8px;" onclick="execDelTripModal();event.stopPropagation()">はい</button>`;
}

function execDelTripModal() {
  if (!tripModalId) return;
  if (_currentTripId === tripModalId) _currentTripId = null;
  trips = trips.filter(t => String(t.id) !== tripModalId);
  saveTrips(); closeTripModal(); renderTravel();
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

// ── RENDER MAIN ──
function renderTravel() {
  document.getElementById('tripN1').textContent = trips.filter(t => t.status === '検討中').length;
  document.getElementById('tripN2').textContent = trips.filter(t => t.status === '計画中').length;
  document.getElementById('tripN3').textContent = trips.filter(t => t.status === '予約済み').length;
  const budgetTotal = trips.filter(t => t.budget && t.status !== '完了').reduce((s, t) => s + (t.budget||0), 0);
  document.getElementById('tripBudget').textContent = '¥' + fmt(budgetTotal);
  const listView = document.getElementById('tripListView');
  const detailView = document.getElementById('tripDetailView');
  if (_currentTripId) {
    listView.style.display = 'none';
    detailView.style.display = '';
    _renderTripDetail(_currentTripId);
  } else {
    listView.style.display = '';
    detailView.style.display = 'none';
    _renderTripList();
  }
}

function _renderTripList() {
  const STATUSES = ['検討中','計画中','予約済み','完了'];
  let list = tripFilter === 'all' ? trips : trips.filter(t => t.status === tripFilter);
  const grid = document.getElementById('tripGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:48px"><div class="ei">✈</div><div>旅行プランを追加してください</div></div>';
    return;
  }
  grid.innerHTML = list.map(t => {
    const dateStr = t.startDate ? fmtTripDateRange(t) : (t.timing || '');
    const planCount = (t.plan || []).length;
    const photoCount = (t.photos || []).length;
    const rating = (t.review || {}).rating || 0;
    const tid = esc(String(t.id));
    let thumbHTML = '';
    if (t.status === '完了' && photoCount > 0) {
      thumbHTML = `<div class="trip-card-thumb"><img data-path="${esc(t.photos[0].path)}" class="trip-card-thumb-img" src="" alt=""></div>`;
    }
    const chips = [];
    if (planCount > 0) chips.push(`<span class="trip-meta-chip">日程 ${planCount} 件</span>`);
    if (photoCount > 0) chips.push(`<span class="trip-meta-chip">写真 ${photoCount} 枚</span>`);
    if (rating > 0) chips.push(`<span class="trip-meta-chip trip-meta-chip-star">★${rating}</span>`);
    return `<div class="trip-card s-${esc(t.status)}" onclick="openTripDetail('${tid}')">
      ${thumbHTML}
      <div class="trip-card-top">
        <div class="trip-dest">${esc(t.dest)}</div>
        <span class="trip-badge ${esc(t.status)}">${esc(t.status)}</span>
      </div>
      <div class="trip-meta">
        ${dateStr ? `<div class="trip-meta-row"><span class="trip-meta-icon">📅</span>${esc(dateStr)}</div>` : ''}
        ${t.budget ? `<div class="trip-meta-row"><span class="trip-meta-icon">💴</span>¥${fmt(t.budget)}</div>` : '<div class="trip-meta-row"><span class="trip-meta-icon">💴</span><span style="color:var(--mute)">予算未定</span></div>'}
        ${chips.length ? `<div class="trip-meta-row trip-meta-chips-row">${chips.join('')}</div>` : ''}
      </div>
      ${t.note ? `<div class="trip-note">${esc(t.note)}</div>` : '<div class="trip-note"></div>'}
      <div class="trip-actions" onclick="event.stopPropagation()">
        ${STATUSES.map(s => `<button class="trip-sbtn ${esc(s)} ${t.status===s?'act':''}" onclick="setTripStatus('${tid}','${esc(s)}');event.stopPropagation()">${esc(s)}</button>`).join('')}
        <button class="trip-edit-btn" onclick="openTripModal('${tid}');event.stopPropagation()">編集</button>
        <button class="btn-kill" style="margin-left:auto" onclick="delTrip('${tid}');event.stopPropagation()">✕</button>
      </div>
    </div>`;
  }).join('');
  fillSignedUrls(document.getElementById('tripGrid'));
}
