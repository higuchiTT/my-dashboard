// テスト用: dashboard.html と同じ順番で js/ を読み込み、関数を取り出す。
// 画面（document 等）は何を触っても壊れないダミーに置き換える。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function dummy() {
  const fn = function () { return dummy(); };
  return new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : dummy()),
    apply: () => dummy(),
    construct: () => dummy(),
  });
}

function loadApp() {
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
  const ctx = {
    console, localStorage, setTimeout, clearTimeout, crypto: require('crypto').webcrypto,
    TextDecoder, Intl, Date, Math, JSON,
    document: dummy(), supabase: dummy(), navigator: dummy(), location: dummy(),
    addEventListener() {}, requestAnimationFrame: f => setTimeout(f, 0),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
  const files = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
  // 全ファイルを1つのスクリプトとして評価する（ブラウザでの classic script と同じく、変数を共有させるため）
  const code = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n')
    + '\n;globalThis.__app = { mergeCollections, mergeArrayById, normTxName, txCoreName, _parseCSV, _parseDateStr, _parseAmtStr, migrateMealV2, _detectImportFormat, getEffBudget, accountBalance, _catAutoId, esc, jsq };'
    + '\n;globalThis.__setState = (s) => { if (s.txs) txs = s.txs; if (s.accounts) accounts = s.accounts; if (s.budgets) budgets = s.budgets; };';
  vm.runInContext(code, ctx, { filename: 'app.js' });
  return ctx;
}
module.exports = { loadApp };
