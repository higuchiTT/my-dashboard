// 画面の決まりごとをまとめて調べるスクリプト（ブラウザで実行する）。checker が毎回最初に1回だけ動かす。
// 使い方: ローカルサーバーで dashboard.html を開き、
//   eval(await (await fetch('tests/ui-audit.js')).text()); await runUiAudit()
// 調べること（今の画面幅で）:
//   - errors: 全タブの描画で出たエラー（tests/smoke.js の runSmoke）
//   - overflow: 横にはみ出しているか（スマホ幅で scrollWidth > 画面幅）と、はみ出している要素
//   - smallTaps: 押せる要素で高さ 32px 未満のもの（スマホ幅のときだけ）
//   - smallFonts: 文字が 10px 未満のもの
// オプション:
//   pages: 調べるタブ（既定は全タブ）
//   root:  CSS セレクタ。指定するとタブを切り替えず、その要素の中だけ調べる（開いたモーダルや旅の詳細など）
//   seed:  false にするとテスト用データを入れない（自分で入れたダミーのまま調べる）
//   limit: 項目ごとに返す例の数（既定 8）
// 本番データには書き込まない（runSmoke が saveToSupabase を空にする）。
async function runUiAudit(opts = {}) {
  const limit = opts.limit || 8;
  const mobile = window.innerWidth <= 640;
  const errors = [];
  const onErr = e => errors.push(String(e.message || e));
  window.addEventListener('error', onErr);
  if (opts.seed !== false && typeof runSmoke === 'function') {
    const s = await runSmoke();
    errors.push(...s.errors);
  } else {
    window.saveToSupabase = () => {};
    const lo = document.getElementById('loginOverlay'); if (lo) lo.style.display = 'none';
  }

  const visible = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0;
  };
  const desc = el => {
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}${txt ? ' "' + txt + '"' : ''}`;
  };
  const sample = arr => ({ count: arr.length, samples: arr.slice(0, limit) });

  const auditRoot = root => {
    const vw = document.documentElement.clientWidth;
    const all = [...root.querySelectorAll('*')].filter(visible);
    // 横スクロールする箱や、はみ出しを隠す箱の中の要素は数えない
    const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
    const overflowEls = all.filter(el => el.getBoundingClientRect().right > vw + 1 && !clipped(el))
      .map(el => `${desc(el)} right=${Math.round(el.getBoundingClientRect().right)}`);
    const tapSel = 'button, a[href], [onclick], select, input:not([type=hidden]), textarea, [role=button]';
    const smallTaps = !mobile ? [] : all.filter(el => el.matches(tapSel))
      .filter(el => { const r = el.getBoundingClientRect(); return r.height < 32 && !el.closest('label') && !(el.parentElement && el.parentElement.closest(tapSel) && el.parentElement.closest(tapSel).getBoundingClientRect().height >= 32); })
      .map(el => `${desc(el)} h=${Math.round(el.getBoundingClientRect().height)}`);
    const smallFonts = all.filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
      .filter(el => parseFloat(getComputedStyle(el).fontSize) < 10)
      .map(el => `${desc(el)} ${getComputedStyle(el).fontSize}`);
    return {
      overflow: { scrollWidth: document.documentElement.scrollWidth, viewport: vw, ...sample(overflowEls) },
      smallTaps: sample(smallTaps),
      smallFonts: sample(smallFonts),
    };
  };

  const result = { viewport: `${window.innerWidth}x${window.innerHeight}`, mobile, errors, pages: {} };
  if (opts.root) {
    const root = document.querySelector(opts.root);
    result.pages[opts.root] = root ? auditRoot(root) : '(not found)';
  } else {
    const pages = opts.pages || ['home', 'todo', 'finance', 'shopping', 'travel', 'food', 'notes'];
    for (const p of pages) {
      try { nav(p); } catch (e) { errors.push(p + ': ' + e.message); }
      await new Promise(r => setTimeout(r, 60));
      const el = document.getElementById('page-' + p);
      result.pages[p] = el ? auditRoot(el) : '(missing)';
    }
  }
  window.removeEventListener('error', onErr);
  return result;
}
