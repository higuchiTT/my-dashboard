// ── メールから取り込み（楽天カード「カード利用のお知らせ」） ──
// Apps Script（tools/gas/rakuten-mail.gs）が返したメールを解析し、Ledger に「未確認」として出す。
// 設定は txRules.mailImport = {url, token, accountId}、処理済みは txRules.mailHandled = [{key, at}]。
// メール本文はメモリにだけ持つ（保存しない）。
const MAIL_FETCH_DAYS = 45;
const MAIL_FETCH_INTERVAL_MS = 10 * 60 * 1000;
const MAIL_HANDLED_KEEP_DAYS = 150;

// ── 純粋関数（テスト対象） ──
// 本文の ■利用日 / ■利用先 / ■利用者 / ■利用金額 のブロックを読む。日付か金額が取れないブロックは捨てる
function parseRakutenUsageMail(body) {
  const lines = String(body || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^[\s　]*■[\s　]*(利用日|利用先|利用者|利用金額)[\s　]*[:：][\s　]*(.*)$/);
    if (!m) continue;
    const label = m[1], val = m[2].trim();
    if (label === '利用日') { cur = { dateRaw: val, store: '', user: '', amountRaw: '' }; blocks.push(cur); continue; }
    if (!cur) { cur = { dateRaw: '', store: '', user: '', amountRaw: '' }; blocks.push(cur); }
    if (label === '利用先') cur.store = val;
    else if (label === '利用者') cur.user = val;
    else if (label === '利用金額') cur.amountRaw = val;
  }
  const out = [];
  for (const b of blocks) {
    const d = String(b.dateRaw).normalize('NFKC').match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
    const a = String(b.amountRaw).normalize('NFKC').replace(/[,\s]/g, '').match(/\d+/);
    if (!d || !a) continue;
    const amount = Number(a[0]);
    if (!isFinite(amount) || amount <= 0) continue;
    const date = `${d[1]}-${String(d[2]).padStart(2, '0')}-${String(d[3]).padStart(2, '0')}`;
    out.push({ date, store: b.store, user: b.user, amount });
  }
  return out;
}

function mailItemKey(msgId, idx) { return 'rkmail:' + msgId + ':' + idx; }

// 確定版の「カード利用のお知らせ」だけ true（subject が無いときは判断せず true）
function isRakutenUsageSubject(subject) {
  if (typeof subject !== 'string') return true;
  return subject.indexOf('カード利用のお知らせ') === 0 && subject.indexOf('速報版') < 0;
}

// 未確認の一覧。処理済み・取り込み済みを除き、同じ口座・日付・金額の支出があれば possibleDup（記録済みかも）
function buildMailInbox(mails, opts) {
  const o = opts || {};
  const handled = new Set(Array.isArray(o.handledKeys) ? o.handledKeys : (o.handledKeys ? Array.from(o.handledKeys) : []));
  const list = o.txs || [];
  const mailKeys = new Set(list.filter(t => t && t.mailKey).map(t => t.mailKey));
  const accId = String(o.accountId || '');
  const out = [];
  (mails || []).forEach(mail => {
    if (!mail || !isRakutenUsageSubject(mail.subject)) return;
    parseRakutenUsageMail(mail.body).forEach((p, idx) => {
      const key = mailItemKey(mail.id, idx);
      if (handled.has(key) || mailKeys.has(key)) return;
      const possibleDup = list.some(t => t && t.type === 'expense' && !t.mailKey
        && String(t.accountId || '') === accId && t.date === p.date && t.amount === p.amount);
      out.push({ key, mailId: mail.id, date: p.date, store: p.store, user: p.user, amount: p.amount, possibleDup });
    });
  });
  out.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  return out;
}

function mailFetchUrl(url, token, days) {
  return String(url) + '?token=' + encodeURIComponent(token) + '&days=' + (days || MAIL_FETCH_DAYS);
}

// ── 状態（メモリのみ） ──
let _mail = { mails: [], fetchedAt: 0, status: '', loading: false, open: false, catOpenKey: null, cats: {} };

function _mailCfg() { return (txRules && txRules.mailImport) || {}; }
function _mailReady() { const c = _mailCfg(); return !!(c.url && c.token); }
function _mailGuessAccountId() {
  const a = accounts.find(x => !x.archived && /楽天/.test(x.name || ''));
  return a ? String(a.id) : '';
}
function _mailAccountId() { return _mailCfg().accountId || _mailGuessAccountId(); }
function _mailHandledKeys() { return (txRules.mailHandled || []).map(h => h.key); }
function _mailPending() {
  return buildMailInbox(_mail.mails, { handledKeys: _mailHandledKeys(), txs, accountId: _mailAccountId() });
}
function _mailStop(e) { if (e && e.stopPropagation) e.stopPropagation(); }
function _mailGuessCat(store) {
  const names = getCategories('expense').map(c => c.name);
  const sg = suggestTxCategory(store);
  return sg && sg.category && names.includes(sg.category) ? sg.category : 'その他';
}
function _mailCat(it) { return _mail.cats[it.key] || _mailGuessCat(it.store); }

// 処理済みキーを追加して保存（150日より古いものは捨てる）
function _mailMarkHandled(keys) {
  const now = new Date();
  const cutoff = now.getTime() - MAIL_HANDLED_KEEP_DAYS * 86400000;
  const cur = (txRules.mailHandled || []).filter(h => h && h.key && new Date(h.at).getTime() >= cutoff);
  const have = new Set(cur.map(h => h.key));
  keys.forEach(k => { if (!have.has(k)) { cur.push({ key: k, at: now.toISOString() }); have.add(k); } });
  txRules.mailHandled = cur;
}

// ── 取得 ──
async function _mailFetchItems(url, token) {
  let res;
  try { res = await fetch(mailFetchUrl(url, token, MAIL_FETCH_DAYS)); }
  catch (e) { throw new Error('接続できませんでした（URL を確認してください）'); }
  if (!res.ok) throw new Error('接続エラー（HTTP ' + res.status + '）');
  let j;
  try { j = await res.json(); }
  catch (e) { throw new Error('応答を読めませんでした（公開設定「全員」を確認してください）'); }
  if (j && j.error) throw new Error(j.error === 'unauthorized' ? 'トークンが違います' : String(j.error));
  return Array.isArray(j && j.items) ? j.items : [];
}

async function mailRefresh(e) {
  _mailStop(e);
  if (!_mailReady() || _mail.loading) return;
  _mail.loading = true; _mail.status = '確認中…'; renderMailInbox();
  try {
    _mail.mails = await _mailFetchItems(_mailCfg().url, _mailCfg().token);
    _mail.fetchedAt = Date.now();
    const hh = new Date(_mail.fetchedAt);
    _mail.status = `最終確認 ${hh.getHours()}:${String(hh.getMinutes()).padStart(2, '0')}`;
  } catch (err) {
    _mail.status = err.message || '取得できませんでした';
  }
  _mail.loading = false;
  renderMailInbox();
}

// Ledger を開いたとき。10分以内なら取りに行かない
function mailAutoFetch() {
  if (!_mailReady()) { renderMailInbox(); return; }
  if (Date.now() - _mail.fetchedAt < MAIL_FETCH_INTERVAL_MS) { renderMailInbox(); return; }
  mailRefresh();
}

// ── 未確認パネル ──
function renderMailInbox() {
  const box = document.getElementById('ldrMailInbox');
  if (!box) return;
  if (!_mailReady()) { box.innerHTML = ''; return; }
  const items = _mailPending();
  const st = _mail.status ? `<span class="lm-status">${esc(_mail.status)}</span>` : '';
  const refreshBtn = `<button type="button" class="lm-btn" ${_mail.loading ? 'disabled' : ''} onclick="mailRefresh(event)">メールを確認</button>`;
  if (!items.length) {
    box.innerHTML = `<div class="lm-idle">${st}<span class="lm-idle-txt">${_mail.fetchedAt ? '未確認のメールはありません' : 'メール取り込み'}</span>${refreshBtn}</div>`;
    return;
  }
  const confirmable = items.filter(it => !it.possibleDup).length;
  const body = _mail.open ? `<div class="lm-panel">
    <div class="lm-toolbar">
      <button type="button" class="lm-btn lm-btn-main" ${confirmable ? '' : 'disabled'} onclick="mailConfirmAll(event)">全部確定（${confirmable}件）</button>
      ${refreshBtn}${st}
    </div>
    ${items.map(_mailRowHtml).join('')}
  </div>` : '';
  box.innerHTML = `<div class="ui-card lm-box">
    <button type="button" class="lm-banner" onclick="mailToggle(event)" aria-expanded="${_mail.open ? 'true' : 'false'}">
      <span>メールから ${items.length}件 未確認</span><span class="lm-caret">${_mail.open ? '▴' : '▾'}</span>
    </button>${body}
  </div>`;
}

function _mailRowHtml(it) {
  const cat = _mailCat(it);
  const k = jsq(it.key);
  const d = new Date(it.date + 'T00:00:00');
  const dl = isNaN(d) ? it.date : `${d.getMonth() + 1}/${d.getDate()}`;
  const store = normTxName(it.store) || it.store || '（利用先なし）';
  const catPick = _mail.catOpenKey === it.key
    ? `<div class="lm-catlist">${getCategories('expense').map(c =>
      `<button type="button" class="lm-chip${c.name === cat ? ' is-on' : ''}" onclick="mailSetCat(event,${k},${jsq(c.name)})">${esc(c.name)}</button>`).join('')}</div>`
    : '';
  const confirmBtn = `<button type="button" class="lm-btn${it.possibleDup ? '' : ' lm-btn-main'}" onclick="mailConfirm(event,${k})">確定</button>`;
  const skipBtn = `<button type="button" class="lm-btn${it.possibleDup ? ' lm-btn-main' : ''}" onclick="mailSkip(event,${k})">スキップ</button>`;
  return `<div class="lm-row${it.possibleDup ? ' is-dup' : ''}">
    <div class="lm-line1"><span class="lm-date">${esc(dl)}</span><span class="lm-store">${esc(store)}</span><span class="lm-amt">¥${fmt(it.amount)}</span></div>
    <div class="lm-line2">
      ${it.user === '家族' ? '<span class="lm-tag">家族</span>' : ''}${it.possibleDup ? '<span class="lm-tag lm-tag-dup">記録済みかも</span>' : ''}
      <button type="button" class="lm-catbtn" onclick="mailToggleCat(event,${k})"><span class="qx-dot" style="background:${esc(catColor(cat))}"></span>${esc(cat)} ▾</button>
      <span class="lm-acts">${it.possibleDup ? skipBtn + confirmBtn : confirmBtn + skipBtn}</span>
    </div>${catPick}
  </div>`;
}

// ── 操作 ──
function mailToggle(e) { _mailStop(e); _mail.open = !_mail.open; renderMailInbox(); }
function mailToggleCat(e, key) {
  _mailStop(e);
  _mail.catOpenKey = String(_mail.catOpenKey) === String(key) ? null : String(key);
  renderMailInbox();
}
function mailSetCat(e, key, name) {
  _mailStop(e);
  _mail.cats[String(key)] = String(name);
  _mail.catOpenKey = null;
  renderMailInbox();
}
function _mailAfterChange() {
  if (typeof _qxRefreshViews === 'function') _qxRefreshViews();
  renderMailInbox();
}
function _mailCommit(items) {
  if (!items.length) return;
  const now = new Date().toISOString();
  const accId = _mailAccountId();
  items.forEach(it => {
    const srcName = normTxName(it.store);
    const tx = {
      id: crypto.randomUUID(), type: 'expense', title: srcName || it.store, srcName, amount: it.amount,
      category: _mailCat(it), date: it.date, note: it.user === '家族' ? '家族' : '',
      mailKey: it.key, importedAt: now,
    };
    if (accId) tx.accountId = accId;
    txs.push(tx);
  });
  _mailMarkHandled(items.map(it => it.key));
  saveTx();
  saveTxRules();
  _mailAfterChange();
}
function mailConfirm(e, key) {
  _mailStop(e);
  const it = _mailPending().find(x => String(x.key) === String(key));
  if (it) _mailCommit([it]);
}
function mailConfirmAll(e) {
  _mailStop(e);
  const items = _mailPending().filter(x => !x.possibleDup);
  _mailCommit(items);
  _mail.status = `${items.length}件を確定しました`;
  renderMailInbox();
}
function mailSkip(e, key) {
  _mailStop(e);
  _mailMarkHandled([String(key)]);
  saveTxRules();
  renderMailInbox();
}

// ── 設定（Ledger「設定」） ──
function _renderMailSettingsSection() {
  const c = _mailCfg();
  const accId = _mailAccountId();
  const opts = accounts.filter(a => !a.archived).map(a =>
    `<option value="${esc(String(a.id))}"${String(a.id) === String(accId) ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
  return `<div class="ldr-settings-title">メールから取り込み（楽天カード）</div>
    <div class="lm-set">
      <label class="lm-set-lbl">Apps Script URL
        <input type="url" class="lm-in" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off"
          onclick="event.stopPropagation()" onchange="event.stopPropagation();mailCfgSet('url',this.value)"></label>
      <label class="lm-set-lbl">トークン
        <input type="password" class="lm-in" value="${esc(c.token || '')}" autocomplete="off"
          onclick="event.stopPropagation()" onchange="event.stopPropagation();mailCfgSet('token',this.value)"></label>
      <label class="lm-set-lbl">カード口座
        <select class="lm-in" onclick="event.stopPropagation()" onchange="event.stopPropagation();mailCfgSet('accountId',this.value)">
          <option value="">口座未設定</option>${opts}</select></label>
      <div class="lm-set-row">
        <button type="button" class="lm-btn" onclick="mailTestConnection(event)">接続を確かめる</button>
        <span class="lm-status" id="mailTestResult"></span>
      </div>
      <div class="lm-set-note">設定はすべての端末で共通です。URL とトークンは他の人に見せないでください。</div>
    </div>`;
}
function mailCfgSet(field, value) {
  const c = Object.assign({ url: '', token: '', accountId: _mailAccountId() }, _mailCfg());
  c[field] = String(value || '').trim();
  txRules.mailImport = c;
  saveTxRules();
  _mail.fetchedAt = 0;
}
async function mailTestConnection(e) {
  _mailStop(e);
  const out = document.getElementById('mailTestResult');
  const c = _mailCfg();
  if (!c.url || !c.token) { if (out) out.textContent = 'URL とトークンを入れてください'; return; }
  if (out) out.textContent = '確認中…';
  try {
    const items = await _mailFetchItems(c.url, c.token);
    const n = items.reduce((s, m) => s + parseRakutenUsageMail(m.body).length, 0);
    if (out) out.textContent = `接続できました（メール ${items.length}通・利用 ${n}件）`;
  } catch (err) {
    if (out) out.textContent = err.message || '接続できませんでした';
  }
}
