// ── ACCOUNTS ──
const ACC_KIND_LABELS={bank:'銀行',card:'カード',cash:'現金',emoney:'電子マネー'};
function _accKindSvg(kind,size){
  size=size||14;
  const s=`width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  if(kind==='bank')return`<svg ${s}><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`;
  if(kind==='card')return`<svg ${s}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
  if(kind==='cash')return`<svg ${s}><path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>`;
  if(kind==='emoney')return`<svg ${s}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
  return`<svg ${s}><circle cx="12" cy="12" r="9"/></svg>`;
}
function saveAccounts(){
  localStorage.setItem('ledger_accounts',JSON.stringify(accounts));
  saveToSupabase();
  renderHome();
  renderGuidePanel();renderLdrMobOnboard();
}
function accountBalance(acc,asOfDate){
  let bal=acc.openingBalance||0;
  txs.forEach(t=>{
    if(!t.date)return;
    if(t.date<acc.openingDate)return;
    if(asOfDate&&t.date>asOfDate)return;
    const aid=String(acc.id);
    if(t.type==='income'&&String(t.accountId)===aid)bal+=t.amount;
    else if(t.type==='expense'&&String(t.accountId)===aid)bal-=t.amount;
    else if(t.type==='transfer'){if(String(t.fromAccountId)===aid)bal-=t.amount;else if(String(t.toAccountId)===aid)bal+=t.amount;}
    else if(t.type==='adjust'&&String(t.accountId)===aid)bal+=t.amount;
  });
  return bal;
}
function _accAsOfDate(){
  const now=new Date();
  const isCurrentMonth=(vy===now.getFullYear()&&vm===now.getMonth());
  if(isCurrentMonth)return today();
  // Last day of the displayed month
  const last=new Date(vy,vm+1,0);
  return`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
}
function _accAsOfLabel(){
  const now=new Date();
  const isCurrentMonth=(vy===now.getFullYear()&&vm===now.getMonth());
  const last=new Date(vy,vm+1,0);
  if(isCurrentMonth)return`${vy}年${vm+1}月${now.getDate()}日時点`;
  return`${vy}年${vm+1}月末時点`;
}
function _ldrUpdateAccSel(){
  const sel=document.getElementById('ldrMonAccSel');if(!sel)return;
  // Validate stored filter
  if(ldrAccFilter!=='all'){const exists=accounts.find(a=>String(a.id)===ldrAccFilter&&!a.archived);if(!exists){ldrAccFilter='all';try{localStorage.setItem('ledger_acc_filter','all');}catch(e){}}}
  const opts=`<option value="all">すべての口座</option>${accounts.filter(a=>!a.archived).map(a=>`<option value="${esc(String(a.id))}">${esc(a.name)}</option>`).join('')}`;
  sel.innerHTML=opts;
  sel.value=ldrAccFilter;
}
function ldrSetAccFilter(val){
  ldrAccFilter=val;
  try{localStorage.setItem('ledger_acc_filter',val);}catch(e){}
  const t=_ldrActiveTab();
  if(t==='overview')renderFinance();
  else if(t==='txlist')renderLdrTxList();
  else if(t==='accounts')renderAccountsPanel();
}
// ── Accounts sub-tab panel ──
function renderAccountsPanel(){
  const panel=document.getElementById('ldrPanelAccounts');if(!panel)return;
  // Month nav labels
  const ml=document.getElementById('ldrMonLabel');
  if(ml)ml.textContent=`${vy}年 ${LDR_MONTHS[vm]}`;
  const firstDay=new Date(vy,vm,1),lastDay=new Date(vy,vm+1,0);
  const pEl=document.getElementById('ldrPeriod');
  if(pEl)pEl.textContent=`${vy}年${vm+1}月${firstDay.getDate()}日 〜 ${vy}年${vm+1}月${lastDay.getDate()}日`;
  _ldrUpdateAccSel();
  const asOf=_accAsOfDate();
  const asOfLabel=_accAsOfLabel();
  const activeAccounts=accounts.filter(a=>!a.archived).sort((a,b)=>(a.order||0)-(b.order||0));
  const archivedAccounts=accounts.filter(a=>a.archived);
  if(!activeAccounts.length&&!archivedAccounts.length){
    panel.innerHTML=`<div class="ldr-acc-empty ui-card" style="margin-bottom:12px;">
      <div class="ldr-acc-empty-text">口座を登録すると、残高と純資産が表示されます</div>
      <button class="btn btn-primary" onclick="openAccModal()">＋ 口座を追加</button>
    </div>`;
    return;
  }
  const net=activeAccounts.reduce((s,a)=>s+accountBalance(a,asOf),0);
  const assets=activeAccounts.filter(a=>accountBalance(a,asOf)>=0).reduce((s,a)=>s+accountBalance(a,asOf),0);
  const liabilities=activeAccounts.filter(a=>accountBalance(a,asOf)<0).reduce((s,a)=>s+Math.abs(accountBalance(a,asOf)),0);
  // Build active account rows
  const rowsHtml=activeAccounts.map(a=>{
    const bal=accountBalance(a,asOf);
    const balNeg=bal<0;
    // This month's flow
    const moTxs=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===vy&&d.getMonth()===vm;});
    const accId=String(a.id);
    const moIn=moTxs.filter(t=>(t.type==='income'&&String(t.accountId)===accId)||(t.type==='transfer'&&String(t.toAccountId)===accId)).reduce((s,t)=>s+(t.type==='income'?t.amount:t.amount),0);
    const moOut=moTxs.filter(t=>(t.type==='expense'&&String(t.accountId)===accId)||(t.type==='transfer'&&String(t.fromAccountId)===accId)).reduce((s,t)=>s+t.amount,0);
    const flowHtml=`<span style="color:var(--ok)">+¥${fmt(moIn)}</span> / <span style="color:var(--accent)">-¥${fmt(moOut)}</span>`;
    return`<tr class="ldr-acc-row">
      <td><div class="ldr-acc-icon-cell"><div class="ldr-acc-icon">${_accKindSvg(a.kind)}</div><span class="ldr-acc-name">${esc(a.name)}</span></div></td>
      <td><span class="ldr-acc-kind-tag">${esc(ACC_KIND_LABELS[a.kind]||a.kind)}</span></td>
      <td class="ldr-acc-bal ${balNeg?'neg':''}">${balNeg?'-':''}¥${fmt(Math.abs(bal))}</td>
      <td class="ldr-acc-flow hide-mob">${flowHtml}</td>
      <td style="width:36px;padding:4px;" onclick="event.stopPropagation()">
        <div class="ldr-acc-more-wrap">
          <button class="ldr-acc-more" onclick="toggleAccMenu(event,'${esc(String(a.id))}')">⋯</button>
          <div class="ldr-acc-menu" id="ldrAccMenu_${esc(String(a.id))}">
            <button onclick="openAccModal('${esc(String(a.id))}');closeAccMenus()">編集</button>
            <button onclick="openBalAdjModal('${esc(String(a.id))}');closeAccMenus()">残高を合わせる</button>
            <button onclick="archiveAcc('${esc(String(a.id))}');closeAccMenus()">非表示にする</button>
            <button class="danger" onclick="confirmDelAcc('${esc(String(a.id))}');closeAccMenus()">削除</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
  const archivedHtml=archivedAccounts.length?`<details style="margin-top:12px;">
    <summary class="ldr-acc-archived-hdr">非表示の口座（${archivedAccounts.length}）</summary>
    <table class="ldr-acc-table" style="margin-top:8px;"><tbody>${archivedAccounts.map(a=>{const bal=accountBalance(a,asOf);const balNeg=bal<0;return`<tr class="ldr-acc-row" style="opacity:0.6;"><td><div class="ldr-acc-icon-cell"><div class="ldr-acc-icon">${_accKindSvg(a.kind)}</div><span class="ldr-acc-name">${esc(a.name)}</span></div></td><td><span class="ldr-acc-kind-tag">${esc(ACC_KIND_LABELS[a.kind]||a.kind)}</span></td><td class="ldr-acc-bal ${balNeg?'neg':''}">${balNeg?'-':''}¥${fmt(Math.abs(bal))}</td><td></td><td style="width:36px;padding:4px;" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="unarchiveAcc('${esc(String(a.id))}')">再表示</button></td></tr>`;}).join('')}</tbody></table>
  </details>`:''
  panel.innerHTML=`
<div class="ldr-acc-summary-row">
  <div class="ui-card ldr-acc-net-card">
    <div class="ldr-acc-net-label">純資産合計</div>
    <div class="ldr-acc-net-date">${asOfLabel}</div>
    <div class="ldr-acc-net-val ${net<0?'neg':''}" style="${net<0?'color:var(--accent)':''}">${net<0?'-':''}¥${fmt(Math.abs(net))}</div>
  </div>
  <div class="ui-card ldr-acc-stat">
    <div class="ldr-acc-stat-label">資産（残高プラス）</div>
    <div class="ldr-acc-stat-val" style="color:var(--ok);">¥${fmt(assets)}</div>
  </div>
  <div class="ui-card ldr-acc-stat">
    <div class="ldr-acc-stat-label">負債（残高マイナス）</div>
    <div class="ldr-acc-stat-val" style="${liabilities>0?'color:var(--accent)':''};">¥${fmt(liabilities)}</div>
  </div>
</div>
<div class="ui-card" style="overflow-x:auto;margin-bottom:12px;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid rgba(26,24,20,0.08);">
    <span style="font-family:'Newsreader',serif;font-size:15px;font-weight:800;">口座一覧</span>
    <button class="btn btn-primary btn-sm" onclick="openAccModal()">＋ 口座を追加</button>
  </div>
  <table class="ldr-acc-table">
    <thead><tr>
      <th style="min-width:140px;">口座名</th>
      <th style="min-width:70px;">種類</th>
      <th class="r" style="min-width:100px;">残高</th>
      <th class="r hide-mob" style="min-width:130px;">今月の入出金</th>
      <th style="width:36px;"></th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  ${archivedHtml}
</div>`;
}
// ── Account modal ──
function openAccModal(accId){
  _ldrAccModalId=accId||null;
  const overlay=document.getElementById('ldrAccModal');if(!overlay)return;
  overlay.classList.add('open');
  const title=document.getElementById('ldrAccModalTitle');
  const saveBtn=document.getElementById('ldrAccSaveBtn');
  const delWrap=document.getElementById('ldrAccDelWrap');
  if(accId){
    const a=accounts.find(a=>String(a.id)===String(accId));if(!a)return;
    if(title)title.textContent='口座を編集';
    if(saveBtn)saveBtn.textContent='保存';
    document.getElementById('ldrAccName').value=a.name||'';
    document.getElementById('ldrAccKind').value=a.kind||'bank';
    document.getElementById('ldrAccOpening').value=a.openingBalance!==undefined?a.openingBalance:'';
    document.getElementById('ldrAccOpenDate').value=a.openingDate||today();
    if(delWrap)delWrap.innerHTML=`<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="confirmDelAccFromModal('${esc(String(accId))}')">削除</button>`;
  } else {
    if(title)title.textContent='口座を追加';
    if(saveBtn)saveBtn.textContent='追加';
    document.getElementById('ldrAccName').value='';
    document.getElementById('ldrAccKind').value='bank';
    document.getElementById('ldrAccOpening').value='0';
    document.getElementById('ldrAccOpenDate').value=today();
    if(delWrap)delWrap.innerHTML='';
  }
  document.addEventListener('keydown',_ldrAccEsc);
}
function _ldrAccEsc(e){if(e.key==='Escape')closeAccModal();}
function closeAccModal(){
  const overlay=document.getElementById('ldrAccModal');if(overlay)overlay.classList.remove('open');
  document.removeEventListener('keydown',_ldrAccEsc);
}
function saveAccModal(){
  const name=document.getElementById('ldrAccName').value.trim();
  if(!name){document.getElementById('ldrAccName').focus();return;}
  const kind=document.getElementById('ldrAccKind').value;
  const openingBalance=parseFloat(document.getElementById('ldrAccOpening').value)||0;
  const openingDate=document.getElementById('ldrAccOpenDate').value||today();
  if(_ldrAccModalId){
    const a=accounts.find(a=>String(a.id)===String(_ldrAccModalId));
    if(a){a.name=name;a.kind=kind;a.openingBalance=openingBalance;a.openingDate=openingDate;}
  } else {
    accounts.push({id:crypto.randomUUID(),name,kind,openingBalance,openingDate,archived:false,order:accounts.length});
  }
  saveAccounts();
  closeAccModal();
  ldrListInitDone=false;
  renderAccountsPanel();
  renderFinance();
}
function confirmDelAccFromModal(accId){
  const delWrap=document.getElementById('ldrAccDelWrap');if(!delWrap)return;
  const hasRef=txs.some(t=>String(t.accountId)===accId||String(t.fromAccountId)===accId||String(t.toAccountId)===accId);
  if(hasRef){
    delWrap.innerHTML=`<span class="ldr-del-confirm" style="font-size:10px;">この口座を参照する取引があります。削除する場合は取引の口座を変更してください。<br>「非表示にする」で一覧から隠せます。</span>`;
    return;
  }
  delWrap.innerHTML=`<span class="ldr-del-confirm">本当に削除しますか？</span><button class="btn btn-ghost btn-sm" onclick="_resetAccDelWrap('${esc(String(accId))}')">いいえ</button><button class="btn btn-sm" style="background:var(--accent);color:var(--paper);border:none;padding:5px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;" onclick="execDelAcc('${esc(String(accId))}')">削除</button>`;
}
function _resetAccDelWrap(accId){
  const delWrap=document.getElementById('ldrAccDelWrap');
  if(delWrap)delWrap.innerHTML=`<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="confirmDelAccFromModal('${esc(String(accId))}')">削除</button>`;
}
function execDelAcc(accId){
  accounts=accounts.filter(a=>String(a.id)!==String(accId));
  saveAccounts();
  closeAccModal();
  ldrListInitDone=false;
  renderAccountsPanel();
  renderFinance();
}
async function confirmDelAcc(accId){
  const hasRef=txs.some(t=>String(t.accountId)===accId||String(t.fromAccountId)===accId||String(t.toAccountId)===accId);
  if(hasRef){uiAlert('この口座を参照している取引があります。取引を削除または変更してから削除してください。「非表示にする」で一覧から隠すこともできます。');return;}
  if(await uiConfirm('この口座を削除しますか？',{title:'口座の削除',danger:true}))execDelAcc(accId);
}
function archiveAcc(accId){
  const a=accounts.find(a=>String(a.id)===String(accId));
  if(a){a.archived=true;saveAccounts();ldrListInitDone=false;renderAccountsPanel();renderFinance();}
}
function unarchiveAcc(accId){
  const a=accounts.find(a=>String(a.id)===String(accId));
  if(a){a.archived=false;saveAccounts();ldrListInitDone=false;renderAccountsPanel();renderFinance();}
}
// ── Account ... menus ──
function toggleAccMenu(e,id){
  e.stopPropagation();
  const menuId='ldrAccMenu_'+id;
  if(_ldrOpenAccMenuId&&_ldrOpenAccMenuId!==menuId){const old=document.getElementById(_ldrOpenAccMenuId);if(old)old.classList.remove('open');}
  const m=document.getElementById(menuId);
  if(m){m.classList.toggle('open');_ldrOpenAccMenuId=m.classList.contains('open')?menuId:null;}
}
function closeAccMenus(){
  if(_ldrOpenAccMenuId){const m=document.getElementById(_ldrOpenAccMenuId);if(m)m.classList.remove('open');_ldrOpenAccMenuId=null;}
}
// ── Balance adjust modal ──
function openBalAdjModal(accId){
  _ldrBalAdjAccId=accId;
  const a=accounts.find(a=>String(a.id)===String(accId));if(!a)return;
  const overlay=document.getElementById('ldrBalAdjModal');if(!overlay)return;
  overlay.classList.add('open');
  const asOf=today();
  const cur=accountBalance(a,asOf);
  const nameEl=document.getElementById('ldrBalAdjAccName');
  if(nameEl)nameEl.textContent=a.name;
  const curEl=document.getElementById('ldrBalAdjCurrent');
  if(curEl)curEl.textContent=(cur<0?'-':'')+'¥'+fmt(Math.abs(cur));
  const targetEl=document.getElementById('ldrBalAdjTarget');
  if(targetEl){targetEl.value='';targetEl.focus();}
  const diffEl=document.getElementById('ldrBalAdjDiffRow');
  if(diffEl)diffEl.textContent='';
  document.addEventListener('keydown',_ldrBalAdjEsc);
}
function _ldrBalAdjEsc(e){if(e.key==='Escape')closeBalAdjModal();}
function closeBalAdjModal(){
  const overlay=document.getElementById('ldrBalAdjModal');if(overlay)overlay.classList.remove('open');
  document.removeEventListener('keydown',_ldrBalAdjEsc);
}
function ldrBalAdjPreview(){
  const a=accounts.find(a=>String(a.id)===String(_ldrBalAdjAccId));if(!a)return;
  const cur=accountBalance(a,today());
  const targetVal=document.getElementById('ldrBalAdjTarget').value;
  const diffEl=document.getElementById('ldrBalAdjDiffRow');if(!diffEl)return;
  if(targetVal===''||targetVal===null){diffEl.textContent='';return;}
  const target=parseFloat(targetVal);
  if(isNaN(target)){diffEl.textContent='';return;}
  const diff=target-cur;
  if(diff===0){diffEl.textContent='差額なし（調整は記録されません）';return;}
  const sign=diff>0?'+':'-';
  diffEl.innerHTML=`差額: <strong style="color:${diff>0?'var(--ok)':'var(--accent)'};">${sign}¥${fmt(Math.abs(diff))}</strong> の調整取引が作成されます`;
}
function saveBalAdj(){
  const a=accounts.find(a=>String(a.id)===String(_ldrBalAdjAccId));if(!a)return;
  const cur=accountBalance(a,today());
  const targetVal=document.getElementById('ldrBalAdjTarget').value;
  if(targetVal===''||targetVal===null){document.getElementById('ldrBalAdjTarget').focus();return;}
  const target=parseFloat(targetVal);
  if(isNaN(target)){document.getElementById('ldrBalAdjTarget').focus();return;}
  const diff=target-cur;
  if(diff!==0){
    txs.push({id:crypto.randomUUID(),type:'adjust',title:'残高調整',amount:diff,accountId:String(a.id),date:today(),note:''});
    saveTx();
  }
  closeBalAdjModal();
  ldrListInitDone=false;
  renderAccountsPanel();
  renderFinance();
  renderLdrTxList();
}
