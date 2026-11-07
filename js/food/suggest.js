// ── FOOD SUGGEST ──

/**
 * Pure function: suggest home-cooked dishes based on pantry.
 * @param {Array}  meals  全 meal レコード
 * @param {Array}  home   家にある食材タグ
 * @param {Array}  buy    買って帰る食材タグ
 * @param {string} today  'YYYY-MM-DD'
 * @returns {Array} 並べ替え済みの候補配列
 */
function suggestFoodDishes(meals, home, buy, today) {
  if (!Array.isArray(meals)) return [];

  const homeArr = Array.isArray(home) ? home : [];
  const buyArr  = Array.isArray(buy)  ? buy  : [];
  const homeSet = new Set(homeArr);
  const buySet  = new Set(buyArr);
  const allSet  = new Set([...homeSet, ...buySet]);
  if (allSet.size === 0) return [];

  // Build dish map keyed by trimmed name (home dishes only)
  const dishMap = {};
  for (const meal of meals) {
    if (!meal || !meal.date) continue;
    for (const sitting of (meal.sittings || [])) {
      for (const dish of (sitting.dishes || [])) {
        if (dish.type !== 'home') continue;
        const name = (dish.name || '').trim();
        if (!name) continue;

        if (!dishMap[name]) {
          dishMap[name] = {
            tags: new Set(),
            count: 0,
            lastDate: '',
            lastMealId: null,
            photoByDate: {}
          };
        }
        const entry = dishMap[name];
        entry.count++;

        // Collect ingredient tags only
        for (const tag of (dish.tags || [])) {
          if (foodTagCategory(tag) === 'ingredient') entry.tags.add(tag);
        }

        // Track latest date + mealId
        if (!entry.lastDate || meal.date > entry.lastDate) {
          entry.lastDate  = meal.date;
          entry.lastMealId = meal.id;
        }

        // Track first photo path per date
        const photos = dish.photos || [];
        if (photos.length > 0 && !entry.photoByDate[meal.date]) {
          entry.photoByDate[meal.date] = photos[0].path;
        }
      }
    }
  }

  const todayMs = today ? new Date(today + 'T00:00:00').getTime() : Date.now();
  const results = [];

  for (const [name, entry] of Object.entries(dishMap)) {
    const ingredients = [...entry.tags];
    const usedHome = ingredients.filter(t => homeSet.has(t));
    const usedBuy  = ingredients.filter(t => buySet.has(t));
    if (usedHome.length + usedBuy.length === 0) continue;

    const missing = ingredients.filter(t => !allSet.has(t));

    // Photo: prefer lastDate, else latest date that has a photo
    const photoPath = entry.photoByDate[entry.lastDate] ||
      (Object.entries(entry.photoByDate)
        .sort((a, b) => b[0].localeCompare(a[0]))[0]?.[1] ?? null);

    // Recent = lastDate within 7 days inclusive (0..6 days ago from today)
    let recent = false;
    if (entry.lastDate) {
      const lastMs  = new Date(entry.lastDate + 'T00:00:00').getTime();
      const diffDays = Math.round((todayMs - lastMs) / 86400000);
      recent = diffDays >= 0 && diffDays <= 6;
    }

    const score = usedHome.length * 2 + usedBuy.length;

    results.push({
      name,
      ingredients,
      usedHome,
      usedBuy,
      missing,
      count:      entry.count,
      lastDate:   entry.lastDate,
      lastMealId: entry.lastMealId,
      photoPath,
      recent,
      _score: score
    });
  }

  // Sort: non-recent first; then score desc; missing asc; count desc; lastDate asc
  results.sort((a, b) => {
    if (a.recent !== b.recent)         return a.recent ? 1 : -1;
    if (b._score !== a._score)         return b._score - a._score;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    if (b.count !== a.count)           return b.count - a.count;
    return a.lastDate.localeCompare(b.lastDate);
  });

  return results.map(({ _score, ...rest }) => rest);
}

// ── Pantry state ──────────────────────────────────────────────────────────────

let _foodSuggestPantry = { home: [], buy: [] };
try {
  const _fspRaw = localStorage.getItem('food_suggest_pantry');
  if (_fspRaw) {
    const _fspParsed = JSON.parse(_fspRaw);
    if (_fspParsed && Array.isArray(_fspParsed.home) && Array.isArray(_fspParsed.buy)) {
      _foodSuggestPantry = _fspParsed;
    }
  }
} catch(e) {}

function _saveFoodSuggestPantry() {
  try { localStorage.setItem('food_suggest_pantry', JSON.stringify(_foodSuggestPantry)); } catch(e) {}
}

// ── Modal open / close ────────────────────────────────────────────────────────

function openFoodSuggestModal() {
  _renderFoodSuggestModal();
  document.getElementById('foodSuggestOverlay').style.display = 'flex';
  document.body.classList.add('fsg-open'); // 開いている間は Food の「＋」ボタン(z-index:7000)を隠す
}

function closeFoodSuggestModal() {
  document.body.classList.remove('fsg-open');
  document.getElementById('foodSuggestOverlay').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' &&
      document.getElementById('foodSuggestOverlay')?.style.display === 'flex') {
    // Only close if the detail popup is NOT open on top
    if (document.getElementById('foodPopupOverlay')?.style.display !== 'flex') {
      closeFoodSuggestModal();
    }
  }
}, true); // capture: 詳細のポップアップの Esc 処理より先に動き、詳細が開いている間は閉じない

// ── Render ────────────────────────────────────────────────────────────────────

function _foodSuggestGetIngredientCandidates() {
  const countMap = {};
  for (const meal of meals) {
    for (const sitting of (meal.sittings || [])) {
      for (const dish of (sitting.dishes || [])) {
        if (dish.type !== 'home') continue;
        for (const tag of (dish.tags || [])) {
          if (foodTagCategory(tag) !== 'ingredient') continue;
          countMap[tag] = (countMap[tag] || 0) + 1;
        }
      }
    }
  }
  return Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);
}

function _renderFoodSuggestModal() {
  const bodyEl = document.getElementById('foodSuggestBody');
  if (!bodyEl) return;

  const { home, buy } = _foodSuggestPantry;
  const candidates = _foodSuggestGetIngredientCandidates();

  function chipsHTML(items, section) {
    if (!items.length) return '';
    return items.map((tag, i) => {
      const cls = section === 'home' ? 'fsg-chip-home' : 'fsg-chip-buy';
      return `<span class="fsg-chip ${cls}">${esc(tag)}<button type="button" class="fsg-chip-x" onclick="event.stopPropagation();_foodSuggestRemoveItem(${jsq(section)},${i})">×</button></span>`;
    }).join('');
  }

  function candidatePillsHTML(section) {
    const thisArr  = section === 'home' ? home : buy;
    const otherArr = section === 'home' ? buy  : home;
    // Hide items already in this section; still show items in the other section (with dim style)
    const available = candidates.filter(t => !thisArr.includes(t));
    if (!available.length) return '<span class="fsg-no-candidates">候補なし</span>';
    return available.map(t => {
      const inOther = otherArr.includes(t);
      return `<button type="button" class="ui-pill fsg-cand-pill${inOther ? ' fsg-cand-in-other' : ''}" onclick="event.stopPropagation();_foodSuggestAddItem(${jsq(section)},${jsq(t)})">${esc(t)}</button>`;
    }).join('');
  }

  bodyEl.innerHTML = `
    <div class="fsg-section">
      <div class="fsg-section-label">家にある食材</div>
      <div class="fsg-chips-row">${chipsHTML(home, 'home')}</div>
      <div class="fsg-candidates">${candidatePillsHTML('home')}</div>
      <div class="fsg-add-row">
        <input type="text" class="fsg-add-input" id="fsgAddHome"
          placeholder="食材名を入力…（Enter で追加）"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_foodSuggestAddFromInput('home')}"
          oninput="event.stopPropagation()">
      </div>
    </div>
    <div class="fsg-section">
      <div class="fsg-section-label">買って帰る食材</div>
      <div class="fsg-chips-row">${chipsHTML(buy, 'buy')}</div>
      <div class="fsg-candidates">${candidatePillsHTML('buy')}</div>
      <div class="fsg-add-row">
        <input type="text" class="fsg-add-input" id="fsgAddBuy"
          placeholder="食材名を入力…（Enter で追加）"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_foodSuggestAddFromInput('buy')}"
          oninput="event.stopPropagation()">
      </div>
    </div>
    <div class="fsg-actions-row">
      <button type="button" class="btn btn-ghost btn-sm"
        onclick="event.stopPropagation();_foodSuggestClear()">クリア</button>
    </div>
    <div class="fsg-results" id="fsgResults"></div>
  `;

  _renderFoodSuggestResults();
}

function _foodSuggestAddItem(section, tag) {
  tag = String(tag).trim();
  if (!tag) return;
  section = String(section);
  if (section === 'home') {
    _foodSuggestPantry.buy  = _foodSuggestPantry.buy.filter(t => t !== tag);
    if (!_foodSuggestPantry.home.includes(tag)) _foodSuggestPantry.home.push(tag);
  } else {
    _foodSuggestPantry.home = _foodSuggestPantry.home.filter(t => t !== tag);
    if (!_foodSuggestPantry.buy.includes(tag))  _foodSuggestPantry.buy.push(tag);
  }
  _saveFoodSuggestPantry();
  _renderFoodSuggestModal();
}

function _foodSuggestAddFromInput(section) {
  section = String(section);
  const id = section === 'home' ? 'fsgAddHome' : 'fsgAddBuy';
  const input = document.getElementById(id);
  if (!input) return;
  const tag = input.value.trim();
  if (!tag) return;
  // Capture value before re-render destroys the element
  _foodSuggestAddItem(section, tag);
  // 続けて入力できるよう、描き直した入力欄にフォーカスを戻す
  document.getElementById(id)?.focus();
}

function _foodSuggestRemoveItem(section, idx) {
  section = String(section);
  idx = Number(idx);
  if (section === 'home') {
    _foodSuggestPantry.home.splice(idx, 1);
  } else {
    _foodSuggestPantry.buy.splice(idx, 1);
  }
  _saveFoodSuggestPantry();
  _renderFoodSuggestModal();
}

function _foodSuggestClear() {
  _foodSuggestPantry = { home: [], buy: [] };
  _saveFoodSuggestPantry();
  _renderFoodSuggestModal();
}

function _renderFoodSuggestResults() {
  const container = document.getElementById('fsgResults');
  if (!container) return;

  const { home, buy } = _foodSuggestPantry;
  if (home.length === 0 && buy.length === 0) {
    container.innerHTML =
      `<div class="fsg-empty">家にある食材を選ぶと、過去の献立から提案します</div>`;
    return;
  }

  const todayStr  = localDate();
  const suggestions = suggestFoodDishes(meals, home, buy, todayStr);

  if (suggestions.length === 0) {
    container.innerHTML =
      `<div class="fsg-empty">この食材を使った料理の記録がまだありません</div>`;
    return;
  }

  const total = suggestions.length;
  const placeholderSVG = `<svg class="fsg-no-photo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 .55.45 1 1 1h3c.55 0 1 .45 1 1v4"/><path d="M21 22v-2"/></svg>`;

  const cardsHTML = suggestions.map((s, i) => {
    const photoHTML = s.photoPath
      ? `<div class="fsg-card-photo"><img data-path="${esc(s.photoPath)}" alt="" loading="lazy"></div>`
      : `<div class="fsg-card-photo fsg-card-no-photo">${placeholderSVG}</div>`;

    const usedParts = [
      ...s.usedHome.map(t => `<span class="fsg-ingr-chip fsg-ingr-home">${esc(t)}</span>`),
      ...s.usedBuy.map(t  => `<span class="fsg-ingr-chip fsg-ingr-buy">${esc(t)}</span>`)
    ];
    const usedHTML = usedParts.length
      ? `<div class="fsg-card-ingr-row">${usedParts.join('')}</div>` : '';

    const missingHTML = s.missing.length
      ? `<div class="fsg-card-missing"><span class="fsg-missing-label">足りない:</span> ${s.missing.map(t => `<span class="fsg-missing-tag">${esc(t)}</span>`).join(' ')}</div>`
      : `<div class="fsg-card-no-missing">足りない食材なし</div>`;

    const lastD     = s.lastDate ? new Date(s.lastDate + 'T00:00:00') : null;
    const lastLabel = lastD ? `${lastD.getMonth() + 1}/${lastD.getDate()}` : '';
    const recentBadge = s.recent ? `<span class="fsg-recent-badge">最近食べた</span>` : '';

    const mealId = s.lastMealId ? esc(String(s.lastMealId)) : '';
    const cardClick = mealId
      ? `onclick="event.stopPropagation();openFoodDetailPopup('${mealId}')"`
      : '';

    return `<div class="fsg-card" data-idx="${i}" ${cardClick}>
      ${photoHTML}
      <div class="fsg-card-body">
        <div class="fsg-card-name-row">
          <div class="fsg-card-name">${esc(s.name)}</div>
          ${recentBadge}
        </div>
        ${usedHTML}
        ${missingHTML}
        <div class="fsg-card-meta">最後 ${esc(lastLabel)}・${s.count}回</div>
        <button class="fsg-record-btn" onclick="event.stopPropagation();recordSuggestedDish(${jsq(s.name)},${jsq(s.lastMealId || '')})">今日記録する</button>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="fsg-counter-row">
      <button type="button" class="fsg-nav-btn"
        onclick="event.stopPropagation();_foodSuggestNavCard(-1)">&#8249;</button>
      <span class="fsg-counter" id="fsgCounter">1 / ${total}</span>
      <button type="button" class="fsg-nav-btn"
        onclick="event.stopPropagation();_foodSuggestNavCard(1)">&#8250;</button>
    </div>
    <div class="fsg-carousel" id="fsgCarousel">${cardsHTML}</div>
  `;

  fillSignedUrls(container);

  const carousel = document.getElementById('fsgCarousel');
  if (carousel) {
    carousel.addEventListener('scroll', () => {
      const w   = carousel.offsetWidth || 1;
      const idx = Math.round(carousel.scrollLeft / w);
      const counter = document.getElementById('fsgCounter');
      if (counter) counter.textContent = `${Math.min(idx + 1, total)} / ${total}`;
    }, { passive: true });
  }
}

function _foodSuggestNavCard(delta) {
  const carousel = document.getElementById('fsgCarousel');
  if (!carousel) return;
  const w     = carousel.offsetWidth || 1;
  const cards = carousel.querySelectorAll('.fsg-card');
  if (!cards.length) return;
  const cur  = Math.round(carousel.scrollLeft / w);
  const next = Math.max(0, Math.min(cards.length - 1, cur + delta));
  carousel.scrollTo({ left: next * w, behavior: 'smooth' });
}

// 提案の料理を今日の食事に入れて、記録の画面を開く（タグは前回の同じ料理から写す）
function recordSuggestedDish(name, mealId) {
  let tags = [];
  const past = meals.find(m => String(m.id) === String(mealId));
  if (past) {
    for (const sit of (past.sittings || [])) {
      const d = (sit.dishes || []).find(d => d.name === name);
      if (d) { tags = (d.tags || []).slice(); break; }
    }
  }
  closeFoodSuggestModal();
  openFoodModalNew(localDate());
  const st = _foodModalState;
  if (!st) return;
  const kind = guessKindByHour();
  let sit = (st.sittings || []).find(x => x.kind === kind);
  if (!sit) {
    sit = { id: crypto.randomUUID(), kind, dishes: [] };
    st.sittings.push(sit);
  }
  const empty = sit.dishes.find(d => !d.name && !(d.photos || []).length);
  const dish = empty || { id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', tags: [], photos: [] };
  dish.name = name; dish.type = 'home'; dish.tags = tags;
  if (!empty) sit.dishes.push(dish);
  renderFoodModalBody();
}
