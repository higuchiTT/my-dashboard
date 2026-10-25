// ── BACKUP ──
function openBackupModal() {
  document.getElementById('backupModal').classList.add('open');
  document.getElementById('restorePreview').style.display = 'none';
  document.getElementById('restoreConfirmBtn').style.display = 'none';
  document.getElementById('restoreFileInput').value = '';
  _restoreData = null;
  document.getElementById('photoCleanResult').style.display = 'none';
  document.getElementById('photoCleanResult').textContent = '';
  document.getElementById('photoCleanDeleteBtn').style.display = 'none';
  document.getElementById('photoCleanCheckBtn').disabled = !_syncReady;
  _orphanPhotos = [];
}

function closeBackupModal() {
  document.getElementById('backupModal').classList.remove('open');
}

function downloadBackup() {
  const backup = {
    app: 'my-dashboard', version: 1, exportedAt: new Date().toISOString(),
    data: { tasks, task_notes: taskNotes, shopping, subs, txs, trips, meals,
      budgets, accounts, tx_rules: txRules, reflections, seed_flags: _collectSeedFlags() }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  a.download = `dashboard-backup-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let _restoreData = null;

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed.app || !parsed.data) { uiAlert('このファイルはバックアップとして認識できません。'); return; }
      _restoreData = parsed;
      const d = parsed.data;
      const exportedAt = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('ja-JP') : '不明';
      const preview = document.getElementById('restorePreview');
      preview.innerHTML =
        `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.08em;color:var(--ink3);margin-bottom:8px;">バックアップの日時: ${esc(exportedAt)}</div>` +
        `<div style="font-size:13px;line-height:1.9;">` +
        `タスク: <b>${Array.isArray(d.tasks)?d.tasks.length:0}</b> 件　` +
        `取引: <b>${Array.isArray(d.txs)?d.txs.length:0}</b> 件　` +
        `食事: <b>${Array.isArray(d.meals)?d.meals.length:0}</b> 日分<br>` +
        `所感: <b>${Array.isArray(d.reflections)?d.reflections.length:0}</b> 件　` +
        `ウィッシュリスト: <b>${Array.isArray(d.shopping)?d.shopping.length:0}</b> 件</div>`;
      preview.style.display = 'block';
      document.getElementById('restoreConfirmBtn').style.display = 'inline-block';
    } catch (err) { uiAlert('ファイルの読み込みに失敗しました。'); }
  };
  reader.readAsText(file);
}

async function doRestore() {
  if (!_restoreData || !_syncReady) return;
  if (!(await uiConfirm('今のデータはすべてこのバックアップの内容に置き換わります。念のため、今のデータのバックアップを先にダウンロードします。',{title:'復元の確認',okLabel:'復元する',danger:true}))) return;
  downloadBackup(); // save current data first
  const d = _restoreData.data;
  _applyCollections({
    tasks:       Array.isArray(d.tasks)       ? d.tasks       : tasks,
    task_notes:  d.task_notes  || {},
    shopping:    Array.isArray(d.shopping)    ? d.shopping    : shopping,
    subs:        Array.isArray(d.subs)        ? d.subs        : subs,
    txs:         Array.isArray(d.txs)         ? d.txs         : txs,
    trips:       Array.isArray(d.trips)       ? d.trips       : trips,
    meals:       Array.isArray(d.meals)       ? d.meals       : meals,
    budgets:     (d.budgets && typeof d.budgets==='object') ? d.budgets : budgets,
    accounts:    Array.isArray(d.accounts)    ? d.accounts    : accounts,
    tx_rules:    (d.tx_rules && typeof d.tx_rules==='object') ? d.tx_rules : txRules,
    reflections: Array.isArray(d.reflections) ? d.reflections : reflections,
    seed_flags:  d.seed_flags || {}
  });
  rerenderAll();
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const seedFlags = _collectSeedFlags();
    const { data: upsertData, error: upsertErr } = await sb.from('user_data').upsert({
      user_id: user.id, tasks, task_notes: taskNotes,
      shopping, subs, txs, trips, meals, budgets, accounts, tx_rules: txRules, reflections,
      seed_flags: seedFlags, updated_at: new Date().toISOString()
    }).select('updated_at').single();
    if (upsertErr) {
      _showSaveErrToast(`復元の保存に失敗しました（${upsertErr.message}）`);
    } else {
      if (upsertData) { _serverUpdatedAt = upsertData.updated_at; _baseSnapshot = _snapshotCollections(); }
      _showSyncInfoToast('復元しました');
    }
  }
  closeBackupModal();
  _restoreData = null;
}

// ── PHOTO CLEANUP ──
let _orphanPhotos = [];

async function checkOrphanPhotos() {
  if (!_syncReady) return;
  const checkBtn = document.getElementById('photoCleanCheckBtn');
  const resultDiv = document.getElementById('photoCleanResult');
  const deleteBtn = document.getElementById('photoCleanDeleteBtn');
  checkBtn.disabled = true;
  checkBtn.textContent = '確認中…';
  resultDiv.style.display = 'none';
  resultDiv.textContent = '';
  deleteBtn.style.display = 'none';
  _orphanPhotos = [];
  try {
    // ほかの端末で追加された写真を「未使用」と誤判定しないよう、先にサーバーの最新を取り込む
    try { await _checkRemoteChanges(); } catch (e) {}
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { resultDiv.textContent = 'ログインが必要です。'; resultDiv.style.display = ''; return; }
    const userId = user.id;
    const { data: folders, error: fErr } = await sb.storage.from('meal-photos').list(userId, { limit: 1000 });
    if (fErr) { _showSaveErrToast('写真一覧の取得に失敗しました'); return; }
    const allFiles = [];
    for (const folder of (folders || [])) {
      if (folder.name === 'trips') continue; // trips photos are in subfolders — managed separately, never cleaned here
      const { data: files, error: fErr2 } = await sb.storage.from('meal-photos').list(`${userId}/${folder.name}`, { limit: 1000 });
      if (!fErr2 && files) {
        files.forEach(f => allFiles.push({ path: `${userId}/${folder.name}/${f.name}`, created_at: f.created_at, size: f.metadata && f.metadata.size != null ? f.metadata.size : null }));
      }
    }
    const refPaths = new Set();
    (meals || []).forEach(meal => {
      ((meal.sittings) || []).forEach(sitting => {
        (sitting.dishes || []).forEach(dish => {
          (dish.photos || []).forEach(p => { if (p.path) refPaths.add(p.path); });
        });
      });
    });
    if (_foodModalState) {
      ((_foodModalState.sittings) || []).forEach(sitting => {
        (sitting.dishes || []).forEach(dish => {
          (dish.photos || []).forEach(p => { if (p.path) refPaths.add(p.path); });
        });
      });
    }
    // Add trip photo paths so they are never treated as orphans
    (trips || []).forEach(t => {
      (t.photos || []).forEach(p => { if (p.path) refPaths.add(p.path); });
      if (t.coverPhoto && t.coverPhoto.path) refPaths.add(t.coverPhoto.path);
    });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    _orphanPhotos = allFiles.filter(f => {
      if (refPaths.has(f.path)) return false;
      if (!f.created_at) return false;
      return new Date(f.created_at).getTime() < cutoff;
    });
    if (_orphanPhotos.length === 0) {
      resultDiv.textContent = '使われていない写真はありません。';
    } else {
      const totalBytes = _orphanPhotos.reduce((s, f) => s + (f.size != null ? f.size : 0), 0);
      const mb = (totalBytes / 1024 / 1024).toFixed(1);
      resultDiv.textContent = `使われていない写真が ${_orphanPhotos.length} 件あります（約 ${mb} MB）`;
      deleteBtn.textContent = `${_orphanPhotos.length} 件を削除する`;
      deleteBtn.style.display = 'inline-block';
    }
    resultDiv.style.display = '';
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = '確認する';
  }
}

async function deleteOrphanPhotos() {
  if (!_syncReady || !_orphanPhotos.length) return;
  if (!(await uiConfirm(`${_orphanPhotos.length} 件の写真を削除します。この操作は元に戻せません。`, { title: '写真の削除', okLabel: '削除する', danger: true }))) return;
  const deleteBtn = document.getElementById('photoCleanDeleteBtn');
  const resultDiv = document.getElementById('photoCleanResult');
  deleteBtn.disabled = true;
  deleteBtn.textContent = '削除中…';
  const paths = _orphanPhotos.map(f => f.path);
  let deleted = 0;
  try {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await sb.storage.from('meal-photos').remove(chunk);
      if (error) { _showSaveErrToast('削除に失敗しました: ' + error.message); break; }
      deleted += chunk.length;
    }
    resultDiv.textContent = `${deleted} 件を削除しました。`;
    _orphanPhotos = [];
    deleteBtn.style.display = 'none';
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = '削除する';
  }
}
