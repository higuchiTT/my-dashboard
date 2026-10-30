// ── FOOD TAG CATEGORIES ──
const FOOD_TAG_CATS = [
  { key: 'ingredient', label: '食材' },
  { key: 'role',       label: '役割' },
  { key: 'genre',      label: 'ジャンル' },
  { key: 'method',     label: '調理法' },
  { key: 'other',      label: 'その他' },
];

// キー → タグ名のセット（ingredient はその他すべて）
const _FOOD_TAG_DICT = {
  role:   new Set(['主菜','副菜','汁物','主食','デザート']),
  genre:  new Set(['和食','洋食','中華','韓国','エスニック','イタリアン','フレンチ']),
  method: new Set(['生','焼き','煮物','炒め物','揚げ物','和え物','サラダ','漬け','蒸し']),
  other:  new Set(['作り置き','市販','コース','丼','麺','粉もの','時短']),
};

// タグ名 → 分類キー ('ingredient' | 'role' | 'genre' | 'method' | 'other')
function foodTagCategory(tag) {
  for (const { key } of FOOD_TAG_CATS) {
    if (key === 'ingredient') continue;
    if (_FOOD_TAG_DICT[key] && _FOOD_TAG_DICT[key].has(tag)) return key;
  }
  return 'ingredient';
}

// ── FOOD TAG VIEW ──
let _foodTagsActiveTag = null;
let _foodTagsCatFilter = null; // null = すべて

function setFoodTagCatFilter(key) {
  _foodTagsCatFilter = (key === undefined || key === null) ? null : key;
  renderFoodTagView();
}

function renderFoodTagView() {
  const container = document.getElementById('foodTagGrid');
  if (!container) return;
  if (_foodTagsActiveTag !== null) {
    _renderFoodTagDetail(container);
  } else {
    _renderFoodTagList(container);
  }
}

function _renderFoodTagList(container) {
  const q = foodSearch.trim().toLowerCase();

  // Collect tag usage: { tagName: { count, lastDate } }
  const tagMap = {};
  for (const m of meals) {
    for (const s of (m.sittings || [])) {
      for (const d of (s.dishes || [])) {
        if (foodFilter !== 'all' && d.type !== foodFilter) continue;
        for (const t of (d.tags || [])) {
          if (!tagMap[t]) tagMap[t] = { count: 0, lastDate: '' };
          tagMap[t].count++;
          if (!tagMap[t].lastDate || m.date > tagMap[t].lastDate) tagMap[t].lastDate = m.date;
        }
      }
    }
  }

  // Filter by search query (tag name)
  let tags = Object.entries(tagMap);
  if (q) {
    tags = tags.filter(([t]) => t.toLowerCase().includes(q));
  }

  // Sort by count desc
  tags.sort((a, b) => b[1].count - a[1].count);

  if (tags.length === 0) {
    const msg = q ? '検索結果なし' : '料理の記録画面でタグを付けると、ここにまとまります';
    container.innerHTML = `<div class="food-empty"><div class="ei">🏷</div><div>${esc(msg)}</div></div>`;
    return;
  }

  // Count tags per category (from full result before cat filter)
  const catCounts = {};
  for (const [t] of tags) {
    const k = foodTagCategory(t);
    catCounts[k] = (catCounts[k] || 0) + 1;
  }

  // Category filter pills
  const allCatsWithTags = FOOD_TAG_CATS.filter(c => catCounts[c.key]);
  const filterPills = [{ key: null, label: 'すべて' }, ...allCatsWithTags].map(c => {
    const isActive = _foodTagsCatFilter === c.key;
    const cnt = c.key !== null && catCounts[c.key]
      ? `<span class="food-cat-pill-cnt">${catCounts[c.key]}</span>` : '';
    const onclickArg = c.key === null ? 'null' : jsq(c.key);
    return `<button class="ui-pill${isActive ? ' active' : ''}" onclick="setFoodTagCatFilter(${onclickArg})">${esc(c.label)}${cnt}</button>`;
  }).join('');
  const filterPillsHTML = `<div class="food-tag-cat-pills">${filterPills}</div>`;

  // Apply category filter
  const filteredTags = _foodTagsCatFilter !== null
    ? tags.filter(([t]) => foodTagCategory(t) === _foodTagsCatFilter)
    : tags;

  // Categories to show
  const activeCats = _foodTagsCatFilter !== null
    ? FOOD_TAG_CATS.filter(c => c.key === _foodTagsCatFilter)
    : FOOD_TAG_CATS;

  // Group by category
  let sections = '';
  for (const { key, label } of activeCats) {
    const catTags = filteredTags.filter(([t]) => foodTagCategory(t) === key);
    if (!catTags.length) continue;
    const pills = catTags.map(([t, info]) => {
      const lastDate = info.lastDate;
      const lastLabel = lastDate
        ? `${parseInt(lastDate.slice(5, 7))}/${parseInt(lastDate.slice(8, 10))}`
        : '';
      return `<button class="food-tag-pill" onclick="showFoodTagDetail(${jsq(t)})">
        <span class="food-tag-pill-name">${esc(t)}</span>
        <span class="food-tag-pill-stats">
          <span class="food-tag-pill-count">${info.count}回</span>
          ${lastLabel ? `<span class="food-tag-pill-last">最後: ${esc(lastLabel)}</span>` : ''}
        </span>
      </button>`;
    }).join('');
    sections += `<div class="food-tag-cat-section">
      <div class="food-tag-cat-hdr">
        <span class="food-tag-cat-label">${esc(label)}</span>
        <span class="food-tag-cat-cnt">${catTags.length}</span>
      </div>
      <div class="food-tag-grid">${pills}</div>
    </div>`;
  }

  container.innerHTML = filterPillsHTML + (sections
    ? sections
    : `<div class="food-empty"><div>${q ? '検索結果なし' : '該当なし'}</div></div>`);
}

function _renderFoodTagDetail(container) {
  const tag = _foodTagsActiveTag;
  const q = foodSearch.trim().toLowerCase();
  const KIND_SHORT = { breakfast: '朝', lunch: '昼', dinner: '夕', snack: '軽' };
  const placeholderSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 .55.45 1 1 1h3c.55 0 1 .45 1 1v4"/><path d="M21 22v-2"/></svg>`;

  // Collect dishes with this tag
  const items = []; // { meal, sitting, dish }
  for (const m of meals) {
    for (const s of (m.sittings || [])) {
      for (const d of (s.dishes || [])) {
        if (!(d.tags || []).includes(tag)) continue;
        if (foodFilter !== 'all' && d.type !== foodFilter) continue;
        // Search: match tag name or dish name or place
        if (q && !tag.toLowerCase().includes(q) &&
            !(d.name || '').toLowerCase().includes(q) &&
            !(d.place || '').toLowerCase().includes(q)) continue;
        items.push({ meal: m, sitting: s, dish: d });
      }
    }
  }

  // Sort newest first
  items.sort((a, b) => b.meal.date.localeCompare(a.meal.date));

  let html = `<div class="food-tag-detail-hdr">
    <button class="food-tag-back-btn" onclick="showFoodTagList()">← タグ一覧</button>
    <span class="food-tag-detail-name">${esc(tag)}</span>
    <span class="food-tag-detail-count">${items.length}件</span>
  </div>`;

  if (items.length === 0) {
    html += `<div class="food-empty"><div>${q ? '検索結果なし' : '該当なし'}</div></div>`;
    container.innerHTML = html;
    return;
  }

  const cards = items.map(({ meal, sitting, dish }) => {
    const d = new Date(meal.date + 'T00:00:00');
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const kindShort = KIND_SHORT[sitting.kind] || sitting.kind;
    const isOut = dish.type === 'out';
    const typeLabel = isOut ? '外食' : '自炊';
    const placeLabel = isOut && dish.place ? `@${dish.place}` : '';
    const mealId = esc(String(meal.id));
    const dishId = esc(String(dish.id));
    const firstPhoto = (dish.photos || [])[0];
    const thumbHTML = firstPhoto
      ? `<div class="food-tag-card-thumb"><img data-path="${esc(firstPhoto.path)}" alt="" loading="lazy"></div>`
      : `<div class="food-tag-card-thumb food-tag-card-thumb-empty">${placeholderSVG}</div>`;
    return `<div class="food-tag-card" onclick="openFoodDetailPopup('${mealId}','${dishId}')">
      ${thumbHTML}
      <div class="food-tag-card-info">
        <div class="food-tag-card-name">${esc(dish.name || '（名前なし）')}</div>
        <div class="food-tag-card-meta">
          <span class="food-tag-card-date">${esc(dateLabel)}</span>
          <span class="food-tag-card-kind">${esc(kindShort)}</span>
          <span class="food-tag-card-type ${isOut ? 'out' : 'home'}">${esc(typeLabel)}</span>
          ${placeLabel ? `<span class="food-tag-card-place">${esc(placeLabel)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  html += `<div class="food-tag-card-grid">${cards}</div>`;
  container.innerHTML = html;
  fillSignedUrls(container);
}

function showFoodTagDetail(tag) {
  _foodTagsActiveTag = String(tag);
  renderFoodTagView();
}

function showFoodTagList() {
  _foodTagsActiveTag = null;
  renderFoodTagView();
}
