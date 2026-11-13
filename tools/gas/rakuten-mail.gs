// 楽天カードの「カード利用のお知らせ」（確定版）と、三菱UFJ-VISAデビットの「ご利用のお知らせ」、JCBの「ショッピングご利用のお知らせ」（取消は除く）メールを JSON で返す Apps Script。
// （ファイル名は rakuten-mail.gs のまま。両方を扱う）
// 解析はダッシュボード側（js/ledger/mail-import.js）で行う。ここでは取得だけ。各 item の source は 'rakuten' / 'mufg' / 'jcb'。
// 合言葉（TOKEN）はコードに書かない。スクリプトプロパティに入れる（tools/gas/README.md 参照）。

function doGet(e) {
  var p = (e && e.parameter) || {};
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || p.token !== token) return _json({ error: 'unauthorized' });

  var days = parseInt(p.days, 10);
  if (!days || days < 1) days = 45;
  if (days > 120) days = 120;

  var items = [];
  var seen = {};
  function collect(query, source, address, okSubject) {
    GmailApp.search(query, 0, 100).forEach(function (thread) {
      thread.getMessages().forEach(function (m) {
        var subject = m.getSubject();
        if (m.getFrom().indexOf(address) < 0 || !okSubject(subject) || seen[m.getId()]) return;
        seen[m.getId()] = true;
        items.push({ id: m.getId(), date: m.getDate().toISOString(), subject: subject, body: m.getPlainBody(), source: source });
      });
    });
  }
  collect('from:info@mail.rakuten-card.co.jp subject:"カード利用のお知らせ" -subject:速報版 newer_than:' + days + 'd',
    'rakuten', 'info@mail.rakuten-card.co.jp',
    function (s) { return s.indexOf('カード利用のお知らせ') === 0 && s.indexOf('速報版') < 0; });
  collect('from:mail@debit.bk.mufg.jp subject:"ご利用のお知らせ" newer_than:' + days + 'd',
    'mufg', 'mail@debit.bk.mufg.jp',
    function (s) { return s.indexOf('ご利用のお知らせ') >= 0; });
  collect('from:mail@qa.jcb.co.jp subject:"ショッピングご利用のお知らせ" -subject:取消 newer_than:' + days + 'd',
    'jcb', 'mail@qa.jcb.co.jp',
    function (s) { return s.indexOf('ショッピングご利用のお知らせ') >= 0 && s.indexOf('取消') < 0; });
  return _json({ items: items });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
