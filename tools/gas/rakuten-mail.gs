// 楽天カードの「カード利用のお知らせ」（確定版）メールを JSON で返す Apps Script。
// 解析はダッシュボード側（js/ledger/mail-import.js）で行う。ここでは取得だけ。
// 合言葉（TOKEN）はコードに書かない。スクリプトプロパティに入れる（tools/gas/README.md 参照）。

function doGet(e) {
  var p = (e && e.parameter) || {};
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || p.token !== token) return _json({ error: 'unauthorized' });

  var days = parseInt(p.days, 10);
  if (!days || days < 1) days = 45;
  if (days > 120) days = 120;

  var query = 'from:info@mail.rakuten-card.co.jp subject:"カード利用のお知らせ" -subject:速報版 newer_than:' + days + 'd';
  var items = [];
  GmailApp.search(query, 0, 100).forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      var subject = m.getSubject();
      if (subject.indexOf('カード利用のお知らせ') !== 0 || subject.indexOf('速報版') >= 0) return;
      items.push({ id: m.getId(), date: m.getDate().toISOString(), subject: subject, body: m.getPlainBody() });
    });
  });
  return _json({ items: items });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
