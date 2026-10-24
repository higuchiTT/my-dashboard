// ── FOOD CALENDAR ──
function setFoodView(v, el) {
  foodView = v;
  _foodViewManual = (v === 'list');
  if (v === 'list') _foodListWeeks = 0;
  document.querySelectorAll('#page-food .ui-seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderFood();
}

function chFoodCal(d) {
  foodCalM += d;
  if (foodCalM > 11) { foodCalM = 0; foodCalY++; }
  if (foodCalM < 0)  { foodCalM = 11; foodCalY--; }
  foodCalSelDay = null;
  renderFood();
}

function chFoodCalToday() {
  const now = new Date();
  foodCalY = now.getFullYear();
  foodCalM = now.getMonth();
  foodCalSelDay = null;
  renderFood();
}

function foodCalCellClick(dateStr) {
  const isMobile = window.innerWidth <= 640;
  if (isMobile) {
    const meal = meals.find(m => m.date === dateStr);
    if (meal) { openFoodDetailPopup(String(meal.id)); return; }
    foodCalSelDay = (foodCalSelDay === dateStr) ? null : dateStr;
  } else {
    foodCalSelDay = dateStr;
  }
  renderFoodCalendar();
}

function _renderFoodStats() {
  // 表示中の月の集計（タグの絞り込みを反映）
  const monthMeals = meals.filter(m => {
    const mDate = new Date(m.date + 'T00:00:00');
    return mDate.getFullYear() === foodCalY && mDate.getMonth() === foodCalM;
  });
  const allSittings = monthMeals.flatMap(m => m.sittings || [])
    .filter(s => !foodTagFilter || (s.dishes||[]).some(d => (d.tags||[]).includes(foodTagFilter)));
  const totalDishes = allSittings.length; // sitting count = 食事回数
  const homeDishes = allSittings.filter(s => !_sittingIsOut(s)).length;
  const outDishes  = allSittings.filter(s => _sittingIsOut(s)).length;
  const statsEl = document.getElementById('foodStatsRow');
  if (statsEl) {
    const knifeIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 .55.45 1 1 1h3c.55 0 1 .45 1 1v4"/><path d="M21 22v-2"/></svg>`;
    const homeIcon  = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    const storeIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M3 9 5.45 4.1A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><line x1="12" y1="3" x2="12" y2="9"/></svg>`;
    statsEl.innerHTML = `
      <div class="food-stat-card"><span class="food-stat-icon">${knifeIcon}</span><div class="food-stat-body"><div class="food-stat-label">今月の食事数</div><div class="food-stat-num-row"><span class="food-stat-num">${totalDishes}</span><span class="food-stat-unit">回</span></div></div></div>
      <div class="food-stat-card"><span class="food-stat-icon">${homeIcon}</span><div class="food-stat-body"><div class="food-stat-label">自炊</div><div class="food-stat-num-row"><span class="food-stat-num">${homeDishes}</span><span class="food-stat-unit">回</span></div></div></div>
      <div class="food-stat-card"><span class="food-stat-icon">${storeIcon}</span><div class="food-stat-body"><div class="food-stat-label">外食</div><div class="food-stat-num-row"><span class="food-stat-num">${outDishes}</span><span class="food-stat-unit">回</span></div></div></div>
    `;
  }

}

function renderFoodCalendar() {
  const months = '1月 2月 3月 4月 5月 6月 7月 8月 9月 10月 11月 12月'.split(' ');
  const labelEl = document.getElementById('foodCalLabel');
  if (labelEl) labelEl.textContent = `${foodCalY}年 ${months[foodCalM]}`;
  const firstDow = new Date(foodCalY, foodCalM, 1).getDay();
  const daysInMonth = new Date(foodCalY, foodCalM + 1, 0).getDate();
  const prevDays = new Date(foodCalY, foodCalM, 0).getDate();
  const todayStr = localDate();

  _renderFoodStats();

  // Auto-select default day on PC if no selection
  if (!foodCalSelDay && window.innerWidth > 640) {
    const todayDate = new Date(todayStr + 'T00:00:00');
    if (todayDate.getFullYear() === foodCalY && todayDate.getMonth() === foodCalM) {
      foodCalSelDay = todayStr;
    } else {
      foodCalSelDay = `${foodCalY}-${String(foodCalM + 1).padStart(2, '0')}-01`;
    }
  }

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ d: prevDays - i, m: foodCalM - 1, y: foodCalY, other: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, m: foodCalM, y: foodCalY, other: false });
  while (cells.length % 7 !== 0) {
    const x = cells.length - daysInMonth - firstDow + 1;
    cells.push({ d: x, m: foodCalM + 1, y: foodCalY, other: true });
  }

  // Build meal map with filter applied
  const mealMap = {};
  for (const m of meals) {
    if (foodFilter !== 'all' && !(m.sittings||[]).some(s=>(s.dishes||[]).some(d=>d.type===foodFilter))) continue;
    if (foodTagFilter && !(m.sittings||[]).some(s=>(s.dishes||[]).some(d=>(d.tags||[]).includes(foodTagFilter)))) continue;
    mealMap[m.date] = m;
  }

  const grid = document.getElementById('foodCalGrid');
  if (!grid) return;

  grid.innerHTML = cells.map(c => {
    const ds = `${c.y}-${String(c.m + 1).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
    const isToday = ds === todayStr;
    const isSel = ds === foodCalSelDay;
    const meal = c.other ? null : mealMap[ds];
    const cls = ['food-cal-cell', c.other ? 'food-cal-other' : '', isToday ? 'food-cal-today' : '', isSel ? 'food-cal-sel' : ''].filter(Boolean).join(' ');
    const clickAttr = c.other ? '' : `onclick="foodCalCellClick('${esc(ds)}')"`;

    // v2: gather all photos and dishes from sittings
    const allCellPhotos = meal ? _allMealPhotos(meal) : [];
    const allCellDishes = meal ? (meal.sittings||[]).flatMap(s=>s.dishes||[]) : [];

    // Determine day-of-week class for number coloring
    const cellDow = new Date(ds + 'T00:00:00').getDay();
    const dowClass = cellDow === 0 ? ' dow-sun' : cellDow === 6 ? ' dow-sat' : '';

    // PC compact thumbnails (max 2)
    let pcThumbsHTML = '';
    if (allCellPhotos.length) {
      const thumb1 = `<div class="food-cal-thumb"><img data-path="${esc(allCellPhotos[0].path)}" src="" alt=""></div>`;
      let thumb2 = '';
      if (allCellPhotos.length >= 2) {
        const moreCount = allCellPhotos.length > 2 ? allCellPhotos.length - 1 : 0;
        const moreBadge = moreCount > 0 ? `<div class="food-cal-thumb-more">+${moreCount}</div>` : '';
        thumb2 = `<div class="food-cal-thumb"><img data-path="${esc(allCellPhotos[1].path)}" src="" alt="">${moreBadge}</div>`;
      }
      const nClass = allCellPhotos.length >= 2 ? 'n2' : 'n1';
      pcThumbsHTML = `<div class="food-cal-thumbs ${nClass}">${thumb1}${thumb2}</div>`;
    }

    // Mobile: 1 photo or dot
    let mobHTML = '';
    if (meal) {
      if (allCellPhotos.length) {
        const mobBadge = allCellPhotos.length > 1 ? `<div class="food-cal-more-sm">+${allCellPhotos.length - 1}</div>` : '';
        mobHTML = `<div class="food-cal-photo-mob"><img data-path="${esc(allCellPhotos[0].path)}" src="" alt="">${mobBadge}</div>`;
      } else if (allCellDishes.length) {
        const hasOut = allCellDishes.some(d => d.type === 'out');
        mobHTML = `<div class="food-cal-dot-mob ${hasOut ? 'out' : 'home'}"></div>`;
      }
    }

    // PC dish name row + type pills (first dish of first sitting)
    let pcDishRowHTML = '';
    let typePillsHTML = '';
    if (allCellDishes.length) {
      const firstName = esc(allCellDishes[0].name || '');
      const totalDishCount = allCellDishes.length;
      const extra = totalDishCount > 1 ? `<span class="food-cal-dish-extra">+${totalDishCount - 1}品</span>` : '';
      pcDishRowHTML = `<div class="food-cal-dish-row"><span class="food-cal-dish-name">${firstName}</span>${extra}</div>`;
      const hasHome = allCellDishes.some(d => d.type !== 'out');
      const hasOut  = allCellDishes.some(d => d.type === 'out');
      const pills = [];
      if (hasHome) pills.push(`<span class="food-cal-type-pill home">自炊</span>`);
      if (hasOut)  pills.push(`<span class="food-cal-type-pill out">外食</span>`);
      if (pills.length) typePillsHTML = `<div class="food-cal-type-pills">${pills.join('')}</div>`;
    }

    return `<div class="${cls}" ${clickAttr}><div class="food-cal-num${dowClass}">${c.d}</div>${pcThumbsHTML}${mobHTML}${pcDishRowHTML}${typePillsHTML}</div>`;
  }).join('');

  fillSignedUrls(grid);
  renderFoodDayDetail(foodCalSelDay);
}

function renderFoodDayDetail(dateStr) {
  const detailEl = document.getElementById('foodDayDetail');
  if (!detailEl) return;
  if (!dateStr) {
    detailEl.innerHTML = '';
    detailEl.classList.remove('has-content');
    return;
  }
  detailEl.classList.add('has-content');
  const meal = meals.find(m => m.date === dateStr);
  const d = new Date(dateStr + 'T00:00:00');
  const days7 = '日月火水木金土'.split('');
  const dateLabel = `${dateStr.slice(0, 4)}年 ${parseInt(dateStr.slice(5, 7))}月${parseInt(dateStr.slice(8, 10))}日（${days7[d.getDay()]}）`;

  const sittings = meal ? (meal.sittings || []).slice().sort((a,b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)) : [];

  const countIconSVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 .55.45 1 1 1h3c.55 0 1 .45 1 1v4"/><path d="M21 22v-2"/></svg>`;
  const placeholderSVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 .55.45 1 1 1h3c.55 0 1 .45 1 1v4"/><path d="M21 22v-2"/></svg>`;
  const pencilSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
  const trashSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const linkSVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

  let sittingsHTML = '';
  for (const s of sittings) {
    const isOut = _sittingIsOut(s);
    const outPlace = isOut ? (s.dishes||[]).map(d=>d.place).filter(Boolean)[0] || '' : '';
    const placeLabel = outPlace ? `<span class="food-detail-sitting-place"> — ${esc(outPlace)}</span>` : '';
    const dishRowsHTML = (s.dishes||[]).map(dish => {
      const photos = dish.photos || [];
      const firstPhoto = photos[0];
      const thumbHTML = firstPhoto
        ? `<div class="food-detail-thumb"><img data-path="${esc(firstPhoto.path)}" src="" alt="">${photos.length>1?`<div class="food-detail-thumb-badge">+${photos.length-1}</div>`:''}</div>`
        : `<div class="food-detail-thumb">${placeholderSVG}</div>`;
      const pillCls = dish.type === 'out' ? 'out' : 'home';
      const pillLabel = dish.type === 'out' ? '外食' : '自炊';
      const placeHTML = dish.type === 'out' && dish.place ? `<span class="food-detail-dish-place">@${esc(dish.place)}</span>` : '';
      const isValidUrl = /^https?:\/\//.test(dish.recipeUrl || '');
      const linkHTML = isValidUrl ? `<a class="food-detail-dish-link" href="${esc(dish.recipeUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${linkSVG} レシピ</a>` : '';
      const noteHTML = dish.note ? `<div class="food-detail-dish-note">${esc(dish.note)}</div>` : '';
      const dishTags = dish.tags||[];
      const dishTagsHTML = dishTags.length ? `<div class="food-detail-dish-tags">${dishTags.map(t=>`<button class="food-chip food-chip-sm food-chip-btn" onclick="event.stopPropagation();closeFoodDetailPopupAndFilter('${esc(t)}')">${esc(t)}</button>`).join('')}</div>` : '';
      return `<div class="food-detail-dish-row" onclick="openFoodDetailPopup('${esc(String(meal.id))}','${esc(String(dish.id))}')">
        ${thumbHTML}
        <div class="food-detail-dish-info">
          <div class="food-detail-dish-name">${esc(dish.name || '（名前なし）')}</div>
          <div class="food-detail-dish-meta">
            <span class="food-detail-dish-pill ${pillCls}">${pillLabel}</span>
            ${placeHTML}${linkHTML}
          </div>
          ${dishTagsHTML}
          ${noteHTML}
        </div>
      </div>`;
    }).join('');
    sittingsHTML += `<div class="food-detail-sitting">
      <div class="food-detail-sitting-hdr">
        <span class="food-detail-sitting-kind">${esc(KIND_LABELS[s.kind]||s.kind)}</span>${placeLabel}
      </div>
      <div class="food-detail-dishes">${dishRowsHTML}</div>
    </div>`;
  }

  const memoHTML = meal && meal.memo ? `<div class="food-detail-memo">${esc(meal.memo)}</div>` : '';

  // Build day-tags summary
  let dayTagsHTML = '';
  if (meal) {
    const dayTagMap = {};
    (meal.sittings||[]).forEach(s => (s.dishes||[]).forEach(d => (d.tags||[]).forEach(t => { dayTagMap[t] = (dayTagMap[t]||0)+1; })));
    const dayTags = Object.entries(dayTagMap).sort((a,b)=>b[1]-a[1]);
    if (dayTags.length) {
      dayTagsHTML = `<div class="food-day-tags-section">
        <div class="food-day-tags-label">この日のタグ</div>
        <div class="food-chip-row">${dayTags.map(([t,n])=>`<button class="food-chip food-chip-btn" onclick="event.stopPropagation();closeFoodDetailPopupAndFilter('${esc(t)}')">${esc(t)}${n>1?`<span class="food-chip-cnt">${n}</span>`:''}</button>`).join('')}</div>
      </div>`;
    }
  }

  const editDelHTML = meal ? `
    <div id="foodDetailDelWrap">
      <div class="food-detail-edit-del">
        <button class="food-detail-edit-btn" onclick="openFoodModal('${esc(String(meal.id))}')">
          ${pencilSVG} この日の編集
        </button>
        <button class="food-detail-del-btn" onclick="showFoodDetailDelConfirm('${esc(String(meal.id))}')">
          ${trashSVG} この日の削除
        </button>
      </div>
    </div>` : '';

  detailEl.innerHTML = `
    <div class="food-detail-nav">
      <button class="food-detail-nav-btn" onclick="foodDayDetailNav(-1)">‹</button>
      <div class="food-detail-date-label">${esc(dateLabel)}</div>
      <button class="food-detail-nav-btn" onclick="foodDayDetailNav(1)">›</button>
    </div>
    ${meal ? `<div class="food-detail-count"><span class="food-detail-count-icon">${countIconSVG}</span><span class="food-detail-count-label">この日の食事数</span><span class="food-detail-count-num">${sittings.length}</span><span class="food-detail-count-unit">回</span></div>` : ''}
    ${sittingsHTML}
    ${dayTagsHTML}
    ${memoHTML}
    ${!meal ? `<div class="food-detail-empty"><div class="food-detail-empty-text">記録がありません</div></div>` : ''}
    <div class="food-detail-actions">
      <button class="food-detail-add-btn" onclick="openFoodModalNew('${esc(dateStr)}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        記録を追加
      </button>
      ${editDelHTML}
    </div>
  `;

  const allPhotos = meal ? _allMealPhotos(meal) : [];
  if (allPhotos.length) fillSignedUrls(detailEl);
}

function foodDayDetailNav(delta) {
  if (!foodCalSelDay) return;
  const d = new Date(foodCalSelDay + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  foodCalSelDay = localDate(d);
  if (d.getFullYear() !== foodCalY || d.getMonth() !== foodCalM) {
    foodCalY = d.getFullYear();
    foodCalM = d.getMonth();
  }
  renderFoodCalendar();
}

function showFoodDetailDelConfirm(id) {
  const wrap = document.getElementById('foodDetailDelWrap');
  if (!wrap) return;
  const pencilSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
  const trashSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  wrap.innerHTML = `
    <div class="food-detail-del-confirm">本当に削除しますか？</div>
    <div class="food-detail-edit-del">
      <button class="food-detail-edit-btn" onclick="cancelFoodDetailDelConfirm('${esc(id)}')">キャンセル</button>
      <button class="food-detail-del-btn" style="background:var(--accent);color:var(--paper);border-color:var(--accent);"
        onclick="deleteFoodFromDetail('${esc(id)}')">削除する</button>
    </div>`;
}

function cancelFoodDetailDelConfirm(id) {
  const wrap = document.getElementById('foodDetailDelWrap');
  if (!wrap) return;
  const pencilSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
  const trashSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  wrap.innerHTML = `
    <div class="food-detail-edit-del">
      <button class="food-detail-edit-btn" onclick="openFoodModal('${esc(id)}')">
        ${pencilSVG} この日の編集
      </button>
      <button class="food-detail-del-btn" onclick="showFoodDetailDelConfirm('${esc(id)}')">
        ${trashSVG} この日の削除
      </button>
    </div>`;
}

async function deleteFoodFromDetail(id) {
  await deleteFoodRecord(id);
}
