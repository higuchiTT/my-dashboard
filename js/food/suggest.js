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
            allTags: new Set(),
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
          entry.allTags.add(tag);
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
      role: dishRoleGroup([...entry.allTags]),
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

// 作りたいリスト項目のタグ一覧（古い形式の ingredients + role も読む）
function _wishTags(w) {
  if (Array.isArray(w.tags)) return w.tags;
  return [...(Array.isArray(w.ingredients) ? w.ingredients : []), ...(w.role ? [w.role] : [])];
}

/**
 * Pure function: 作りたいリストの全件（名前があるもの）を、suggestFoodDishes と同じ形
 * （＋ wish/wishId/url）で返す。
 * 並び: 選んだ食材に1つでも一致するものが先（家にある食材を多く使う順 → 買う食材 → 足りない食材が少ない順
 * → 新しい順）、その後に一致しないものを新しい順。何も選んでいなければ全件を新しい順。
 */
function rankRecipeWishes(wishes, home, buy) {
  if (!Array.isArray(wishes)) return [];
  const homeSet = new Set(Array.isArray(home) ? home : []);
  const buySet  = new Set(Array.isArray(buy) ? buy : []);
  const allSet  = new Set([...homeSet, ...buySet]);
  const byNewest = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  const items = [];
  for (const w of wishes) {
    if (!w || !String(w.name || '').trim()) continue;
    const tags = _wishTags(w);
    const ingredients = tags.filter(t => foodTagCategory(t) === 'ingredient');
    const usedHome = ingredients.filter(t => homeSet.has(t));
    const usedBuy  = ingredients.filter(t => buySet.has(t) && !homeSet.has(t));
    items.push({
      name: String(w.name).trim(),
      role: dishRoleGroup(tags),
      ingredients, usedHome, usedBuy,
      missing: ingredients.filter(t => !allSet.has(t)),
      count: 0, lastDate: '', lastMealId: null, photoPath: null, recent: false,
      wish: true, wishId: String(w.id), url: w.url || '', tags: tags.slice(),
      createdAt: w.createdAt || ''
    });
  }
  const isMatch = x => x.usedHome.length + x.usedBuy.length > 0;
  const matched = items.filter(isMatch).sort((a, b) =>
    (b.usedHome.length - a.usedHome.length) ||
    (b.usedBuy.length - a.usedBuy.length) ||
    (a.missing.length - b.missing.length) ||
    byNewest(a, b));
  const rest = items.filter(x => !isMatch(x)).sort(byNewest);
  return matched.concat(rest);
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
    ${_foodSuggestWishSectionHTML()}
  `;

  _renderFoodSuggestResults();
}

// ── 作りたいリスト ────────────────────────────────────────────────────────────

let _foodWishEditId = null; // 編集中の項目 ID
let _foodWishOpen = null; // null = 件数が少ないときだけ開く（初期）、true/false = ユーザーが切り替えた状態

function _saveRecipeWishes() {
  try { localStorage.setItem('food_recipe_wishes', JSON.stringify(recipeWishes)); } catch(e) {}
  saveToSupabase();
}

function _foodSuggestWishSectionHTML() {
  const list = recipeWishes.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const open = _foodWishOpen === null ? list.length <= 3 : _foodWishOpen;
  const keyAttr = (fn) => `onkeydown="if(event.key==='Enter'){event.preventDefault();${fn}}" oninput="event.stopPropagation()"`;
  const rowsHTML = list.length ? list.map(w => {
    if (String(w.id) === String(_foodWishEditId)) {
      const sid = jsq(String(w.id));
      return `<div class="fsg-wish-row fsg-wish-editing" onclick="event.stopPropagation()">
        <input type="text" class="fsg-add-input" id="fsgWishEditName" value="${esc(w.name)}" placeholder="料理名（必須）" ${keyAttr(`_foodSuggestSaveWish(${sid})`)}>
        <input type="text" class="fsg-add-input" id="fsgWishEditUrl" value="${esc(w.url || '')}" placeholder="レシピの URL（任意）" ${keyAttr(`_foodSuggestSaveWish(${sid})`)}>
        <input type="text" class="fsg-add-input" id="fsgWishEditTags" value="${esc(_wishTags(w).join(' '))}" placeholder="タグ（食材・主菜など。空白で区切る）" ${keyAttr(`_foodSuggestSaveWish(${sid})`)}>
        <div class="fsg-wish-form-row">
          <button type="button" class="btn btn-sm" onclick="event.stopPropagation();_foodSuggestSaveWish(${sid})">保存</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();_foodSuggestEditWish('')">キャンセル</button>
        </div>
      </div>`;
    }
    const nameHTML = w.url
      ? `<a class="fsg-wish-name" href="${esc(w.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(w.name)} ↗</a>`
      : `<span class="fsg-wish-name">${esc(w.name)}</span>`;
    const chips = _wishTags(w).map(t => `<span class="fsg-ingr-chip">${esc(t)}</span>`).join('');
    return `<div class="fsg-wish-row">
      <div class="fsg-wish-main">${nameHTML}</div>
      ${chips ? `<div class="fsg-wish-chips">${chips}</div>` : ''}
      <button type="button" class="fsg-wish-edit" aria-label="編集" onclick="event.stopPropagation();_foodSuggestEditWish(${jsq(String(w.id))})">編集</button>
      <button type="button" class="fsg-wish-del" aria-label="削除" onclick="event.stopPropagation();_foodSuggestDeleteWish(${jsq(String(w.id))})">×</button>
    </div>`;
  }).join('') : '<div class="fsg-no-candidates">まだありません</div>';

  return `<div class="fsg-section">
    <details class="fsg-wish-details" ${open ? 'open' : ''} onclick="event.stopPropagation()" ontoggle="_foodWishOpen=this.open">
      <summary class="fsg-section-label fsg-wish-summary">作りたいリスト（${list.length}件）</summary>
      <div class="fsg-wish-list">${rowsHTML}</div>
      <div class="fsg-wish-form" onclick="event.stopPropagation()">
        <input type="text" class="fsg-add-input" id="fsgWishUrl" placeholder="レシピの URL（任意）"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_foodSuggestAddWish()}" oninput="event.stopPropagation()">
        <input type="text" class="fsg-add-input" id="fsgWishName" placeholder="料理名（必須）"
          onchange="_foodSuggestWishAutoTags()"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_foodSuggestAddWish()}" oninput="event.stopPropagation()">
        <input type="text" class="fsg-add-input" id="fsgWishIngr" placeholder="タグ（食材・主菜など。空なら料理名から自動で推定）"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_foodSuggestAddWish()}" oninput="event.stopPropagation()">
        <div class="fsg-wish-form-row">
          <button type="button" class="btn btn-sm" onclick="event.stopPropagation();_foodSuggestAddWish()">追加</button>
        </div>
      </div>
    </details>
  </div>`;
}

function _foodWishParseTags(s) {
  return [...new Set(String(s || '').split(/[,、，\s　]+/).map(x => x.trim()).filter(Boolean))];
}
function _foodWishNormUrl(url) {
  url = String(url || '').trim();
  return url && !/^https?:\/\//i.test(url) ? 'https://' + url : url;
}

// 料理名を入れたとき、タグ欄が空なら過去の記録と語句ルールから推定して入れる（手で直せる）
function _foodSuggestWishAutoTags() {
  const nameEl = document.getElementById('fsgWishName');
  const tagEl  = document.getElementById('fsgWishIngr');
  if (!nameEl || !tagEl || tagEl.value.trim()) return;
  tagEl.value = presetFoodTags(nameEl.value, meals).join(' ');
}

function _foodSuggestAddWish() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const name = val('fsgWishName');
  if (!name) { document.getElementById('fsgWishName')?.focus(); return; }
  const url = _foodWishNormUrl(val('fsgWishUrl'));
  let tags = _foodWishParseTags(val('fsgWishIngr'));
  if (!tags.length) tags = presetFoodTags(name, meals);
  recipeWishes.push({ id: crypto.randomUUID(), name, url, tags, createdAt: new Date().toISOString() });
  _foodWishOpen = true;
  _saveRecipeWishes();
  _renderFoodSuggestModal();
  document.getElementById('fsgWishUrl')?.focus();
}

function _foodSuggestEditWish(id) {
  _foodWishEditId = id ? String(id) : null;
  _foodWishOpen = true;
  _renderFoodSuggestModal();
  document.getElementById('fsgWishEditName')?.focus();
}

function _foodSuggestSaveWish(id) {
  const w = recipeWishes.find(x => String(x.id) === String(id));
  if (!w) return;
  const val = el => (document.getElementById(el)?.value || '').trim();
  const name = val('fsgWishEditName');
  if (!name) { document.getElementById('fsgWishEditName')?.focus(); return; }
  w.name = name;
  w.url  = _foodWishNormUrl(val('fsgWishEditUrl'));
  w.tags = _foodWishParseTags(val('fsgWishEditTags'));
  delete w.ingredients; delete w.role; // 古い形式から tags に統一
  _foodWishEditId = null;
  _saveRecipeWishes();
  _renderFoodSuggestModal();
}

async function _foodSuggestDeleteWish(id) {
  const w = recipeWishes.find(x => String(x.id) === String(id));
  if (!w) return;
  if (!(await uiConfirm(`「${w.name}」を作りたいリストから削除しますか？`, { title: '削除の確認', okLabel: '削除', danger: true }))) return;
  recipeWishes = recipeWishes.filter(x => String(x.id) !== String(id));
  _saveRecipeWishes();
  _renderFoodSuggestModal();
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
  const hasPantry = home.length + buy.length > 0;

  const placeholderSVG = `<svg class="fsg-no-photo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 .55.45 1 1 1h3c.55 0 1 .45 1 1v4"/><path d="M21 22v-2"/></svg>`;

  const cardHTML = (s, i) => {
    const photoHTML = s.photoPath
      ? `<div class="fsg-card-photo"><img data-path="${esc(s.photoPath)}" alt="" loading="lazy"></div>`
      : `<div class="fsg-card-photo fsg-card-no-photo">${placeholderSVG}</div>`;

    const usedParts = [
      ...s.usedHome.map(t => `<span class="fsg-ingr-chip fsg-ingr-home">${esc(t)}</span>`),
      ...s.usedBuy.map(t  => `<span class="fsg-ingr-chip fsg-ingr-buy">${esc(t)}</span>`)
    ];
    const usedHTML = usedParts.length
      ? `<div class="fsg-card-ingr-row">${usedParts.join('')}</div>` : '';

    let missingHTML;
    if (s.wish && !hasPantry) {
      missingHTML = s.ingredients.length
        ? `<div class="fsg-card-missing"><span class="fsg-missing-label">食材:</span> ${s.ingredients.map(t => `<span class="fsg-missing-tag">${esc(t)}</span>`).join(' ')}</div>`
        : '';
    } else {
      missingHTML = s.missing.length
        ? `<div class="fsg-card-missing"><span class="fsg-missing-label">足りない:</span> ${s.missing.map(t => `<span class="fsg-missing-tag">${esc(t)}</span>`).join(' ')}</div>`
        : `<div class="fsg-card-no-missing">足りない食材なし</div>`;
    }

    const lastD     = s.lastDate ? new Date(s.lastDate + 'T00:00:00') : null;
    const lastLabel = lastD ? `${lastD.getMonth() + 1}/${lastD.getDate()}` : '';
    const recentBadge = (!s.wish && s.recent) ? `<span class="fsg-recent-badge">最近食べた</span>` : '';

    const mealId = s.lastMealId ? esc(String(s.lastMealId)) : '';
    const metaHTML = s.wish
      ? '<div class="fsg-card-meta">作りたいリスト</div>'
      : `<div class="fsg-card-meta">最後 ${esc(lastLabel)}・${s.count}回</div>`;
    const recordOnclick = s.wish
      ? `recordSuggestedWish(${jsq(s.wishId)})`
      : `recordSuggestedDish(${jsq(s.name)},${jsq(s.lastMealId || '')})`;
    const recipeHref = (s.wish && s.url) ? s.url : FOOD_RECIPE_SITES[2].url + encodeURIComponent(s.name);
    const recipeLabel = (s.wish && s.url) ? 'レシピを開く ↗' : 'この料理のレシピを探す ↗';
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
        ${metaHTML}
        <button class="fsg-record-btn" onclick="event.stopPropagation();${recordOnclick}">今日記録する</button>
        <a class="fsg-card-recipe-link" href="${esc(recipeHref)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${recipeLabel}</a>
      </div>
    </div>`;
  };

  const groupHTML = (title, gi, items) => `<div class="fsg-group" data-group="${gi}" data-total="${items.length}">
      <div class="fsg-group-head">
        <span class="fsg-group-title">${esc(title)}</span><span class="fsg-group-count">${items.length}件</span>
      </div>
      <div class="fsg-counter-row">
        <button type="button" class="fsg-nav-btn"
          onclick="event.stopPropagation();_foodSuggestNavCard(${gi},-1)">&#8249;</button>
        <span class="fsg-counter">1 / ${items.length}</span>
        <button type="button" class="fsg-nav-btn"
          onclick="event.stopPropagation();_foodSuggestNavCard(${gi},1)">&#8250;</button>
      </div>
      <div class="fsg-carousel">${items.map(cardHTML).join('')}</div>
    </div>`;

  // 作りたいリスト（役割グループには混ぜず、一番上に別グループで出す。空なら何も出さない）
  const wishItems = rankRecipeWishes(recipeWishes, home, buy);
  const wishHTML = wishItems.length ? groupHTML('作りたい', FOOD_SUGGEST_GROUPS.length, wishItems) : '';

  if (!hasPantry) {
    container.innerHTML = wishHTML +
      `<div class="fsg-empty">家にある食材を選ぶと、過去の献立から提案します</div>`;
    fillSignedUrls(container);
    _foodSuggestBindCarousels(container);
    return;
  }

  const suggestions = suggestFoodDishes(meals, home, buy, localDate());
  const webLinksHTML = _foodSuggestWebLinksHTML([...home, ...buy].join(' '), '食材でネットのレシピを探す');

  if (suggestions.length === 0) {
    container.innerHTML = wishHTML +
      `<div class="fsg-empty">この食材を使った料理の記録がまだありません</div>${webLinksHTML}`;
    fillSignedUrls(container);
    _foodSuggestBindCarousels(container);
    return;
  }

  // 役割ごとのグループ（候補がないグループは出さない）
  const groupsHTML = FOOD_SUGGEST_GROUPS.map((g, gi) => {
    const items = suggestions.filter(s => s.role === g);
    return items.length ? groupHTML(g, gi, items) : '';
  }).join('');

  container.innerHTML = wishHTML + webLinksHTML + groupsHTML;

  fillSignedUrls(container);
  _foodSuggestBindCarousels(container);
}

function _foodSuggestBindCarousels(container) {
  container.querySelectorAll('.fsg-group').forEach(grp => {
    const carousel = grp.querySelector('.fsg-carousel');
    const counter  = grp.querySelector('.fsg-counter');
    if (!carousel || !counter) return;
    const total    = Number(grp.dataset.total) || 1;
    carousel.addEventListener('scroll', () => {
      const w   = carousel.offsetWidth || 1;
      const idx = Math.round(carousel.scrollLeft / w);
      counter.textContent = `${Math.min(idx + 1, total)} / ${total}`;
    }, { passive: true });
  });
}

const FOOD_SUGGEST_GROUPS = ['主菜', '副菜', '汁物', 'その他'];

const FOOD_RECIPE_SITES = [
  { name: 'デリッシュキッチン', url: 'https://delishkitchen.tv/search?q=' },
  { name: 'Nadia',             url: 'https://oceans-nadia.com/search?q=' },
  { name: 'クラシル',           url: 'https://www.kurashiru.com/search?query=' },
  { name: '白ごはん.com',       url: 'https://www.sirogohan.com/recipe/index?data%5BRecipe%5D%5Bkeyword%5D=' },
];

// ネットのレシピ検索リンク（4サイト）。query が空なら何も出さない
function _foodSuggestWebLinksHTML(query, label) {
  query = String(query || '').trim();
  if (!query) return '';
  const q = encodeURIComponent(query);
  return `<div class="fsg-weblinks">
    <span class="fsg-weblinks-label">${esc(label)}</span>
    ${FOOD_RECIPE_SITES.map(s => `<a class="fsg-weblink" href="${esc(s.url + q)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(s.name)} ↗</a>`).join('')}
  </div>`;
}

function _foodSuggestNavCard(gi, delta) {
  const grp = document.querySelector(`#fsgResults .fsg-group[data-group="${Number(gi)}"]`);
  const carousel = grp && grp.querySelector('.fsg-carousel');
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
  _openFoodModalWithDish(name, tags, '');
}

// 作りたいリストの料理を今日の食事に入れて記録の画面を開く。開けたらリストから外す
function recordSuggestedWish(id) {
  const w = recipeWishes.find(x => String(x.id) === String(id));
  if (!w) return;
  if (!_openFoodModalWithDish(w.name, _wishTags(w).slice(), w.url || '')) return;
  recipeWishes = recipeWishes.filter(x => String(x.id) !== String(id));
  _saveRecipeWishes();
}

function _openFoodModalWithDish(name, tags, recipeUrl) {
  closeFoodSuggestModal();
  openFoodModalNew(localDate());
  const st = _foodModalState;
  if (!st) return false;
  const kind = guessKindByHour();
  let sit = (st.sittings || []).find(x => x.kind === kind);
  if (!sit) {
    sit = { id: crypto.randomUUID(), kind, dishes: [] };
    st.sittings.push(sit);
  }
  const empty = sit.dishes.find(d => !d.name && !(d.photos || []).length);
  const dish = empty || { id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', tags: [], photos: [] };
  dish.name = name; dish.type = 'home'; dish.tags = tags;
  if (recipeUrl) dish.recipeUrl = recipeUrl;
  if (!empty) sit.dishes.push(dish);
  renderFoodModalBody();
  return true;
}
