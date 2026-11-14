// 実行: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load.js');
const ctx = loadApp();
const A = ctx.__app;
const plain = v => JSON.parse(JSON.stringify(v));

const T = (id, title) => ({ id, title, done: false });
const fill = o => Object.assign({ tasks: [], shopping: [], subs: [], txs: [], trips: [], meals: [], accounts: [], reflections: [], task_notes: {}, budgets: { base: { total: null, cats: {} }, months: {} }, tx_rules: { rules: [], categories: [] }, seed_flags: {} }, o);

test('todayBucket: 期限切れ / 今日が期限 / 今日やる / 昨日の「今日やる」は失効 / 完了は除外', () => {
  const today = '2026-11-14';
  const b = o => A.todayBucket(Object.assign({ id: 1, title: 'x', done: false }, o), today);
  assert.equal(b({ due: '2026-11-13' }), 'overdue');
  assert.equal(b({ due: '2026-11-14' }), 'due');
  assert.equal(b({ due: '2026-11-20', todayDate: today }), 'picked');
  assert.equal(b({ todayDate: today }), 'picked');
  assert.equal(b({ due: '2026-11-20', todayDate: '2026-11-13' }), null);
  assert.equal(b({ due: '' }), null);
  assert.equal(b({ due: '2026-11-13', done: true }), null);
  assert.equal(b({ todayDate: today, done: true }), null);
  assert.equal(b({ due: '2026-11-14', todayDate: today }), 'due');
});

test('classifyTask: 今日以前=today / 今週 / 後で / 未定 / 完了', () => {
  const now = new Date('2026-11-14T00:00:00'), sun = new Date('2026-11-15T00:00:00');
  assert.equal(A.classifyTask({ due: '2026-11-10' }, now, sun), 'today');
  assert.equal(A.classifyTask({ due: '2026-11-15' }, now, sun), 'thisweek');
  assert.equal(A.classifyTask({ due: '2026-11-30' }, now, sun), 'later');
  assert.equal(A.classifyTask({ due: '' }, now, sun), 'undef');
  assert.equal(A.classifyTask({ due: '2026-11-10', done: true }, now, sun), 'done');
});

const W = (id, o) => Object.assign({ id, name: 'item' + id, category: 'A', price: null, status: '検討中', candidates: [], note: '', priority: 'mid', targetMonth: null }, o);

test('wlMonthStrip: 今月から6か月＋未定。購入済みは数えない。合計と件数', () => {
  const now = new Date('2026-11-14T00:00:00');
  const items = [
    W(1, { price: 1000, targetMonth: '2026-11' }),
    W(2, { price: 2500, targetMonth: '2026-11' }),
    W(3, { price: 9999, targetMonth: '2026-11', status: '購入済み' }),
    W(4, { price: 300, targetMonth: '2027-02' }),
    W(5, { price: 700 }),
    W(6, { targetMonth: '2027-06' }),   // 6か月より先は帯に出ない
  ];
  const s = plain(A.wlMonthStrip(items, now));
  assert.equal(s.length, 7);
  assert.deepEqual(s.map(m => m.ym), ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', null]);
  assert.deepEqual(s[0], { ym: '2026-11', label: '11月', total: 3500, count: 2 });
  assert.deepEqual(s[1], { ym: '2026-12', label: '12月', total: 0, count: 0 });
  assert.equal(s[3].label, '2027年2月');
  assert.equal(s[3].total, 300);
  assert.deepEqual(s[6], { ym: null, label: '未定', total: 700, count: 1 });
});

test('wlFilterItems: ステータス / カテゴリ / 月 / 購入済みの表示', () => {
  const items = [
    W(1, { targetMonth: '2026-11' }),
    W(2, { status: '保留中', category: 'B', targetMonth: '2026-12' }),
    W(3, { status: '購入済み', targetMonth: '2026-11' }),
    W(4, {}),
  ];
  const ids = f => plain(A.wlFilterItems(items, f).map(s => s.id));
  assert.deepEqual(ids({}), [1, 2, 4]);
  assert.deepEqual(ids({ showBought: true }), [1, 2, 3, 4]);
  assert.deepEqual(ids({ status: '保留中' }), [2]);
  assert.deepEqual(ids({ status: '検討中', showBought: true }), [1, 4]);
  assert.deepEqual(ids({ category: 'B' }), [2]);
  assert.deepEqual(ids({ month: '2026-11' }), [1]);
  assert.deepEqual(ids({ month: '2026-11', showBought: true }), [1, 3]);
  assert.deepEqual(ids({ month: 'none' }), [4]);
});

test('wlSortItems: 優先度順 / 予定月順 / 追加順（ステータスの並びは共通）', () => {
  const items = [
    W(1, { priority: 'low', targetMonth: '2026-12' }),
    W(2, { priority: 'high', status: '保留中' }),
    W(3, { priority: 'high', targetMonth: '2027-01' }),
    W(4, { priority: 'mid', targetMonth: '2026-11' }),
    W(5, { status: '購入済み', priority: 'high' }),
  ];
  const ids = m => plain(A.wlSortItems(items, m).map(s => s.id));
  assert.deepEqual(ids('priority'), [3, 4, 1, 2, 5]);
  assert.deepEqual(ids('month'), [4, 1, 3, 2, 5]);
  assert.deepEqual(ids('order'), [1, 3, 4, 2, 5]);
  assert.deepEqual(items.map(s => s.id), [1, 2, 3, 4, 5]); // 元の配列は変えない
});

test('wlThreeMonthTotal: 今月から3か月の予算合計（購入済み・範囲外は除く）', () => {
  const now = new Date('2026-11-14T00:00:00');
  const items = [
    W(1, { price: 100, targetMonth: '2026-11' }),
    W(2, { price: 200, targetMonth: '2027-01' }),
    W(3, { price: 400, targetMonth: '2027-02' }),
    W(4, { price: 800, targetMonth: '2026-12', status: '購入済み' }),
    W(5, { targetMonth: '2026-12' }),
  ];
  assert.equal(A.wlThreeMonthTotal(items, now), 300);
});

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

test('qxKeypad: 数字・00・⌫、先頭の 0 と桁あふれを防ぐ', () => {
  assert.equal(A.qxKeypad('', '0'), '');
  assert.equal(A.qxKeypad('', '00'), '');
  assert.equal(A.qxKeypad('', '5'), '5');
  assert.equal(A.qxKeypad('12', '00'), '1200');
  assert.equal(A.qxKeypad('1280', 'back'), '128');
  assert.equal(A.qxKeypad('', 'back'), '');
  assert.equal(A.qxKeypad('12345678', '9'), '12345678');
  assert.equal(A.qxKeypad('1234567', '00'), '1234567');
  assert.equal(A.qxKeypad('12', 'x'), '12');
});

test('qxTopCategories: 直近60日の件数順、足りなければ設定順で補う', () => {
  const cats = ['食費', '交通費', '娯楽', '日用品', '医療', '衣服', 'その他'].map(name => ({ name }));
  const now = new Date(2026, 10, 13);
  const e = (category, date) => ({ type: 'expense', category, date });
  const list = [
    e('娯楽', '2026-11-10'), e('娯楽', '2026-11-01'), e('娯楽', '2026-10-20'),
    e('交通費', '2026-11-05'),
    e('食費', '2026-08-01'),                       // 60日より前 → 数えない
    { type: 'income', category: '食費', date: '2026-11-10' }, // 支出以外 → 数えない
  ];
  assert.deepEqual(plain(A.qxTopCategories(list, cats, now)), ['娯楽', '交通費', '食費', '日用品', '医療', '衣服']);
  assert.deepEqual(plain(A.qxTopCategories([], cats, now)), ['食費', '交通費', '娯楽', '日用品', '医療', '衣服']);
});

test('suggestTxCategory: ルール → 過去の取引 → 類似店舗の順で提案', () => {
  const list = [
    { type: 'expense', title: 'ローソン 駅前店', category: '食費', date: '2026-11-01', accountId: 'a1' },
    { type: 'expense', title: 'ローソン 駅前店', category: '日用品', date: '2026-11-09', accountId: 'a2' },
  ];
  const rules = [{ keyword: 'jr', type: 'expense', category: '交通費' }];
  assert.deepEqual(plain(A.suggestTxCategory('JR東日本', list, rules)), { category: '交通費', accountId: '' });
  assert.deepEqual(plain(A.suggestTxCategory('ローソン 駅前店', list, rules)), { category: '日用品', accountId: 'a2' });
  assert.equal(A.suggestTxCategory('ローソン 渋谷店', list, rules).category, '日用品');
  assert.equal(A.suggestTxCategory('知らない店', list, rules), null);
  assert.equal(A.suggestTxCategory('', list, rules), null);
});

// ── メールから取り込み（楽天カード） ──
const RK_BODY = `<カードご利用情報>
《ショッピングご利用分》
■利用日: 2026/10/29
■利用先: 楽天ＳＰ　アルプラザアプリ
■利用者: 本人
■支払方法: 1回
■利用金額: 952 円
■支払月: 2026/12

■利用日: 2026/11/02
■利用先: ﾊﾞﾛ-(ｽ-ﾊﾟ-)
■利用者: 家族
■支払方法: 1回
■利用金額: 1,497 円
■支払月: 2026/12

■ご利用明細のご確認
https://example.test/
`;

test('parseRakutenUsageMail: 複数ブロック・カンマ・家族を読む', () => {
  const r = plain(A.parseRakutenUsageMail(RK_BODY));
  assert.deepEqual(r, [
    { date: '2026-10-29', store: '楽天ＳＰ　アルプラザアプリ', user: '本人', amount: 952 },
    { date: '2026-11-02', store: 'ﾊﾞﾛ-(ｽ-ﾊﾟ-)', user: '家族', amount: 1497 },
  ]);
});

test('parseRakutenUsageMail: 日付か金額がないブロックは無視、CRLF・全角コロン・全角数字も読む', () => {
  const body = '■利用日: 2026/11/03\r\n■利用先: A\r\n■利用者: 本人\r\n\r\n■利用日：2026/11/04\r\n■利用先: B\r\n■利用金額：１,２００ 円\r\n';
  assert.deepEqual(plain(A.parseRakutenUsageMail(body)), [{ date: '2026-11-04', store: 'B', user: '', amount: 1200 }]);
  assert.deepEqual(plain(A.parseRakutenUsageMail('')), []);
  assert.deepEqual(plain(A.parseRakutenUsageMail(null)), []);
});

test('mailItemKey / isRakutenUsageSubject', () => {
  assert.equal(A.mailItemKey('abc', 1), 'rkmail:abc:1');
  assert.equal(A.isRakutenUsageSubject('カード利用のお知らせ(本人・家族会員ご利用分)'), true);
  assert.equal(A.isRakutenUsageSubject('カード利用のお知らせ(速報版)'), false);
  assert.equal(A.isRakutenUsageSubject('ご請求金額のお知らせ'), false);
});

test('buildMailInbox: 処理済み・取り込み済みを除き、記録済みかもを付けて日付降順', () => {
  const mails = [{ id: 'm1', subject: 'カード利用のお知らせ(本人・家族会員ご利用分)', body: RK_BODY },
                 { id: 'm2', subject: 'カード利用のお知らせ(速報版)', body: RK_BODY }];
  const base = { handledKeys: [], txs: [], accountId: 'a1' };
  let r = plain(A.buildMailInbox(mails, base));
  assert.deepEqual(r.map(x => x.key), ['rkmail:m1:1', 'rkmail:m1:0']);   // 速報版は無視、日付降順
  assert.equal(r[0].user, '家族');
  assert.equal(r.every(x => !x.possibleDup), true);
  r = plain(A.buildMailInbox(mails, { ...base, handledKeys: ['rkmail:m1:0'] }));
  assert.deepEqual(r.map(x => x.key), ['rkmail:m1:1']);
  r = plain(A.buildMailInbox(mails, { ...base, txs: [{ type: 'expense', mailKey: 'rkmail:m1:1', accountId: 'a1', date: '2026-11-02', amount: 1497 }] }));
  assert.deepEqual(r.map(x => x.key), ['rkmail:m1:0']);
  // 手入力と同じ口座・日付・金額 → possibleDup。口座が違えば対象外
  const hand = { type: 'expense', accountId: 'a1', date: '2026-10-29', amount: 952 };
  r = plain(A.buildMailInbox(mails, { ...base, txs: [hand] }));
  assert.equal(r.find(x => x.key === 'rkmail:m1:0').possibleDup, true);
  assert.equal(r.find(x => x.key === 'rkmail:m1:1').possibleDup, false);
  r = plain(A.buildMailInbox(mails, { ...base, accountId: 'a2', txs: [hand] }));
  assert.equal(r.every(x => !x.possibleDup), true);
});

const MUFG_BODY = (amt, shop) => ` 山田　太郎 様

三菱ＵＦＪ‐ＶＩＳＡデビットをご利用いただきましてありがとうございます。

三菱ＵＦＪ‐ＶＩＳＡデビットのご利用がありましたので、ご連絡いたします。

ご利用金額（円）　 : ${amt}
ご利用先　　　　　　: ${shop}

●「ご利用金額（円）」について
プラス金額の場合はお引落し、マイナス金額の場合はご入金となります。
`;

test('parseMufgDebitMail: 通常・カンマ・マイナス（返金）・JST の日付', () => {
  assert.deepEqual(plain(A.parseMufgDebitMail(MUFG_BODY('276', 'HEIWADO'), '2026-11-10T03:00:00Z')),
    [{ date: '2026-11-10', store: 'HEIWADO', user: '', amount: 276 }]);
  assert.equal(A.parseMufgDebitMail(MUFG_BODY('12,345', 'X'), '2026-11-10T03:00:00Z')[0].amount, 12345);
  assert.deepEqual(plain(A.parseMufgDebitMail(MUFG_BODY('-500', 'X'), '2026-11-10T03:00:00Z')), []);
  assert.equal(A.parseMufgDebitMail(MUFG_BODY('276', 'X'), '2026-11-10T16:30:00Z')[0].date, '2026-11-11');
  assert.deepEqual(plain(A.parseMufgDebitMail('本文なし', '2026-11-10T03:00:00Z')), []);
});

const JCB_A = `山田　太郎 様
カード名称　：　ＫＩＰＳ－ＪＣＢ

JCBカードのご利用がありましたのでご連絡します。

【ご利用日時(日本時間)】　2026/10/26 08:34
【ご利用金額】　2,290円
【ご利用先】　ベネフイツト　ワン

▼ご留意点
`;
const JCB_B = `山田　太郎 様
　◆ご利用１
　　【ご利用日】　2026/10/31
　　【ご利用金額】　 3,190円
　　【ご利用先】　タイムズカー
　◆ご利用２
　　【ご利用日】　2026/10/31
　　【ご利用金額】　 4,510円
　　【ご利用先】　タイムズカー

　※本通知は、カードご利用時に通知していないものが対象です。
`;

test('parseJcbUsageMail: 利用時の通知（1件・カンマ）と売上到着分（複数）', () => {
  assert.deepEqual(plain(A.parseJcbUsageMail(JCB_A)), [{ date: '2026-10-26', store: 'ベネフイツト　ワン', user: '', amount: 2290 }]);
  assert.deepEqual(plain(A.parseJcbUsageMail(JCB_B)), [
    { date: '2026-10-31', store: 'タイムズカー', user: '', amount: 3190 },
    { date: '2026-10-31', store: 'タイムズカー', user: '', amount: 4510 },
  ]);
  assert.deepEqual(plain(A.parseJcbUsageMail('【ご利用日】2026/10/31\n【ご利用金額】0円\n')), []);
});

test('buildMailInbox: 楽天・UFJ・JCB 混在で、口座は種別ごと。source なしは楽天', () => {
  const mails = [
    { id: 'r1', subject: 'カード利用のお知らせ(本人・家族会員ご利用分)', body: RK_BODY },
    { id: 'u1', source: 'mufg', subject: '【三菱ＵＦＪ‐ＶＩＳＡデビット】ご利用のお知らせ', date: '2026-11-10T03:00:00Z', body: MUFG_BODY('276', 'HEIWADO') },
    { id: 'j1', source: 'jcb', subject: '（売上到着分）JCBカード/ショッピングご利用のお知らせ', date: '2026-11-01T03:00:00Z', body: JCB_B },
  ];
  const opts = { handledKeys: [], accountId: 'ra', mufgAccountId: 'ua', jcbAccountId: 'ja',
    txs: [{ type: 'expense', accountId: 'ua', date: '2026-11-10', amount: 276 },    // UFJ 口座の手入力 → UFJ だけ dup
          { type: 'expense', accountId: 'ra', date: '2026-10-31', amount: 3190 }] }; // 楽天口座の同額 → JCB は dup でない
  const r = plain(A.buildMailInbox(mails, opts));
  assert.equal(r.length, 5);
  assert.deepEqual(r.map(x => x.source).sort(), ['jcb', 'jcb', 'mufg', 'rakuten', 'rakuten']);
  assert.equal(r.find(x => x.source === 'mufg').possibleDup, true);
  assert.equal(r.filter(x => x.source === 'jcb').every(x => !x.possibleDup), true);
  assert.equal(r[0].key, 'rkmail:u1:0');   // 11/10 が最新
});

test('mailFetchUrl:トークンをエンコードして GET の URL を作る', () => {
  assert.equal(A.mailFetchUrl('https://x.test/exec', 'a b&c', 45), 'https://x.test/exec?token=a%20b%26c&days=45');
});

test('_csvDupStatus: メール取り込みの支出は imported、手入力は possible', () => {
  const mailTx = { type: 'expense', mailKey: 'rkmail:m:0', accountId: 'a1', date: '2026-10-29', amount: 952 };
  const handTx = { type: 'expense', accountId: 'a1', date: '2026-10-30', amount: 500 };
  const csvTx = { type: 'expense', importKey: 'k1', accountId: 'a1', date: '2026-10-31', amount: 700 };
  const L = [mailTx, handTx, csvTx];
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-10-29', 952, 'expense'), 'imported');
  assert.equal(A._csvDupStatus(L, 'zz', 'a2', '2026-10-29', 952, 'expense'), null);
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-10-29', 952, 'income'), null);
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-10-30', 500, 'expense'), 'possible');
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-10-31', 700, 'expense'), null);   // importKey 付きは possible にしない
  assert.equal(A._csvDupStatus(L, 'k1', 'a1', '2026-10-31', 700, 'expense'), 'imported');
  // メール確定済みは ±3 日まで imported、4 日ずれは対象外、手入力は日付ぴったりだけ
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-11-01', 952, 'expense'), 'imported');
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-10-26', 952, 'expense'), 'imported');
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-11-02', 952, 'expense'), null);
  assert.equal(A._csvDupStatus(L, 'zz', 'a1', '2026-11-02', 500, 'expense'), null);
});

test('foodTagCategory: 既知のタグは正しい分類を返し、未知は ingredient', () => {
  assert.equal(A.foodTagCategory('主菜'),    'role');
  assert.equal(A.foodTagCategory('和食'),    'genre');
  assert.equal(A.foodTagCategory('焼き'),    'method');
  assert.equal(A.foodTagCategory('作り置き'), 'other');
  assert.equal(A.foodTagCategory('鯖'),      'ingredient');
  assert.equal(A.foodTagCategory('未知の語'), 'ingredient');
});

test('suggestFoodDishes: 家にある食材を多く使う料理が上に来て、外食の料理は除外される', () => {
  const ms = [
    { id: 'm1', date: '2026-10-01', memo: '', v: 2, sittings: [{ id: 's1', kind: 'dinner', dishes: [
      { id: 'd1', name: '豚汁', type: 'home', tags: ['豚肉', '大根', '人参'], photos: [] },
      { id: 'd2', name: 'ラーメン', type: 'out', place: '麺屋', tags: ['豚肉', '麺'], photos: [] }
    ]}]},
    { id: 'm2', date: '2026-10-02', memo: '', v: 2, sittings: [{ id: 's2', kind: 'lunch', dishes: [
      { id: 'd3', name: '野菜炒め', type: 'home', tags: ['大根', '人参', 'キャベツ'], photos: [] }
    ]}]}
  ];
  const result = plain(A.suggestFoodDishes(ms, ['豚肉', '大根'], [], '2026-11-06'));
  // 外食のラーメンは含まれない
  assert.ok(result.every(r => r.name !== 'ラーメン'), 'ラーメン（外食）が含まれてはいけない');
  // 豚汁(usedHome=2, score=4) > 野菜炒め(usedHome=1, score=2)
  assert.equal(result.length, 2);
  assert.equal(result[0].name, '豚汁');
  assert.equal(result[0].usedHome.length, 2);
});

test('dishRoleGroup: 役割タグから見出しグループを決める', () => {
  assert.equal(A.dishRoleGroup(['豚肉', '主菜']), '主菜');
  assert.equal(A.dishRoleGroup(['副菜']), '副菜');
  assert.equal(A.dishRoleGroup(['汁物', '豆腐']), '汁物');
  assert.equal(A.dishRoleGroup(['副菜', '主菜']), '主菜');
  assert.equal(A.dishRoleGroup(['主食']), 'その他');
  assert.equal(A.dishRoleGroup(['デザート']), 'その他');
  assert.equal(A.dishRoleGroup(['豚肉']), 'その他');
  assert.equal(A.dishRoleGroup(undefined), 'その他');
});

test('rankRecipeWishes: 一致するものが先、一致しないものも後ろに全部残す', () => {
  const ws = [
    { id: 'a', name: 'A', url: '', tags: ['豚肉', '副菜'], createdAt: '2026-11-01T00:00:00Z' },
    { id: 'b', name: 'B', url: 'https://x.test/b', tags: ['豚肉', '大根', '味噌', '主菜'], createdAt: '2026-11-02T00:00:00Z' },
    { id: 'c', name: 'C', tags: ['鮭'], createdAt: '2026-11-03T00:00:00Z' },
    { id: 'd', name: 'D', tags: ['大根', '汁物'], createdAt: '2026-11-04T00:00:00Z' },
    { id: 'e', name: 'E', tags: ['主菜'], createdAt: '2026-11-05T00:00:00Z' }
  ];
  const r = plain(A.rankRecipeWishes(ws, ['豚肉', '大根'], ['味噌']));
  assert.deepEqual(r.map(x => x.name), ['B', 'D', 'A', 'E', 'C']);
  assert.equal(r[0].role, '主菜');
  assert.equal(r[1].role, '汁物');
  assert.equal(r[2].role, '副菜');
  assert.equal(r[0].wish, true);
  assert.equal(r[0].wishId, 'b');
  assert.equal(r[0].url, 'https://x.test/b');
  assert.deepEqual(r[0].usedHome, ['豚肉', '大根']);
  assert.deepEqual(r[0].usedBuy, ['味噌']);
  assert.deepEqual(r[0].missing, []);
  assert.deepEqual(r[0].ingredients, ['豚肉', '大根', '味噌']);
  assert.deepEqual(plain(A.rankRecipeWishes(ws, [], [])).map(x => x.name), ['E', 'D', 'C', 'B', 'A']);
  assert.deepEqual(plain(A.rankRecipeWishes(ws, ['卵'], [])).map(x => x.name), ['E', 'D', 'C', 'B', 'A']);
  assert.deepEqual(plain(A.rankRecipeWishes(null, ['豚肉'], [])), []);
  assert.deepEqual(plain(A.rankRecipeWishes([{ id: 'x', name: ' ', tags: [] }, null], [], [])), []);
});

test('rankRecipeWishes: 古い形式（ingredients / role）の項目も読める', () => {
  const ws = [{ id: 'o', name: 'O', ingredients: ['鮭'], role: '主菜', createdAt: '2026-11-01T00:00:00Z' }];
  const r = plain(A.rankRecipeWishes(ws, ['鮭'], []));
  assert.equal(r.length, 1);
  assert.equal(r[0].role, '主菜');
});

test('suggestFoodDishes: 結果に role（見出しグループ）が付く', () => {
  const ms = [
    { id: 'm1', date: '2026-10-01', memo: '', v: 2, sittings: [{ id: 's1', kind: 'dinner', dishes: [
      { id: 'd1', name: '豚汁', type: 'home', tags: ['豚肉', '汁物'], photos: [] },
      { id: 'd2', name: '炒め', type: 'home', tags: ['豚肉'], photos: [] }
    ]}]}
  ];
  const r = plain(A.suggestFoodDishes(ms, ['豚肉'], [], '2026-11-06'));
  assert.equal(r.find(x => x.name === '豚汁').role, '汁物');
  assert.equal(r.find(x => x.name === '炒め').role, 'その他');
});

test('suggestFoodDishes: 7日以内に食べた料理は、score が高くても後ろに回る', () => {
  const today = '2026-11-06';
  const ms = [
    // カレー: 昨日食べた → recent=true, score=4 (豚肉+人参)
    { id: 'm3', date: '2026-11-05', memo: '', v: 2, sittings: [{ id: 's3', kind: 'dinner', dishes: [
      { id: 'd5', name: 'カレー', type: 'home', tags: ['豚肉', '人参', 'じゃがいも', '玉ねぎ'], photos: [] }
    ]}]},
    // 味噌汁: 古い日 → recent=false, score=2 (豆腐)
    { id: 'm4', date: '2026-10-01', memo: '', v: 2, sittings: [{ id: 's4', kind: 'dinner', dishes: [
      { id: 'd6', name: '味噌汁', type: 'home', tags: ['豆腐'], photos: [] }
    ]}]}
  ];
  // home に両方の食材を含める（カレーの方が score 高い）
  const result = plain(A.suggestFoodDishes(ms, ['豚肉', '人参', '豆腐'], [], today));
  assert.equal(result.length, 2);
  // score が高くても recent=true のカレーは後ろ
  assert.equal(result[0].name, '味噌汁');
  assert.equal(result[1].name, 'カレー');
  assert.equal(result[1].recent, true);
});

test('presetFoodTags: 同じ名前の過去の料理があれば最新のタグを返す', () => {
  const ms = [
    { id: 'm1', date: '2026-10-01', memo: '', v: 2, sittings: [{ id: 's1', kind: 'dinner', dishes: [
      { id: 'd1', name: 'カレーライス', type: 'home', tags: ['豚肉', 'じゃがいも'], photos: [] }
    ]}]},
    { id: 'm2', date: '2026-11-01', memo: '', v: 2, sittings: [{ id: 's2', kind: 'dinner', dishes: [
      { id: 'd2', name: 'カレーライス', type: 'home', tags: ['鶏肉', 'にんじん'], photos: [] }
    ]}]}
  ];
  const result = plain(A.presetFoodTags('カレーライス', ms));
  // m2 が最新 → ['鶏肉','にんじん']
  assert.deepEqual(result, ['鶏肉', 'にんじん']);
});

test('presetFoodTags: 過去にない名前でも食材エイリアスと語句ルールからタグを推測する', () => {
  const ms = [
    { id: 'm3', date: '2026-10-01', memo: '', v: 2, sittings: [{ id: 's3', kind: 'dinner', dishes: [
      { id: 'd3', name: 'ナスの炒め物', type: 'home', tags: ['ナス'], photos: [] }
    ]}]}
  ];
  // '茄子の煮びたし' は過去に存在しない。ただし past に 'ナス' (ingredient) があり、茄子はエイリアス
  const result = plain(A.presetFoodTags('茄子の煮びたし', ms));
  assert.ok(result.includes('ナス'),  'alias 茄子 → tag ナス');
  assert.ok(result.includes('煮物'), 'word rule 煮びたし → 煮物');
});

test('jsq: 引用符やバックスラッシュを含むタグでも onclick の引数として元の文字列に戻る', () => {
  const unesc = s => s.replace(/&quot;|&#39;|&lt;|&gt;|&amp;/g, m => ({ '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' }[m]));
  for (const tag of ["母's", 'a"b', 'c\d', '<b>&']) {
    const attr = A.jsq(tag);
    assert.ok(!/["'<>]/.test(attr));         // 属性の中に生の記号が残らない
    assert.equal(JSON.parse(unesc(attr)), tag); // ブラウザが属性を読んだ後の JS 文字列が元に戻る
  }
});

test('calcCheckOutDate: チェックイン日 + 泊数 = チェックアウト日', () => {
  assert.equal(A.calcCheckOutDate('2026-11-28', 1), '2026-11-29');
  assert.equal(A.calcCheckOutDate('2026-11-28', 2), '2026-11-30');
  assert.equal(A.calcCheckOutDate('2026-12-31', 1), '2027-01-01'); // 年またぎ
  assert.equal(A.calcCheckOutDate('', 1),           '');           // 日付なし
  assert.equal(A.calcCheckOutDate('2026-11-28', 0), '');           // 0泊
});

test('calcNights: チェックイン〜チェックアウト間の泊数を返す', () => {
  assert.equal(A.calcNights('2026-11-28', '2026-11-29'), 1);
  assert.equal(A.calcNights('2026-11-28', '2026-11-30'), 2);
  assert.equal(A.calcNights('2026-11-28', '2026-11-28'), 0); // 同日
  assert.equal(A.calcNights('', '2026-11-29'),           0); // 日付なし
});

test('fmtTimeRange: 開始・終了時刻をフォーマットする', () => {
  assert.equal(A.fmtTimeRange('10:00', '12:00'), '10:00–12:00');
  assert.equal(A.fmtTimeRange('10:00', ''),      '10:00');
  assert.equal(A.fmtTimeRange('',      '12:00'), '');
  assert.equal(A.fmtTimeRange('',      ''),      '');
});

test('_stayAutoRowsForDay: チェックイン日は返さない', () => {
  const plan = [{ kind:'stay', date:'2026-11-28', checkOut:'2026-11-30', title:'Hotel A' }];
  assert.equal(A._stayAutoRowsForDay(plan, '2026-11-28').length, 0);
});

test('_stayAutoRowsForDay: 中泊日は continuing を返す', () => {
  const plan = [{ kind:'stay', date:'2026-11-28', checkOut:'2026-11-30', title:'Hotel A' }];
  const rows = A._stayAutoRowsForDay(plan, '2026-11-29');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'continuing');
  assert.equal(rows[0].item.title, 'Hotel A');
});

test('_stayAutoRowsForDay: チェックアウト日は checkout を返す', () => {
  const plan = [{ kind:'stay', date:'2026-11-28', checkOut:'2026-11-30', title:'Hotel A' }];
  const rows = A._stayAutoRowsForDay(plan, '2026-11-30');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'checkout');
});

test('_stayAutoRowsForDay: checkOut 未設定の宿は中泊・チェックアウト行を出さない', () => {
  const plan = [{ kind:'stay', date:'2026-11-28', title:'Hotel A' }];
  assert.equal(A._stayAutoRowsForDay(plan, '2026-11-29').length, 0);
});

test('migrateTripDetailsToPlan: transport と stay が plan に移行される', () => {
  const trips = [{
    id: 'trip1', dest: 'Tokyo', plan: [],
    details: {
      transport: [{ id: 'tr1', kind: 'flight', name: 'ANA123', from: '東京', to: '大阪', depDate: '2026-11-01', depTime: '10:00', arrDate: '2026-11-01', arrTime: '11:00', confNo: 'ABC123', price: 15000, url: '', note: 'メモ' }],
      stay: [{ id: 'st1', name: 'ホテル花', address: '大阪市', checkIn: '2026-11-01', checkInTime: '15:00', checkOut: '2026-11-03', checkOutTime: '11:00', confNo: 'XYZ789', price: 20000, url: '', note: '' }],
      notes: {}
    }
  }];
  const { trips: result, changed } = A.migrateTripDetailsToPlan(trips);
  assert.ok(changed);
  assert.ok(result[0].planMigrated);
  const moveItems = result[0].plan.filter(p => p.kind === 'move');
  assert.equal(moveItems.length, 1);
  assert.equal(moveItems[0].id, 'tr1');
  assert.equal(moveItems[0].mode, 'flight');
  assert.equal(moveItems[0].title, 'ANA123');
  assert.equal(moveItems[0].from, '東京');
  assert.equal(moveItems[0].to, '大阪');
  assert.equal(moveItems[0].date, '2026-11-01');
  assert.equal(moveItems[0].confNo, 'ABC123');
  assert.equal(moveItems[0].price, 15000);
  assert.ok(moveItems[0].confirmed);
  const stayItems = result[0].plan.filter(p => p.kind === 'stay');
  assert.equal(stayItems.length, 1);
  assert.equal(stayItems[0].id, 'st1');
  assert.equal(stayItems[0].title, 'ホテル花');
  assert.equal(stayItems[0].address, '大阪市');
  assert.equal(stayItems[0].date, '2026-11-01');
  assert.equal(stayItems[0].checkOut, '2026-11-03');
  assert.ok(stayItems[0].confirmed);
  // original details preserved
  assert.equal(result[0].details.transport.length, 1);
  assert.equal(result[0].details.stay.length, 1);
});

test('migrateTripDetailsToPlan: 重複 ID はスキップされる', () => {
  const existingPlan = [{ id: 'tr1', kind: 'move', title: '既存', date: null, time: '' }];
  const trips = [{
    id: 'trip2', dest: 'Osaka', plan: existingPlan,
    details: {
      transport: [{ id: 'tr1', kind: 'train', name: '重複', from: 'A', to: 'B', depDate: null, depTime: '', arrDate: null, arrTime: '', confNo: '', price: null, url: '', note: '' }],
      stay: [],
      notes: {}
    }
  }];
  const { trips: result, changed } = A.migrateTripDetailsToPlan(trips);
  assert.ok(changed);
  assert.equal(result[0].plan.length, 1); // duplicated tr1 not added again
  assert.equal(result[0].plan[0].title, '既存');
});

test('migrateTripDetailsToPlan: planMigrated 済みは再実行しない', () => {
  const trips = [{
    id: 'trip3', dest: 'Kyoto', plan: [{ id: 'x', kind: 'see', title: '金閣寺', date: null, time: '' }],
    planMigrated: true,
    details: {
      transport: [{ id: 'tr2', kind: 'bus', name: 'バス', from: 'A', to: 'B', depDate: null, depTime: '', arrDate: null, arrTime: '', confNo: '', price: null, url: '', note: '' }],
      stay: [],
      notes: {}
    }
  }];
  const { trips: result, changed } = A.migrateTripDetailsToPlan(trips);
  assert.ok(!changed);
  assert.equal(result[0].plan.length, 1); // transport not added since already migrated
});

test('migrateTripDetailsToPlan: 空の配列は changed=false を返す', () => {
  const { trips: result, changed } = A.migrateTripDetailsToPlan([]);
  assert.ok(!changed);
  assert.deepEqual(result, []);
});

// ── swipeDirection ──

test('swipeDirection: 左スワイプ（dx 負）は next、右スワイプ（dx 正）は prev', () => {
  assert.equal(A.swipeDirection(-80, 10, 300), 'next');
  assert.equal(A.swipeDirection(80, 10, 300), 'prev');
});

test('swipeDirection: 移動量が 60px 未満は null', () => {
  assert.equal(A.swipeDirection(-59, 0, 300), null);
  assert.equal(A.swipeDirection(59, 0, 300), null);
  assert.equal(A.swipeDirection(-60, 0, 300), 'next'); // ちょうど 60px はOK
  assert.equal(A.swipeDirection(60, 0, 300), 'prev');
});

test('swipeDirection: 600ms を超えると null', () => {
  assert.equal(A.swipeDirection(-80, 10, 601), null);
  assert.equal(A.swipeDirection(-80, 10, 600), 'next'); // ちょうど 600ms はOK
});

test('swipeDirection: 横移動が縦移動の 2 倍未満（縦スクロール優勢）は null', () => {
  assert.equal(A.swipeDirection(-80, 41, 300), null);  // 80 < 41*2=82 → null
  assert.equal(A.swipeDirection(-80, 40, 300), 'next'); // 80 = 40*2=80 → ちょうど境界でOK
  assert.equal(A.swipeDirection(-80, 39, 300), 'next'); // 80 > 39*2=78 → OK
});

test('swipeDirection: 条件が複数 NG でも null', () => {
  // 距離不足かつ時間超過
  assert.equal(A.swipeDirection(-30, 0, 700), null);
  // ゼロ移動
  assert.equal(A.swipeDirection(0, 0, 100), null);
});

// ── isTripDone ──────────────────────────────────────────────────────────────
test('isTripDone: status=完了 は endDate に関係なく true', () => {
  assert.equal(A.isTripDone({ status: '完了' }, '2026-01-01'), true);
  assert.equal(A.isTripDone({ status: '完了', endDate: '2030-12-31' }, '2026-01-01'), true);
});

test('isTripDone: endDate なしは false', () => {
  assert.equal(A.isTripDone({ status: '予定' }, '2026-11-12'), false);
  assert.equal(A.isTripDone({}, '2026-11-12'), false);
});

test('isTripDone: today > endDate は true', () => {
  assert.equal(A.isTripDone({ status: '予定', endDate: '2026-11-10' }, '2026-11-12'), true);
});

test('isTripDone: today === endDate は false（まだ当日）', () => {
  assert.equal(A.isTripDone({ status: '予定', endDate: '2026-11-12' }, '2026-11-12'), false);
});

test('isTripDone: today < endDate は false', () => {
  assert.equal(A.isTripDone({ status: '予定', endDate: '2026-11-30' }, '2026-11-12'), false);
});

// ── isDayPassed ──────────────────────────────────────────────────────────────
test('isDayPassed: ds なし（undated）は false', () => {
  assert.equal(A.isDayPassed(null, '2026-11-12'), false);
  assert.equal(A.isDayPassed(undefined, '2026-11-12'), false);
  assert.equal(A.isDayPassed('', '2026-11-12'), false);
});

test('isDayPassed: today === ds は true（当日は記録を開く）', () => {
  assert.equal(A.isDayPassed('2026-11-12', '2026-11-12'), true);
});

test('isDayPassed: today > ds は true（過去日）', () => {
  assert.equal(A.isDayPassed('2026-11-10', '2026-11-12'), true);
});

test('isDayPassed: today < ds は false（未来日）', () => {
  assert.equal(A.isDayPassed('2026-11-20', '2026-11-12'), false);
});

// ── _itiTimeSortKey ──────────────────────────────────────────────────────────
test('_itiTimeSortKey: 9:00 は 10:00 より前になる（H:MM と HH:MM の混在）', () => {
  assert.ok(A._itiTimeSortKey('9:00') < A._itiTimeSortKey('10:00'),
    `9:00=${A._itiTimeSortKey('9:00')} should be < 10:00=${A._itiTimeSortKey('10:00')}`);
});

test('_itiTimeSortKey: チェックアウト 10:00 は 14:00 の便より前になる', () => {
  assert.ok(A._itiTimeSortKey('10:00') < A._itiTimeSortKey('14:00'),
    `10:00=${A._itiTimeSortKey('10:00')} should be < 14:00=${A._itiTimeSortKey('14:00')}`);
});

test('_itiTimeSortKey: 時刻なし項目はすべての時刻付き項目より後', () => {
  assert.ok(A._itiTimeSortKey('') > A._itiTimeSortKey('23:59'),
    `no-time=${A._itiTimeSortKey('')} should be > 23:59=${A._itiTimeSortKey('23:59')}`);
});

test('_itiTimeSortKey: 同じ宿に宿泊（isContinuing）は時刻なし項目より後で常に最後', () => {
  assert.ok(A._itiTimeSortKey('', true) > A._itiTimeSortKey(''),
    `continuing=${A._itiTimeSortKey('', true)} should be > no-time=${A._itiTimeSortKey('')}`);
  assert.ok(A._itiTimeSortKey('', true) > A._itiTimeSortKey('23:59'),
    `continuing should be > any timed item`);
});

test('_itiTimeSortKey: チェックアウト→便→宿泊継続 の正しい順序', () => {
  const checkout = A._itiTimeSortKey('10:00');       // 600
  const flight   = A._itiTimeSortKey('14:00');       // 840
  const cont     = A._itiTimeSortKey('', true);      // 10000
  assert.ok(checkout < flight && flight < cont,
    `expected checkout(${checkout}) < flight(${flight}) < continuing(${cont})`);
});

test('_itiTimeSortKey: 時刻なしのチェックアウトは 9:00 の項目より前（先頭扱い -1）', () => {
  // checkOutTime なしのチェックアウト行は keyOf で -1 を返す約束
  const noTimeCheckout = -1;
  assert.ok(noTimeCheckout < A._itiTimeSortKey('9:00'),
    `-1 should be < 9:00(${A._itiTimeSortKey('9:00')})`);
});
