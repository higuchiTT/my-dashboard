// ── SUBS ──
function saveSubs(){localStorage.setItem('hd_subs',JSON.stringify(subs));saveToSupabase();renderHome();renderGuidePanel();renderLdrMobOnboard();}

// Default txCategory from sub category
function _subDefaultTxCat(subCat){
  const MAP={'住居':'家賃','光熱費':'光熱費','通信':'通信費','交通':'交通費','動画':'娯楽','音楽':'娯楽','ゲーム':'娯楽'};
  const result=MAP[subCat]||'その他';
  // If mapped result exists in master, use it; otherwise fall back to その他
  const cats=getAllCategories();
  return cats.some(c=>c.name===result)?result:'その他';
}

// autoPostSubs: create expense txs for active subs with payDay, from autoFrom up to today
function autoPostSubs(){
  if(!subs||!txs)return;
  let changed=false;
  const todayStr=today();
  const ty=parseInt(todayStr.slice(0,4)),tm=parseInt(todayStr.slice(5,7))-1,td=parseInt(todayStr.slice(8,10));
  subs.forEach(s=>{
    if(!s.active||!s.payDay||!s.autoFrom)return;
    const afy=parseInt(s.autoFrom.slice(0,4)),afm=parseInt(s.autoFrom.slice(5,7))-1;
    let cy=afy,cm=afm;
    while(cy<ty||(cy===ty&&cm<=tm)){
      const ym=`${cy}-${String(cm+1).padStart(2,'0')}`;
      // For yearly: only the payMonth
      if(s.cycle==='yearly'){
        const payMo=(s.payMonth||1)-1;
        if(cm!==payMo){if(cm===11){cm=0;cy++;}else cm++;continue;}
      }
      // Check payDay has passed
      const daysInMo=new Date(cy,cm+1,0).getDate();
      const actualDay=Math.min(s.payDay,daysInMo);
      const payDateStr=`${cy}-${String(cm+1).padStart(2,'0')}-${String(actualDay).padStart(2,'0')}`;
      if(payDateStr>todayStr){if(cm===11){cm=0;cy++;}else cm++;continue;}
      // Skip if user unchecked this month
      if(s.skip&&s.skip[ym]){if(cm===11){cm=0;cy++;}else cm++;continue;}
      // Skip if already paid
      const alreadyPaid=txs.some(t=>String(t.subId)===String(s.id)&&t.subYm===ym);
      if(!alreadyPaid){
        const txCat=s.txCategory||_subDefaultTxCat(s.category);
        const tx={id:crypto.randomUUID(),type:'expense',title:s.name,amount:s.price,category:txCat,date:payDateStr,note:'',subId:String(s.id),subYm:ym};
        if(s.accountId)tx.accountId=s.accountId;
        txs.push(tx);
        changed=true;
      }
      if(cm===11){cm=0;cy++;}else cm++;
    }
  });
  if(changed)saveTx();
}

// Sub modal
let _ldrSubEditId=null;
function _populateLdrSubTxCatSel(selectedCat){
  const sel=document.getElementById('ldrSubTxCat');if(!sel)return;
  const cats=getCategories('expense');
  // If selectedCat is hidden or missing, include it
  const extra=(selectedCat&&!cats.some(c=>c.name===selectedCat)&&getAllCategories().some(c=>c.name===selectedCat))?[getAllCategories().find(c=>c.name===selectedCat)]:[];
  sel.innerHTML=[...cats,...extra].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  if(selectedCat)sel.value=selectedCat;
  if(!sel.value&&cats.length)sel.value=cats[0].name;
}
function _populateLdrSubAccSel(selectedId){
  const sel=document.getElementById('ldrSubAccId');if(!sel)return;
  sel.innerHTML=`<option value="">口座未設定</option>${accounts.filter(a=>!a.archived).map(a=>`<option value="${esc(String(a.id))}">${esc(a.name)}</option>`).join('')}`;
  sel.value=selectedId||'';
}
function openLdrSubModal(id){
  _ldrSubEditId=id?String(id):null;
  const overlay=document.getElementById('ldrSubModal');if(!overlay)return;
  _populateLdrSubAccSel(null);
  overlay.classList.add('open');
  const title=document.getElementById('ldrSubModalTitle');
  const saveBtn=document.getElementById('ldrSubSaveBtn');
  const delWrap=document.getElementById('ldrSubDelWrap');
  if(id){
    const s=subs.find(s=>String(s.id)===String(id));if(!s)return;
    if(title)title.textContent='固定費・サブスクを編集';
    if(saveBtn)saveBtn.textContent='保存';
    document.getElementById('ldrSubName').value=s.name||'';
    document.getElementById('ldrSubPrice').value=s.price||'';
    document.getElementById('ldrSubCycle').value=s.cycle||'monthly';
    document.getElementById('ldrSubPayDay').value=s.payDay||'';
    document.getElementById('ldrSubPayMonth').value=s.payMonth||'';
    document.getElementById('ldrSubCat').value=s.category||'その他';
    _populateLdrSubTxCatSel(s.txCategory||_subDefaultTxCat(s.category||'その他'));
    _populateLdrSubAccSel(s.accountId||'');
    document.getElementById('ldrSubNote').value=s.note||'';
    ldrSubCycleChange();
    if(delWrap)delWrap.innerHTML=`<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="confirmDelLdrSub('${esc(String(id))}')">削除</button>`;
  } else {
    if(title)title.textContent='固定費・サブスクを追加';
    if(saveBtn)saveBtn.textContent='追加';
    document.getElementById('ldrSubName').value='';
    document.getElementById('ldrSubPrice').value='';
    document.getElementById('ldrSubCycle').value='monthly';
    document.getElementById('ldrSubPayDay').value='';
    document.getElementById('ldrSubPayMonth').value='';
    document.getElementById('ldrSubCat').value='その他';
    _populateLdrSubTxCatSel('その他');
    _populateLdrSubAccSel('');
    document.getElementById('ldrSubNote').value='';
    ldrSubCycleChange();
    if(delWrap)delWrap.innerHTML='';
  }
  document.addEventListener('keydown',_ldrSubModalEsc);
  setTimeout(()=>{const el=document.getElementById('ldrSubName');if(el)el.focus();},50);
}
function closeLdrSubModal(){
  const overlay=document.getElementById('ldrSubModal');if(overlay)overlay.classList.remove('open');
  document.removeEventListener('keydown',_ldrSubModalEsc);
  _ldrSubEditId=null;
}
function _ldrSubModalEsc(e){if(e.key==='Escape')closeLdrSubModal();}
function ldrSubCycleChange(){
  const cycle=document.getElementById('ldrSubCycle');
  const row=document.getElementById('ldrSubPayMonthRow');
  if(cycle&&row)row.style.display=cycle.value==='yearly'?'':'none';
}
function ldrSubCatChange(){
  const cat=document.getElementById('ldrSubCat');
  if(cat)_populateLdrSubTxCatSel(_subDefaultTxCat(cat.value));
}
function saveLdrSubModal(){
  const name=document.getElementById('ldrSubName').value.trim();
  if(!name){document.getElementById('ldrSubName').focus();return;}
  const priceStr=document.getElementById('ldrSubPrice').value;
  const price=parseFloat(priceStr);
  if(!priceStr||isNaN(price)||price<=0){document.getElementById('ldrSubPrice').focus();return;}
  const cycle=document.getElementById('ldrSubCycle').value;
  const payDayStr=document.getElementById('ldrSubPayDay').value;
  const payDay=payDayStr?Math.min(31,Math.max(1,parseInt(payDayStr))):null;
  const payMonthStr=document.getElementById('ldrSubPayMonth').value;
  const payMonth=(cycle==='yearly'&&payMonthStr)?Math.min(12,Math.max(1,parseInt(payMonthStr))):null;
  const category=document.getElementById('ldrSubCat').value;
  const txCategory=document.getElementById('ldrSubTxCat').value;
  const accId=document.getElementById('ldrSubAccId').value||null;
  const note=document.getElementById('ldrSubNote').value.trim();
  const nowYm=today().slice(0,7);
  if(_ldrSubEditId){
    const idx=subs.findIndex(s=>String(s.id)===String(_ldrSubEditId));
    if(idx>=0){
      const s=subs[idx];
      s.name=name;s.price=price;s.cycle=cycle;s.category=category;s.txCategory=txCategory;s.note=note;
      if(accId)s.accountId=accId;else delete s.accountId;
      if(payDay){if(s.payDay!==payDay)s.autoFrom=nowYm;s.payDay=payDay;}
      else{delete s.payDay;delete s.autoFrom;}
      if(cycle==='yearly'&&payMonth)s.payMonth=payMonth;else delete s.payMonth;
    }
  } else {
    const newSub={id:crypto.randomUUID(),name,price,cycle,category,txCategory,active:true,note};
    if(accId)newSub.accountId=accId;
    if(payDay){newSub.payDay=payDay;newSub.autoFrom=nowYm;}
    if(cycle==='yearly'&&payMonth)newSub.payMonth=payMonth;
    subs.push(newSub);
  }
  saveSubs();
  closeLdrSubModal();
  autoPostSubs();
  renderSubs();
  renderFinance();
}
function confirmDelLdrSub(id){
  const delWrap=document.getElementById('ldrSubDelWrap');if(!delWrap)return;
  delWrap.innerHTML=`<span class="ldr-del-confirm">本当に削除しますか？</span><button class="btn btn-ghost btn-sm" onclick="ldrSubDelWrap_cancel()">いいえ</button><button class="btn btn-sm" style="background:var(--accent);color:var(--paper);border:none;padding:5px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;" onclick="execDelLdrSub('${esc(String(id))}')">削除</button>`;
}
function ldrSubDelWrap_cancel(){
  const w=document.getElementById('ldrSubDelWrap');
  if(w&&_ldrSubEditId)w.innerHTML=`<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="confirmDelLdrSub('${esc(String(_ldrSubEditId))}')">削除</button>`;
}
function execDelLdrSub(id){
  subs=subs.filter(s=>String(s.id)!==String(id));
  saveSubs();closeLdrSubModal();renderSubs();renderFinance();
}

// Check/uncheck payment for a sub in a specific month
function checkSubPayment(id,ym){
  const s=subs.find(s=>String(s.id)===String(id));if(!s||!s.payDay)return;
  // Remove from skip if present
  if(s.skip&&s.skip[ym]){delete s.skip[ym];if(!Object.keys(s.skip).length)delete s.skip;}
  const exists=txs.some(t=>String(t.subId)===String(id)&&t.subYm===ym);
  if(!exists){
    const y=parseInt(ym.slice(0,4)),m=parseInt(ym.slice(5,7))-1;
    const daysInMo=new Date(y,m+1,0).getDate();
    const actualDay=Math.min(s.payDay,daysInMo);
    const payDateStr=`${ym}-${String(actualDay).padStart(2,'0')}`;
    const txCat=s.txCategory||_subDefaultTxCat(s.category);
    const tx={id:crypto.randomUUID(),type:'expense',title:s.name,amount:s.price,category:txCat,date:payDateStr,note:'',subId:String(s.id),subYm:ym};
    if(s.accountId)tx.accountId=s.accountId;
    txs.push(tx);
    saveTx();
  }
  saveSubs();renderSubs();renderFinance();ldrListInitDone=false;renderLdrTxList();
}
async function uncheckSubPayment(id,ym){
  const s=subs.find(s=>String(s.id)===String(id));if(!s)return;
  if(!(await uiConfirm(`${ym} の「${s.name}」の支払いを取り消しますか？`,{title:'支払いの取り消し'})))return;
  txs=txs.filter(t=>!(String(t.subId)===String(id)&&t.subYm===ym));
  if(!s.skip)s.skip={};s.skip[ym]=true;
  saveTx();saveSubs();renderSubs();renderFinance();ldrListInitDone=false;renderLdrTxList();
}

// Sub row ... menu
let _openSubMenuId=null;
function _openSubMenu(e,id){
  e.stopPropagation();
  const menuId='subMenu_'+id;
  if(_openSubMenuId&&_openSubMenuId!==menuId){const old=document.getElementById(_openSubMenuId);if(old)old.classList.remove('open');}
  const m=document.getElementById(menuId);
  if(m){m.classList.toggle('open');_openSubMenuId=m.classList.contains('open')?menuId:null;}
}
function _closeSubMenus(){if(_openSubMenuId){const m=document.getElementById(_openSubMenuId);if(m)m.classList.remove('open');_openSubMenuId=null;}}

function toggleSubActive(id){
  const s=subs.find(s=>String(s.id)===String(id));
  if(s){s.active=!s.active;saveSubs();if(s.active)autoPostSubs();renderSubs();renderFinance();}
}

function renderSubs(){
  const panel=document.getElementById('ldrPanelSubs');if(!panel)return;
  // Update month nav labels
  const ml=document.getElementById('ldrMonLabel');
  if(ml)ml.textContent=`${vy}年 ${LDR_MONTHS[vm]}`;
  const firstDay=new Date(vy,vm,1),lastDay=new Date(vy,vm+1,0);
  const pEl=document.getElementById('ldrPeriod');
  if(pEl)pEl.textContent=`${vy}年${vm+1}月${firstDay.getDate()}日 〜 ${vy}年${vm+1}月${lastDay.getDate()}日`;

  const ym=`${vy}-${String(vm+1).padStart(2,'0')}`;
  const active=subs.filter(s=>s.active);
  const monthly=active.reduce((sum,s)=>sum+(s.cycle==='yearly'?s.price/12:s.price),0);
  // Progress
  const monthSubs=active.filter(s=>{if(!s.payDay)return false;if(s.cycle==='yearly')return(s.payMonth||1)===(vm+1);return true;});
  const paidSubs=monthSubs.filter(s=>txs.some(t=>String(t.subId)===String(s.id)&&t.subYm===ym));
  const M=monthSubs.length,N=paidSubs.length;
  const progPct=M>0?N/M*100:0;
  const todayStr=today();

  const rowsHtml=subs.map(s=>{
    const col=SUB_CAT_COLORS[s.category]||'#6b7280';
    const mPrice=s.cycle==='yearly'?Math.round(s.price/12):s.price;
    const isPaid=s.payDay?txs.some(t=>String(t.subId)===String(s.id)&&t.subYm===ym):false;
    let payDayLabel,checkHtml;
    if(!s.payDay){
      payDayLabel=`<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);cursor:pointer;" onclick="openLdrSubModal('${esc(String(s.id))}');event.stopPropagation()">＋ 支払日</span>`;
      checkHtml=`<span style="color:var(--mute);font-size:15px;opacity:0.4;min-width:22px;text-align:center;">○</span>`;
    } else {
      payDayLabel=`<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink3);">${s.cycle==='yearly'?`毎年 ${s.payMonth||1}月${s.payDay}日`:`毎月 ${s.payDay}日`}</span>`;
      const daysInMo=new Date(vy,vm+1,0).getDate();
      const actualDay=Math.min(s.payDay,daysInMo);
      const payDateStr=`${ym}-${String(actualDay).padStart(2,'0')}`;
      const isOverdue=!isPaid&&payDateStr<=todayStr&&s.active;
      if(isPaid){
        checkHtml=`<button style="width:22px;height:22px;border-radius:50%;background:var(--ok);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;" onclick="uncheckSubPayment('${esc(String(s.id))}','${esc(ym)}');event.stopPropagation()" title="チェックを外す"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>`;
      } else if(isOverdue){
        checkHtml=`<button style="padding:2px 6px;background:rgba(139,58,24,0.08);border:1px solid var(--accent);color:var(--accent);cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:10px;border-radius:3px;flex-shrink:0;white-space:nowrap;" onclick="checkSubPayment('${esc(String(s.id))}','${esc(ym)}');event.stopPropagation()" title="支払い済みにする">未払い</button>`;
      } else {
        checkHtml=`<button style="width:22px;height:22px;border-radius:50%;background:transparent;border:1.5px solid var(--mute);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;" onclick="checkSubPayment('${esc(String(s.id))}','${esc(ym)}');event.stopPropagation()" title="支払い済みにする"></button>`;
      }
    }
    const accName=s.accountId?_accName(s.accountId):'—';
    return`<div class="ldr-sub-row2 ${s.active?'':'inactive'}" onclick="openLdrSubModal('${esc(String(s.id))}')">
      <div class="sub-cdot" style="background:${col};flex-shrink:0;width:8px;height:8px;border-radius:50%;"></div>
      <div style="flex:1;min-width:0;font-family:'Space Grotesk',sans-serif;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.name)}</div>
      <div class="sub-cat-tag hide-mob">${esc(s.category)}</div>
      <div class="hide-mob" style="min-width:100px;">${payDayLabel}</div>
      <div class="hide-mob" style="font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--ink3);min-width:80px;">${esc(accName)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;min-width:72px;text-align:right;flex-shrink:0;">¥${fmt(mPrice)}</div>
      <div onclick="event.stopPropagation()" style="flex-shrink:0;">${checkHtml}</div>
      <button class="sub-toggle ${s.active?'on':'off'}" onclick="toggleSubActive('${esc(String(s.id))}');event.stopPropagation()" title="${s.active?'無効化':'有効化'}"></button>
      <div class="ldr-tx-more-wrap" onclick="event.stopPropagation()">
        <button class="ldr-tx-more" onclick="_openSubMenu(event,'${esc(String(s.id))}')" style="padding:2px 6px;">⋯</button>
        <div class="ldr-tx-menu" id="subMenu_${esc(String(s.id))}">
          <button onclick="openLdrSubModal('${esc(String(s.id))}');_closeSubMenus()">編集</button>
          <button onclick="confirmDelLdrSub('${esc(String(s.id))}');_closeSubMenus()">削除</button>
        </div>
      </div>
    </div>`;
  }).join('');

  panel.innerHTML=`<div style="padding:0 0 12px;">
  <div style="display:flex;align-items:flex-end;gap:16px;padding:14px 0 12px;border-bottom:1px solid rgba(26,24,20,0.12);flex-wrap:wrap;">
    <div>
      <div class="ldr-subs-total-label">月額合計（有効）</div>
      <div class="ldr-subs-total-num">¥${fmt(monthly)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink3);margin-top:3px;">${monthly>0?`年間 ¥${fmt(monthly*12)}`:''}</div>
    </div>
    ${M>0?`<div style="flex:1;min-width:160px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink3);margin-bottom:5px;">今月の支払い <strong style="color:var(--ink);">${N} / ${M} 件</strong></div>
      <div style="height:5px;background:rgba(26,24,20,0.1);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${progPct.toFixed(1)}%;background:${progPct>=100?'var(--ok)':'var(--warn)'};border-radius:3px;transition:width 0.3s;"></div></div>
    </div>`:''}
    <button class="btn btn-primary btn-sm" onclick="openLdrSubModal(null);event.stopPropagation()">＋ 追加</button>
  </div>
  ${subs.length?`<div style="display:flex;flex-direction:column;gap:0;">${rowsHtml}</div>`:'<div class="empty" style="padding:36px 20px"><div class="ei" style="font-size:1.6rem">💳</div><div>固定費・サブスクを追加してください</div></div>'}
</div>`;
}
