// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  // リカバリートークンをURLハッシュから先に検出
  const hashParams = new URLSearchParams(location.hash.slice(1));
  if (hashParams.get('type') === 'recovery') {
    const accessToken  = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || '';
    if (accessToken) await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('resetForm').style.display = 'flex';
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    document.getElementById('loginOverlay').style.display = 'flex';
    return;
  }
  document.getElementById('logoutBtn').style.display = 'inline-block';
  document.getElementById('backupBtn').style.display = 'inline-block';
  // Apply v1→v2 migration from localStorage before sync
  const _preSyncMeals = JSON.stringify(meals);
  meals = meals.map(migrateMealV2);
  const _mealsChanged = JSON.stringify(meals) !== _preSyncMeals;
  if (_mealsChanged) {
    if (!localStorage.getItem('food_meals_v1_backup')) {
      localStorage.setItem('food_meals_v1_backup', _preSyncMeals);
    }
    localStorage.setItem('food_meals', JSON.stringify(meals));
  }
  const synced = await syncFromSupabase(session.user.id);
  // Initialize category master after sync (sync may have loaded server categories)
  const _catsBefore = JSON.stringify(txRules.categories||[]);
  _initCategories();
  // Save only if _syncReady and categories changed (newly generated or supplemented)
  if(_syncReady && JSON.stringify(txRules.categories||[]) !== _catsBefore) { saveTxRules(); }
  if (synced) autoPostSubs(); // only after server data has been loaded
  // After sync, re-apply migration in case server had v1 data; save if changed
  const _postSyncMeals = JSON.stringify(meals);
  meals = meals.map(migrateMealV2);
  if (JSON.stringify(meals) !== _postSyncMeals) {
    if (!localStorage.getItem('food_meals_v1_backup')) {
      localStorage.setItem('food_meals_v1_backup', _postSyncMeals);
    }
    saveMeals(); // _syncReady is true at this point
  }
  loadTaskNotes();
  migrateTaskNotes();
  applyTaskNotes();
  const h = new Date().getHours();
  document.getElementById('topDate').textContent = fmtFull(new Date());
  rerenderAll();
  restoreLdrGuide(); restoreLdrSubtab();
});

function rerenderAll() {
  renderHome(); renderTodayView(); renderShopping(); renderTravel(); renderFood(); renderNotes(); updateBadge();
  restoreLdrSubtab();
}

async function _checkRemoteChanges() {
  if (_pushInFlight || !_syncReady || !_serverUpdatedAt) return;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: chk, error: chkErr } = await sb.from('user_data')
      .select('updated_at').eq('user_id', user.id).single();
    if (chkErr || !chk || chk.updated_at === _serverUpdatedAt) return;
    const { data: serverRow, error: fetchErr } = await sb.from('user_data')
      .select('*').eq('user_id', user.id).single();
    if (fetchErr || !serverRow) return;
    const merged = mergeCollections(_baseSnapshot || {}, _localCollections(), serverRow);
    _applyCollections(merged);
    rerenderAll();
    _baseSnapshot    = _extractSnapshot(serverRow);
    _serverUpdatedAt = serverRow.updated_at;
    _showSyncInfoToast('別の端末の変更を読み込みました');
    // Push if merged differs from server (local had unsent changes)
    if (JSON.stringify(merged) !== JSON.stringify(_extractSnapshot(serverRow))) {
      _enqueuePush(user.id);
    }
  } catch (e) {
    // silent — visibility change check is best-effort
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') _checkRemoteChanges();
});
window.addEventListener('focus', _checkRemoteChanges);

document.addEventListener('click', () => {
  closeTvTagPop();
  closeLdrAddMenu();
  closeLdrTxMenus();
  closeAccMenus();
  _closeSubMenus();
  document.querySelectorAll('.notes-card-menu.open').forEach(m=>m.classList.remove('open'));
});
