// ── 3タップ支出（クイック入力シート） ──
// 開き方: スマホ幅の Home / Ledger の右下の＋ボタン、または URL ハッシュ #add=expense（PC でも開く）
// 流れ: 金額（テンキー）→ カテゴリのボタンを押す → その場で保存 → トースト（5秒、取り消す）
const QX_AMT_MAX_DIGITS = 8;
const QX_TOP_DAYS = 60;
const QX_TOP_LIMIT = 8;
const QX_TOP_MIN = 6;

let qx = null;            // 開いている間だけ入る状態
let _qxToastTimer = null;
let _qxLastSaved = null;  // 取り消し用 {id}
let _qxReady = false;     // ログイン・データ読み込み後に true

// ── 純粋関数（テスト対象） ──
// テンキーの入力。amt は数字の文字列。key は '0'-'9' / '00' / 'back'
function qxKeypad(amt, key) {
  let a = String(amt || '');
  if (key === 'back') return a.slice(0, -1);
  if (!/^(\d|00)$/.test(String(key))) return a;
  if (a === '' && (key === '0' || key === '00')) return '';   // 先頭の 0 は入れない
  const next = a + key;
  return next.length > QX_AMT_MAX_DIGITS ? a : next;
}

// 直近 days 日の支出で件数の多いカテゴリ（最大 limit 件）。データが少ないときは設定順で min 件まで補う
// cats: getCategories('expense') の結果（設定順）。戻り値はカテゴリ名の配列
function qxTopCategories(txList, cats, now, days, limit, min) {
  days = days || QX_TOP_DAYS; limit = limit || QX_TOP_LIMIT; min = min || QX_TOP_MIN;
  const names = cats.map(c => c.name);
  const cutoff = localDate(new Date((now ? new Date(now) : new Date()).getTime() - days * 86400000));
  const cnt = {};
  (txList || []).forEach(t => {
    if (t.type !== 'expense' || !t.category || !t.date || t.date < cutoff) return;
    if (!names.includes(t.category)) return;
    cnt[t.category] = (cnt[t.category] || 0) + 1;
  });
  const used = Object.keys(cnt)
    .sort((a, b) => cnt[b] - cnt[a] || names.indexOf(a) - names.indexOf(b))
    .slice(0, limit);
  for (const n of names) { if (used.length >= Math.min(min, limit)) break; if (!used.includes(n)) used.push(n); }
  return used;
}

// ── 状態の補助 ──
function _qxAccounts() { return accounts.filter(a => !a.archived); }
function _qxAccName(id) {
  if (!id) return '口座未設定';
  const a = accounts.find(x => String(x.id) === String(id));
  return a ? a.name : '口座未設定';
}
function _qxStop(e) { if (e && e.stopPropagation) e.stopPropagation(); }

// ── 開く・閉じる ──
function qxOpen() {
  const ov = document.getElementById('qxOverlay');
  if (!ov) return;
  let la = '';
  try { la = localStorage.getItem('ledger_last_account') || ''; } catch (e) {}
  if (la && !_qxAccounts().some(a => String(a.id) === la)) la = '';
  const cats = getCategories('expense');
  qx = {
    amt: '', title: '', suggested: '', accId: la, date: today(),
    topNames: qxTopCategories(txs, cats), allOpen: false, accOpen: false, nameOpen: false,
  };
  ov.innerHTML = _qxSheetHtml();
  ov.classList.add('open');
  document.body.classList.add('qx-open');
  _qxUpdateAmt(); _qxRenderCats(); _qxRenderAcc();
  document.addEventListener('keydown', _qxEsc);
}
function _qxEsc(e) { if (e.key === 'Escape') qxClose(); }
function qxClose(e) {
  _qxStop(e);
  const ov = document.getElementById('qxOverlay');
  if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
  document.body.classList.remove('qx-open');
  document.removeEventListener('keydown', _qxEsc);
  qx = null;
}

function _qxSheetHtml() {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'back'];
  const keyHtml = keys.map(k =>
    `<button type="button" class="qx-key${k === 'back' ? ' qx-key-back' : ''}" onclick="event.stopPropagation();qxKey('${k}')" aria-label="${k === 'back' ? '1文字消す' : k}">${k === 'back' ? '⌫' : k}</button>`
  ).join('');
  return `<div class="qx-sheet" id="qxSheet" onclick="event.stopPropagation()" role="dialog" aria-label="支出をすばやく記録">
    <div class="qx-hdr">
      <div class="qx-title">支出をすばやく記録</div>
      <button type="button" class="qx-close" onclick="qxClose(event)" aria-label="閉じる">✕</button>
    </div>
    <div class="qx-amt" id="qxAmt"></div>
    <div class="qx-meta">
      <label class="qx-chip qx-date" onclick="event.stopPropagation()">
        <span id="qxDateLbl"></span>
        <input type="date" id="qxDateIn" value="${esc(qx.date)}" onclick="event.stopPropagation()" onchange="event.stopPropagation();qxSetDate(this.value)">
      </label>
      <button type="button" class="qx-chip qx-acc" id="qxAccChip" onclick="event.stopPropagation();qxToggleAcc()"></button>
      <button type="button" class="qx-chip qx-name-toggle" id="qxNameToggle" onclick="event.stopPropagation();qxToggleName()">＋ 店名・品名</button>
    </div>
    <div class="qx-accpick" id="qxAccPick" style="display:none"></div>
    <div class="qx-namerow" id="qxNameRow" style="display:none">
      <input type="text" id="qxNameIn" class="qx-name-in" placeholder="店名・品名（空欄ならカテゴリ名）" autocomplete="off"
        onclick="event.stopPropagation()" oninput="event.stopPropagation();qxNameInput(this.value)" onkeydown="if(event.key==='Enter'){event.stopPropagation();this.blur();}">
    </div>
    <div class="qx-cats-lbl" id="qxCatsLbl">カテゴリを押すと記録します</div>
    <div class="qx-cats" id="qxCats"></div>
    <div class="qx-keypad">${keyHtml}</div>
  </div>`;
}

// ── 表示の更新 ──
function _qxUpdateAmt() {
  const el = document.getElementById('qxAmt');
  if (!el || !qx) return;
  const n = qx.amt ? parseInt(qx.amt, 10) : 0;
  el.textContent = '¥' + n.toLocaleString('ja-JP');
  el.classList.toggle('is-empty', !qx.amt);
}
function _qxRenderCats() {
  const box = document.getElementById('qxCats');
  if (!box || !qx) return;
  const lbl = document.getElementById('qxCatsLbl');
  if (qx.allOpen) {
    qx.shown = getCategories('expense').map(c => c.name);
    if (lbl) lbl.textContent = 'すべてのカテゴリ';
    box.className = 'qx-cats qx-cats-all';
    box.innerHTML = qx.shown.map((n, i) =>
      `<button type="button" class="qx-cat${n === qx.suggested ? ' is-sug' : ''}" onclick="event.stopPropagation();qxPickCat(${i})">${esc(n)}</button>`).join('')
      + `<button type="button" class="qx-cat qx-cat-more" onclick="event.stopPropagation();qxToggleAll()">‹ 戻る</button>`;
    return;
  }
  if (lbl) lbl.textContent = 'カテゴリを押すと記録します';
  const names = qx.topNames.slice();
  if (qx.suggested && !names.includes(qx.suggested)) names.unshift(qx.suggested);
  qx.shown = names;
  box.className = 'qx-cats';
  box.innerHTML = names.map((n, i) =>
    `<button type="button" class="qx-cat${n === qx.suggested ? ' is-sug' : ''}" onclick="event.stopPropagation();qxPickCat(${i})"><span class="qx-dot" style="background:${esc(catColor(n))}"></span>${esc(n)}</button>`).join('')
    + `<button type="button" class="qx-cat qx-cat-more" onclick="event.stopPropagation();qxToggleAll()">その他…</button>`;
}
function _qxRenderAcc() {
  const chip = document.getElementById('qxAccChip');
  if (chip && qx) chip.textContent = _qxAccName(qx.accId) + ' ▾';
  const dl = document.getElementById('qxDateLbl');
  if (dl && qx) {
    const d = new Date(qx.date + 'T00:00:00');
    dl.textContent = qx.date === today() ? '今日' : (isNaN(d) ? qx.date : `${d.getMonth() + 1}/${d.getDate()}`);
  }
  const pick = document.getElementById('qxAccPick');
  if (pick && qx) {
    pick.style.display = qx.accOpen ? 'flex' : 'none';
    if (qx.accOpen) {
      qx.accList = ['', ..._qxAccounts().map(a => String(a.id))];
      pick.innerHTML = qx.accList.map((id, i) =>
        `<button type="button" class="qx-chip${String(id) === String(qx.accId) ? ' is-on' : ''}" onclick="event.stopPropagation();qxSetAcc(${i})">${esc(_qxAccName(id))}</button>`).join('');
    }
  }
}

// ── 操作 ──
function qxKey(k) {
  if (!qx) return;
  qx.amt = qxKeypad(qx.amt, k);
  _qxUpdateAmt();
}
function qxToggleAll() { if (!qx) return; qx.allOpen = !qx.allOpen; _qxRenderCats(); }
function qxToggleAcc() { if (!qx) return; qx.accOpen = !qx.accOpen; _qxRenderAcc(); }
function qxSetAcc(i) { if (!qx) return; qx.accId = qx.accList[i] || ''; qx.accOpen = false; _qxRenderAcc(); }
function qxSetDate(v) { if (!qx || !v) return; qx.date = v; _qxRenderAcc(); }
function qxToggleName() {
  if (!qx) return;
  qx.nameOpen = !qx.nameOpen;
  const row = document.getElementById('qxNameRow');
  if (row) row.style.display = qx.nameOpen ? 'flex' : 'none';
  if (qx.nameOpen) { const i = document.getElementById('qxNameIn'); if (i) i.focus(); }
}
function qxNameInput(v) {
  if (!qx) return;
  qx.title = v;
  const sg = suggestTxCategory(v);
  const cat = sg && sg.category && getCategories('expense').some(c => c.name === sg.category) ? sg.category : '';
  if (cat !== qx.suggested) { qx.suggested = cat; _qxRenderCats(); }
  if (sg && sg.accountId && !qx.accId && _qxAccounts().some(a => String(a.id) === sg.accountId)) { qx.accId = sg.accountId; _qxRenderAcc(); }
}
function _qxNudge() {
  const el = document.getElementById('qxAmt');
  if (!el) return;
  el.classList.remove('qx-shake');
  void el.offsetWidth;
  el.classList.add('qx-shake');
  setTimeout(() => el.classList.remove('qx-shake'), 500);
}
function qxPickCat(i) {
  if (!qx) return;
  const name = qx.shown && qx.shown[i];
  if (!name) return;
  if (!qx.amt || parseInt(qx.amt, 10) <= 0) { _qxNudge(); return; }
  qxSave(name);
}

// 保存。openTxModal / saveTxModal と同じ形の支出を作る
function qxSave(category) {
  if (!qx) return;
  const amount = parseInt(qx.amt, 10);
  if (!amount || amount <= 0) { _qxNudge(); return; }
  const title = (qx.title || '').trim() || category;
  const tx = { type: 'expense', title, amount, category, date: qx.date || today(), note: '' };
  if (qx.accId) tx.accountId = qx.accId;
  tx.id = crypto.randomUUID();
  try { if (qx.accId) localStorage.setItem('ledger_last_account', qx.accId); } catch (e) {}
  txs.push(tx);
  saveTx();
  _qxLastSaved = { id: String(tx.id) };
  qxClose();
  _qxRefreshViews();
  _qxShowToast(`${category} ¥${amount.toLocaleString('ja-JP')} を記録しました`);
}
function _qxRefreshViews() {
  ldrListInitDone = false;
  const fin = document.getElementById('page-finance');
  if (!fin || !fin.classList.contains('active')) return;   // Home は saveTx が描き直す。Ledger は開いたとき描かれる
  renderFinance();
  renderLdrTxList();
  const t = _ldrActiveTab();
  if (t === 'accounts') renderAccountsPanel();
  if (t === 'subs') renderSubs();
}

// ── トースト・取り消し ──
function _qxShowToast(msg) {
  const el = document.getElementById('qxToast');
  if (!el) return;
  el.innerHTML = `<span class="qx-toast-msg">${esc(msg)}</span><button type="button" class="qx-toast-undo" onclick="event.stopPropagation();qxUndo()">取り消す</button>`;
  el.classList.add('show');
  clearTimeout(_qxToastTimer);
  _qxToastTimer = setTimeout(_qxHideToast, 5000);
}
function _qxHideToast() {
  const el = document.getElementById('qxToast');
  if (el) el.classList.remove('show');
  _qxLastSaved = null;
}
function qxUndo() {
  if (!_qxLastSaved) return;
  const id = _qxLastSaved.id;
  txs = txs.filter(t => String(t.id) !== String(id));
  saveTx();
  clearTimeout(_qxToastTimer);
  _qxHideToast();
  _qxRefreshViews();
}

// ── URL ハッシュ #add=expense（ホーム画面ショートカット用） ──
// 他のハッシュ（認証用の type / access_token など）は残す
function qxHandleHash() {
  _qxReady = true;
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('add') !== 'expense') return;
  params.delete('add');
  const rest = params.toString();
  try { history.replaceState(null, '', location.pathname + location.search + (rest ? '#' + rest : '')); } catch (e) {}
  if (!qx) qxOpen();
}
window.addEventListener('hashchange', () => { if (_qxReady) qxHandleHash(); });
