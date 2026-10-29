// 実行: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load.js');
const ctx = loadApp();
const A = ctx.__app;
const plain = v => JSON.parse(JSON.stringify(v));

const T = (id, title) => ({ id, title, done: false });
const fill = o => Object.assign({ tasks: [], shopping: [], subs: [], txs: [], trips: [], meals: [], accounts: [], reflections: [], task_notes: {}, budgets: { base: { total: null, cats: {} }, months: {} }, tx_rules: { rules: [], categories: [] }, seed_flags: {} }, o);

test('mergeCollections: 両方の端末の追加・編集・削除を残す', () => {
  const base = fill({ tasks: [T(1, 'A'), T('b', 'B'), T('c', 'C')] });
  const local = fill({ tasks: [T(1, 'A-local'), T('c', 'C'), T('d', 'D')] });        // A 編集, B 削除, D 追加
  const server = fill({ tasks: [T('1', 'A'), T('b', 'B'), T('c', 'C-srv'), T('e', 'E')] }); // C 編集, E 追加
  const m = plain(A.mergeCollections(base, local, server));
  assert.deepEqual(m.tasks.map(t => String(t.id) + ':' + t.title).sort(), ['1:A-local', 'c:C-srv', 'd:D', 'e:E']);
});

test('mergeCollections: 予算はキー単位で合わせる', () => {
  const base = fill({ budgets: { base: { total: 100, cats: { 食費: 10 } }, months: {} } });
  const local = fill({ budgets: { base: { total: 100, cats: { 食費: 10, 娯楽: 5 } }, months: {} } });
  const server = fill({ budgets: { base: { total: 200, cats: { 食費: 10 } }, months: { '2026-10': { cats: { 食費: 20 } } } } });
  const m = plain(A.mergeCollections(base, local, server));
  assert.deepEqual(m.budgets, { base: { total: 200, cats: { 食費: 10, 娯楽: 5 } }, months: { '2026-10': { cats: { 食費: 20 } } } });
});

test('mergeCollections: 引数を書き換えない', () => {
  const base = fill({ tasks: [T(1, 'A')] }), local = fill({ tasks: [] }), server = fill({ tasks: [T(1, 'A'), T(2, 'B')] });
  const snap = JSON.stringify([base, local, server]);
  A.mergeCollections(base, local, server);
  assert.equal(JSON.stringify([base, local, server]), snap);
});

test('自動で作るカテゴリの ID は名前から決まる（端末間で重複しない）', () => {
  assert.equal(A._catAutoId('expense', '食費'), 'cat:expense:食費');
});

test('normTxName: 全角・承認番号・半角カナの長音を整える', () => {
  assert.equal(A.normTxName('１４７０６１　ＧＹＯＵＺＡＮＯ'), 'GYOUZANO');
  assert.equal(A.normTxName('ﾊﾞﾛ-(ｽ-ﾊﾟ-)'), 'バロー(スーパー)');
  assert.equal(A.normTxName('ABC-123'), 'ABC-123');
  assert.equal(A.normTxName('LAWSON 駅前', true), 'lawson 駅前');
});

test('CSV: 引用符・カンマ・改行を正しく読む', () => {
  const rows = plain(A._parseCSV('"a","b,c","d""e"\r\n"1","2\n3","4"\r\n'));
  assert.deepEqual(rows.filter(r => r.length > 1), [['a', 'b,c', 'd"e'], ['1', '2\n3', '4']]);
});

test('CSV: 日付と金額を読み取る', () => {
  assert.equal(A._parseDateStr('2026/9/18'), '2026-09-18');
  assert.equal(A._parseDateStr('20260918'), '2026-09-18');
  assert.equal(A._parseAmtStr('2,871'), 2871);
  assert.equal(A._parseAmtStr('¥1,000円'), 1000);
});

test('CSV: 三菱UFJ と楽天カードの見出しを判定する', () => {
  const mufg = ['日付', '摘要', '摘要内容', '支払い金額', '預かり金額', '差引残高', 'メモ', '未資金化区分', '入払区分'];
  const rak = ['利用日', '利用店名・商品名', '利用者', '支払方法', '利用金額', '手数料/利息', '支払総額'];
  assert.match(String(plain(A._detectImportFormat(mufg)).name || A._detectImportFormat(mufg)), /mufg|UFJ/i);
  assert.match(String(plain(A._detectImportFormat(rak)).name || A._detectImportFormat(rak)), /rakuten|楽天/i);
});

test('migrateMealV2: 写真を料理に割り当て、2回目は変えない', () => {
  const v1 = { id: 'a', date: '2026-10-08', memo: 'm', dishes: [{ id: 'd1', name: 'A', type: 'out' }, { id: 'd2', name: 'B', type: 'out' }], photos: [{ id: 'p1', path: '1' }, { id: 'p2', path: '2' }, { id: 'p3', path: '3' }] };
  const v2 = plain(A.migrateMealV2(v1));
  assert.equal(v2.v, 2);
  assert.deepEqual(v2.sittings[0].dishes.map(d => d.photos.map(p => p.id)), [['p1'], ['p2', 'p3']]);
  assert.equal(v2.sittings[0].kind, 'dinner');
  assert.deepEqual(plain(A.migrateMealV2(v2)), v2);
});

test('accountBalance: 振替と残高調整を含めて計算する', () => {
  const bank = { id: 'b1', openingBalance: 100000, openingDate: '2026-10-01' };
  const card = { id: 'c1', openingBalance: 0, openingDate: '2026-10-01' };
  ctx.__setState({ txs: [
    { type: 'income', amount: 300000, accountId: 'b1', date: '2026-10-07' },
    { type: 'expense', amount: 3480, accountId: 'c1', date: '2026-10-08' },
    { type: 'transfer', amount: 3480, fromAccountId: 'b1', toAccountId: 'c1', date: '2026-10-27' },
    { type: 'adjust', amount: -1000, accountId: 'b1', date: '2026-10-28' },
    { type: 'expense', amount: 999, accountId: 'b1', date: '2026-09-30' }, // 開始日より前は数えない
  ] });
  assert.equal(A.accountBalance(bank), 100000 + 300000 - 3480 - 1000);
  assert.equal(A.accountBalance(card), 0);
});

test('getEffBudget: 月ごとの上書きを優先する', () => {
  ctx.__setState({ budgets: { base: { total: 100, cats: { 食費: 10, 娯楽: 5 } }, months: { '2026-12': { cats: { 娯楽: 50 } } } } });
  assert.deepEqual(plain(A.getEffBudget(2026, 11)), { total: 100, cats: { 食費: 10, 娯楽: 50 } });
  assert.deepEqual(plain(A.getEffBudget(2026, 10)), { total: 100, cats: { 食費: 10, 娯楽: 5 } });
});

test('esc: HTML の特殊文字をエスケープする', () => {
  assert.equal(A.esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('txCoreName: 末尾の店舗名サフィックスを除く', () => {
  assert.equal(A.txCoreName('lawson 駅前店'), 'lawson');
  assert.equal(A.txCoreName('セブンイレブン 渋谷2丁目店'), 'セブンイレブン');
  assert.equal(A.txCoreName('イオン 本店'), 'イオン');
});

test('txCoreName: 数字・店番号トークンを除く', () => {
  assert.equal(A.txCoreName('スーパー #123'), 'スーパー');
  assert.equal(A.txCoreName('ファミマ 456'), 'ファミマ');
});

test('txCoreName: 短くなりすぎる場合は元の値（normTxName 結果）を返す', () => {
  // 'a' は1文字 < 2 → 元の値 'a 店' (normTxName) を返す
  assert.equal(A.txCoreName('a 店'), 'a 店');
  // 単語が1つのみで除去対象なし → そのまま返す
  assert.equal(A.txCoreName('マクドナルド'), 'マクドナルド');
});

test('jsq: 引用符やバックスラッシュを含むタグでも onclick の引数として元の文字列に戻る', () => {
  const unesc = s => s.replace(/&quot;|&#39;|&lt;|&gt;|&amp;/g, m => ({ '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' }[m]));
  for (const tag of ["母's", 'a"b', 'c\d', '<b>&']) {
    const attr = A.jsq(tag);
    assert.ok(!/["'<>]/.test(attr));         // 属性の中に生の記号が残らない
    assert.equal(JSON.parse(unesc(attr)), tag); // ブラウザが属性を読んだ後の JS 文字列が元に戻る
  }
});
