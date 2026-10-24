// ── add menu ──
function toggleLdrAddMenu(e){e.stopPropagation();const m=document.getElementById('ldrAddMenu');if(m)m.classList.toggle('open');}
function closeLdrAddMenu(){const m=document.getElementById('ldrAddMenu');if(m)m.classList.remove('open');}

// ── TX modal ──
function _populateTxCatSelect(kind, currentCat){
  const sel=document.getElementById('ldrTxCat');if(!sel)return;
  const cats=getCategories(kind);
  // If currentCat is hidden, include it too
  const extra=(currentCat&&!cats.some(c=>c.name===currentCat)&&getAllCategories().some(c=>c.name===currentCat))?[getAllCategories().find(c=>c.name===currentCat)]:[];
  sel.innerHTML=[...cats,...extra].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  if(currentCat)sel.value=currentCat;
  if(!sel.value&&cats.length)sel.value=cats[0].name;
}

function openTxModal(type,txId){
  closeLdrAddMenu();
  ldrTxModalType=type||'expense';
  ldrEditingTxId=txId||null;
  const overlay=document.getElementById('ldrTxModal');
  if(!overlay)return;
  overlay.classList.add('open');
  const title=document.getElementById('ldrTxModalTitle');
  const saveBtn=document.getElementById('ldrTxSaveBtn');
  const delWrap=document.getElementById('ldrTxDelWrap');
  // Populate account selects
  _populateTxAccSelects(txId?txs.find(t=>String(t.id)===String(txId)):null);
  if(txId){
    const tx=txs.find(t=>String(t.id)===String(txId));
    if(!tx)return;
    ldrTxModalType=tx.type;
    if(title)title.textContent='取引を編集';
    if(saveBtn)saveBtn.textContent='保存';
    document.getElementById('ldrTxDate').value=tx.date||today();
    document.getElementById('ldrTxAmt').value=tx.type==='adjust'?Math.abs(tx.amount):tx.amount||'';
    document.getElementById('ldrTxTitle').value=tx.title||'';
    _populateTxCatSelect(tx.type==='income'?'income':'expense',tx.category||'その他');
    document.getElementById('ldrTxNote').value=tx.note||'';
    // Restore account / from / to
    const accSel=document.getElementById('ldrTxAcc');
    const fromSel=document.getElementById('ldrTxFrom');
    const toSel=document.getElementById('ldrTxTo');
    if(tx.type==='transfer'){if(fromSel)fromSel.value=tx.fromAccountId||'';if(toSel)toSel.value=tx.toAccountId||'';}
    else{if(accSel)accSel.value=tx.accountId||'';}
    if(delWrap)delWrap.innerHTML=`<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="confirmDelTx('${esc(String(txId))}')">削除</button>`;
  } else {
    if(title)title.textContent='取引を追加';
    if(saveBtn)saveBtn.textContent='追加';
    document.getElementById('ldrTxDate').value=today();
    document.getElementById('ldrTxAmt').value='';
    document.getElementById('ldrTxTitle').value='';
    _populateTxCatSelect(ldrTxModalType==='income'?'income':'expense','その他');
    document.getElementById('ldrTxNote').value='';
    // Restore last used account
    try{const la=localStorage.getItem('ledger_last_account')||'';const accSel=document.getElementById('ldrTxAcc');if(accSel&&la)accSel.value=la;}catch(e){}
    if(delWrap)delWrap.innerHTML='';
  }
  _setLdrTxType(ldrTxModalType);
  setTimeout(()=>{const el=document.getElementById('ldrTxTitle');if(el)el.focus();},50);
  // Auto-suggest category on blur (new expense/income only)
  const titleInEl=document.getElementById('ldrTxTitle');
  if(titleInEl){
    titleInEl.onblur=function(){
      if(ldrEditingTxId)return;
      if(ldrTxModalType!=='expense'&&ldrTxModalType!=='income')return;
      const catEl=document.getElementById('ldrTxCat');
      if(!catEl||catEl.value!=='その他')return;
      const raw=titleInEl.value.trim();if(!raw)return;
      const srcKey=normTxName(raw,true);if(!srcKey)return;
      const rules=txRules.rules||[];
      for(const r of rules){
        if(!r.keyword)continue;
        if(srcKey.includes(r.keyword.toLowerCase())){
          if((r.type==='expense'||r.type==='income')&&r.category){catEl.value=r.category;}
          return;
        }
      }
      const matching=txs.filter(t=>{
        const ts=t.srcName?normTxName(t.srcName,true):normTxName(t.title,true);
        return ts===srcKey&&ts!==''&&(t.type==='expense'||t.type==='income');
      });
      if(matching.length){
        const ref=matching.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
        if(ref.category)catEl.value=ref.category;
        const accEl=document.getElementById('ldrTxAcc');
        if(accEl&&!accEl.value&&ref.accountId)accEl.value=String(ref.accountId);
      }
    };
  }
  document.addEventListener('keydown',_ldrTxEsc);
}
function _populateTxAccSelects(existingTx){
  const activeAcc=accounts.filter(a=>!a.archived);
  // If editing, also include archived accounts that are referenced
  const extraIds=new Set();
  if(existingTx){if(existingTx.accountId)extraIds.add(String(existingTx.accountId));if(existingTx.fromAccountId)extraIds.add(String(existingTx.fromAccountId));if(existingTx.toAccountId)extraIds.add(String(existingTx.toAccountId));}
  const allRelevant=[...activeAcc,...accounts.filter(a=>a.archived&&extraIds.has(String(a.id)))];
  const opts=`<option value="">口座未設定</option>${allRelevant.map(a=>`<option value="${esc(String(a.id))}">${esc(a.name)}</option>`).join('')}`;
  const accSel=document.getElementById('ldrTxAcc');if(accSel)accSel.innerHTML=opts;
  const opts2=`<option value="">選択してください</option>${allRelevant.map(a=>`<option value="${esc(String(a.id))}">${esc(a.name)}</option>`).join('')}`;
  const fromSel=document.getElementById('ldrTxFrom');if(fromSel)fromSel.innerHTML=opts2;
  const toSel=document.getElementById('ldrTxTo');if(toSel)toSel.innerHTML=opts2;
}
function _ldrTxEsc(e){if(e.key==='Escape')closeTxModal();}
function closeTxModal(){
  const overlay=document.getElementById('ldrTxModal');
  if(overlay)overlay.classList.remove('open');
  document.removeEventListener('keydown',_ldrTxEsc);
}
function setLdrTxType(type,el){
  ldrTxModalType=type;
  _setLdrTxType(type);
  // Re-populate category select for the new type
  if(type==='expense'||type==='income'){
    const catEl=document.getElementById('ldrTxCat');
    const currentCat=catEl?catEl.value:'';
    _populateTxCatSelect(type,currentCat);
  }
}
function _setLdrTxType(type){
  const expBtn=document.getElementById('ldrTxTypeExp');
  const incBtn=document.getElementById('ldrTxTypeInc');
  const trBtn=document.getElementById('ldrTxTypeTransfer');
  if(expBtn)expBtn.classList.toggle('active',type==='expense');
  if(incBtn)incBtn.classList.toggle('active',type==='income');
  if(trBtn)trBtn.classList.toggle('active',type==='transfer');
  // Show/hide rows based on type
  const isTransfer=type==='transfer';
  const isAdjust=type==='adjust';
  const catRow=document.getElementById('ldrTxCatRow');
  const accRow=document.getElementById('ldrTxAccRow');
  const fromRow=document.getElementById('ldrTxFromRow');
  const toRow=document.getElementById('ldrTxToRow');
  const titleRow=document.getElementById('ldrTxTitleRow');
  const typeRow=document.getElementById('ldrTxTypeRow');
  if(catRow)catRow.style.display=isTransfer?'none':'';
  if(accRow)accRow.style.display=isTransfer?'none':'';
  if(fromRow)fromRow.style.display=isTransfer?'':'none';
  if(toRow)toRow.style.display=isTransfer?'':'none';
  if(typeRow)typeRow.style.display=isAdjust?'none':'';
}
function saveTxModal(){
  const amount=parseFloat(document.getElementById('ldrTxAmt').value);
  if(isNaN(amount)||amount<=0){document.getElementById('ldrTxAmt').focus();return;}
  let txObj;
  if(ldrTxModalType==='transfer'){
    const fromId=document.getElementById('ldrTxFrom').value;
    const toId=document.getElementById('ldrTxTo').value;
    if(!fromId){document.getElementById('ldrTxFrom').focus();return;}
    if(!toId){document.getElementById('ldrTxTo').focus();return;}
    if(fromId===toId){uiAlert('出金元と入金先は異なる口座を選んでください');return;}
    const titleVal=document.getElementById('ldrTxTitle').value.trim()||'振替';
    txObj={type:'transfer',title:titleVal,amount,fromAccountId:fromId,toAccountId:toId,date:document.getElementById('ldrTxDate').value,note:document.getElementById('ldrTxNote').value.trim()};
  } else if(ldrTxModalType==='adjust'){
    // adjust type is saved with signed amount; editing existing adjust
    const titleVal=document.getElementById('ldrTxTitle').value.trim()||'残高調整';
    const existingTx=ldrEditingTxId?txs.find(t=>String(t.id)===String(ldrEditingTxId)):null;
    const sign=existingTx&&existingTx.amount<0?-1:1;
    txObj={type:'adjust',title:titleVal,amount:amount*sign,accountId:document.getElementById('ldrTxAcc').value||null,date:document.getElementById('ldrTxDate').value,note:document.getElementById('ldrTxNote').value.trim()};
  } else {
    const title=document.getElementById('ldrTxTitle').value.trim();
    if(!title){document.getElementById('ldrTxTitle').focus();return;}
    const accId=document.getElementById('ldrTxAcc').value||null;
    // Remember last used account
    try{if(accId)localStorage.setItem('ledger_last_account',accId);}catch(e){}
    txObj={type:ldrTxModalType,title,amount,category:document.getElementById('ldrTxCat').value,accountId:accId||undefined,date:document.getElementById('ldrTxDate').value,note:document.getElementById('ldrTxNote').value.trim()};
    if(!accId)delete txObj.accountId;
  }
  if(ldrEditingTxId){
    const idx=txs.findIndex(t=>String(t.id)===String(ldrEditingTxId));
    if(idx>=0){txs[idx]={...txs[idx],...txObj};}
  } else {
    txObj.id=crypto.randomUUID();
    txs.push(txObj);
  }
  saveTx();
  closeTxModal();
  renderFinance();
  ldrListInitDone=false;
  renderLdrTxList();
  const activeTab=_ldrActiveTab();
  if(activeTab==='accounts')renderAccountsPanel();
}
function confirmDelTx(id){
  const delWrap=document.getElementById('ldrTxDelWrap');
  if(!delWrap)return;
  delWrap.innerHTML=`<span class="ldr-del-confirm">本当に削除しますか？</span><button class="btn btn-ghost btn-sm" onclick="ldrTxDelWrap_cancel()">いいえ</button><button class="btn btn-sm" style="background:var(--accent);color:var(--paper);border:none;padding:5px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;" onclick="execDelTx('${esc(String(id))}')">削除</button>`;
}
function ldrTxDelWrap_cancel(){const w=document.getElementById('ldrTxDelWrap');if(w&&ldrEditingTxId)w.innerHTML=`<button class="btn btn-ghost btn-sm" style="border-color:var(--accent);color:var(--accent)" onclick="confirmDelTx('${esc(String(ldrEditingTxId))}')">削除</button>`;}
function execDelTx(id){
  const _dtx=txs.find(t=>String(t.id)===String(id));
  if(_dtx&&_dtx.subId&&_dtx.subYm){const _ds=subs.find(s=>String(s.id)===String(_dtx.subId));if(_ds){if(!_ds.skip)_ds.skip={};_ds.skip[_dtx.subYm]=true;saveSubs();}}
  txs=txs.filter(t=>String(t.id)!==String(id));saveTx();closeTxModal();renderFinance();ldrListInitDone=false;renderLdrTxList();if(_ldrActiveTab()==='accounts')renderAccountsPanel();if(_ldrActiveTab()==='subs')renderSubs();
}
function delTx(id){txs=txs.filter(t=>String(t.id)!==String(id));saveTx();renderFinance();ldrListInitDone=false;renderLdrTxList();}

// ── ... menu ──
function toggleTxMenu(e,id){
  e.stopPropagation();
  // 同じ取引が Overview と取引一覧の両方に描画されるので、ID ではなく押したボタンの隣のメニューを開く
  const btn=e.currentTarget;
  const m=btn&&btn.nextElementSibling;
  if(!m)return;
  const wasOpen=m.classList.contains('open');
  closeLdrTxMenus();
  if(wasOpen)return;
  m.classList.add('open');
  // カードの overflow で切れないよう、画面に固定して表示する
  const r=btn.getBoundingClientRect();
  m.style.position='fixed';
  m.style.right='auto';
  m.style.top=(r.bottom+4)+'px';
  m.style.left='0px';
  const mw=m.offsetWidth, mh=m.offsetHeight;
  let left=r.right-mw; if(left<8)left=8;
  let top=r.bottom+4; if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-4);
  m.style.left=left+'px'; m.style.top=top+'px';
  _ldrOpenMenuEl=m;
}
window.addEventListener('scroll',()=>{if(_ldrOpenMenuEl)closeLdrTxMenus();},{passive:true,capture:true});
async function confirmDelTxFromMenu(id){
  const t=txs.find(x=>String(x.id)===String(id)); if(!t)return;
  const label=`${t.date||''} ${t.title||''} ¥${fmt(t.amount||0)}`;
  if(await uiConfirm(`この取引を削除しますか？
${label}`,{title:'取引の削除',okLabel:'削除する',danger:true}))execDelTx(id);
}
function closeLdrTxMenus(){
  if(_ldrOpenMenuEl){_ldrOpenMenuEl.classList.remove('open');_ldrOpenMenuEl.style.position='';_ldrOpenMenuEl.style.top='';_ldrOpenMenuEl.style.left='';_ldrOpenMenuEl.style.right='';_ldrOpenMenuEl=null;}
}

// ── SVG mini charts ──
function miniBarSvg(values,color){
  const max=Math.max(...values,1);
  const h=28,barW=6,gap=2;
  const bars=values.map((v,i)=>{
    const bh=Math.max(2,Math.round((v/max)*h));
    const x=i*(barW+gap),y=h-bh;
    return`<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${color}" rx="1" opacity="0.85"/>`;
  }).join('');
  const w=values.length*(barW+gap)-gap;
  return`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars}</svg>`;
}
function miniLineSvg(values,color){
  if(values.length<2)return'';
  const max=Math.max(...values.map(Math.abs),1);
  const w=56,h=28;
  const pts=values.map((v,i)=>{
    const x=(i/(values.length-1))*w;
    const y=h/2-((v/max)*(h/2));
    return`${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function donutSvg(pct,color,size){
  size=size||44;const cx=size/2,cy=size/2,r=size*0.38,sw=size*0.14;
  const circ=2*Math.PI*r;
  const dash=Math.max(0,Math.min(pct,100))/100*circ;
  return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper3)" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/></svg>`;
}
function catDonutSvg(segments,totalAmt,size){
  size=size||110;if(!totalAmt||!segments.length)return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size*0.38}" fill="none" stroke="var(--paper3)" stroke-width="${size*0.14}"/></svg>`;
  const cx=size/2,cy=size/2,r=size*0.38;
  let angle=-Math.PI/2;
  const arcs=segments.map(s=>{
    const frac=s.amt/totalAmt;
    const sweep=frac*2*Math.PI;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    angle+=sweep;
    const x2=cx+r*Math.cos(angle),y2=cy+r*Math.sin(angle);
    const large=sweep>Math.PI?1:0;
    return`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="${(size*0.14).toFixed(1)}"/>`;
  }).join('');
  const cx2=size/2,cy2=size/2;
  const lbl=`<text x="${cx2}" y="${(cy2-4).toFixed(1)}" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-size="${(size*0.09).toFixed(0)}" fill="var(--ink3)">支出合計</text><text x="${cx2}" y="${(cy2+10).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="${(size*0.1).toFixed(0)}" font-weight="700" fill="var(--ink)">¥${fmt(totalAmt)}</text>`;
  return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}${lbl}</svg>`;
}

// ── get 6 months data ──
function _get6Mo(){
  const res=[];
  for(let i=5;i>=0;i--){
    let y=vy,m=vm-i;
    while(m<0){m+=12;y--;}
    while(m>11){m-=12;y++;}
    const mt=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===y&&d.getMonth()===m;});
    const inc=mt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=mt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    res.push({y,m,inc,exp,net:inc-exp});
  }
  return res;
}
function _prevMonthData(){
  let py=vy,pm=vm-1;if(pm<0){pm=11;py--;}
  const mt=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===py&&d.getMonth()===pm;});
  const inc=mt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=mt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  return{inc,exp,net:inc-exp};
}

// ── tx table row HTML ──
function _accName(id){if(!id)return'';const a=accounts.find(a=>String(a.id)===String(id));return a?a.name:'';}
function _txRowHtml(t,hideMobCols){
  const mobCls=hideMobCols?'hide-mob':'';
  const dateStr=t.date?fmtS(new Date(t.date+'T00:00:00')):'';
  let catHtml,amtHtml,accHtml,titleStr;
  if(t.type==='transfer'){
    catHtml=`<div class="ldr-tx-cat-cell"><div class="ldr-tx-cat-dot" style="background:#9ca3af"></div><span class="ldr-tx-cat-lbl">振替</span></div>`;
    amtHtml=`<td class="ldr-tx-amt" style="color:var(--ink);">¥${fmt(t.amount)}</td>`;
    const fn=_accName(t.fromAccountId),tn=_accName(t.toAccountId);
    accHtml=`<td class="${mobCls} ldr-tx-transfer-arrow">${fn?esc(fn):'?'} → ${tn?esc(tn):'?'}</td>`;
    titleStr=t.title||'振替';
  } else if(t.type==='adjust'){
    catHtml=`<div class="ldr-tx-cat-cell"><div class="ldr-tx-cat-dot" style="background:#9ca3af"></div><span class="ldr-tx-cat-lbl">残高調整</span></div>`;
    const sign=t.amount>=0?'+':'-';
    amtHtml=`<td class="ldr-tx-amt" style="color:var(--ink);">${sign}¥${fmt(Math.abs(t.amount))}</td>`;
    const an=_accName(t.accountId);
    accHtml=`<td class="${mobCls}">${an?`<span style="font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--ink3);">${esc(an)}</span>`:'<span style="color:var(--mute);">—</span>'}</td>`;
    titleStr=t.title||'残高調整';
  } else {
    const col=catColor(t.category);
    catHtml=`<div class="ldr-tx-cat-cell"><div class="ldr-tx-cat-dot" style="background:${col}"></div><span class="ldr-tx-cat-lbl">${esc(t.category||'')}</span></div>`;
    const sign=t.type==='income'?'+':'-';
    const amtCls=t.type==='income'?'inc':'exp';
    amtHtml=`<td class="ldr-tx-amt ${amtCls}">${sign}¥${fmt(t.amount)}</td>`;
    const an=_accName(t.accountId);
    accHtml=`<td class="${mobCls}">${an?`<span style="font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--ink3);">${esc(an)}</span>`:'<span style="color:var(--mute);">—</span>'}</td>`;
    titleStr=t.title||'';
  }
  return`<tr class="ldr-tx-row" onclick="openTxModal(null,'${esc(String(t.id))}')">
    <td class="ldr-tx-date">${esc(dateStr)}</td>
    <td class="ldr-tx-name">${esc(titleStr)}</td>
    <td class="${mobCls}">${catHtml}</td>
    ${accHtml}
    ${amtHtml}
    <td class="${mobCls} ldr-tx-memo">${esc(t.note||'')}</td>
    <td style="width:32px;padding:4px;" onclick="event.stopPropagation()">
      <div class="ldr-tx-more-wrap">
        <button class="ldr-tx-more" onclick="toggleTxMenu(event,'${esc(String(t.id))}')">⋯</button>
        <div class="ldr-tx-menu" id="ldrTxMenu_${esc(String(t.id))}">
          <button onclick="closeLdrTxMenus();openTxModal(null,'${esc(String(t.id))}')">編集</button>
          <button onclick="closeLdrTxMenus();confirmDelTxFromMenu('${esc(String(t.id))}')">削除</button>
        </div>
      </div>
    </td>
  </tr>`;
}

// ── render overview filter pills ──
function setLdrTxFilter(f,el){
  ldrTxFilter=f;
  document.querySelectorAll('#ldrTxFilterPills .ui-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  renderFinance();
}

// ── renderFinance (Overview) ──
function renderFinance(){
  // Month label + period
  const ml=document.getElementById('ldrMonLabel');
  if(ml)ml.textContent=`${vy}年 ${LDR_MONTHS[vm]}`;
  const firstDay=new Date(vy,vm,1),lastDay=new Date(vy,vm+1,0);
  const pEl=document.getElementById('ldrPeriod');
  if(pEl)pEl.textContent=`${vy}年${vm+1}月${firstDay.getDate()}日 〜 ${vy}年${vm+1}月${lastDay.getDate()}日`;
  // Account filter select update
  _ldrUpdateAccSel();
  // Current month txs (with account filter)
  const _moBase=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===vy&&d.getMonth()===vm;});
  const mt=ldrAccFilter==='all'?_moBase:_moBase.filter(t=>{
    if(t.type==='income'||t.type==='expense')return String(t.accountId)===ldrAccFilter;
    if(t.type==='transfer')return String(t.fromAccountId)===ldrAccFilter||String(t.toAccountId)===ldrAccFilter;
    if(t.type==='adjust')return String(t.accountId)===ldrAccFilter;
    return false;
  });
  const inc=mt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=mt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net=inc-exp;
  const rate=inc>0?((net/inc)*100):0;
  // Previous month
  const prev=_prevMonthData();
  const incDiff=inc-prev.inc,expDiff=exp-prev.exp,netDiff=net-prev.net,ratePrev=prev.inc>0?(prev.net/prev.inc*100):0;
  // 6 months
  const mo6=_get6Mo();
  const incVals=mo6.map(m=>m.inc),expVals=mo6.map(m=>m.exp),netVals=mo6.map(m=>m.net);
  // Subs
  const activeSubs=subs.filter(s=>s.active);
  const subMo=activeSubs.reduce((sum,s)=>sum+(s.cycle==='yearly'?s.price/12:s.price),0);
  const _ovYm=`${vy}-${String(vm+1).padStart(2,'0')}`;
  const _ovMonthSubs=activeSubs.filter(s=>{if(!s.payDay)return false;if(s.cycle==='yearly')return(s.payMonth||1)===(vm+1);return true;});
  const _ovPaidSubs=_ovMonthSubs.filter(s=>txs.some(t=>String(t.subId)===String(s.id)&&t.subYm===_ovYm));
  const _ovSubM=_ovMonthSubs.length,_ovSubN=_ovPaidSubs.length;
  const _ovSubProg=_ovSubM>0?_ovSubN/_ovSubM*100:0;
  // Category breakdown (expense only, account-filtered)
  const cats={};mt.filter(t=>t.type==='expense').forEach(t=>{cats[t.category]=(cats[t.category]||0)+t.amount;});
  const sortedCats=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([name,amt])=>({name,amt,color:catColor(name)}));
  // Recent txs (filtered by type pill)
  const filtered=ldrTxFilter==='all'?mt:ldrTxFilter==='unset_account'?mt.filter(t=>(t.type==='income'||t.type==='expense')&&!t.accountId):mt.filter(t=>t.type===ldrTxFilter);
  const recent=[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
  const panel=document.getElementById('ldrPanelOverview');
  if(!panel)return;
  const diffStr=(v)=>{if(!isFinite(v))return'';if(v===0)return'±¥0';return(v>0?'+':'')+(v<0?'-':'')+'¥'+fmt(Math.abs(v));};
  panel.innerHTML=`
<!-- Summary cards -->
<div class="ldr-summary-row">
  <div class="ui-card ldr-sum-card">
    <div class="ldr-sum-label">収入</div>
    <div class="ldr-sum-val inc">¥${fmt(inc)}</div>
    <div class="ldr-sum-diff">前月比 ${diffStr(incDiff)}</div>
    <div class="ldr-sum-chart">${miniBarSvg(incVals,'var(--ok)')}</div>
  </div>
  <div class="ui-card ldr-sum-card">
    <div class="ldr-sum-label">支出</div>
    <div class="ldr-sum-val exp">¥${fmt(exp)}</div>
    <div class="ldr-sum-diff">前月比 ${diffStr(expDiff)}</div>
    <div class="ldr-sum-chart">${miniBarSvg(expVals,'var(--accent)')}</div>
  </div>
  <div class="ui-card ldr-sum-card">
    <div class="ldr-sum-label">収支</div>
    <div class="ldr-sum-val ${net>=0?'pos':'neg'}">${net>=0?'+':''}¥${fmt(net)}</div>
    <div class="ldr-sum-diff">前月比 ${diffStr(netDiff)}</div>
    <div class="ldr-sum-chart">${miniLineSvg(netVals,net>=0?'var(--ok)':'var(--accent)')}</div>
  </div>
  <div class="ui-card ldr-sum-card">
    <div class="ldr-sum-label">貯蓄率</div>
    <div class="ldr-sum-val ${rate>=0?'pos':'neg'}">${rate.toFixed(1)}%</div>
    <div class="ldr-sum-diff">前月 ${ratePrev.toFixed(1)}%</div>
    <div class="ldr-sum-chart">${donutSvg(rate,'var(--ok)')}</div>
  </div>
  <div class="ui-card ldr-sum-card">
    <div class="ldr-sum-label">今月の予算進捗</div>
    ${(()=>{const eb=getEffBudget(vy,vm);const tb=eb.total;if(tb===null){return`<div style="font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--ink3);margin-top:6px;">予算が未設定です</div><button class="ldr-card-link" style="margin-top:6px;display:block;background:transparent;border:none;padding:0;cursor:pointer;" onclick="ldrTab('budget',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(5)'))">設定する ›</button>`;}const pct=tb>0?exp/tb*100:0;const over=exp>tb;const barColor=over?'var(--accent)':pct>=80?'var(--warn)':'var(--ok)';return`<div class="ldr-sum-val ${over?'neg':''}" style="font-size:14px;margin-top:4px;">¥${fmt(exp)} / ¥${fmt(tb)}</div><div class="ldr-bdg-progbar-wrap" style="margin:6px 0 3px;"><div class="ldr-bdg-progbar" style="width:${Math.min(pct,100).toFixed(1)}%;background:${barColor};"></div></div><div class="ldr-sum-diff ${over?'':''}"><span style="${over?'color:var(--accent);font-weight:700':''}">${pct.toFixed(0)}%${over?' 超過':''}</span></div>`;})()}
  </div>
</div>
<!-- Mid row: category / accounts / subs -->
<div class="ldr-mid-row">
  <div class="ui-card">
    <div class="ldr-card-hdr"><div class="ldr-card-title">カテゴリ別支出</div></div>
    <div class="ldr-card-body">
      ${sortedCats.length?`<div class="ldr-donut-wrap">
        ${catDonutSvg(sortedCats,exp)}
        <div class="ldr-cat-list">${sortedCats.slice(0,6).map(c=>`<div class="ldr-cat-row"><div class="ldr-cat-dot" style="background:${c.color}"></div><div class="ldr-cat-name">${esc(c.name)}</div><div class="ldr-cat-amt">¥${fmt(c.amt)}</div><div class="ldr-cat-pct">${(c.amt/exp*100).toFixed(0)}%</div></div>`).join('')}</div>
      </div>`:'<div style="text-align:center;padding:24px 0;color:var(--mute);font-family:\'JetBrains Mono\',monospace;font-size:12px;">支出がありません</div>'}
    </div>
  </div>
  <div class="ui-card">
    <div class="ldr-card-hdr">
      <div class="ldr-card-title">口座・残高</div>
      <button class="ldr-card-link" onclick="ldrTab('accounts',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(3)'))">詳細を見る ›</button>
    </div>
    <div class="ldr-card-body" style="padding:8px 14px 14px;">
      ${(()=>{
        const activeAccounts=accounts.filter(a=>!a.archived).sort((a,b)=>(a.order||0)-(b.order||0));
        if(!activeAccounts.length)return`<div style="text-align:center;padding:16px 0;font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--mute);">口座が登録されていません</div><button class="ldr-card-link" style="font-size:11px;background:transparent;border:none;cursor:pointer;padding:0;color:var(--accent);display:block;margin-top:4px;" onclick="ldrTab('accounts',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(3)'));setTimeout(()=>openAccModal(),50)">口座を登録する ›</button>`;
        const asOf=_accAsOfDate();
        const rows=activeAccounts.map(a=>{
          const bal=accountBalance(a,asOf);
          const balNeg=bal<0;
          return`<div class="ldr-acc-ov-row" onclick="ldrTab('accounts',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(3)'))">
            <div class="ldr-acc-ov-icon">${_accKindSvg(a.kind,12)}</div>
            <div class="ldr-acc-ov-name">${esc(a.name)}</div>
            <div class="ldr-acc-ov-bal ${balNeg?'neg':''}">${balNeg?'-':''}¥${fmt(Math.abs(bal))}</div>
            <div class="ldr-acc-ov-chevron">›</div>
          </div>`;
        }).join('');
        const net=activeAccounts.reduce((s,a)=>s+accountBalance(a,asOf),0);
        return`${rows}<div class="ldr-acc-net-total-row"><span class="ldr-acc-net-total-label">純資産合計</span><span class="ldr-acc-net-total-val ${net<0?'neg':''}" style="${net<0?'color:var(--accent)':''}">${net<0?'-':''}¥${fmt(Math.abs(net))}</span></div>`;
      })()}
    </div>
  </div>
  <div class="ui-card">
    <div class="ldr-card-hdr">
      <div class="ldr-card-title">固定費・サブスク</div>
      <button class="ldr-card-link" onclick="ldrTab('subs',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(4)'))">管理 ›</button>
    </div>
    <div class="ldr-card-body">
      <div class="ldr-sub-total-num">¥${fmt(subMo)}</div>
      <div class="ldr-sub-annual">${subMo>0?`年間 ¥${fmt(subMo*12)}`:''}</div>
      ${_ovSubM>0?`<div style="margin:8px 0 4px;"><div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink3);margin-bottom:4px;">今月の支払い <strong style="color:var(--ink);">${_ovSubN} / ${_ovSubM} 件</strong></div><div style="height:4px;background:rgba(26,24,20,0.1);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${_ovSubProg.toFixed(1)}%;background:${_ovSubProg>=100?'var(--ok)':'var(--warn)'};border-radius:2px;transition:width 0.3s;"></div></div></div>`:''}
      <div class="ldr-sub-rows">${activeSubs.slice(0,5).map(s=>{const col=SUB_CAT_COLORS[s.category]||'#6b7280';const mp=s.cycle==='yearly'?Math.round(s.price/12):s.price;const isPaid=txs.some(t=>String(t.subId)===String(s.id)&&t.subYm===_ovYm);const pdLabel=s.payDay?(s.cycle==='yearly'?`${s.payMonth||1}/${s.payDay}`:`毎月${s.payDay}日`):'';return`<div class="ldr-sub-row"><div class="ldr-sub-dot" style="background:${col}"></div><div class="ldr-sub-name">${esc(s.name)}</div><div class="ldr-sub-cat">${esc(s.category)}</div>${s.payDay?`<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink3);">${pdLabel}</div><div style="font-size:12px;color:${isPaid?'var(--ok)':'var(--mute)'};">${isPaid?'✓':'○'}</div>`:''}<div class="ldr-sub-price">¥${fmt(mp)}</div></div>`;}).join('')}${!activeSubs.length?'<div style="font-family:\'Space Grotesk\',sans-serif;font-size:12px;color:var(--mute);">サブスクがありません</div>':''}</div>
      <button class="ldr-card-link" style="font-size:11px;background:transparent;border:none;cursor:pointer;padding:0;color:var(--accent);display:block;margin-top:8px;" onclick="ldrTab('subs',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(4)'))">すべて見る ›</button>
    </div>
  </div>
</div>
<!-- Bottom row: recent txs + budget placeholder -->
<div class="ldr-bot-row">
  <div class="ui-card">
    <div class="ldr-card-hdr">
      <div class="ldr-card-title">最近の取引</div>
      <button class="ldr-card-link" onclick="ldrTab('txlist',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(2)'))">取引一覧を見る ›</button>
    </div>
    <div class="ldr-card-body" style="padding:8px 14px 14px;">
      <div id="ldrTxFilterPills" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <button class="ui-pill ${ldrTxFilter==='all'?'active':''}" onclick="setLdrTxFilter('all',this)">すべて</button>
        <button class="ui-pill ${ldrTxFilter==='income'?'active':''}" onclick="setLdrTxFilter('income',this)">収入</button>
        <button class="ui-pill ${ldrTxFilter==='expense'?'active':''}" onclick="setLdrTxFilter('expense',this)">支出</button>
        <button class="ui-pill ${ldrTxFilter==='transfer'?'active':''}" onclick="setLdrTxFilter('transfer',this)">振替</button>
        ${(()=>{const n=mt.filter(t=>(t.type==='income'||t.type==='expense')&&!t.accountId).length;return`<button class="ui-pill ${ldrTxFilter==='unset_account'?'active':''}" onclick="setLdrTxFilter('unset_account',this)" style="${n===0?'opacity:0.55':''}">口座未設定 <span style="font-family:'JetBrains Mono',monospace;font-size:9px;background:rgba(26,24,20,0.12);padding:0 4px;border-radius:3px;${n===0?'opacity:0.5':''}">${n}</span></button>`;})()}
      </div>
      ${recent.length?`<table class="ldr-tx-table"><thead class="ldr-tx-thead"><tr><th>日付</th><th>内容</th><th class="hide-mob">カテゴリ</th><th class="hide-mob">口座</th><th class="r">金額</th><th class="hide-mob">メモ</th><th></th></tr></thead><tbody>${recent.map(t=>_txRowHtml(t,true)).join('')}</tbody></table>`:'<div style="text-align:center;padding:24px;color:var(--mute);font-family:\'JetBrains Mono\',monospace;font-size:12px;">取引がありません</div>'}
    </div>
  </div>
  <div class="ui-card">
    <div class="ldr-card-hdr">
      <div class="ldr-card-title">今月の予算</div>
      <button class="ldr-card-link" onclick="ldrTab('budget',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(5)'))">予算設定 ›</button>
    </div>
    <div class="ldr-card-body" style="padding:8px 14px 14px;">
      ${(()=>{
        const eb=getEffBudget(vy,vm);
        const catExpMap={};mt.filter(t=>t.type==='expense').forEach(t=>{catExpMap[t.category]=(catExpMap[t.category]||0)+t.amount;});
        const catEntries=Object.entries(eb.cats).filter(([c,v])=>v!==null&&v!==undefined);
        if(!catEntries.length)return`<div style="font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--mute);padding:12px 0;">カテゴリの予算が未設定です</div><button class="ldr-card-link" style="font-size:11px;background:transparent;border:none;cursor:pointer;padding:0;color:var(--accent);" onclick="ldrTab('budget',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(5)'))">カテゴリ予算を設定する ›</button>`;
        const rows=catEntries.map(([cat,bud])=>{const act=catExpMap[cat]||0;const pct=bud>0?act/bud*100:0;const over=act>bud;const col=catColor(cat);const barColor=over?'var(--accent)':pct>=80?'var(--warn)':'var(--ok)';return{cat,bud,act,pct,over,col,barColor};}).sort((a,b)=>b.pct-a.pct);
        return`<table class="ldr-tx-table"><thead><tr><th>カテゴリ</th><th class="r">予算</th><th class="r">実績</th><th>進捗</th></tr></thead><tbody>${rows.map(r=>`<tr><td><div style="display:flex;align-items:center;gap:5px;"><div style="width:7px;height:7px;border-radius:50%;background:${r.col};flex-shrink:0;"></div><span style="font-family:'Space Grotesk',sans-serif;font-size:12px;">${esc(r.cat)}</span></div></td><td class="ldr-tx-amt" style="color:var(--ink3);font-size:12px;">¥${fmt(r.bud)}</td><td class="ldr-tx-amt ${r.over?'exp':''}" style="font-size:12px;">¥${fmt(r.act)}</td><td style="min-width:90px;"><div style="display:flex;align-items:center;gap:4px;"><div style="flex:1;height:4px;background:rgba(26,24,20,0.1);border-radius:2px;overflow:hidden;min-width:40px;"><div style="height:100%;width:${Math.min(r.pct,100).toFixed(1)}%;background:${r.barColor};border-radius:2px;"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:10px;${r.over?'color:var(--accent);font-weight:700;':'color:var(--ink3);'}width:32px;text-align:right;flex-shrink:0;">${r.pct.toFixed(0)}%</span></div></td></tr>`).join('')}</tbody></table>`;
      })()}
    </div>
  </div>
</div>`;
  // Update guide panel with latest data
  renderGuidePanel();
  renderLdrMobOnboard();
}

// ── renderReviewPanel ──
function renderReviewPanel(){
  const panel=document.getElementById('ldrPanelReview');if(!panel)return;
  // Update month nav
  const ml=document.getElementById('ldrMonLabel');
  if(ml)ml.textContent=`${vy}年 ${LDR_MONTHS[vm]}`;
  const firstDay=new Date(vy,vm,1),lastDay=new Date(vy,vm+1,0);
  const pEl=document.getElementById('ldrPeriod');
  if(pEl)pEl.textContent=`${vy}年${vm+1}月${firstDay.getDate()}日 〜 ${vy}年${vm+1}月${lastDay.getDate()}日`;

  const moTxs=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===vy&&d.getMonth()===vm;});
  const inc=moTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=moTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net=inc-exp;
  const rate=inc>0?((net/inc)*100):0;

  let py=vy,pm=vm-1;if(pm<0){pm=11;py--;}
  const prevTxs=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===py&&d.getMonth()===pm;});
  const prevInc=prevTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const prevExp=prevTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const prevNet=prevInc-prevExp;
  const prevRate=prevInc>0?((prevNet/prevInc)*100):0;

  function diffStr(v){if(!isFinite(v)||v===0)return'±0';return(v>0?'+':'')+(v<0?'-':'')+'¥'+fmt(Math.abs(v));}
  function diffPct(v){if(!isFinite(v))return'';return(v>0?'+':'')+v.toFixed(1)+'%';}

  // 1. Summary
  const sumHtml=`<div class="ldr-review-sum-row">
    <div class="ui-card ldr-review-sum-card">
      <div class="ldr-review-sum-label">収入</div>
      <div class="ldr-review-sum-val inc">¥${fmt(inc)}</div>
      <div class="ldr-review-sum-diff">前月比 ${diffStr(inc-prevInc)}</div>
    </div>
    <div class="ui-card ldr-review-sum-card">
      <div class="ldr-review-sum-label">支出</div>
      <div class="ldr-review-sum-val exp">¥${fmt(exp)}</div>
      <div class="ldr-review-sum-diff">前月比 ${diffStr(exp-prevExp)}</div>
    </div>
    <div class="ui-card ldr-review-sum-card">
      <div class="ldr-review-sum-label">収支</div>
      <div class="ldr-review-sum-val ${net>=0?'pos':'neg'}">${net>=0?'+':''}¥${fmt(Math.abs(net))}</div>
      <div class="ldr-review-sum-diff">前月比 ${diffStr(net-prevNet)}</div>
    </div>
    <div class="ui-card ldr-review-sum-card">
      <div class="ldr-review-sum-label">貯蓄率</div>
      <div class="ldr-review-sum-val ${rate>=0?'pos':'neg'}">${rate.toFixed(1)}%</div>
      <div class="ldr-review-sum-diff">前月 ${prevRate.toFixed(1)}%</div>
    </div>
  </div>`;

  // 2. Budget vs actual
  const eb=getEffBudget(vy,vm);
  const catExpMap={};moTxs.filter(t=>t.type==='expense').forEach(t=>{catExpMap[t.category]=(catExpMap[t.category]||0)+t.amount;});
  const allBudCats=[...new Set([...Object.keys(eb.cats),...Object.keys(catExpMap)])];
  // Sort: over budget first, then by actual amount
  const budRows=allBudCats.map(cat=>{
    const bud=eb.cats[cat];
    const act=catExpMap[cat]||0;
    const hasB=bud!==null&&bud!==undefined;
    const over=hasB&&act>bud;
    const warn=hasB&&!over&&act/bud>=0.8;
    return{cat,bud,act,hasB,over,warn};
  }).sort((a,b)=>{
    if(a.over!==b.over)return a.over?-1:1;
    return b.act-a.act;
  });
  // Also show overall budget
  const budRowsHtml=budRows.map(r=>{
    const pct=r.hasB&&r.bud>0?r.act/r.bud*100:null;
    const overAmt=r.hasB?r.act-r.bud:null;
    const barColor=r.over?'var(--accent)':r.warn?'var(--warn)':'var(--ok)';
    const dot=catColor(r.cat);
    return`<tr>
      <td class="name"><div style="display:flex;align-items:center;gap:5px;"><div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0"></div>${esc(r.cat)}</div></td>
      <td class="r">${r.hasB?'¥'+fmt(r.bud):'—'}</td>
      <td class="r ${r.over?'ldr-review-over':r.warn?'ldr-review-warn':''}">¥${fmt(r.act)}</td>
      <td class="r">${r.hasB&&pct!==null?`<div style="display:flex;align-items:center;gap:5px;"><div style="flex:1;min-width:40px;height:4px;background:rgba(26,24,20,0.1);border-radius:2px;overflow:hidden"><div style="height:100%;width:${Math.min(pct,100).toFixed(1)}%;background:${barColor};border-radius:2px"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:11px;${r.over?'color:var(--accent);font-weight:700':''}">${pct.toFixed(0)}%${r.over?' <span class="ldr-review-over">¥'+fmt(overAmt)+' 超過</span>':''}</span></div>`:'—'}</td>
    </tr>`;
  }).join('');
  const overallBudHtml=(eb.total!==null&&eb.total!==undefined)?`<tr style="border-top:2px solid rgba(26,24,20,0.15);font-weight:700">
    <td class="name">合計</td><td class="r">¥${fmt(eb.total)}</td>
    <td class="r ${exp>eb.total?'ldr-review-over':''}">¥${fmt(exp)}</td>
    <td class="r">${exp>eb.total?`<span class="ldr-review-over">¥${fmt(exp-eb.total)} 超過</span>`:(eb.total>0?`${(exp/eb.total*100).toFixed(0)}%`:'—')}</td>
  </tr>`:'';
  const budSection=`<div class="ui-card" style="overflow-x:auto"><table class="ldr-review-table">
    <thead><tr><th style="min-width:80px;">カテゴリ</th><th class="r" style="min-width:80px;">予算</th><th class="r" style="min-width:80px;">実績</th><th style="min-width:120px;">進捗</th></tr></thead>
    <tbody>${budRowsHtml}${overallBudHtml}</tbody>
  </table></div>`;

  // 3. Category MoM diff
  const prevCatMap={};prevTxs.filter(t=>t.type==='expense').forEach(t=>{prevCatMap[t.category]=(prevCatMap[t.category]||0)+t.amount;});
  const momCats=[...new Set([...Object.keys(catExpMap),...Object.keys(prevCatMap)])];
  const momRows=momCats.map(c=>({cat:c,cur:catExpMap[c]||0,prev:prevCatMap[c]||0,diff:(catExpMap[c]||0)-(prevCatMap[c]||0)}))
    .sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));
  const momHtml=momRows.length?`<div class="ui-card" style="overflow-x:auto"><table class="ldr-review-table">
    <thead><tr><th style="min-width:80px;">カテゴリ</th><th class="r hide-mob" style="min-width:80px;">今月</th><th class="r hide-mob" style="min-width:80px;">前月</th><th class="r" style="min-width:80px;">差額</th></tr></thead>
    <tbody>${momRows.map(r=>{
      const isUp=r.diff>0;const col=isUp?'ldr-review-up':'ldr-review-down';const arrow=isUp?'▲':'▼';
      const dot=catColor(r.cat);
      return`<tr><td class="name"><div style="display:flex;align-items:center;gap:5px;"><div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0"></div>${esc(r.cat)}</div></td>
        <td class="r hide-mob">¥${fmt(r.cur)}</td>
        <td class="r hide-mob">¥${fmt(r.prev)}</td>
        <td class="r ${col}">${arrow} ¥${fmt(Math.abs(r.diff))}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`:`<div style="padding:16px;font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--mute);">前月データなし</div>`;

  // 4. Top merchants (top 5)
  const merchantMap={};
  moTxs.filter(t=>t.type==='expense').forEach(t=>{
    const key=t.srcName||t.title||'不明';
    if(!merchantMap[key])merchantMap[key]={amt:0,count:0};
    merchantMap[key].amt+=t.amount;merchantMap[key].count++;
  });
  const top5=Object.entries(merchantMap).sort((a,b)=>b[1].amt-a[1].amt).slice(0,5);
  const merchantHtml=top5.length?`<div class="ui-card" style="overflow-x:auto"><table class="ldr-review-table">
    <thead><tr><th style="min-width:120px;">お店</th><th class="r" style="min-width:80px;">合計</th><th class="r" style="min-width:50px;">回数</th></tr></thead>
    <tbody>${top5.map(([name,{amt,count}])=>`<tr><td class="name">${esc(name)}</td><td class="r">¥${fmt(amt)}</td><td class="r">${count}</td></tr>`).join('')}</tbody>
  </table></div>`:`<div style="padding:16px;font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--mute);">支出データなし</div>`;

  // 5. Subs (subId を持つ取引)
  const subTxs=moTxs.filter(t=>t.subId);
  const subTotal=subTxs.reduce((s,t)=>s+t.amount,0);
  const subsHtml=subTxs.length?`<div class="ui-card" style="padding:14px 16px">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink3);letter-spacing:0.1em;text-transform:uppercase;font-weight:600;margin-bottom:6px">この月の固定費合計</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;margin-bottom:8px">¥${fmt(subTotal)}</div>
    <table class="ldr-review-table"><tbody>${subTxs.map(t=>`<tr><td class="name">${esc(t.title||'')}</td><td class="r">¥${fmt(t.amount)}</td></tr>`).join('')}</tbody></table>
  </div>`:`<div style="padding:16px;font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--mute);">この月の固定費なし</div>`;

  panel.innerHTML=`
<div class="ldr-review-section">${sumHtml}</div>
<div class="ldr-review-section"><div class="ldr-review-section-title">予算と実績</div>${budSection}</div>
<div class="ldr-review-section"><div class="ldr-review-section-title">カテゴリ別の前月比</div>${momHtml}</div>
<div class="ldr-review-section"><div class="ldr-review-section-title">支出の多いお店 トップ5</div>${merchantHtml}</div>
<div class="ldr-review-section"><div class="ldr-review-section-title">固定費</div>${subsHtml}</div>
`;
}

// ── renderLdrTxList ──
let ldrListInitDone=false;
let ldrListAccFilter='all';
function renderLdrTxList(){
  const panel=document.getElementById('ldrPanelTxlist');if(!panel)return;
  // Compute _moBase first so it can be used in init HTML
  const _moBase=txs.filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===vy&&d.getMonth()===vm;});
  const _unsetN=_moBase.filter(t=>(t.type==='income'||t.type==='expense')&&!t.accountId).length;
  if(!ldrListInitDone){
    ldrListInitDone=true;
    const accOpts=`<option value="all">すべての口座</option><option value="__unset__">口座未設定</option>${accounts.filter(a=>!a.archived).map(a=>`<option value="${esc(String(a.id))}">${esc(a.name)}</option>`).join('')}`;
    panel.innerHTML=`<div class="ldr-txlist-toolbar">
      <input class="ldr-txlist-search" id="ldrListSearch" type="text" placeholder="内容・メモで検索…" oninput="ldrListSearch=this.value;renderLdrTxList()" value="${esc(ldrListSearch)}">
      <div id="ldrListPills" style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="ui-pill ${ldrListFilter==='all'?'active':''}" onclick="setLdrListFilter('all',this)">すべて</button>
        <button class="ui-pill ${ldrListFilter==='income'?'active':''}" onclick="setLdrListFilter('income',this)">収入</button>
        <button class="ui-pill ${ldrListFilter==='expense'?'active':''}" onclick="setLdrListFilter('expense',this)">支出</button>
        <button class="ui-pill ${ldrListFilter==='transfer'?'active':''}" onclick="setLdrListFilter('transfer',this)">振替</button>
        <button class="ui-pill ${ldrListAccFilter==='__unset__'?'active':''}" id="ldrListUnsetPill" onclick="ldrListSetUnset()" style="${_unsetN===0?'opacity:0.55':''}">口座未設定 <span id="ldrListUnsetBadge" style="font-family:'JetBrains Mono',monospace;font-size:9px;background:rgba(26,24,20,0.12);padding:0 4px;border-radius:3px;">${_unsetN}</span></button>
      </div>
      <select class="ldr-txlist-cat-sel" id="ldrListCatSel" onchange="ldrListCat=this.value;renderLdrTxList()" onclick="event.stopPropagation()">
        <option value="all">すべてのカテゴリ</option>
        ${getAllCategories().map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
      </select>
      <select class="ldr-txlist-cat-sel" id="ldrListAccSel" onchange="ldrListAccFilter=this.value;renderLdrTxList()" onclick="event.stopPropagation()">${accOpts}</select>
    </div>
    <div class="ldr-txlist-summary" id="ldrListSummary"></div>
    <div class="ui-card" style="overflow:auto;"><table class="ldr-tx-table" id="ldrListTable"><thead><tr><th>日付</th><th>内容</th><th class="hide-mob">カテゴリ</th><th class="hide-mob">口座</th><th class="r">金額</th><th class="hide-mob">メモ</th><th></th></tr></thead><tbody id="ldrListTbody"></tbody></table></div>`;
  }
  // Update unset badge count (when month changes without full reinit)
  const _unsetBadge=document.getElementById('ldrListUnsetBadge');const _unsetPill=document.getElementById('ldrListUnsetPill');
  if(_unsetBadge)_unsetBadge.textContent=_unsetN;
  if(_unsetPill){_unsetPill.classList.toggle('active',ldrListAccFilter==='__unset__');_unsetPill.style.opacity=_unsetN===0?'0.55':'';}
  // filter
  let filtered=_moBase;
  if(ldrListFilter!=='all')filtered=filtered.filter(t=>t.type===ldrListFilter);
  if(ldrListCat!=='all')filtered=filtered.filter(t=>t.category===ldrListCat);
  if(ldrListAccFilter!=='all'){
    if(ldrListAccFilter==='__unset__')filtered=filtered.filter(t=>(t.type==='income'||t.type==='expense')&&!t.accountId);
    else filtered=filtered.filter(t=>{
      if(t.type==='income'||t.type==='expense')return String(t.accountId)===ldrListAccFilter;
      if(t.type==='transfer')return String(t.fromAccountId)===ldrListAccFilter||String(t.toAccountId)===ldrListAccFilter;
      if(t.type==='adjust')return String(t.accountId)===ldrListAccFilter;
      return false;
    });
  }
  if(ldrListSearch){const q=ldrListSearch.toLowerCase();filtered=filtered.filter(t=>(t.title||'').toLowerCase().includes(q)||(t.note||'').toLowerCase().includes(q));}
  const sorted=[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const totInc=filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totExp=filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const sumEl=document.getElementById('ldrListSummary');
  if(sumEl)sumEl.innerHTML=`<strong>${sorted.length}</strong> 件　収入 <strong style="color:var(--ok)">+¥${fmt(totInc)}</strong>　支出 <strong style="color:var(--accent)">-¥${fmt(totExp)}</strong>`;
  const tbody=document.getElementById('ldrListTbody');
  if(tbody)tbody.innerHTML=sorted.length?sorted.map(t=>_txRowHtml(t,false)).join(''):`<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--mute);font-family:'JetBrains Mono',monospace;font-size:12px;">取引がありません</td></tr>`;
  // update pills active state
  document.querySelectorAll('#ldrListPills .ui-pill').forEach(p=>{
    const f=p.getAttribute('onclick').match(/setLdrListFilter\('(\w+)'/)?.[1];
    if(f)p.classList.toggle('active',f===ldrListFilter);
  });
  // update cat sel + acc sel
  const catSel=document.getElementById('ldrListCatSel');if(catSel)catSel.value=ldrListCat;
  const accSel=document.getElementById('ldrListAccSel');if(accSel)accSel.value=ldrListAccFilter;
}
function setLdrListFilter(f,el){
  ldrListFilter=f;
  renderLdrTxList();
}
function ldrListSetUnset(){
  ldrListAccFilter=ldrListAccFilter==='__unset__'?'all':'__unset__';
  renderLdrTxList();
}
