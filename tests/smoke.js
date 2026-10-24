// 画面の回帰チェック用スクリプト（ブラウザで実行する）。
// 使い方: ローカルサーバーで dashboard.html を開き、コンソール等で
//   eval(await (await fetch('tests/smoke.js')).text()); await runSmoke()
// を実行すると、固定のテストデータで各タブを描画し、タブごとの表示テキストと
// エラーの一覧を返す。分割・リファクタリングの前後で結果を比べる。
// 本番データには書き込まない（saveToSupabase を空にし、ログイン画面を隠すだけ）。
async function runSmoke() {
  const errors = [];
  const onErr = e => errors.push(String(e.message || e));
  window.addEventListener('error', onErr);
  window.saveToSupabase = () => {};
  const lo = document.getElementById('loginOverlay'); if (lo) lo.style.display = 'none';

  const D = (id, name, type, extra = {}) => Object.assign({ id, name, type, place: '', recipeUrl: '', note: '', photos: [], tags: [] }, extra);
  tasks = [
    { id: 1, title: '住所変更', category: '手続き', priority: 'high', due: '2026-10-10', done: false },
    { id: 't2', title: 'ホテル確認', category: 'その他', priority: 'medium', due: '2026-10-25', done: false, tags: ['旅行'] },
    { id: 't3', title: '電球', category: '家事', priority: 'low', due: '', done: true },
  ];
  accounts = [
    { id: 'b1', name: '三菱UFJ', kind: 'bank', openingBalance: 100000, openingDate: '2026-09-01', archived: false, order: 0 },
    { id: 'c1', name: '楽天カード', kind: 'card', openingBalance: 0, openingDate: '2026-09-01', archived: false, order: 1 },
  ];
  txs = [
    { id: 'x1', type: 'income', title: '給与', amount: 300000, category: '給与', date: '2026-10-07', accountId: 'b1' },
    { id: 'x2', type: 'expense', title: 'スーパー', amount: 4280, category: '食費', date: '2026-10-11', accountId: 'c1', note: 'メモ' },
    { id: 'x3', type: 'transfer', title: '振替', amount: 20000, date: '2026-10-12', fromAccountId: 'b1', toAccountId: 'c1' },
    { id: 'x4', type: 'expense', title: '家賃', amount: 73000, category: '家賃', date: '2026-09-01', accountId: 'b1' },
  ];
  subs = [{ id: 's1', name: 'Netflix', category: '動画', price: 2290, cycle: 'monthly', active: true, payDay: 27, autoFrom: '2026-10' }];
  budgets = { base: { total: 200000, cats: { 食費: 40000 } }, months: {} };
  txRules = { rules: [{ id: 'r1', keyword: 'lawson', type: 'expense', category: '食費' }] };
  if (typeof _initCategories === 'function') _initCategories();
  shopping = [{ id: 'w1', name: '椅子', category: '家具・インテリア', price: 10000, status: '検討中', note: '', candidates: [] }];
  trips = [{ id: 'tr1', dest: '京都', status: '予約済み', startDate: '2026-10-28', endDate: '2026-10-30', budget: 80000, note: '' }];
  meals = [
    { id: 'm1', date: '2026-10-20', memo: 'メモ', v: 2, sittings: [{ id: 's1', kind: 'dinner', dishes: [D('d1', 'さば', 'home', { tags: ['魚料理'] }), D('d2', 'サラダ', 'home')] }] },
    { id: 'm2', date: '2026-10-18', memo: '', v: 2, sittings: [{ id: 's2', kind: 'lunch', dishes: [D('d3', '刺身', 'out', { place: '居酒屋A' })] }] },
  ];
  reflections = [{ id: 'n1', date: '2026-10-20', body: '気づき', tags: ['仕事'], createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' }];

  const out = {};
  const pages = ['home', 'todo', 'finance', 'shopping', 'travel', 'food', 'notes'];
  for (const p of pages) {
    try { nav(p); } catch (e) { errors.push(p + ': ' + e.message); }
    await new Promise(r => setTimeout(r, 50));
    const el = document.getElementById('page-' + p);
    out[p] = el ? el.innerText.replace(/\s+/g, ' ').trim() : '(missing)';
  }
  // Ledger のサブタブも確認
  for (const t of ['txlist', 'accounts', 'subs', 'budget', 'review', 'import', 'settings']) {
    try {
      const b = document.querySelector(`#ldrSubtabs .ui-seg-btn[onclick*="'${t}'"]`);
      nav('finance'); ldrTab(t, b);
      await new Promise(r => setTimeout(r, 30));
      out['finance:' + t] = document.getElementById('page-finance').innerText.replace(/\s+/g, ' ').trim();
    } catch (e) { errors.push('finance:' + t + ': ' + e.message); }
  }
  window.removeEventListener('error', onErr);
  return { errors, out };
}

// 見た目の比較用: 各タブの全要素の計算済みスタイルの主要な値をまとめた指紋を返す
async function styleFingerprint() {
  await runSmoke();
  const props = ['display','position','width','height','color','backgroundColor','fontSize','fontWeight','paddingTop','paddingLeft','marginTop','marginLeft','borderTopWidth','gridTemplateColumns','flexDirection'];
  const out = {};
  for (const p of ['home','todo','finance','shopping','travel','food','notes']) {
    nav(p); await new Promise(r => setTimeout(r, 40));
    const els = [document.querySelector('.masthead'), ...document.querySelectorAll('#page-' + p + ' *')].filter(Boolean);
    let h = 0, n = 0;
    for (const el of els) {
      const cs = getComputedStyle(el);
      const s = props.map(k => cs[k]).join('|');
      for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
      n++;
    }
    out[p] = n + ':' + h;
  }
  return out;
}
