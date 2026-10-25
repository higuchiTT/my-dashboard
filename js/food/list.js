// ── FOOD ──
const KIND_ORDER = ['breakfast','lunch','dinner','snack'];
const KIND_LABELS = { breakfast:'朝食', lunch:'昼食', dinner:'夕食', snack:'軽食' };

function migrateMealV2(m) {
  if (m && m.v === 2) return m;
  if (!m) return m;
  const oldDishes = (m.dishes || []).map(d => ({
    id: d.id || crypto.randomUUID(),
    name: d.name || '',
    type: d.type || 'home',
    place: d.place || '',
    recipeUrl: d.recipeUrl || '',
    note: '',
    photos: []
  }));
  const oldPhotos = m.photos || [];
  let dishes;
  if (oldDishes.length === 0 && oldPhotos.length > 0) {
    dishes = [{ id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', photos: [...oldPhotos] }];
  } else if (oldDishes.length > 0) {
    dishes = oldDishes;
    oldPhotos.forEach((p, i) => {
      const idx = i < dishes.length ? i : dishes.length - 1;
      dishes[idx].photos.push(p);
    });
  } else {
    dishes = [];
  }
  const sittings = dishes.length > 0 ? [{ id: crypto.randomUUID(), kind: 'dinner', dishes }] : [];
  return { id: m.id, date: m.date, memo: m.memo || '', v: 2, sittings };
}

function _sittingIsOut(sitting) {
  return (sitting.dishes || []).some(d => d.type === 'out');
}

function _allMealPhotos(meal) {
  return (meal.sittings || []).flatMap(s => (s.dishes || []).flatMap(d => d.photos || []));
}

function _allMealPhotoPaths(meal) {
  return _allMealPhotos(meal).map(p => p.path);
}

function guessKindByHour() {
  // 新しく記録するときの食事の種類。いちばん多い夕食を既定にする（ユーザーの要望）
  return 'dinner';
}

let foodFilter = 'all';
let foodSearch = '';
let foodTagFilter = '';
let foodView = 'calendar';
let foodCalY = new Date().getFullYear();
let foodCalM = new Date().getMonth();
let foodCalSelDay = null;
let _foodViewManual = false;
let _foodModalState = null;
let _foodListWeeks = 0;
let _signedUrlCache = {}; // path -> { url, expiry }
let _foodUploading = 0;
let _foodPopupId = null;
let _lightboxPhotos = [];
let _lightboxIdx = 0;
let _foodShowEmpty = false;
try { _foodShowEmpty = localStorage.getItem('food_show_empty') === '1'; } catch(e) {}

function _foodToggleShowEmpty() {
  _foodShowEmpty = !_foodShowEmpty;
  try { localStorage.setItem('food_show_empty', _foodShowEmpty ? '1' : '0'); } catch(e) {}
  renderFoodList();
}

function saveMeals() { localStorage.setItem('food_meals', JSON.stringify(meals)); saveToSupabase(); renderHome(); }

function localDate(d) {
  const dt = d || new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function setFoodFilter(f, el) {
  foodFilter = f;
  _foodListWeeks = 0;
  document.querySelectorAll('#page-food .food-filter-pills .ui-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderFood();
}

function setFoodTagFilter(val) {
  foodTagFilter = val;
  _foodListWeeks = 0;
  if (val) {
    foodView = 'list';
    _foodViewManual = true;
  }
  renderFood();
}

function _getFoodTagUsage() {
  const map = {};
  meals.forEach(m => {
    (m.sittings||[]).forEach(s => {
      (s.dishes||[]).forEach(d => {
        (d.tags||[]).forEach(t => { map[t] = (map[t]||0) + 1; });
      });
    });
  });
  return map;
}

function _renderFoodTagSelect() {
  const sel = document.getElementById('foodTagSel');
  if (!sel) return;
  const usage = _getFoodTagUsage();
  const tags = Object.entries(usage).sort((a,b) => b[1]-a[1]).map(([t]) => t);
  sel.innerHTML = `<option value="">タグ: すべて</option>`
    + tags.map(t => `<option value="${esc(t)}"${foodTagFilter===t?' selected':''}>${esc(t)}</option>`).join('');
  if (foodTagFilter && !tags.includes(foodTagFilter)) { foodTagFilter = ''; sel.value = ''; }
}

function foodSearchInput(val) {
  foodSearch = val;
  _foodListWeeks = 0;
  if (val.trim()) {
    foodView = 'list';
  } else if (!_foodViewManual) {
    foodView = 'calendar';
  }
  renderFood();
}

function renderFood() {
  _renderFoodTagSelect();
  _renderFoodStats();
  const calEl = document.getElementById('foodCalendar');
  const listEl = document.getElementById('foodListView');
  // Sync view toggle buttons
  document.querySelectorAll('#page-food .ui-seg-btn').forEach(b => {
    const isCalBtn = b.textContent.trim().includes('カレンダー');
    b.classList.toggle('active', (foodView === 'calendar') === isCalBtn);
  });
  if (!calEl || !listEl) return;
  if (foodView === 'calendar') {
    const summaryEl = document.getElementById('foodSearchSummary');
    if (summaryEl) summaryEl.style.display = 'none';
    calEl.style.display = '';
    listEl.style.display = 'none';
    renderFoodCalendar();
  } else {
    calEl.style.display = 'none';
    listEl.style.display = '';
    renderFoodList();
  }
}

function renderFoodList() {
  const container = document.getElementById('foodGrid');
  const summaryEl = document.getElementById('foodSearchSummary');
  if (!container) return;

  const days7 = '日月火水木金土'.split('');
  const DISP_ORDER = ['breakfast','lunch','dinner','snack'];
  const KIND_SHORT = { breakfast:'朝', lunch:'昼', dinner:'夕', snack:'軽' };
  const todayStr = localDate();
  const q = foodSearch.trim().toLowerCase();

  // Search summary
  if (summaryEl) {
    if (q) {
      let matchCount = 0;
      let latestDate = '';
      for (const m of meals) {
        const memoMatch = (m.memo||'').toLowerCase().includes(q);
        for (const s of (m.sittings||[])) {
          for (const dish of (s.dishes||[])) {
            if (memoMatch || (dish.name+' '+(dish.place||'')+' '+(dish.note||'')+' '+(dish.tags||[]).join(' ')).toLowerCase().includes(q)) {
              if ((foodFilter === 'all' || dish.type === foodFilter) && (!foodTagFilter || (dish.tags||[]).includes(foodTagFilter))) {
                matchCount++;
                if (!latestDate || m.date > latestDate) latestDate = m.date;
              }
            }
          }
        }
      }
      summaryEl.style.display = '';
      if (matchCount) {
        const daysAgo = Math.round((new Date(todayStr+'T00:00:00') - new Date(latestDate+'T00:00:00')) / 86400000);
        const daysLabel = daysAgo===0?'今日':daysAgo===1?'1日前':`${daysAgo}日前`;
        const df = latestDate.slice(0,4)+'/'+latestDate.slice(5,7)+'/'+latestDate.slice(8,10);
        summaryEl.innerHTML = `<strong>"${esc(q)}"</strong> — 最後は${daysLabel}（${df}）・計${matchCount}回`;
      } else {
        summaryEl.innerHTML = `<strong>"${esc(q)}"</strong> — 記録なし`;
      }
    } else {
      summaryEl.style.display = 'none';
    }
  }

  // Build meal map by date
  const mealByDate = {};
  meals.forEach(m => { mealByDate[m.date] = m; });

  // Determine display range
  const mealDates = meals.map(m=>m.date).filter(Boolean);
  const todayDate = new Date(todayStr+'T00:00:00');
  let rangeStart = todayStr;
  if (mealDates.length) rangeStart = mealDates.reduce((a,b) => a<b?a:b);

  // Generate all days from rangeStart to today
  const allDays = [];
  for (let c=new Date(rangeStart+'T00:00:00'); c<=todayDate; c.setDate(c.getDate()+1)) {
    allDays.push(localDate(c));
  }

  // Window: last (4 + _foodListWeeks) * 7 days
  const windowDays = (4 + _foodListWeeks) * 7;
  const windowStartDate = new Date(todayDate);
  windowStartDate.setDate(windowStartDate.getDate() - windowDays + 1);
  const windowStartStr = localDate(windowStartDate);
  const hasMore = allDays.some(d => d < windowStartStr);
  const displayDays = allDays.filter(d => d >= windowStartStr);

  // Helper: get matched sittings for a day (with filter/search applied)
  const isFiltered = foodFilter !== 'all' || q || foodTagFilter;
  function getMatchedSittings(date) {
    const meal = mealByDate[date];
    if (!meal) return null;
    const memoMatch = q ? (meal.memo||'').toLowerCase().includes(q) : false;
    const out = [];
    for (const s of (meal.sittings||[])) {
      const dishes = (s.dishes||[]).filter(dish => {
        if (foodFilter !== 'all' && dish.type !== foodFilter) return false;
        if (foodTagFilter && !(dish.tags||[]).includes(foodTagFilter)) return false;
        if (q && !memoMatch && !(dish.name+' '+(dish.place||'')+' '+(dish.note||'')+' '+(dish.tags||[]).join(' ')).toLowerCase().includes(q)) return false;
        return true;
      });
      if (dishes.length) out.push({...s, dishes});
    }
    return out.length ? out : null;
  }

  // Get Monday of week containing date
  function mondayOf(dateStr) {
    const d = new Date(dateStr+'T00:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow===0 ? -6 : 1-dow));
    return localDate(d);
  }

  // Group into weeks
  const weekMap = {};
  const weekOrder = [];
  for (const d of displayDays) {
    const mon = mondayOf(d);
    if (!weekMap[mon]) { weekMap[mon] = []; weekOrder.push(mon); }
    weekMap[mon].push(d);
  }
  // Sort weeks newest first
  weekOrder.sort((a,b) => b.localeCompare(a));

  const todayWeekMon = mondayOf(todayStr);
  const lastWeekMonD = new Date(todayWeekMon+'T00:00:00');
  lastWeekMonD.setDate(lastWeekMonD.getDate()-7);
  const lastWeekMon = localDate(lastWeekMonD);

  function fmtWeekHdr(mon) {
    const mD = new Date(mon+'T00:00:00');
    const sD = new Date(mon+'T00:00:00'); sD.setDate(sD.getDate()+6);
    const fmt = d => `${d.getMonth()+1}/${d.getDate()}（${days7[d.getDay()]}）`;
    const prefix = mon===todayWeekMon?'今週 ': mon===lastWeekMon?'先週 ':'';
    return `${prefix}${fmt(mD)}〜${fmt(sD)}`;
  }

  const togglePill = `<div class="food-list-toggle-row"><button class="ui-pill${_foodShowEmpty?' active':''}" onclick="_foodToggleShowEmpty()">${_foodShowEmpty?'空いている日を隠す':'空いている日も表示'}</button></div>`;
  let html = togglePill + '<div class="food-day-list">';
  let hasContent = false;

  for (const mon of weekOrder) {
    // Days newest-first within week (so most-recent day appears just under its week header)
    const daysAsc = weekMap[mon].slice().sort();
    const daysDesc = daysAsc.slice().reverse();

    // Check if any day in this week is visible when filtering
    if (isFiltered && !daysAsc.some(d => getMatchedSittings(d) !== null)) continue;

    // When hiding empty days, skip weeks with no meals and today not in week
    if (!_foodShowEmpty && !isFiltered && !daysAsc.some(d => mealByDate[d] || d === todayStr)) continue;

    hasContent = true;
    html += `<div class="food-week-hdr">${esc(fmtWeekHdr(mon))}</div>`;

    for (const ds of daysDesc) {
      const dt = new Date(ds+'T00:00:00');
      const dow = dt.getDay();
      const isSat = dow===6, isSun = dow===0;
      const isToday = ds===todayStr;
      const dayClass = isSat?' is-sat':isSun?' is-sun':'';
      const matched = getMatchedSittings(ds);

      // When filtering, hide empty-record days AND days with no matches
      if (isFiltered && !matched) continue;

      // When hiding empty days, skip days without meals (except today)
      if (!_foodShowEmpty && !isFiltered && !mealByDate[ds] && !isToday) continue;

      const mealRec = mealByDate[ds];
      const mealId = mealRec ? String(mealRec.id) : null;
      const dateLabel = `${dt.getMonth()+1}/${dt.getDate()}`;
      const rowOnclick = mealId
        ? `onclick="openFoodDetailPopup('${esc(mealId)}')" `
        : `onclick="openFoodModalNew('${esc(ds)}')" `;

      let mealsColHTML = '';
      if (matched && matched.length) {
        // Sort sittings by kind order
        const sorted = matched.slice().sort((a,b)=>DISP_ORDER.indexOf(a.kind)-DISP_ORDER.indexOf(b.kind));

        // Build sitting groups
        mealsColHTML = sorted.map(s => {
          const kShort = KIND_SHORT[s.kind]||s.kind;
          const dishParts = s.dishes.map(dish => {
            const isOut = dish.type==='out';
            const placeHTML = isOut&&dish.place ? ` <span class="food-day-place">@${esc(dish.place)}</span>` : '';
            const tags = dish.tags||[];
            const tagsShown = tags.slice(0,2);
            const tagsExtra = tags.length > 2 ? tags.length - 2 : 0;
            const tagHTML = tagsShown.length ? `<span class="food-chip-row-sm">${tagsShown.map(t=>`<button class="food-chip food-chip-sm food-chip-btn" onclick="event.stopPropagation();setFoodTagFilter('${esc(t)}')">${esc(t)}</button>`).join('')}${tagsExtra?`<span class="food-chip food-chip-sm">+${tagsExtra}</span>`:''}</span>` : '';
            return `<span class="food-day-dish-link" onclick="event.stopPropagation();openFoodDetailPopup('${esc(mealId)}','${esc(String(dish.id))}')">${esc(dish.name||'（名前なし）')}${placeHTML}</span>${tagHTML}`;
          }).join('<span style="color:var(--mute);margin:0 2px">・</span>');
          return `<div class="food-day-sitting-group"><span class="food-day-kind-tag">${esc(kShort)}</span>${dishParts}</div>`;
        }).join('');

        // Thumbnails (up to 4)
        let thumbs = '';
        let tCount = 0;
        const MAX_T = 4;
        let totalPhotos = 0;
        for (const s of sorted) for (const d of s.dishes) totalPhotos += (d.photos||[]).length;

        // 全部の写真を出力し、PC では 5 枚目以降を CSS で隠す（スマホは横スクロールで全部見られる）
        for (const s of sorted) {
          for (const dish of s.dishes) {
            for (const p of (dish.photos||[])) {
              const extra = tCount >= MAX_T ? ' is-extra' : '';
              thumbs += `<div class="food-day-thumb${extra}" onclick="event.stopPropagation();openFoodDetailPopup('${esc(mealId)}','${esc(String(dish.id))}')"><img data-path="${esc(p.path)}" alt="" loading="lazy"></div>`;
              tCount++;
            }
          }
        }
        if (totalPhotos > MAX_T) {
          thumbs += `<div class="food-day-thumb-more" onclick="event.stopPropagation();openFoodDetailPopup('${esc(mealId)}')">+${totalPhotos-MAX_T}</div>`;
        }
        if (thumbs) mealsColHTML += `<div class="food-day-thumbs">${thumbs}</div>`;

        // スマホ用: 1品ごとに1行（左に料理名、右にその料理の写真）
        let dishRows = '';
        for (const s of sorted) {
          const kShort = KIND_SHORT[s.kind]||s.kind;
          s.dishes.forEach((dish, i) => {
            const isOut = dish.type==='out';
            const placeHTML = isOut&&dish.place ? `<span class="food-day-place">@${esc(dish.place)}</span>` : '';
            const ph = dish.photos||[];
            const photoHTML = ph.length
              ? `<div class="food-day-dishrow-photo"><img data-path="${esc(ph[0].path)}" alt="" loading="lazy">${ph.length>1?`<span class="food-day-dishrow-more">+${ph.length-1}</span>`:''}</div>`
              : '';
            const tags = dish.tags||[];
            const mobTagHTML = tags.length ? `<div class="food-chip-row" style="margin-top:2px;flex-wrap:nowrap;overflow:hidden;">${tags.map(t=>`<button class="food-chip food-chip-sm food-chip-btn" onclick="event.stopPropagation();setFoodTagFilter('${esc(t)}')">${esc(t)}</button>`).join('')}</div>` : '';
            dishRows += `<div class="food-day-dishrow" onclick="event.stopPropagation();openFoodDetailPopup('${esc(mealId)}','${esc(String(dish.id))}')">
              <span class="food-day-kind-tag${i===0?'':' is-blank'}">${esc(kShort)}</span>
              <div style="min-width:0;flex:1"><span class="food-day-dishrow-name">${esc(dish.name||'（名前なし）')}${placeHTML}</span>${mobTagHTML}</div>
              ${photoHTML}
            </div>`;
          });
        }
        mealsColHTML += `<div class="food-day-dishlist">${dishRows}</div>`;
      } else {
        // No filter active, show "記録なし" (today shows "+ 記録する")
        mealsColHTML = isToday
          ? `<span class="food-day-empty food-day-today-add">＋ 記録する</span>`
          : `<span class="food-day-empty">記録なし</span>`;
      }

      html += `<div class="food-day-row${dayClass}" ${rowOnclick}>
        <div class="food-day-date-col">
          <div class="food-day-date-num">${esc(dateLabel)}</div>
          <div class="food-day-dow-label">${esc(days7[dow])}</div>
          ${isToday?'<span class="food-day-today-badge">今日</span>':''}
        </div>
        <div class="food-day-meals-col">${mealsColHTML}</div>
      </div>`;
    }
  }

  if (!hasContent) {
    html = `<div class="food-empty"><div class="ei">🍽</div><div>${q?'検索結果なし':'記録がありません'}</div></div>`;
  } else {
    if (hasMore) {
      html += `<button class="food-list-more-btn" onclick="_foodListWeeks+=4;renderFoodList()">さらに前を表示（4週間）</button>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
  fillSignedUrls(container);
}
