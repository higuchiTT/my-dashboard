// ── FOOD DETAIL POPUP ──
function openFoodDetailPopup(id, dishId) {
  const meal = meals.find(m => String(m.id) === String(id));
  if (!meal) return;
  _foodPopupId = String(id);
  renderFoodDetailPopup();
  document.getElementById('foodPopupOverlay').style.display = 'flex';
  if (dishId) {
    setTimeout(() => {
      const dishEl = document.getElementById('foodPopupDish-' + String(dishId));
      if (dishEl) {
        dishEl.scrollIntoView({ block: 'start' });
        dishEl.classList.remove('food-popup-dish-highlight');
        void dishEl.offsetWidth;
        dishEl.classList.add('food-popup-dish-highlight');
      }
    }, 0);
  }
}

function closeFoodDetailPopup() {
  _foodPopupId = null;
  document.getElementById('foodPopupOverlay').style.display = 'none';
}

function closeFoodDetailPopupAndFilter(tag) {
  closeFoodDetailPopup();
  setFoodTagFilter(tag);
}

function renderFoodDetailPopup() {
  if (!_foodPopupId) return;
  const meal = meals.find(m => String(m.id) === _foodPopupId);
  if (!meal) { closeFoodDetailPopup(); return; }
  const d = new Date(meal.date + 'T00:00:00');
  const days7 = '日月火水木金土'.split('');
  const dateLabel = `${meal.date.slice(0,4)}年${parseInt(meal.date.slice(5,7))}月${parseInt(meal.date.slice(8,10))}日（${days7[d.getDay()]}）`;
  const linkSVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

  // Header
  document.getElementById('foodPopupHdr').innerHTML = `
    <button class="food-popup-nav-btn" onclick="event.stopPropagation();navFoodPopup(-1)">‹</button>
    <div class="food-popup-date">${esc(dateLabel)}</div>
    <button class="food-popup-nav-btn" onclick="event.stopPropagation();navFoodPopup(1)">›</button>
    <button class="food-popup-edit-btn" onclick="event.stopPropagation();closeFoodDetailPopup();openFoodModal('${esc(_foodPopupId)}')">編集</button>
    <button class="food-popup-close" onclick="event.stopPropagation();closeFoodDetailPopup()">✕</button>
  `;

  // Body
  const sittings = (meal.sittings||[]).slice().sort((a,b)=>KIND_ORDER.indexOf(a.kind)-KIND_ORDER.indexOf(b.kind));
  let bodyHTML = '';
  for (const s of sittings) {
    const isOut = _sittingIsOut(s);
    const outPlaces = (s.dishes||[]).filter(d=>d.type==='out'&&d.place).map(d=>d.place);
    const placeText = isOut && outPlaces.length ? outPlaces[0] : '';
    const placeHTML = placeText ? `<span class="food-popup-sitting-place">${esc(placeText)}</span>` : '';
    let dishesHTML = '';
    for (const dish of (s.dishes||[])) {
      const photos = dish.photos || [];
      const pillCls = dish.type==='out' ? 'out' : 'home';
      const pillLabel = dish.type==='out' ? '外食' : '自炊';
      const placeHtml = dish.type==='out' && dish.place ? `<span class="food-popup-dish-place">@${esc(dish.place)}</span>` : '';
      const isValidUrl = /^https?:\/\//.test(dish.recipeUrl||'');
      const linkHtml = isValidUrl ? `<a class="food-popup-dish-link" href="${esc(dish.recipeUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${linkSVG} レシピ</a>` : '';
      const noteHtml = dish.note ? `<div class="food-popup-dish-note">${esc(dish.note)}</div>` : '';
      const dishTags2 = dish.tags||[];
      const dishTagsHtml2 = dishTags2.length ? `<div class="food-popup-dish-tags">${dishTags2.map(t=>`<button class="food-chip food-chip-btn" onclick="event.stopPropagation();closeFoodDetailPopupAndFilter(${jsq(t)})">${esc(t)}</button>`).join('')}</div>` : '';
      // Gallery
      const galleryHTML = photos.length ? `<div class="food-popup-gallery">${photos.map((p,pi) =>
        `<div class="food-popup-gallery-img" onclick="event.stopPropagation();openFoodLightboxForDish('${esc(String(dish.id))}',${pi})">
          <img data-path="${esc(p.path)}" src="" alt="">
        </div>`
      ).join('')}</div>` : '';
      dishesHTML += `<div class="food-popup-dish" id="foodPopupDish-${esc(String(dish.id))}">
        <div class="food-popup-dish-name">${esc(dish.name||'（名前なし）')}</div>
        <div class="food-popup-dish-meta">
          <span class="food-popup-dish-pill ${pillCls}">${pillLabel}</span>
          ${placeHtml}${linkHtml}
        </div>
        ${dishTagsHtml2}
        ${noteHtml}
        ${galleryHTML}
      </div>`;
    }
    bodyHTML += `<div class="food-popup-sitting">
      <div class="food-popup-sitting-hdr">
        <span class="food-popup-sitting-kind">${esc(KIND_LABELS[s.kind]||s.kind)}</span>${placeHTML}
      </div>
      ${dishesHTML}
    </div>`;
  }
  // Build day-tags summary for popup
  const popupTagMap = {};
  (meal.sittings||[]).forEach(s=>(s.dishes||[]).forEach(d=>(d.tags||[]).forEach(t=>{popupTagMap[t]=(popupTagMap[t]||0)+1;})));
  const popupDayTags = Object.entries(popupTagMap).sort((a,b)=>b[1]-a[1]);
  if (popupDayTags.length) {
    bodyHTML += `<div class="food-day-tags-section">
      <div class="food-day-tags-label">この日のタグ</div>
      <div class="food-chip-row">${popupDayTags.map(([t,n])=>`<button class="food-chip food-chip-btn" onclick="event.stopPropagation();closeFoodDetailPopupAndFilter(${jsq(t)})">${esc(t)}${n>1?`<span class="food-chip-cnt">${n}</span>`:''}</button>`).join('')}</div>
    </div>`;
  }
  if (meal.memo) {
    bodyHTML += `<div class="food-popup-memo">${esc(meal.memo)}</div>`;
  }
  document.getElementById('foodPopupBody').innerHTML = bodyHTML;
  fillSignedUrls(document.getElementById('foodPopupBody'));
}

function navFoodPopup(delta) {
  if (!_foodPopupId) return;
  const sorted = [...meals].sort((a,b)=>a.date.localeCompare(b.date));
  const cur = sorted.findIndex(m=>String(m.id)===_foodPopupId);
  if (cur < 0) return;
  let next = cur + delta;
  if (next < 0 || next >= sorted.length) return;
  _foodPopupId = String(sorted[next].id);
  renderFoodDetailPopup();
}

// ── LIGHTBOX ──
function openFoodLightboxForDish(dishId, startIdx) {
  for (const m of meals) for (const s of (m.sittings || [])) for (const d of (s.dishes || [])) {
    if (String(d.id) === String(dishId)) { openFoodLightbox((d.photos || []).map(p => p.path), startIdx); return; }
  }
}
function openFoodLightbox(photoPaths, startIdx) {
  _lightboxPhotos = photoPaths;
  _lightboxIdx = startIdx || 0;
  _renderLightbox();
  document.getElementById('foodLightbox').classList.add('open');
}

function closeFoodLightbox() {
  document.getElementById('foodLightbox').classList.remove('open');
  _lightboxPhotos = [];
  _lightboxIdx = 0;
}

function moveFoodLightbox(delta) {
  _lightboxIdx = (_lightboxIdx + delta + _lightboxPhotos.length) % _lightboxPhotos.length;
  _renderLightbox();
}

function _renderLightbox() {
  const img = document.getElementById('foodLightboxImg');
  const path = _lightboxPhotos[_lightboxIdx];
  if (!path) return;
  const cached = _signedUrlCache[path];
  if (cached) { img.src = cached.url; }
  else {
    img.src = '';
    fillSignedUrls(document.getElementById('foodLightbox'));
    img.dataset.path = path;
  }
  img.dataset.path = path;
  document.getElementById('foodLightboxCounter').textContent = _lightboxPhotos.length > 1 ? `${_lightboxIdx+1} / ${_lightboxPhotos.length}` : '';
  document.getElementById('foodLightboxPrev').style.display = _lightboxPhotos.length > 1 ? '' : 'none';
  document.getElementById('foodLightboxNext').style.display = _lightboxPhotos.length > 1 ? '' : 'none';
  // Ensure signed URL
  fillSignedUrls(document.getElementById('foodLightbox'));
}

document.addEventListener('keydown', e => {
  const lb = document.getElementById('foodLightbox');
  if (lb && lb.classList.contains('open')) {
    if (e.key === 'Escape') { closeFoodLightbox(); return; }
    if (e.key === 'ArrowLeft') { moveFoodLightbox(-1); return; }
    if (e.key === 'ArrowRight') { moveFoodLightbox(1); return; }
  }
  if (document.getElementById('foodPopupOverlay')?.style.display === 'flex') {
    if (e.key === 'Escape') { closeFoodDetailPopup(); return; }
  }
});

async function fillSignedUrls(containerEl) {
  if (!containerEl) return;
  const imgs = containerEl.querySelectorAll('img[data-path]');
  if (!imgs.length) return;
  const paths = [...new Set([...imgs].map(img => img.dataset.path).filter(Boolean))];
  const now = Date.now();
  const needFetch = paths.filter(p => !_signedUrlCache[p] || _signedUrlCache[p].expiry <= now + 60000);
  if (needFetch.length) {
    try {
      const { data } = await sb.storage.from('meal-photos').createSignedUrls(needFetch, 3600);
      if (data) {
        const arr = Array.isArray(data) ? data : (data.signedUrls || []);
        arr.forEach(item => {
          if (item && item.signedUrl && item.path) {
            _signedUrlCache[item.path] = { url: item.signedUrl, expiry: now + 3600000 };
          }
        });
      }
    } catch(e) {}
  }
  imgs.forEach(img => {
    const cached = _signedUrlCache[img.dataset.path];
    if (cached && img.isConnected) img.src = cached.url;
  });
}
