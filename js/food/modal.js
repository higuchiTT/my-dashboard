// ── FOOD MODAL ──
function openFoodModalNew(dateStr) {
  if (!dateStr) dateStr = localDate();
  const existing = meals.find(m => m.date === dateStr);
  if (existing) { openFoodModal(String(existing.id)); return; }
  const kind = guessKindByHour();
  _foodModalState = {
    id: crypto.randomUUID(), date: dateStr, memo: '', v: 2,
    sittings: [{
      id: crypto.randomUUID(), kind,
      dishes: [{ id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', tags: [], photos: [] }]
    }],
    isNew: true, _focusDishId: null
  };
  document.getElementById('foodModalTitle').textContent = '記録を追加';
  renderFoodModalBody();
  document.getElementById('foodModalOverlay').style.display = 'flex';
}

function openFoodModal(id) {
  const meal = meals.find(m => String(m.id) === String(id));
  if (!meal) return;
  _foodModalState = { ...JSON.parse(JSON.stringify(meal)), isNew: false };
  document.getElementById('foodModalTitle').textContent = '記録を編集';
  renderFoodModalBody();
  document.getElementById('foodModalOverlay').style.display = 'flex';
}

function closeFoodModal() {
  _foodModalState = null;
  document.getElementById('foodModalOverlay').style.display = 'none';
}

function renderFoodModalBody() {
  if (!_foodModalState) return;
  const s = _foodModalState;
  const sortedSittings = (s.sittings||[]).slice().sort((a,b)=>KIND_ORDER.indexOf(a.kind)-KIND_ORDER.indexOf(b.kind));
  const usedKinds = new Set(sortedSittings.map(sit=>sit.kind));
  const missedKinds = KIND_ORDER.filter(k=>!usedKinds.has(k));

  const sittingsHTML = sortedSittings.map(sit => foodSittingSectionHTML(sit)).join('');
  const addKindBtns = missedKinds.map(k =>
    `<button class="food-sitting-add-kind-btn" onclick="event.stopPropagation();addFoodSitting('${esc(k)}')">＋ ${esc(KIND_LABELS[k])}</button>`
  ).join('');

  document.getElementById('foodModalBody').innerHTML = `
    <div class="food-modal-section">
      <div class="food-modal-label">日付</div>
      <input type="date" id="foodModalDate" value="${esc(s.date)}"
        style="font-family:'Space Grotesk',sans-serif;font-size:14px;padding:7px 10px;border:1px solid var(--ink3);background:var(--paper);color:var(--ink);outline:none;width:180px;border-radius:0;"
        onchange="onFoodModalDateChange(this.value)">
    </div>
    <div class="food-modal-section">
      <div class="food-modal-label">食事<span class="food-photo-hint">感想・写真は料理ごとに追加できます（Ctrl+V 貼り付けは最後に選択した料理に追加）</span></div>
      <div id="foodSittingList">${sittingsHTML}</div>
      ${missedKinds.length ? `<div class="food-sitting-add-btns">${addKindBtns}</div>` : ''}
    </div>
    <div class="food-modal-section">
      <div class="food-modal-label">その日のメモ</div>
      <textarea class="food-memo-ta" id="foodModalMemo" placeholder="今日の食事についてメモ">${esc(s.memo)}</textarea>
    </div>
    <div class="food-photo-error" id="foodPhotoError"></div>
    <input type="file" id="foodPhotoInput" accept="image/*" multiple style="display:none"
      onchange="handleFoodPhotoUpload(Array.from(this.files));this.value=''">
  `;
  document.getElementById('foodModalFtr').innerHTML = `
    <div id="foodDelConfirmWrap">
      ${!s.isNew ? `<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="showFoodDelConfirm()">記録を削除</button>` : ''}
    </div>
    <div class="food-modal-ftr-right">
      <button class="btn btn-ghost" onclick="closeFoodModal()">キャンセル</button>
      <button class="btn btn-primary" id="foodSaveBtn" onclick="saveFoodModal()">保存</button>
    </div>
  `;
  // Fill signed URLs for existing photos
  fillSignedUrls(document.getElementById('foodSittingList'));
}

function foodSittingSectionHTML(sit) {
  const dishes = sit.dishes || [];
  const dishesHTML = dishes.map((d, i) => foodDishRowHTML(sit.id, d, i)).join('');
  return `<div class="food-sitting-section" id="foodSitting-${esc(sit.id)}">
    <div class="food-sitting-hdr">
      <span class="food-sitting-kind-label">${esc(KIND_LABELS[sit.kind]||sit.kind)}</span>
      <button class="food-sitting-del-btn" onclick="event.stopPropagation();removeFoodSitting('${esc(String(sit.id))}')" title="このセクションを削除">✕</button>
    </div>
    <div class="food-sitting-body">
      <div id="foodDishList-${esc(sit.id)}">${dishesHTML}</div>
      <button class="food-add-dish" onclick="event.stopPropagation();addFoodDish('${esc(String(sit.id))}')">＋ 料理を追加</button>
    </div>
  </div>`;
}

function foodDishRowHTML(sittingId, d, i) {
  const isOut = d.type === 'out';
  const sid = esc(String(sittingId));
  const did = esc(String(d.id));
  const photosHTML = foodDishPhotoThumbsHTML(sittingId, d);
  return `<div class="food-dish-row" id="foodDish-${sid}-${i}"
    onclick="_setFocusDishId('${did}')"
    onfocus="_setFocusDishId('${did}')" tabindex="-1">
    <div class="food-dish-fields">
      <div class="food-dish-row-top">
        <input class="food-dish-name" type="text" value="${esc(d.name)}" placeholder="料理名（必須）"
          oninput="foodDishFieldInput('${sid}','${did}','name',this.value)"
          onfocus="event.stopPropagation();_setFocusDishId('${did}')">
        <div class="food-type-toggle">
          <button class="food-type-btn${!isOut ? ' active-home' : ''}" onclick="event.stopPropagation();setFoodDishType('${sid}','${did}','home')">自炊</button>
          <button class="food-type-btn${isOut ? ' active-out' : ''}" onclick="event.stopPropagation();setFoodDishType('${sid}','${did}','out')">外食</button>
        </div>
      </div>
      <div class="food-dish-extra">
        ${isOut ? `<input class="food-dish-place" type="text" value="${esc(d.place || '')}" placeholder="店名" oninput="foodDishFieldInput('${sid}','${did}','place',this.value)" onfocus="event.stopPropagation();_setFocusDishId('${did}')">` : ''}
        <input class="food-dish-url" type="text" value="${esc(d.recipeUrl || '')}" placeholder="レシピURL（任意）" oninput="foodDishFieldInput('${sid}','${did}','recipeUrl',this.value)" onfocus="event.stopPropagation();_setFocusDishId('${did}')">
      </div>
      <textarea class="food-dish-note-ta" placeholder="料理の感想（任意）"
        oninput="foodDishFieldInput('${sid}','${did}','note',this.value)"
        onfocus="event.stopPropagation();_setFocusDishId('${did}')">${esc(d.note||'')}</textarea>
      <div class="food-dish-tag-row">
        <div class="food-dish-tag-wrap" onclick="event.stopPropagation();document.getElementById('foodDishTagIn-${did}').focus()">
          <span id="foodDishTagChips-${did}">${(d.tags||[]).map((t,i)=>`<span class="notes-tag-chip-in">${esc(t)}<button type="button" class="notes-tag-chip-in-x" onclick="event.stopPropagation();foodDishTagRemove('${did}',${i})">×</button></span>`).join('')}</span>
          <input type="text" id="foodDishTagIn-${did}" class="food-dish-tag-text-in" placeholder="タグ（Enter）"
            onkeydown="event.stopPropagation();foodDishTagKeydown(event,'${did}')"
            oninput="event.stopPropagation();foodDishTagOninput(event,'${did}')"
            onfocus="event.stopPropagation();_setFocusDishId('${did}')"
            onblur="setTimeout(()=>{const a=document.getElementById('foodDishTagAC-${did}');if(a)a.classList.remove('open');},150)">
          <div class="food-dish-tag-ac" id="foodDishTagAC-${did}"></div>
        </div>
      </div>
      <div class="food-dish-photo-area" id="foodDishPhotoArea-${did}"
        ondragover="foodDishDragOver(event,'${did}')" ondragleave="foodDragLeave(event)" ondrop="foodDishDrop(event,'${did}')">
        <div class="food-photos-wrap" id="foodDishPhotos-${did}">${photosHTML}
          <button class="food-photo-add-btn" onclick="event.stopPropagation();_setFocusDishId('${did}');document.getElementById('foodPhotoInput').click()">
            <span style="font-size:16px">＋</span><span>写真</span>
          </button>
        </div>
      </div>
    </div>
    <button class="food-dish-del" onclick="event.stopPropagation();removeFoodDish('${sid}','${did}')" title="削除">✕</button>
  </div>`;
}

function foodDishPhotoThumbsHTML(sittingId, dish) {
  const sid = esc(String(sittingId));
  return (dish.photos || []).map(p => `<div class="food-photo-thumb">
    <img data-path="${esc(p.path)}" src="" alt="">
    <button class="food-photo-del" onclick="event.stopPropagation();deleteFoodPhoto('${esc(String(p.id))}','${esc(String(dish.id))}')" title="削除">✕</button>
  </div>`).join('');
}

function _setFocusDishId(dishId) {
  if (_foodModalState) _foodModalState._focusDishId = String(dishId);
}

function _getFocusDish() {
  if (!_foodModalState) return null;
  const allDishes = (_foodModalState.sittings||[]).flatMap(s=>s.dishes||[]);
  if (_foodModalState._focusDishId) {
    const d = allDishes.find(d=>String(d.id)===String(_foodModalState._focusDishId));
    if (d) return d;
  }
  return allDishes[allDishes.length - 1] || null;
}

function _findSittingByDishId(dishId) {
  if (!_foodModalState) return null;
  return (_foodModalState.sittings||[]).find(s=>(s.dishes||[]).some(d=>String(d.id)===String(dishId)));
}

function foodDishFieldInput(sittingId, dishId, field, val) {
  if (!_foodModalState) return;
  const sitting = (_foodModalState.sittings||[]).find(s=>String(s.id)===String(sittingId));
  if (!sitting) return;
  const dish = (sitting.dishes||[]).find(d=>String(d.id)===String(dishId));
  if (!dish) return;
  dish[field] = val;
}

function _findDishById(dishId) {
  if (!_foodModalState) return null;
  for (const s of (_foodModalState.sittings||[])) {
    const d = (s.dishes||[]).find(d => String(d.id) === String(dishId));
    if (d) return d;
  }
  return null;
}

function _renderFoodDishTagChips(dishId, tags) {
  const el = document.getElementById(`foodDishTagChips-${dishId}`);
  if (!el) return;
  const did = esc(String(dishId));
  el.innerHTML = (tags||[]).map((t,i) =>
    `<span class="notes-tag-chip-in">${esc(t)}<button type="button" class="notes-tag-chip-in-x" onclick="event.stopPropagation();foodDishTagRemove('${did}',${i})">×</button></span>`
  ).join('');
}

function foodDishTagAdd(dishId, tag) {
  tag = tag.trim();
  if (!tag) return;
  const d = _findDishById(dishId);
  if (!d) return;
  if (!d.tags) d.tags = [];
  if (!d.tags.includes(tag)) d.tags.push(tag);
  _renderFoodDishTagChips(dishId, d.tags);
}

function foodDishTagRemove(dishId, idx) {
  const d = _findDishById(dishId);
  if (!d || !d.tags) return;
  d.tags.splice(idx, 1);
  _renderFoodDishTagChips(dishId, d.tags);
  document.getElementById(`foodDishTagIn-${dishId}`)?.focus();
}

function foodDishTagKeydown(e, dishId) {
  const input = e.target;
  const val = input.value;
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const tag = val.trim().replace(/,/g, '');
    if (tag) foodDishTagAdd(dishId, tag);
    input.value = '';
    document.getElementById(`foodDishTagAC-${dishId}`)?.classList.remove('open');
  } else if (e.key === 'Backspace' && !val) {
    const d = _findDishById(dishId);
    if (d && d.tags && d.tags.length > 0) {
      d.tags.pop();
      _renderFoodDishTagChips(dishId, d.tags);
    }
  }
}

function foodDishTagOninput(e, dishId) {
  const val = e.target.value;
  if (val.endsWith(',')) {
    const tag = val.slice(0,-1).trim();
    if (tag) foodDishTagAdd(dishId, tag);
    e.target.value = '';
    document.getElementById(`foodDishTagAC-${dishId}`)?.classList.remove('open');
    return;
  }
  const ac = document.getElementById(`foodDishTagAC-${dishId}`);
  if (!ac || !val.trim()) { ac?.classList.remove('open'); return; }
  const usage = _getFoodTagUsage();
  const curTags = (_findDishById(dishId)||{}).tags||[];
  const matches = Object.entries(usage)
    .filter(([t]) => t.toLowerCase().includes(val.toLowerCase()) && !curTags.includes(t))
    .sort((a,b) => b[1]-a[1]).slice(0, 6);
  if (!matches.length) { ac.classList.remove('open'); return; }
  const did = esc(String(dishId));
  ac.innerHTML = matches.map(([t]) =>
    `<div class="food-dish-tag-ac-item" onmousedown="event.preventDefault();foodDishTagPickAC('${did}','${esc(t)}')">${esc(t)}</div>`
  ).join('');
  ac.classList.add('open');
}

function foodDishTagPickAC(dishId, tag) {
  foodDishTagAdd(dishId, tag);
  const inp = document.getElementById(`foodDishTagIn-${dishId}`);
  if (inp) inp.value = '';
  document.getElementById(`foodDishTagAC-${dishId}`)?.classList.remove('open');
  inp?.focus();
}

function setFoodDishType(sittingId, dishId, type) {
  if (!_foodModalState) return;
  const sitting = (_foodModalState.sittings||[]).find(s=>String(s.id)===String(sittingId));
  if (!sitting) return;
  const dish = (sitting.dishes||[]).find(d=>String(d.id)===String(dishId));
  if (!dish) return;
  _collectModalInputs();
  dish.type = type;
  const idx = (sitting.dishes||[]).indexOf(dish);
  const rowEl = document.getElementById(`foodDish-${esc(sittingId)}-${idx}`);
  if (rowEl) rowEl.outerHTML = foodDishRowHTML(sittingId, dish, idx);
  fillSignedUrls(document.getElementById('foodSittingList'));
}

function addFoodSitting(kind) {
  if (!_foodModalState) return;
  _collectModalInputs();
  if ((_foodModalState.sittings||[]).some(s=>s.kind===kind)) return; // already exists
  const newSitting = { id: crypto.randomUUID(), kind, dishes: [{ id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', tags: [], photos: [] }] };
  _foodModalState.sittings.push(newSitting);
  renderFoodModalBody();
}

async function removeFoodSitting(sittingId) {
  if (!_foodModalState) return;
  if (!(await uiConfirm('このセクションを削除しますか？',{title:'セクションの削除',danger:true}))) return;
  _collectModalInputs();
  _foodModalState.sittings = (_foodModalState.sittings||[]).filter(s=>String(s.id)!==String(sittingId));
  renderFoodModalBody();
}

function addFoodDish(sittingId) {
  if (!_foodModalState) return;
  _collectModalInputs();
  const sitting = (_foodModalState.sittings||[]).find(s=>String(s.id)===String(sittingId));
  if (!sitting) return;
  const newDish = { id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', tags: [], photos: [] };
  sitting.dishes.push(newDish);
  const i = sitting.dishes.length - 1;
  const listEl = document.getElementById(`foodDishList-${sittingId}`);
  if (listEl) {
    const div = document.createElement('div');
    div.innerHTML = foodDishRowHTML(sittingId, newDish, i);
    listEl.appendChild(div.firstElementChild);
    const nameIn = document.getElementById(`foodDish-${sittingId}-${i}`)?.querySelector('.food-dish-name');
    if (nameIn) nameIn.focus();
  }
}

function removeFoodDish(sittingId, dishId) {
  if (!_foodModalState) return;
  _collectModalInputs();
  const sitting = (_foodModalState.sittings||[]).find(s=>String(s.id)===String(sittingId));
  if (!sitting) return;
  if (sitting.dishes.length <= 1) {
    sitting.dishes[0] = { id: crypto.randomUUID(), name: '', type: 'home', place: '', recipeUrl: '', note: '', tags: [], photos: [] };
  } else {
    sitting.dishes = sitting.dishes.filter(d=>String(d.id)!==String(dishId));
  }
  const listEl = document.getElementById(`foodDishList-${sittingId}`);
  if (listEl) listEl.innerHTML = sitting.dishes.map((d,idx)=>foodDishRowHTML(sittingId,d,idx)).join('');
  fillSignedUrls(document.getElementById('foodSittingList'));
}

function _collectModalInputs() {
  if (!_foodModalState) return;
  for (const sitting of (_foodModalState.sittings||[])) {
    (sitting.dishes||[]).forEach((d, i) => {
      const row = document.getElementById(`foodDish-${sitting.id}-${i}`);
      if (!row) return;
      const nameEl = row.querySelector('.food-dish-name');
      if (nameEl) d.name = nameEl.value;
      const placeEl = row.querySelector('.food-dish-place');
      if (placeEl) d.place = placeEl.value;
      const urlEl = row.querySelector('.food-dish-url');
      if (urlEl) d.recipeUrl = urlEl.value;
      const noteEl = row.querySelector('.food-dish-note-ta');
      if (noteEl) d.note = noteEl.value;
    });
  }
  const memoEl = document.getElementById('foodModalMemo');
  if (memoEl) _foodModalState.memo = memoEl.value;
  const dateEl = document.getElementById('foodModalDate');
  if (dateEl) _foodModalState.date = dateEl.value;
}

function onFoodModalDateChange(val) {
  if (!_foodModalState) return;
  if (_foodModalState.isNew) {
    const existing = meals.find(m => m.date === val);
    if (existing) { openFoodModal(existing.id); return; }
  }
  _foodModalState.date = val;
}

function saveFoodModal() {
  if (!_foodModalState || _foodUploading > 0) return;
  _collectModalInputs();
  const sittings = (_foodModalState.sittings||[]).map(s => ({
    ...s,
    dishes: (s.dishes||[]).filter(d => d.name.trim())
  })).filter(s => s.dishes.length > 0);
  const meal = {
    id: _foodModalState.id,
    date: _foodModalState.date,
    memo: _foodModalState.memo.trim(),
    v: 2,
    sittings,
    updatedAt: new Date().toISOString()
  };
  const other = meals.find(m => m.date === meal.date && String(m.id) !== String(meal.id));
  if (other) {
    // Merge sittings by kind
    const mergedSittings = [...(other.sittings||[])];
    for (const s of meal.sittings) {
      const existing = mergedSittings.find(es => es.kind === s.kind);
      if (existing) {
        existing.dishes = [...(existing.dishes||[]), ...(s.dishes||[])];
      } else {
        mergedSittings.push(s);
      }
    }
    other.sittings = mergedSittings;
    other.memo = [other.memo, meal.memo].filter(Boolean).join('\n');
    other.updatedAt = meal.updatedAt;
    meals = meals.filter(m => String(m.id) !== String(meal.id));
  } else {
    const idx = meals.findIndex(m => String(m.id) === String(meal.id));
    if (idx >= 0) meals[idx] = meal; else meals.unshift(meal);
  }
  saveMeals();
  closeFoodModal();
  renderFood();
}

function showFoodDelConfirm() {
  const wrap = document.getElementById('foodDelConfirmWrap');
  if (!wrap || !_foodModalState) return;
  wrap.innerHTML = `
    <div class="food-del-confirm">本当に削除しますか？</div>
    <div class="food-del-btns">
      <button class="btn btn-ghost btn-sm" onclick="cancelFoodDelConfirm()">キャンセル</button>
      <button class="btn btn-sm" style="background:var(--accent);color:var(--paper);border:none;padding:5px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;"
        onclick="deleteFoodRecord('${esc(_foodModalState.id)}')">削除する</button>
    </div>`;
}

function cancelFoodDelConfirm() {
  const wrap = document.getElementById('foodDelConfirmWrap');
  if (!wrap) return;
  wrap.innerHTML = `<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="showFoodDelConfirm()">記録を削除</button>`;
}

async function deleteFoodRecord(id) {
  const meal = meals.find(m => String(m.id) === String(id));
  if (!meal) return;
  const paths = _allMealPhotoPaths(meal);
  if (paths.length) {
    try { await sb.storage.from('meal-photos').remove(paths); } catch(e) {}
    paths.forEach(p => delete _signedUrlCache[p]);
  }
  meals = meals.filter(m => String(m.id) !== String(id));
  saveMeals();
  closeFoodModal();
  closeFoodDetailPopup();
  renderFood();
}

async function deleteFoodPhoto(photoId, dishId) {
  if (!_foodModalState) return;
  // Find the dish that owns this photo
  let ownerDish = null;
  for (const s of (_foodModalState.sittings||[])) {
    const d = (s.dishes||[]).find(d=>String(d.id)===String(dishId));
    if (d) { ownerDish = d; break; }
  }
  if (!ownerDish) return;
  const photo = (ownerDish.photos||[]).find(p=>String(p.id)===String(photoId));
  if (!photo) return;
  try { await sb.storage.from('meal-photos').remove([photo.path]); } catch(e) {}
  delete _signedUrlCache[photo.path];
  ownerDish.photos = ownerDish.photos.filter(p=>String(p.id)!==String(photoId));
  // Re-render just this dish's photo area
  const photoWrap = document.getElementById(`foodDishPhotos-${dishId}`);
  if (photoWrap) {
    photoWrap.innerHTML = foodDishPhotoThumbsHTML(
      (_foodModalState.sittings||[]).find(s=>(s.dishes||[]).some(d=>String(d.id)===String(dishId)))?.id,
      ownerDish
    ) + `<button class="food-photo-add-btn" onclick="event.stopPropagation();_setFocusDishId('${esc(String(dishId))}');document.getElementById('foodPhotoInput').click()"><span style="font-size:16px">＋</span><span>写真</span></button>`;
    fillSignedUrls(photoWrap);
  }
}

function _updateSaveBtn() {
  const saveBtn = document.getElementById('foodSaveBtn');
  if (!saveBtn) return;
  const uploading = _foodUploading > 0;
  saveBtn.disabled = uploading;
  saveBtn.textContent = uploading ? 'アップロード中…' : '保存';
  const errEl = document.getElementById('foodPhotoError');
  if (errEl && uploading) errEl.textContent = '';
}

async function resizeFoodImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { reject(new Error('画像サイズを取得できませんでした')); return; }
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('JPEGへの変換に失敗しました')); }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('この形式の画像は読み込めません（HEICなど）')); };
    img.src = url;
  });
}

async function handleFoodPhotoUpload(files, targetDishId) {
  const state = _foodModalState;
  const list = Array.from(files || []);
  if (!state || !list.length) return;
  // Determine target dish
  const resolvedDishId = targetDishId || (state._focusDishId) || null;
  let targetDish = null;
  let targetSitting = null;
  if (resolvedDishId) {
    for (const s of (state.sittings||[])) {
      const d = (s.dishes||[]).find(d=>String(d.id)===String(resolvedDishId));
      if (d) { targetDish = d; targetSitting = s; break; }
    }
  }
  if (!targetDish) {
    // Fall back to last dish of last sitting
    const lastSitting = (state.sittings||[])[(state.sittings||[]).length-1];
    if (lastSitting && (lastSitting.dishes||[]).length) {
      targetDish = lastSitting.dishes[lastSitting.dishes.length-1];
      targetSitting = lastSitting;
    }
  }
  if (!targetDish) return;
  const errEl = document.getElementById('foodPhotoError');
  if (errEl) errEl.textContent = '';
  const errors = [];
  _foodUploading++;
  _updateSaveBtn();
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('ログインが必要です');
    for (const file of list) {
      try {
        const blob = await resizeFoodImage(file);
        const photoId = crypto.randomUUID();
        const path = `${user.id}/${state.date}/${photoId}.jpg`;
        const { error } = await sb.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        targetDish.photos.push({ id: photoId, path });
      } catch(e) {
        errors.push(`${file.name}: ${e.message || 'アップロード失敗'}`);
      }
    }
  } catch(e) {
    errors.push(e.message || 'アップロード失敗');
  }
  _foodUploading--;
  if (_foodModalState !== state) { _updateSaveBtn(); return; }
  const errNow = document.getElementById('foodPhotoError');
  if (errNow) errNow.textContent = errors.length ? `エラー: ${errors.join(' / ')}` : '';
  _updateSaveBtn();
  // Re-render the target dish photo area
  const photoWrap = document.getElementById(`foodDishPhotos-${targetDish.id}`);
  if (photoWrap) {
    photoWrap.innerHTML = foodDishPhotoThumbsHTML(targetSitting.id, targetDish) +
      `<button class="food-photo-add-btn" onclick="event.stopPropagation();_setFocusDishId('${esc(String(targetDish.id))}');document.getElementById('foodPhotoInput').click()"><span style="font-size:16px">＋</span><span>写真</span></button>`;
    fillSignedUrls(photoWrap);
  }
}

function _hasDraggedFiles(e) {
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types || []) : [];
  return types.includes('Files') || types.includes('text/uri-list');
}

function foodDragOver(e) {
  if (!_foodModalState || !_hasDraggedFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  e.currentTarget.classList.add('drag-over');
}

function foodDragLeave(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return;
  e.currentTarget.classList.remove('drag-over');
}

function foodDishDragOver(e, dishId) {
  if (!_foodModalState || !_hasDraggedFiles(e)) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  e.currentTarget.classList.add('drag-over');
  _setFocusDishId(dishId);
}

function foodDishDrop(e, dishId) {
  if (!_hasDraggedFiles(e)) return;
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  if (!_foodModalState) return;
  _setFocusDishId(dishId);
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (files.length) { handleFoodPhotoUpload(files, dishId); return; }
  const errEl = document.getElementById('foodPhotoError');
  if (errEl) errEl.textContent = 'ブラウザ上の画像はドロップできません。画像を右クリック →「画像をコピー」→ この画面で Ctrl+V で貼り付けてください';
}

function foodDrop(e) {
  if (!_hasDraggedFiles(e)) return;
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_foodModalState) return;
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (files.length) { handleFoodPhotoUpload(files); return; }
  const errEl = document.getElementById('foodPhotoError');
  if (errEl) errEl.textContent = 'ブラウザ上の画像はドロップできません。画像を右クリック →「画像をコピー」→ この画面で Ctrl+V で貼り付けてください';
}

document.addEventListener('paste', e => {
  if (!_foodModalState || !e.clipboardData) return;
  const files = Array.from(e.clipboardData.items || [])
    .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean);
  if (!files.length) return;
  e.preventDefault();
  handleFoodPhotoUpload(files); // uses _focusDishId internally
});

// モーダル外にファイルを落としたとき、ブラウザが画像を開いてページ遷移するのを防ぐ
['dragover', 'drop'].forEach(type => window.addEventListener(type, e => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault();
}));
