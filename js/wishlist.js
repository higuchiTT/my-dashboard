// ── WISHLIST（To-Do と同じ作り: 左にカード一覧、右に詳細パネル。スマホはカードをタップで編集シート） ──
let shopSortMode = 'priority'; // 'priority' | 'month' | 'order'
let _shopShowBought = false;
try { _shopShowBought = localStorage.getItem('wishlist_show_bought') === '1'; } catch(e) {}

// 画面の状態（保存しない）。month: null=絞り込みなし / 'none'=予定月が未定 / 'YYYY-MM'
const wlState = { selectedId: null, status: null, category: '', month: null, candEdit: null, sheetOpen: false };

const shopCategories = ['家具・インテリア','家電','アウトドア','その他'];
const STATUS_ORDER = ['検討中', '保留中', '購入済み'];
const PRIORITY_ORDER = ['high', 'mid', 'low'];
const PRIORITY_LABELS = {high:'高', mid:'中', low:'低'};
const WL_STATUS_CLS = {'検討中':'consider', '保留中':'hold', '購入済み':'bought'};

function saveShop(){localStorage.setItem('hd_shopping',JSON.stringify(shopping));saveToSupabase();}
function wlFind(id){ return shopping.find(s => String(s.id) === String(id)); }
function wlIsMobile(){ return window.matchMedia('(max-width: 640px)').matches; }
function _shopToggleBought(){
  _shopShowBought = !_shopShowBought;
  try { localStorage.setItem('wishlist_show_bought', _shopShowBought ? '1' : '0'); } catch(e) {}
  renderShopping();
}

// ── 純粋関数（画面に触らない。テスト対象） ──
function wlYm(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function wlMonthLabel(ym, now){
  if(!ym) return '未定';
  const [y,m] = ym.split('-').map(Number);
  const ny = (now || new Date()).getFullYear();
  return y === ny ? `${m}月` : `${y}年${m}月`;
}
// 今月から6か月＋「未定」。購入済みは数えない
function wlMonthStrip(items, now){
  now = now || new Date();
  const act = (items || []).filter(s => s.status !== '購入済み');
  const make = (ym, list) => ({ ym, label: wlMonthLabel(ym, now), total: list.reduce((a, s) => a + (s.price || 0), 0), count: list.length });
  const out = [];
  for(let i = 0; i < 6; i++){
    const ym = wlYm(new Date(now.getFullYear(), now.getMonth() + i, 1));
    out.push(make(ym, act.filter(s => s.targetMonth === ym)));
  }
  out.push(make(null, act.filter(s => !s.targetMonth)));
  return out;
}
function wlThreeMonthTotal(items, now){
  now = now || new Date();
  let total = 0;
  for(let i = 0; i < 3; i++){
    const ym = wlYm(new Date(now.getFullYear(), now.getMonth() + i, 1));
    (items || []).filter(s => s.status !== '購入済み' && s.targetMonth === ym).forEach(s => { total += (s.price || 0); });
  }
  return total;
}
function getThreeMonthTotal(){ return wlThreeMonthTotal(shopping, new Date()); }
// f = {status, category, month, showBought}。status が空なら、購入済みは showBought のときだけ含める
function wlFilterItems(items, f){
  f = f || {};
  return (items || []).filter(s => {
    if(f.status){ if(s.status !== f.status) return false; }
    else if(s.status === '購入済み' && !f.showBought) return false;
    if(f.category && s.category !== f.category) return false;
    if(f.month){
      if(f.month === 'none'){ if(s.targetMonth) return false; }
      else if(s.targetMonth !== f.month) return false;
    }
    return true;
  });
}
function wlSortItems(items, mode){
  const all = [...(items || [])];
  const stIdx = s => { const i = STATUS_ORDER.indexOf(s.status ?? ''); return i === -1 ? 999 : i; };
  const prIdx = s => { const i = PRIORITY_ORDER.indexOf(s.priority ?? 'mid'); return i === -1 ? 1 : i; };
  if(mode === 'priority'){
    return all.sort((a, b) => (stIdx(a) - stIdx(b)) || (prIdx(a) - prIdx(b)) || (a.name ?? '').localeCompare(b.name ?? '', 'ja'));
  }
  if(mode === 'month'){
    return all.sort((a, b) => {
      const sd = stIdx(a) - stIdx(b); if(sd !== 0) return sd;
      const am = a.targetMonth || 'zzz', bm = b.targetMonth || 'zzz';
      if(am !== bm) return am.localeCompare(bm);
      return prIdx(a) - prIdx(b);
    });
  }
  const groups = {}; STATUS_ORDER.forEach(st => groups[st] = []);
  all.forEach(item => { const st = item.status ?? '検討中'; (groups[st] || (groups[st] = [])).push(item); });
  return [...(groups['検討中'] || []), ...(groups['保留中'] || []), ...(groups['購入済み'] || [])];
}
function getSortedItems(){ return wlSortItems(shopping, shopSortMode); }

function wlMonthOptions(current, now){
  now = now || new Date();
  let opts = `<option value=""${!current ? ' selected' : ''}>未定</option>`;
  const seen = new Set();
  for(let i = 0; i <= 11; i++){
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = wlYm(d); seen.add(val);
    const label = i === 0 ? `今月（${d.getMonth()+1}月）` : (d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}年${d.getMonth()+1}月` : `${d.getMonth()+1}月`);
    opts += `<option value="${val}"${current === val ? ' selected' : ''}>${label}</option>`;
  }
  if(current && !seen.has(current)) opts += `<option value="${esc(current)}" selected>${esc(wlMonthLabel(current, now))}</option>`;
  return opts;
}

// ── 選択・シート ──
function wlEnsureCandIds(s){ (s.candidates || []).forEach(c => { if(!c.id) c.id = crypto.randomUUID(); }); }
function wlSelect(id){
  const s = wlFind(id); if(!s) return;
  wlEnsureCandIds(s);
  wlState.selectedId = String(id);
  wlState.candEdit = null;
  if(wlIsMobile()){ wlOpenSheet(); return; }
  wlRenderMain(); wlRenderDetail();
}
function wlDeselect(){ wlState.selectedId = null; wlState.candEdit = null; wlRenderMain(); wlRenderDetail(); }
function wlOpenSheet(){
  wlState.sheetOpen = true;
  wlRenderDetail();
  document.getElementById('wlSheetOverlay').classList.add('open');
  document.addEventListener('keydown', _wlSheetKeydown);
  wlRenderMain();
}
function wlCloseSheet(){
  const ov = document.getElementById('wlSheetOverlay');
  if(ov) ov.classList.remove('open');
  document.removeEventListener('keydown', _wlSheetKeydown);
  wlState.sheetOpen = false;
  wlState.selectedId = null;
  wlState.candEdit = null;
  wlRenderMain();
  wlRenderDetail();
}
function _wlSheetKeydown(e){ if(e.key === 'Escape') wlCloseSheet(); }
function wlRoot(){ return document.getElementById(wlState.sheetOpen ? 'wlSheetBody' : 'wlDetail'); }

// ── フィルタの操作 ──
function wlSetStatusFilter(v){ wlState.status = v || null; renderShopping(); }
function wlSetCatFilter(v){ wlState.category = v || ''; renderShopping(); }
function wlSetSort(mode){ shopSortMode = mode; renderShopping(); }
function wlToggleMonth(key){ wlState.month = wlState.month === key ? null : key; renderShopping(); }
function setShopSort(mode){ wlSetSort(mode); }

// ── 追加 ──
function wlToggleAddMore(){
  const f = document.getElementById('wlAddMore');
  const open = f.classList.toggle('open');
  const b = document.getElementById('wlAddMoreBtn'); if(b) b.classList.toggle('active', open);
}
function wlInitAddForm(){
  const m = document.getElementById('wlAddMonth');
  if(m && !m.options.length) m.innerHTML = wlMonthOptions('', new Date());
  const c = document.getElementById('wlAddCat');
  if(c && !c.options.length) c.innerHTML = shopCategories.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
}
function wlAddItem(){
  const nameEl = document.getElementById('wlAddName');
  const name = nameEl.value.trim();
  if(!name){ nameEl.focus(); return; }
  const priceRaw = document.getElementById('wlAddPrice').value;
  const price = priceRaw !== '' && isFinite(parseFloat(priceRaw)) ? parseFloat(priceRaw) : null;
  const item = {
    id: crypto.randomUUID(), name,
    category: document.getElementById('wlAddCat').value || shopCategories[0],
    price, status: '検討中', candidates: [], note: '',
    priority: document.getElementById('wlAddPri').value || 'mid',
    targetMonth: document.getElementById('wlAddMonth').value || null
  };
  shopping.push(item);
  saveShop();
  nameEl.value = '';
  document.getElementById('wlAddPrice').value = '';
  // 追加したものが絞り込みで隠れないようにする
  if(!wlFilterItems([item], { status: wlState.status, category: wlState.category, month: wlState.month, showBought: _shopShowBought }).length){
    wlState.status = null; wlState.category = ''; wlState.month = null;
  }
  if(!wlIsMobile()){ wlState.selectedId = String(item.id); wlState.candEdit = null; }
  renderShopping();
  nameEl.focus();
}

// ── 右パネル・シートでの編集（保存して一覧だけ描き直す。パネル自身は描き直さない = 入力中のフォーカスを奪わない） ──
function wlCommit(withPanel){
  saveShop();
  wlRenderMain();
  if(withPanel) wlRenderDetail();
}
function wlSetName(id, input){
  const s = wlFind(id); if(!s) return;
  const v = input.value.trim();
  if(!v){ input.value = s.name; return; }
  s.name = v; wlCommit(false);
}
function wlSetPrice(id, val){
  const s = wlFind(id); if(!s) return;
  const n = parseFloat(val);
  s.price = (val !== '' && isFinite(n) && n >= 0) ? n : null;
  wlCommit(false);
}
function wlSetNote(id, val){ const s = wlFind(id); if(!s) return; s.note = val; wlCommit(false); }
function wlSetCategory(id, v){ const s = wlFind(id); if(!s) return; s.category = v; wlCommit(true); }
function wlSetPriority(id, v){ const s = wlFind(id); if(!s) return; s.priority = v; wlCommit(true); }
function wlSetMonth(id, v){ const s = wlFind(id); if(!s) return; s.targetMonth = v || null; wlCommit(true); }
function wlSetStatus(id, v){ const s = wlFind(id); if(!s) return; s.status = v; wlCommit(true); }

async function wlDelItem(id){
  const s = wlFind(id); if(!s) return;
  if(!await uiConfirm(`「${s.name}」を削除しますか？`, { title:'アイテムの削除', okLabel:'削除', danger:true })) return;
  shopping = shopping.filter(x => String(x.id) !== String(id));
  saveShop();
  if(String(wlState.selectedId) === String(id)){ wlState.selectedId = null; wlState.candEdit = null; }
  if(wlState.sheetOpen){ wlCloseSheet(); return; }
  renderShopping();
}

// ── 候補の操作 ──
function wlAddCand(){
  if(!wlState.selectedId) return;
  wlState.candEdit = 'new';
  wlRenderDetail();
  setTimeout(() => { const r = wlRoot(); const el = r && r.querySelector('[data-cf="name"]'); if(el) el.focus(); }, 0);
}
function wlEditCand(candId){
  wlState.candEdit = String(candId);
  wlRenderDetail();
  setTimeout(() => { const r = wlRoot(); const el = r && r.querySelector('[data-cf="name"]'); if(el) el.focus(); }, 0);
}
function wlCancelCand(){ wlState.candEdit = null; wlRenderDetail(); }
function wlSaveCand(itemId){
  const s = wlFind(itemId); if(!s) return;
  const r = wlRoot(); if(!r) return;
  const v = k => { const el = r.querySelector(`[data-cf="${k}"]`); return el ? el.value : ''; };
  const name = v('name').trim();
  const p = parseFloat(v('price'));
  const vals = { name, price: (v('price') !== '' && isFinite(p) && p >= 0) ? p : null, pros: v('pros').trim(), cons: v('cons').trim(), memo: v('memo').trim(), url: v('url').trim() };
  if(!s.candidates) s.candidates = [];
  if(wlState.candEdit === 'new'){
    if(!name){ const el = r.querySelector('[data-cf="name"]'); if(el) el.focus(); return; }
    s.candidates.push(Object.assign({ id: crypto.randomUUID(), starred: false, rating: 0, chosen: false }, vals));
  }else{
    const c = s.candidates.find(c => String(c.id) === wlState.candEdit);
    if(c) Object.assign(c, vals);
  }
  wlState.candEdit = null;
  wlCommit(true);
}
async function wlDelCand(itemId, candId){
  const s = wlFind(itemId); if(!s) return;
  const c = (s.candidates || []).find(c => String(c.id) === String(candId)); if(!c) return;
  if(!await uiConfirm(`候補「${c.name || '（名前なし）'}」を削除しますか？`, { title:'候補の削除', okLabel:'削除', danger:true })) return;
  s.candidates = s.candidates.filter(x => String(x.id) !== String(candId));
  if(wlState.candEdit === String(candId)) wlState.candEdit = null;
  wlCommit(true);
}
function wlRate(itemId, candId, n){
  const s = wlFind(itemId); if(!s) return;
  const c = (s.candidates || []).find(c => String(c.id) === String(candId)); if(!c) return;
  c.rating = (c.rating === n) ? 0 : n;
  wlCommit(true);
}
async function wlChoose(itemId, candId){
  const s = wlFind(itemId); if(!s) return;
  const c = (s.candidates || []).find(c => String(c.id) === String(candId)); if(!c) return;
  if(c.chosen){ c.chosen = false; wlCommit(true); return; }
  s.candidates.forEach(x => x.chosen = false);
  c.chosen = true;
  if(c.price){
    const ok = await uiConfirm(`予算を ¥${fmt(c.price)} にします`, { title:`「${c.name}」に決定`, okLabel:'予算も更新する', cancelLabel:'候補だけ決定' });
    if(ok) s.price = c.price;
  }
  wlCommit(true);
}

// ── 描画: 一覧側 ──
function renderShopping(){
  wlInitAddForm();
  wlRenderMain();
  wlRenderDetail();
}

function wlStatBlock(label, amount, unit, cls){
  return `<div class="wl-stat-card ${cls}"><div class="wl-stat-label">${label}</div><div class="wl-stat-num-row"><span class="wl-stat-num">¥${fmt(amount)}</span>${unit ? `<span class="wl-stat-unit">${unit}</span>` : ''}</div></div>`;
}

function wlCardHTML(s, now){
  const q = jsq(String(s.id));
  const sel = String(wlState.selectedId) === String(s.id);
  const cands = s.candidates || [];
  const chosen = cands.find(c => c.chosen);
  const pr = s.priority || 'mid';
  const memo = String(s.note || '').split('\n')[0].trim();
  const st = WL_STATUS_CLS[s.status] || 'consider';
  return `<div class="ui-card wl-card wl-st-${st}${sel ? ' sel' : ''}" role="button" tabindex="0" onclick="wlSelect(${q})" onkeydown="if(event.key==='Enter'&&!event.isComposing){wlSelect(${q})}">
    <div class="wl-card-top"><span class="wl-card-cat">${esc(s.category || '')}</span><span class="wl-badge wl-badge-st wl-bst-${st}">${esc(s.status || '')}</span></div>
    <div class="wl-card-name">${esc(s.name)}</div>
    <div class="wl-card-mid">
      <span class="wl-card-tags"><span class="wl-badge wl-badge-pri wl-bpri-${esc(pr)}">優先 ${esc(PRIORITY_LABELS[pr] || '中')}</span><span class="wl-badge wl-badge-month">${esc(wlMonthLabel(s.targetMonth, now))}</span></span>
      <span class="wl-card-price">${s.price ? '¥' + fmt(s.price) : '—'}</span>
    </div>
    ${(cands.length || chosen) ? `<div class="wl-card-cand">${cands.length ? `<span class="wl-cand-n">候補 ${cands.length}</span>` : ''}${chosen ? `<span class="wl-cand-chosen">決定: ${esc(chosen.name || '候補')}</span>` : ''}</div>` : ''}
    ${memo ? `<div class="wl-card-memo">${esc(memo)}</div>` : ''}
  </div>`;
}

function wlRenderMain(){
  const now = new Date();
  const kent = shopping.filter(s => s.status === '検討中');
  const hor = shopping.filter(s => s.status === '保留中');
  const sum = l => l.reduce((a, s) => a + (s.price || 0), 0);

  // 1. サマリー
  const statsEl = document.getElementById('wlStats');
  if(statsEl) statsEl.innerHTML =
    wlStatBlock('検討中', sum(kent), `（${kent.length}件）`, 'consider') +
    wlStatBlock('保留中', sum(hor), `（${hor.length}件）`, 'hold') +
    wlStatBlock('今後3か月の購入予定', wlThreeMonthTotal(shopping, now), '', 'plan');

  // 2. 月ごとの帯
  const strip = wlMonthStrip(shopping, now);
  const monthsEl = document.getElementById('wlMonths');
  if(monthsEl) monthsEl.innerHTML = strip.map((m, i) => {
    const key = m.ym || 'none';
    return `<button class="wl-month${wlState.month === key ? ' active' : ''}${m.count ? '' : ' empty'}${m.ym ? '' : ' undef'}" onclick="wlToggleMonth(${jsq(key)})" aria-pressed="${wlState.month === key}">
      <span class="wl-month-label">${esc(m.label)}${i === 0 ? '<em>今月</em>' : ''}</span>
      <span class="wl-month-total">${m.total ? '¥' + fmt(m.total) : '—'}</span>
      <span class="wl-month-n">${m.count}件</span>
    </button>`;
  }).join('');

  // 3. ステータスのピル・購入済み
  const active = shopping.filter(s => s.status !== '購入済み');
  const boughtN = shopping.length - active.length;
  const views = [['検討中', '検討中', kent.length], ['保留中', '保留中', hor.length], [null, 'すべて', active.length]];
  const viewsEl = document.getElementById('wlViews');
  if(viewsEl) viewsEl.innerHTML = views.map(([v, label, n]) =>
    `<button class="ui-pill wl-pill${wlState.status === v ? ' active' : ''}" onclick="wlSetStatusFilter(${v === null ? 'null' : jsq(v)})">${label} <span class="wl-pill-n">${n}</span></button>`
  ).join('') + ((boughtN > 0 || _shopShowBought) ? `<button class="ui-pill wl-pill wl-pill-bought${_shopShowBought ? ' active' : ''}" onclick="_shopToggleBought()">購入済み ${boughtN} 件</button>` : '');

  // 4. カテゴリ・並べ替え
  const cats = [...new Set([...shopCategories, ...shopping.map(s => s.category).filter(Boolean)])];
  if(wlState.category && !cats.includes(wlState.category)) cats.push(wlState.category);
  const filtersEl = document.getElementById('wlFilters');
  if(filtersEl) filtersEl.innerHTML = `<select class="wl-sel" onchange="wlSetCatFilter(this.value)" aria-label="カテゴリ">
      <option value="">すべてのカテゴリ</option>
      ${cats.map(c => `<option value="${esc(c)}"${wlState.category === c ? ' selected' : ''}>${esc(c)}（${shopping.filter(s => s.category === c && s.status !== '購入済み').length}）</option>`).join('')}
    </select>
    <select class="wl-sel" onchange="wlSetSort(this.value)" aria-label="並べ替え">
      <option value="priority"${shopSortMode === 'priority' ? ' selected' : ''}>優先度順</option>
      <option value="month"${shopSortMode === 'month' ? ' selected' : ''}>予定月順</option>
      <option value="order"${shopSortMode === 'order' ? ' selected' : ''}>追加順</option>
    </select>`;

  // 5. カード
  const items = wlFilterItems(wlSortItems(shopping, shopSortMode), { status: wlState.status, category: wlState.category, month: wlState.month, showBought: _shopShowBought });
  const gridEl = document.getElementById('wlGrid');
  if(gridEl){
    if(items.length) gridEl.innerHTML = items.map(s => wlCardHTML(s, now)).join('');
    else{
      const filtered = wlState.status || wlState.category || wlState.month;
      gridEl.innerHTML = `<div class="ui-card wl-empty"><div class="wl-empty-title">${filtered ? '条件に合うアイテムがありません' : (shopping.length ? 'アイテムがありません（購入済みは非表示）' : 'アイテムがありません')}</div></div>`;
    }
  }
}

// ── 描画: 詳細（PC は右パネル、スマホは編集シート。同じ中身） ──
function wlRenderDetail(){
  const el = wlRoot();
  if(!el) return;
  const s = wlState.selectedId != null ? wlFind(wlState.selectedId) : null;
  if(!s){
    wlState.selectedId = null;
    if(wlState.sheetOpen){ wlCloseSheet(); return; }
    el.innerHTML = `<div class="wl-d-empty"><div class="wl-d-empty-text">アイテムを選ぶと、ここで詳しく編集できます</div></div>`;
    return;
  }
  el.innerHTML = wlDetailHTML(s, wlState.sheetOpen);
}

function wlStarsHTML(itemQ, c){
  let h = '';
  for(let i = 1; i <= 5; i++){
    h += `<button class="wl-star${i <= (c.rating || 0) ? ' filled' : ''}" onclick="event.stopPropagation();wlRate(${itemQ},${jsq(String(c.id))},${i})" aria-label="評価 ${i}">★</button>`;
  }
  return `<span class="wl-stars">${h}</span>`;
}

function wlCandFormHTML(itemQ, c){
  c = c || {};
  return `<div class="wl-cand wl-cand-form">
    <label class="wl-cf"><span>候補名</span><input class="wl-d-in" data-cf="name" type="text" value="${esc(c.name || '')}" placeholder="候補名"></label>
    <label class="wl-cf"><span>価格</span><input class="wl-d-in wl-num" data-cf="price" type="number" inputmode="numeric" min="0" value="${c.price != null && c.price !== '' ? esc(c.price) : ''}" placeholder="0"></label>
    <label class="wl-cf"><span>良い点</span><textarea class="wl-memo wl-memo-sm" data-cf="pros" rows="2">${esc(c.pros || '')}</textarea></label>
    <label class="wl-cf"><span>気になる点</span><textarea class="wl-memo wl-memo-sm" data-cf="cons" rows="2">${esc(c.cons || '')}</textarea></label>
    <label class="wl-cf"><span>メモ</span><textarea class="wl-memo wl-memo-sm" data-cf="memo" rows="2">${esc(c.memo || '')}</textarea></label>
    <label class="wl-cf"><span>リンク</span><input class="wl-d-in" data-cf="url" type="url" value="${esc(c.url || '')}" placeholder="https://..."></label>
    <div class="wl-cand-acts"><button class="wl-btn wl-btn-primary" onclick="wlSaveCand(${itemQ})">保存</button><button class="wl-btn" onclick="wlCancelCand()">キャンセル</button></div>
  </div>`;
}

function wlCandsHTML(s){
  const itemQ = jsq(String(s.id));
  const cands = s.candidates || [];
  const prices = cands.map(c => c.price || 0).filter(p => p > 0);
  const minPrice = prices.length > 1 ? Math.min(...prices) : null;
  let body = cands.map(c => {
    const cq = jsq(String(c.id));
    if(wlState.candEdit === String(c.id)) return wlCandFormHTML(itemQ, c);
    const chosen = !!c.chosen;
    const isMin = minPrice !== null && c.price === minPrice;
    const url = /^https?:\/\//i.test(c.url || '') ? c.url : '';
    const row = (lbl, v) => v ? `<div class="wl-cand-row"><span class="wl-cand-lbl">${lbl}</span><span class="wl-cand-val">${esc(v)}</span></div>` : '';
    return `<div class="wl-cand${chosen ? ' chosen' : ''}">
      <div class="wl-cand-head">
        <span class="wl-cand-name">${esc(c.name || '（名前なし）')}${chosen ? '<span class="wl-cand-badge">✓ 決定</span>' : ''}</span>
        <span class="wl-cand-price${isMin ? ' cheapest' : ''}">${c.price ? '¥' + fmt(c.price) : '—'}</span>
      </div>
      <div class="wl-cand-stars">${wlStarsHTML(itemQ, c)}${url ? `<a class="wl-cand-link" href="${esc(url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ 開く</a>` : ''}</div>
      ${row('良い点', c.pros)}${row('気になる点', c.cons)}${row('メモ', c.memo)}
      <div class="wl-cand-acts">
        <button class="wl-btn wl-btn-choose${chosen ? ' on' : ''}" onclick="wlChoose(${itemQ},${cq})">${chosen ? '決定を取り消す' : 'これに決めた'}</button>
        <button class="wl-btn" onclick="wlEditCand(${cq})">編集</button>
        <button class="wl-btn wl-btn-del" onclick="wlDelCand(${itemQ},${cq})">削除</button>
      </div>
    </div>`;
  }).join('');
  if(wlState.candEdit === 'new') body += wlCandFormHTML(itemQ, null);
  if(!body) body = '<div class="wl-d-hint">候補がありません。「＋ 候補を追加」で価格や良い点を比べられます。</div>';
  return `<div class="wl-d-sec">
    <div class="wl-d-sec-hdr"><h3 class="wl-d-sec-title">候補比較（${cands.length}件）</h3><button class="wl-btn" onclick="wlAddCand()">＋ 候補を追加</button></div>
    ${body}
  </div>`;
}

function wlDetailHTML(s, inSheet){
  const q = jsq(String(s.id));
  const now = new Date();
  const cats = [...new Set([...shopCategories, s.category].filter(Boolean))];
  const pr = s.priority || 'mid';
  const segP = Object.entries(PRIORITY_LABELS).map(([v, l]) => `<button class="ui-seg-btn${pr === v ? ' active' : ''}" onclick="wlSetPriority(${q},'${v}')">${l}</button>`).join('');
  const segS = STATUS_ORDER.map(st => `<button class="ui-seg-btn${s.status === st ? ' active' : ''}" onclick="wlSetStatus(${q},${jsq(st)})">${st}</button>`).join('');
  return `<div class="wl-d-head${inSheet ? ' in-sheet' : ''}">
      <input class="wl-d-title" type="text" value="${esc(s.name)}" onchange="wlSetName(${q},this)" onkeydown="if(event.key==='Enter'&&!event.isComposing)this.blur()" aria-label="品名">
      ${inSheet ? '' : '<button class="wl-d-close" onclick="wlDeselect()" aria-label="閉じる">✕</button>'}
    </div>
    <div class="wl-d-body">
      <div class="wl-d-row"><label class="wl-d-lbl">ステータス</label><div class="ui-seg wl-d-seg">${segS}</div></div>
      <div class="wl-d-row"><label class="wl-d-lbl">予算</label>
        <div class="wl-d-money"><span>¥</span><input class="wl-d-in wl-num" type="number" inputmode="numeric" min="0" value="${s.price ? esc(s.price) : ''}" placeholder="0" onchange="wlSetPrice(${q},this.value)"></div></div>
      <div class="wl-d-row"><label class="wl-d-lbl">優先度</label><div class="ui-seg wl-d-seg">${segP}</div></div>
      <div class="wl-d-row"><label class="wl-d-lbl">予定月</label>
        <select class="wl-d-in" onchange="wlSetMonth(${q},this.value)">${wlMonthOptions(s.targetMonth, now)}</select></div>
      <div class="wl-d-row"><label class="wl-d-lbl">カテゴリ</label>
        <select class="wl-d-in" onchange="wlSetCategory(${q},this.value)">${cats.map(c => `<option value="${esc(c)}"${s.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="wl-d-row col"><label class="wl-d-lbl">メモ</label>
        <textarea class="wl-memo" rows="3" placeholder="メモ" onchange="wlSetNote(${q},this.value)">${esc(s.note || '')}</textarea></div>
    </div>
    ${wlCandsHTML(s)}
    <div class="wl-d-foot"><button class="wl-d-del" onclick="wlDelItem(${q})">このアイテムを削除</button></div>`;
}
