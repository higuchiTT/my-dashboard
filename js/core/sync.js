// ── SUPABASE SYNC ──
let _syncReady = false;
let _serverUpdatedAt = null;   // last confirmed server updated_at
let _baseSnapshot    = null;   // collections deep-copy at that point
let _pushInFlight    = false;  // serialization guard
let _pushPending     = false;  // re-run flag

function _showSyncWarnBanner() {
  document.getElementById('syncWarnBanner').classList.add('show');
}

let _saveErrToastTimer = null;
function _showSaveErrToast(msg) {
  const el = document.getElementById('saveErrToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_saveErrToastTimer);
  _saveErrToastTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

let _syncInfoToastTimer = null;
function _showSyncInfoToast(msg) {
  const el = document.getElementById('syncInfoToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_syncInfoToastTimer);
  _syncInfoToastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Collection helpers ──
function _collectSeedFlags() {
  const flags = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('hd_')) flags[k] = localStorage.getItem(k);
  }
  return flags;
}

function _snapshotCollections() {
  return JSON.parse(JSON.stringify({
    tasks, task_notes: taskNotes, shopping, subs, txs, trips, meals,
    budgets, accounts, tx_rules: txRules, reflections, seed_flags: _collectSeedFlags()
  }));
}

function _localCollections() {
  return { tasks, task_notes: taskNotes, shopping, subs, txs, trips, meals,
    budgets, accounts, tx_rules: txRules, reflections, seed_flags: _collectSeedFlags() };
}

function _extractSnapshot(row) {
  return {
    tasks:       Array.isArray(row.tasks)       ? row.tasks       : [],
    task_notes:  row.task_notes  || {},
    shopping:    Array.isArray(row.shopping)    ? row.shopping    : [],
    subs:        Array.isArray(row.subs)        ? row.subs        : [],
    txs:         Array.isArray(row.txs)         ? row.txs         : [],
    trips:       Array.isArray(row.trips)       ? row.trips       : [],
    meals:       Array.isArray(row.meals)       ? row.meals       : [],
    budgets:     (row.budgets && typeof row.budgets==='object' && !Array.isArray(row.budgets)) ? row.budgets : {base:{total:null,cats:{}},months:{}},
    accounts:    Array.isArray(row.accounts)    ? row.accounts    : [],
    tx_rules:    (row.tx_rules && typeof row.tx_rules==='object') ? row.tx_rules : {rules:[]},
    reflections: Array.isArray(row.reflections) ? row.reflections : [],
    seed_flags:  row.seed_flags  || {}
  };
}

function _applyCollections(c) {
  if (Array.isArray(c.tasks))      { tasks    = c.tasks;      localStorage.setItem('hd_tasks',       JSON.stringify(tasks)); }
  if (c.task_notes)                { taskNotes = c.task_notes; localStorage.setItem('hd_task_notes',  JSON.stringify(taskNotes)); }
  if (Array.isArray(c.shopping))   { shopping  = c.shopping;  localStorage.setItem('hd_shopping',    JSON.stringify(shopping)); }
  if (Array.isArray(c.subs))       { subs      = c.subs;      localStorage.setItem('hd_subs',        JSON.stringify(subs)); }
  if (Array.isArray(c.txs))        { txs       = c.txs;       localStorage.setItem('hd_tx',          JSON.stringify(txs)); }
  if (Array.isArray(c.trips))      { trips     = c.trips;     localStorage.setItem('hd_trips',       JSON.stringify(trips)); }
  if (Array.isArray(c.meals))      { meals     = c.meals;     localStorage.setItem('food_meals',     JSON.stringify(meals)); }
  if (c.budgets && typeof c.budgets==='object' && !Array.isArray(c.budgets)) { budgets  = c.budgets;  localStorage.setItem('ledger_budgets',  JSON.stringify(budgets)); }
  if (Array.isArray(c.accounts))   { accounts  = c.accounts;  localStorage.setItem('ledger_accounts',JSON.stringify(accounts)); }
  if (c.tx_rules && typeof c.tx_rules==='object' && !Array.isArray(c.tx_rules)) { txRules = c.tx_rules; localStorage.setItem('ledger_tx_rules', JSON.stringify(txRules)); }
  if (Array.isArray(c.reflections)){ reflections = c.reflections; localStorage.setItem('reflections', JSON.stringify(reflections)); }
  if (c.seed_flags) Object.entries(c.seed_flags).forEach(([k,v]) => localStorage.setItem(k, v));
}

// ── 3-way merge ──
function mergeArrayById(base, local, server) {
  const bArr = base || [], lArr = local || [], sArr = server || [];
  const baseMap   = new Map(bArr.map(x => [String(x.id), x]));
  const localMap  = new Map(lArr.map(x => [String(x.id), x]));
  const serverMap = new Map(sArr.map(x => [String(x.id), x]));
  const result = [];
  const added  = new Set();

  for (const [sid, sItem] of serverMap) {
    const inBase  = baseMap.has(sid);
    const inLocal = localMap.has(sid);
    if (inBase && inLocal) {
      const lItem = localMap.get(sid), bItem = baseMap.get(sid);
      result.push(JSON.parse(JSON.stringify(
        JSON.stringify(lItem) !== JSON.stringify(bItem) ? lItem : sItem
      )));
    } else if (!inBase && inLocal) {
      result.push(JSON.parse(JSON.stringify(localMap.get(sid))));
    } else if (inBase && !inLocal) {
      // local deleted → skip
    } else {
      result.push(JSON.parse(JSON.stringify(sItem)));
    }
    added.add(sid);
  }

  for (const [lid, lItem] of localMap) {
    if (added.has(lid)) continue;
    if (!baseMap.has(lid)) {
      result.push(JSON.parse(JSON.stringify(lItem)));
    } else {
      const bItem = baseMap.get(lid);
      if (JSON.stringify(lItem) !== JSON.stringify(bItem)) {
        result.push(JSON.parse(JSON.stringify(lItem)));
      }
    }
  }
  return result;
}

function mergeObjKeysDeep(base, local, server) {
  const b = base || {}, l = local || {}, s = server || {};
  const result = JSON.parse(JSON.stringify(s));
  for (const key of Object.keys(l)) {
    const inBase = key in b;
    if (!inBase) {
      result[key] = JSON.parse(JSON.stringify(l[key]));
    } else {
      const lv = l[key], bv = b[key], sv = s[key];
      if (JSON.stringify(lv) !== JSON.stringify(bv)) {
        if (lv !== null && typeof lv === 'object' && !Array.isArray(lv) &&
            bv !== null && typeof bv === 'object' && !Array.isArray(bv) &&
            (sv === undefined || (sv !== null && typeof sv === 'object' && !Array.isArray(sv)))) {
          result[key] = mergeObjKeysDeep(bv, lv, sv || {});
        } else {
          result[key] = JSON.parse(JSON.stringify(lv));
        }
      }
    }
  }
  for (const key of Object.keys(b)) {
    if (!(key in l) && key in result) delete result[key];
  }
  return result;
}

function mergeCollections(base, local, server) {
  const b = base || {}, l = local || {}, s = server || {};
  return {
    tasks:       mergeArrayById(b.tasks,      l.tasks,      s.tasks),
    task_notes:  mergeObjKeysDeep(b.task_notes,  l.task_notes,  s.task_notes),
    shopping:    mergeArrayById(b.shopping,   l.shopping,   s.shopping),
    subs:        mergeArrayById(b.subs,       l.subs,       s.subs),
    txs:         mergeArrayById(b.txs,        l.txs,        s.txs),
    trips:       mergeArrayById(b.trips,      l.trips,      s.trips),
    meals:       mergeArrayById(b.meals,      l.meals,      s.meals),
    budgets:     mergeObjKeysDeep(b.budgets,     l.budgets,     s.budgets),
    accounts:    mergeArrayById(b.accounts,   l.accounts,   s.accounts),
    tx_rules:    { rules: mergeArrayById(b.tx_rules && b.tx_rules.rules, l.tx_rules && l.tx_rules.rules, s.tx_rules && s.tx_rules.rules), categories: mergeArrayById(b.tx_rules && b.tx_rules.categories, l.tx_rules && l.tx_rules.categories, s.tx_rules && s.tx_rules.categories) },
    reflections: mergeArrayById(b.reflections, l.reflections, s.reflections),
    seed_flags:  mergeObjKeysDeep(b.seed_flags,  l.seed_flags,  s.seed_flags),
  };
}

// ── Push (serialized, optimistic-lock) ──
async function _enqueuePush(userId) {
  if (_pushInFlight) { _pushPending = true; return; }
  _pushInFlight = true;
  _pushPending  = false;
  try {
    await pushToSupabase(userId);
  } finally {
    _pushInFlight = false;
    if (_pushPending) {
      _pushPending = false;
      _enqueuePush(userId);
    }
  }
}

async function pushToSupabase(userId) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const seedFlags = _collectSeedFlags();
    const newTs = new Date().toISOString();
    const payload = {
      user_id: userId, tasks, task_notes: taskNotes,
      shopping, subs, txs, trips, meals, budgets, accounts, tx_rules: txRules, reflections,
      seed_flags: seedFlags, updated_at: newTs
    };

    // No server baseline yet → insert (initial user)
    if (_serverUpdatedAt === null) {
      const { data: upsertData, error: upsertErr } = await sb.from('user_data')
        .upsert(payload).select('updated_at').single();
      if (upsertErr) {
        console.error('pushToSupabase upsert error:', upsertErr);
        _showSaveErrToast(`保存に失敗しました（${upsertErr.message}）`);
        return;
      }
      if (upsertData) { _serverUpdatedAt = upsertData.updated_at; _baseSnapshot = _snapshotCollections(); }
      return;
    }

    // Optimistic update
    const { data: updated, error: updErr } = await sb.from('user_data')
      .update(payload).eq('user_id', userId).eq('updated_at', _serverUpdatedAt).select('updated_at');
    if (updErr) {
      console.error('pushToSupabase update error:', updErr);
      _showSaveErrToast(`保存に失敗しました（${updErr.message}）`);
      return;
    }
    if (updated && updated.length > 0) {
      _serverUpdatedAt = updated[0].updated_at;
      _baseSnapshot    = _snapshotCollections();
      return;
    }

    // Conflict: 0 rows matched → another device updated first
    if (attempt < MAX_RETRIES - 1) {
      const { data: serverRow, error: fetchErr } = await sb.from('user_data')
        .select('*').eq('user_id', userId).single();
      if (fetchErr || !serverRow) {
        console.error('pushToSupabase conflict fetch error:', fetchErr);
        _showSaveErrToast('競合解決に失敗しました。再読み込みしてください');
        return;
      }
      const merged = mergeCollections(_baseSnapshot || {}, _localCollections(), serverRow);
      _applyCollections(merged);
      rerenderAll();
      _baseSnapshot    = _extractSnapshot(serverRow);
      _serverUpdatedAt = serverRow.updated_at;
      // loop continues with merged data as new local
    }
  }
  _showSaveErrToast('競合の解決に繰り返し失敗しました。再読み込みしてください');
}

async function syncFromSupabase(userId) {
  try {
    const { data, error } = await sb.from('user_data').select('*').eq('user_id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') {
        // 行が存在しない（初回ユーザー）— insert with upsert
        const seedFlags = _collectSeedFlags();
        const newTs = new Date().toISOString();
        const { data: upsertData, error: upsertErr } = await sb.from('user_data').upsert({
          user_id: userId, tasks, task_notes: taskNotes,
          shopping, subs, txs, trips, meals, budgets, accounts, tx_rules: txRules, reflections,
          seed_flags: seedFlags, updated_at: newTs
        }).select('updated_at').single();
        if (!upsertErr && upsertData) {
          _serverUpdatedAt = upsertData.updated_at;
          _baseSnapshot    = _snapshotCollections();
        }
        _syncReady = true;
        return false;
      }
      console.error('syncFromSupabase error:', error);
      _showSyncWarnBanner();
      return false;
    }
    if (!data) {
      console.error('syncFromSupabase: data is null without error');
      _showSyncWarnBanner();
      return false;
    }
    if (Array.isArray(data.tasks))    { tasks    = data.tasks;      localStorage.setItem('hd_tasks',       JSON.stringify(tasks)); }
    if (data.task_notes)              { taskNotes = data.task_notes; localStorage.setItem('hd_task_notes',  JSON.stringify(taskNotes)); }
    if (Array.isArray(data.shopping)) { shopping  = data.shopping;  localStorage.setItem('hd_shopping',    JSON.stringify(shopping)); }
    if (Array.isArray(data.subs))     { subs      = data.subs;      localStorage.setItem('hd_subs',        JSON.stringify(subs)); }
    if (Array.isArray(data.txs))      { txs       = data.txs;       localStorage.setItem('hd_tx',          JSON.stringify(txs)); }
    if (Array.isArray(data.trips))    { trips     = data.trips;     localStorage.setItem('hd_trips',       JSON.stringify(trips)); }
    if (Array.isArray(data.meals))    { meals     = data.meals;     localStorage.setItem('food_meals',     JSON.stringify(meals)); }
    if (data.budgets && typeof data.budgets==='object' && !Array.isArray(data.budgets)) { budgets = data.budgets; localStorage.setItem('ledger_budgets', JSON.stringify(budgets)); }
    if (Array.isArray(data.accounts)) { accounts = data.accounts; localStorage.setItem('ledger_accounts', JSON.stringify(accounts)); }
    if (data.tx_rules && typeof data.tx_rules==='object' && !Array.isArray(data.tx_rules)) { txRules = data.tx_rules; localStorage.setItem('ledger_tx_rules', JSON.stringify(txRules)); }
    if (Array.isArray(data.reflections)) { reflections = data.reflections; localStorage.setItem('reflections', JSON.stringify(reflections)); }
    if (data.seed_flags) Object.entries(data.seed_flags).forEach(([k,v]) => localStorage.setItem(k,v));
    _serverUpdatedAt = data.updated_at || null;
    _baseSnapshot    = _snapshotCollections();
    _syncReady = true;
    return true;
  } catch (e) {
    console.error('syncFromSupabase exception:', e);
    _showSyncWarnBanner();
    return false;
  }
}

let _saveDebounceTimer = null;
function saveToSupabase() {
  if (!_syncReady) { _showSyncWarnBanner(); return; }
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer = setTimeout(() => {
    sb.auth.getUser().then(({ data: { user } }) => { if (user) _enqueuePush(user.id); });
  }, 400);
}

async function signIn() {
  document.getElementById('loginBtn').textContent = 'ログイン中...';
  document.getElementById('loginError').textContent = '';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('loginError').textContent = 'ログインに失敗しました';
    document.getElementById('loginBtn').textContent = 'ログイン';
    return;
  }
  location.reload();
}

async function signOut() {
  await sb.auth.signOut();
  location.reload();
}

async function updatePassword() {
  const password = document.getElementById('resetPassword').value;
  if (!password || password.length < 6) {
    document.getElementById('resetError').textContent = '6文字以上で入力してください';
    return;
  }
  document.getElementById('resetBtn').textContent = '更新中...';
  const accessToken = new URLSearchParams(location.hash.slice(1)).get('access_token');
  const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + accessToken
    },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    document.getElementById('resetError').textContent = '更新に失敗しました';
    document.getElementById('resetBtn').textContent = 'パスワードを更新';
    return;
  }
  await sb.auth.signOut();
  location.href = location.href.split('#')[0];
}

function applyTaskNotes(){tasks.forEach(t=>{if(taskNotes[t.id]!==undefined)t.note=taskNotes[t.id];});}
function setTaskNote(id,note){
  const t=tasks.find(t=>t.id===id);if(!t)return;
  taskNotes[id]=note;
  t.note=note;
  saveTaskNotes();
}





function deriveInitialTags(t) {
  const tags = new Set();
  const title = t.title || '';
  if (t.category === '手続き') tags.add('手続き');
  if (t.category === '家事') tags.add('家事');
  if (t.category === '修理') tags.add('修理');
  if (t.category === '買い物') tags.add('買い物');
  if (/準備/.test(title)) tags.add('準備');
  if (/連絡|発注/.test(title)) tags.add('連絡');
  if (/見直し/.test(title)) tags.add('見直し');
  if (/検討/.test(title)) tags.add('検討');
  if (/確定申告|経理|税|決算/.test(title)) tags.add('経理');
  if (/学習|勉強|スキル/.test(title)) tags.add('学習');
  if (/旅行|レジャー|プラン/.test(title)) tags.add('レジャー');
  if (t.priority === 'high') tags.add('重要');
  return [...tags];
}
