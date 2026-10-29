// ── UTILS ──
function fmt(n){return Math.abs(Math.round(n)).toLocaleString('ja-JP');}
function today(){return localDate();}
function fmtS(d){return`${d.getMonth()+1}/${d.getDate()}`;}
function fmtFull(d){const days='日月火水木金土'.split('');return`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// onclick の引数に文字列を埋め込む（引用符やバックスラッシュを含んでも壊れない）
function jsq(s){return esc(JSON.stringify(String(s)));}

// ── UI DIALOG ──
function uiAlert(message, {title=''} = {}) {
  return new Promise(resolve => {
    _openUiDialog({title, message, okLabel:'OK', cancelLabel:null, danger:false, resolve});
  });
}
function uiConfirm(message, {title='', okLabel='OK', cancelLabel='キャンセル', danger=false} = {}) {
  return new Promise(resolve => {
    _openUiDialog({title, message, okLabel, cancelLabel, danger, resolve});
  });
}
function _openUiDialog({title, message, okLabel, cancelLabel, danger, resolve}) {
  const overlay = document.getElementById('uiDialogOverlay');
  const titleEl = document.getElementById('uiDialogTitle');
  const msgEl   = document.getElementById('uiDialogMsg');
  const okBtn   = document.getElementById('uiDialogOk');
  const cancelBtn = document.getElementById('uiDialogCancel');
  titleEl.textContent = title;
  titleEl.style.display = title ? '' : 'none';
  msgEl.innerHTML = esc(message).replace(/\n/g,'<br>');
  okBtn.textContent = okLabel;
  okBtn.style.background = danger ? 'var(--accent)' : 'var(--ink)';
  if (cancelLabel) { cancelBtn.textContent = cancelLabel; cancelBtn.style.display = ''; }
  else { cancelBtn.style.display = 'none'; }
  overlay.style.display = 'flex';
  okBtn.focus();
  function close(result) {
    overlay.style.display = 'none';
    overlay.removeEventListener('keydown', onKey);
    resolve(result);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    else if (e.key === 'Enter') { e.preventDefault(); close(true); }
  }
  okBtn.onclick = () => close(true);
  cancelBtn.onclick = () => close(false);
  overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  overlay.addEventListener('keydown', onKey);
}
