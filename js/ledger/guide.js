// ── guide panel ──
function restoreLdrGuide(){
  let open=true;
  try{const v=localStorage.getItem('ledger_guide_open');if(v!==null)open=v==='true';}catch(e){}
  if(!open)_ldrGuideSetState(false);
  renderGuidePanel();
}
function toggleLdrGuide(){
  const guide=document.getElementById('ldrGuide');
  const col=document.getElementById('ldrGuideCollapsed');
  const open=guide&&guide.style.display!=='none';
  _ldrGuideSetState(!open);
}
function _ldrGuideSetState(open){
  const guide=document.getElementById('ldrGuide');
  const col=document.getElementById('ldrGuideCollapsed');
  const toggle=document.getElementById('ldrGuideToggle');
  if(guide)guide.style.display=open?'':'none';
  if(col)col.style.display=open?'none':'flex';
  if(toggle)toggle.textContent=open?'∧':'∨';
  try{localStorage.setItem('ledger_guide_open',open);}catch(e){}
}

// ── open Ledger sub-tab by name ──
function _ldrOpenTab(name){
  const btn=document.querySelector('#ldrSubtabs .ui-seg-btn[onclick*="\''+name+'\'"]');
  if(btn)ldrTab(name,btn);
}

// ── getLastImportAt ──
function _daysSinceLocal(d){ // 日付（ローカル）の差で数える
  const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()), t=new Date(); t.setHours(0,0,0,0);
  return Math.round((t-a)/86400000);
}
function getLastImportAt(){
  // 1. prefer importedAt field
  let max=null;
  for(const t of txs){
    if(t.importedAt){const d=new Date(t.importedAt);if(!isNaN(d)&&(!max||d>max))max=d;}
  }
  if(max)return max;
  // 2. fallback: date of latest tx with importKey
  let maxDate=null;
  for(const t of txs){
    if(t.importKey&&t.date){const d=new Date(t.date+'T00:00:00');if(!isNaN(d)&&(!maxDate||d>maxDate))maxDate=d;}
  }
  return maxDate;
}

// ── onboarding status ──
function _getOnboardSkips(){
  try{const v=localStorage.getItem('ledger_onboard_skip');return Array.isArray(JSON.parse(v))?JSON.parse(v):[];}catch(e){return[];}
}
function _setOnboardSkip(idx,skip){
  let arr=_getOnboardSkips();
  if(skip){if(!arr.includes(idx))arr.push(idx);}
  else{arr=arr.filter(i=>i!==idx);}
  try{localStorage.setItem('ledger_onboard_skip',JSON.stringify(arr));}catch(e){}
  renderGuidePanel();renderLdrMobOnboard();
}
function _ldrOnboardSteps(){
  // Returns [{done, skipped, label, desc, hint, openTab, openTabLabel}]
  const skip=_getOnboardSkips();
  const activeAcc=accounts.filter(a=>!a.archived);
  const hasBank=activeAcc.some(a=>a.kind==='bank');
  const hasCard=activeAcc.some(a=>a.kind==='card');
  const step1done=hasBank&&hasCard;
  let step1hint='';
  if(activeAcc.length>0&&!(hasBank&&hasCard)){
    step1hint='あと: '+(hasBank?'カード':'銀行');
  }
  const step2done=txs.some(t=>t.importKey);
  const step3done=subs.some(s=>s.payDay!==undefined&&s.payDay!==null&&s.payDay!=='');
  const step4done=(budgets&&budgets.base&&(budgets.base.total!==null&&budgets.base.total!==undefined))||
    (budgets&&budgets.base&&budgets.base.cats&&Object.keys(budgets.base.cats).length>0);
  return[
    {done:step1done,skipped:skip.includes(0),hint:step1hint,
     title:'口座を登録する',
     desc:'銀行とカードを登録しましょう',
     openTab:'accounts',openTabLabel:'口座・残高を開く ›'},
    {done:step2done,skipped:skip.includes(1),
     title:'CSV を取り込む',
     desc:'先月分の CSV を取り込みましょう（引き落とし・ATM は振替に）',
     openTab:'import',openTabLabel:'インポートを開く ›'},
    {done:step3done,skipped:skip.includes(2),
     title:'固定費・サブスクを登録する',
     desc:'支払日を設定すると自動で記録されます',
     openTab:'subs',openTabLabel:'固定費を開く ›'},
    {done:step4done,skipped:skip.includes(3),
     title:'予算を決める',
     desc:'実績から提案ボタンで簡単に設定できます',
     openTab:'budget',openTabLabel:'予算を開く ›'},
  ];
}

// ── render guide panel ──
function renderGuidePanel(){
  const el=document.getElementById('ldrGuideContent');if(!el)return;
  const steps=_ldrOnboardSteps();
  const allDoneOrSkipped=steps.every(s=>s.done||s.skipped);
  const completedCount=steps.filter(s=>s.done||s.skipped).length;
  const pct=Math.round(completedCount/steps.length*100);
  let html='';

  if(!allDoneOrSkipped){
    // Show onboarding steps
    html+=`<div class="ldr-onboard-section-title">はじめの設定</div>`;
    html+=`<div class="ldr-onboard-progress"><div class="ldr-onboard-progress-label">${completedCount} / ${steps.length} 完了</div><div class="ldr-onboard-progress-bar"><div class="ldr-onboard-progress-fill" style="width:${pct}%"></div></div></div>`;
    steps.forEach((s,i)=>{
      const isDone=s.done||s.skipped;
      const badgeClass=s.done?'done':s.skipped?'skipped':'';
      const badgeText=s.done?'✓':s.skipped?'–':(i+1);
      const stepClass=s.done?'done':s.skipped?'skipped':'';
      const skipLabel=s.skipped?'戻す':'この手順は使わない';
      html+=`<div class="ldr-onboard-step ${stepClass}">
        <div class="ldr-onboard-step-hdr">
          <div class="ldr-onboard-step-badge ${badgeClass}">${badgeText}</div>
          <div>
            <div class="ldr-onboard-step-title">${esc(s.title)}</div>
            <div class="ldr-onboard-step-desc">${esc(s.desc)}</div>
            ${s.hint?`<div class="ldr-onboard-step-hint">${esc(s.hint)}</div>`:''}
          </div>
        </div>
        ${!isDone?`<div class="ldr-onboard-step-actions">
          <button class="ldr-onboard-open-btn" onclick="event.stopPropagation();_ldrOpenTab('${s.openTab}')">${esc(s.openTabLabel)}</button>
          <button class="ldr-onboard-skip-btn" onclick="event.stopPropagation();_setOnboardSkip(${i},true)">${skipLabel}</button>
        </div>`:`<div class="ldr-onboard-step-actions">
          ${s.skipped?`<button class="ldr-onboard-skip-btn" onclick="event.stopPropagation();_setOnboardSkip(${i},false)">戻す</button>`:''}
        </div>`}
      </div>`;
    });
  } else {
    // All complete - show collapsed onboarding row
    html+=`<div class="ldr-onboard-complete-row" onclick="event.stopPropagation();this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      はじめの設定 完了
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;margin-left:auto;color:var(--ink3);">▾</span>
    </div>
    <div style="display:none">`;
    steps.forEach((s,i)=>{
      const badgeText=s.done?'✓':'–';
      const badgeClass=s.done?'done':'skipped';
      html+=`<div class="ldr-onboard-step ${s.skipped?'skipped':'done'}" style="margin-bottom:6px;">
        <div class="ldr-onboard-step-hdr">
          <div class="ldr-onboard-step-badge ${badgeClass}">${badgeText}</div>
          <div>
            <div class="ldr-onboard-step-title">${esc(s.title)}</div>
            ${s.skipped?`<div class="ldr-onboard-step-actions"><button class="ldr-onboard-skip-btn" onclick="event.stopPropagation();_setOnboardSkip(${i},false)">戻す</button></div>`:''}
          </div>
        </div>
      </div>`;
    });
    html+=`</div>`;
    // Weekly tasks
    html+=_renderGuideWeekly();
  }
  // Tips box always shown
  html+=`<div class="ldr-tips-box" style="margin-top:10px">
    <div class="ldr-tips-hdr">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      運用のコツ
    </div>
    <div class="ldr-tips-item">週1回 CSV を取り込むだけでOK</div>
    <div class="ldr-tips-item">固定費はサブスクに登録しておく</div>
    <div class="ldr-tips-item">カテゴリは少なめにまとめると分析しやすい</div>
    <div class="ldr-tips-item">カードの引き落としは銀行→カードの振替で記録</div>
  </div>`;
  el.innerHTML=html;
}

function _renderGuideWeekly(){
  const now=new Date();
  const last=getLastImportAt();
  let weeklyHtml='';
  // Import info
  let importLine='';
  if(!last){
    importLine=`<div class="ldr-weekly-item"><span class="ldr-weekly-label">まだ取り込んでいません</span> <button class="ldr-weekly-btn" onclick="event.stopPropagation();_ldrOpenTab('import')">CSV を取り込む ›</button></div>`;
  } else {
    const diffDays=_daysSinceLocal(last);
    const lastDate=`${last.getMonth()+1}/${last.getDate()}`;
    if(diffDays>=7){
      importLine=`<div class="ldr-weekly-item"><span class="ldr-weekly-accent">取り込みから ${diffDays} 日たちました</span> <button class="ldr-weekly-btn" onclick="event.stopPropagation();_ldrOpenTab('import')">CSV を取り込む ›</button></div>`;
    } else {
      importLine=`<div class="ldr-weekly-item"><span class="ldr-weekly-label">最後の取り込み: ${diffDays}日前（${lastDate}）</span></div>`;
    }
  }
  // Uncategorized count
  const cy=now.getFullYear(),cm=now.getMonth();
  const uncatCount=txs.filter(t=>{
    if(t.type!=='expense')return false;
    if(!t.date)return false;
    const d=new Date(t.date+'T00:00:00');
    return d.getFullYear()===cy&&d.getMonth()===cm&&(t.category==='その他'||!t.category);
  }).length;
  let uncatLine='';
  if(uncatCount>0){
    uncatLine=`<div class="ldr-weekly-item"><span class="ldr-weekly-label">未分類（その他）が今月 <b>${uncatCount}</b> 件</span> <button class="ldr-weekly-btn" onclick="event.stopPropagation();ldrListCat='その他';_ldrOpenTab('txlist');setTimeout(()=>{const s=document.getElementById('ldrListCatSel');if(s){s.value='その他';renderLdrTxList();}},80)">取引一覧で確認 ›</button></div>`;
  }
  // Monthly review prompt
  const dom=now.getDate();
  const prevM=cm===0?11:cm-1;
  const prevMLabel=`${prevM+1}月`;
  let monthlyLine='';
  const reviewBtn=`<button class="ldr-weekly-btn" onclick="event.stopPropagation();_openReviewLastMonth()">振り返る ›</button>`;
  if(dom>=1&&dom<=7){
    monthlyLine=`<div class="ldr-weekly-item"><span class="ldr-weekly-label">先月（${prevMLabel}）の振り返りをしましょう</span> ${reviewBtn}</div>`;
  } else {
    monthlyLine=`<div class="ldr-weekly-item" style="opacity:0.6"><span class="ldr-weekly-label">月初に先月の振り返りをしましょう</span> ${reviewBtn}</div>`;
  }
  weeklyHtml=`<div class="ldr-weekly-card">
    <div class="ldr-weekly-title">今週の作業</div>
    ${importLine}${uncatLine}
  </div>
  <div class="ldr-weekly-card">
    <div class="ldr-weekly-title">今月の作業</div>
    ${monthlyLine}
  </div>`;
  return weeklyHtml;
}

function _openReviewLastMonth(){
  const now=new Date();
  let py=now.getFullYear(),pm=now.getMonth()-1;
  if(pm<0){pm=11;py--;}
  vy=py;vm=pm;
  const btn=document.querySelector('#ldrSubtabs .ui-seg-btn[onclick*="\'review\'"]');
  if(btn)ldrTab('review',btn);
}

// ── render mobile onboard ──
function renderLdrMobOnboard(){
  const el=document.getElementById('ldrMobOnboard');if(!el)return;
  const steps=_ldrOnboardSteps();
  const allDone=steps.every(s=>s.done||s.skipped);
  const completedCount=steps.filter(s=>s.done||s.skipped).length;
  const pct=Math.round(completedCount/steps.length*100);
  let inner='';
  if(!allDone){
    inner=`<div class="ldr-mob-onboard-card">
      <div class="ldr-mob-onboard-hdr" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.ldr-mob-onboard-toggle').textContent=b.style.display==='none'?'∨':'∧'">
        <span class="ldr-mob-onboard-hdr-title">はじめの設定 ${completedCount}/${steps.length}</span>
        <span class="ldr-mob-onboard-toggle">∨</span>
      </div>
      <div class="ldr-mob-onboard-body" style="display:none">
        <div class="ldr-onboard-progress-bar" style="margin-bottom:12px"><div class="ldr-onboard-progress-fill" style="width:${pct}%"></div></div>
        ${steps.map((s,i)=>{
          const isDone=s.done||s.skipped;
          const badge=s.done?'✓':s.skipped?'–':(i+1);
          const bCls=s.done?'done':s.skipped?'skipped':'';
          return `<div class="ldr-onboard-step ${s.done?'done':s.skipped?'skipped':''}" style="margin-bottom:8px">
            <div class="ldr-onboard-step-hdr">
              <div class="ldr-onboard-step-badge ${bCls}">${badge}</div>
              <div>
                <div class="ldr-onboard-step-title">${esc(s.title)}</div>
                ${s.hint?`<div class="ldr-onboard-step-hint">${esc(s.hint)}</div>`:''}
              </div>
            </div>
            ${!isDone?`<div class="ldr-onboard-step-actions">
              <button class="ldr-onboard-open-btn" onclick="event.stopPropagation();_ldrOpenTab('${s.openTab}')">${esc(s.openTabLabel)}</button>
              <button class="ldr-onboard-skip-btn" onclick="event.stopPropagation();_setOnboardSkip(${i},true)">この手順は使わない</button>
            </div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  } else {
    // Weekly / monthly tasks
    inner=`<div class="ldr-mob-onboard-card">
      <div class="ldr-mob-onboard-hdr" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.ldr-mob-onboard-toggle').textContent=b.style.display==='none'?'∨':'∧'">
        <span class="ldr-mob-onboard-hdr-title">やること</span>
        <span class="ldr-mob-onboard-toggle">∨</span>
      </div>
      <div class="ldr-mob-onboard-body" style="display:none">
        ${_renderGuideWeekly()}
      </div>
    </div>`;
  }
  el.innerHTML=inner;
}
