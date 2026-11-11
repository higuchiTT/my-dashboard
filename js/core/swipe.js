// ── SWIPE NAV ──
// スマホのボトムタブバーをタッチスワイプで切り替える。PC 幅では何もしない。
// passive リスナーのみ使用（preventDefault しない）ので縦スクロールは妨げない。

/**
 * タッチ移動量からスワイプ方向を返す純粋関数（テスト可能）
 * @param {number} dx  水平移動量（終了x - 開始x; 負=左スワイプ=次のタブ）
 * @param {number} dy  垂直移動量（終了y - 開始y）
 * @param {number} dt  経過時間 ms
 * @returns {'next'|'prev'|null}
 */
function swipeDirection(dx, dy, dt) {
  if (dt > 600) return null;
  if (Math.abs(dx) < 60) return null;
  if (Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx < 0 ? 'next' : 'prev';
}

(function () {
  var _start = null; // { x, y, t }

  /** オーバーレイ/モーダルが表示中か（表示中はスワイプ無効） */
  function _overlayActive() {
    if (document.querySelector('.ldr-modal-overlay.open')) return true;
    if (document.querySelector('.food-lightbox.open')) return true;
    var ids = ['foodModalOverlay', 'foodPopupOverlay', 'foodSuggestOverlay', 'loginOverlay', 'uiDialogOverlay'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.style.display !== '' && el.style.display !== 'none') return true;
    }
    return false;
  }

  /** 横スクロール可能な祖先要素（overflow-x: auto|scroll かつ実際にオーバーフロー）があるか */
  function _horizScrollAncestor(el) {
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth) {
        try {
          var ox = getComputedStyle(el).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        } catch (err) { /* ignore */ }
      }
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('touchstart', function (e) {
    _start = null;
    var touch = e.touches[0];
    if (!touch) return;

    // iOS の「戻る」スワイプと衝突しないよう画面左端 20px は無視
    if (touch.clientX <= 20) return;

    // モバイル幅以外は無視（matchMedia が使えない環境はスキップ）
    try {
      if (!window.matchMedia('(max-width: 640px)').matches) return;
    } catch (err) { return; }

    // テキスト入力系要素の上は無視
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.target.isContentEditable) return;

    // 横スクロール可能な祖先がある場合は無視（Food 写真帯・献立提案・Ledger 表など）
    if (_horizScrollAncestor(e.target)) return;

    _start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_start) return;
    var touch = e.changedTouches[0];
    if (!touch) return;
    var dx = touch.clientX - _start.x;
    var dy = touch.clientY - _start.y;
    var dt = Date.now() - _start.t;
    _start = null;

    // オーバーレイが開いていたら無視
    if (_overlayActive()) return;

    // テキスト選択中は無視
    try {
      var sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;
    } catch (err) { /* ignore */ }

    var dir = swipeDirection(dx, dy, dt);
    if (!dir) return;

    // 現在アクティブなタブのインデックスをボトムナビの DOM 順から取得
    var items = Array.from(document.querySelectorAll('.hm-bnav-item'));
    var curIdx = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('active')) { curIdx = i; break; }
    }
    if (curIdx < 0) return;

    var nextIdx = dir === 'next' ? curIdx + 1 : curIdx - 1;
    if (nextIdx < 0 || nextIdx >= items.length) return;

    // ページ名を onclick 属性から取り出す
    var onclick = items[nextIdx].getAttribute('onclick') || '';
    var m = onclick.match(/nav\('([^']+)'\)/);
    if (!m) return;

    var pageName = m[1];
    nav(pageName);

    // スワイプアニメーション（prefers-reduced-motion: reduce のときはなし）
    try {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var newPage = document.getElementById('page-' + pageName);
        if (newPage) {
          var cls = dir === 'next' ? 'swipe-in-next' : 'swipe-in-prev';
          newPage.classList.remove('swipe-in-next', 'swipe-in-prev');
          void newPage.offsetWidth; // reflow でアニメーションをリセット
          newPage.classList.add(cls);
          newPage.addEventListener('animationend', function onEnd() {
            newPage.classList.remove(cls);
            newPage.removeEventListener('animationend', onEnd);
          });
        }
      }
    } catch (err) { /* ignore */ }
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    _start = null;
  }, { passive: true });
})();
