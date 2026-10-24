// ── BUDGET ──
function saveBudgets(){
  if(!budgets.base)budgets.base={total:null,cats:{}};
  if(!budgets.months)budgets.months={};
  localStorage.setItem('ledger_budgets',JSON.stringify(budgets));
  renderGuidePanel();renderLdrMobOnboard();
  saveToSupabase();
  renderHome();
}

function getEffBudget(y,m){
  if(!budgets)return{total:null,cats:{}};
  const ym=`${y}-${String(m+1).padStart(2,'0')}`;
  const mo=(budgets.months&&budgets.months[ym])||{};
  const base=budgets.base||{total:null,cats:{}};
  const total=mo.total!==undefined?mo.total:(base.total!==undefined?base.total:null);
  const cats={};
  const allCatKeys=new Set([...Object.keys(base.cats||{}),...Object.keys(mo.cats||{})]);
  allCatKeys.forEach(cat=>{
    const moVal=(mo.cats&&mo.cats[cat]!==undefined)?mo.cats[cat]:undefined;
    const baseVal=(base.cats&&base.cats[cat]!==undefined)?base.cats[cat]:null;
    cats[cat]=moVal!==undefined?moVal:baseVal;
  });
  return{total,cats};
}

function renderBudgetPanel(){
  const panel=document.getElementById('ldrPanelBudget');if(!panel)return;
  // Update month nav labels
  const ml=document.getElementById('ldrMonLabel');
  if(ml)ml.textContent=`${vy}年 ${LDR_MONTHS[vm]}`;
  const firstDay=new Date(vy,vm,1),lastDay=new Date(vy,vm+1,0);
  const pEl=document.getElementById('ldrPeriod');
  if(pEl)pEl.textContent=`${vy}年${vm+1}月${firstDay.getDate()}日 〜 ${vy}年${vm+1}月${lastDay.getDate()}日`;
  const ym=`${vy}-${String(vm+1).padStart(2,'0')}`;
  const expTxs=txs.filter(t=>{if(!t.date||t.type!=='expense')return false;const d=new Date(t.date);return d.getFullYear()===vy&&d.getMonth()===vm;});
  const totalExp=expTxs.reduce((s,t)=>s+t.amount,0);
  const eb=getEffBudget(vy,vm);
  const tb=eb.total;

  // Overall top card
  let topCardHtml;
  if(tb===null){
    topCardHtml=`<div class="ldr-bdg-top-label">${vy}年${vm+1}月の支出予算（全体）</div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;color:var(--ink3);margin:6px 0;">全体予算が未設定です</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink3);">実績: ¥${fmt(totalExp)}</div>`;
  } else {
    const pct=tb>0?totalExp/tb*100:0;
    const over=totalExp>tb;
    const remain=tb-totalExp;
    const barColor=over?'var(--accent)':pct>=80?'var(--warn)':'var(--ok)';
    topCardHtml=`<div class="ldr-bdg-top-label">${vy}年${vm+1}月の支出予算</div>
    <div class="ldr-bdg-top-vals ${over?'over':''}">¥${fmt(totalExp)} <span style="color:var(--ink3);font-size:14px;font-weight:400;">/ ¥${fmt(tb)}</span></div>
    <div class="ldr-bdg-progbar-wrap"><div class="ldr-bdg-progbar" style="width:${Math.min(pct,100).toFixed(1)}%;background:${barColor};"></div></div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;display:flex;gap:12px;flex-wrap:wrap;">
      <span style="${over?'color:var(--accent);font-weight:700':'color:var(--ink3)'}">${pct.toFixed(0)}%</span>
      <span style="color:${over?'var(--accent)':'var(--ok)'};">${over?'¥'+fmt(Math.abs(remain))+' 超過':'残り ¥'+fmt(remain)}</span>
    </div>`;
  }

  // Build category list: 'total' + expense categories from master + extra cats in txs
  const masterExpNames=getCategories('expense').map(c=>c.name);
  const masterExpSet=new Set(masterExpNames);
  const txCats=[...new Set(expTxs.map(t=>t.category).filter(c=>c&&!masterExpSet.has(c)))];
  const allCats=['total',...masterExpNames,...txCats];
  const catExpMap={total:totalExp};
  expTxs.forEach(t=>{catExpMap[t.category]=(catExpMap[t.category]||0)+t.amount;});

  const base=budgets.base||{total:null,cats:{}};
  const moData=(budgets.months&&budgets.months[ym])||{};

  function _baseBudGet(cat){return cat==='total'?(base.total!==null&&base.total!==undefined?base.total:null):(base.cats&&base.cats[cat]!==undefined?base.cats[cat]:null);}
  function _moBudGet(cat){return cat==='total'?(moData.total!==undefined?moData.total:null):(moData.cats&&moData.cats[cat]!==undefined?moData.cats[cat]:null);}
  function _effBud(cat){const mo=_moBudGet(cat);if(mo!==null)return mo;return _baseBudGet(cat);}

  const rowsHtml=allCats.map(cat=>{
    const catLabel=cat==='total'?'全体（合計）':cat;
    const color=cat==='total'?'var(--ink)':catColor(cat);
    const baseV=_baseBudGet(cat);
    const moV=_moBudGet(cat);
    const effV=_effBud(cat);
    const actV=catExpMap[cat]||0;
    const hasEff=effV!==null;
    const pct=hasEff&&effV>0?actV/effV*100:0;
    const over=hasEff&&actV>effV;
    const barColor=over?'var(--accent)':pct>=80?'var(--warn)':'var(--ok)';
    const baseCell=_bdgCellHtml(cat,'base',baseV,false);
    const moCell=_bdgCellHtml(cat,'month',moV,moV!==null);
    const progHtml=hasEff?`<div class="ldr-bdg-bar-wrap"><div class="ldr-bdg-bar-bg"><div class="ldr-bdg-bar-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${barColor};"></div></div><span class="ldr-bdg-pct ${over?'over':''}">${pct.toFixed(0)}%</span></div>`:`<span style="color:var(--mute);font-family:'JetBrains Mono',monospace;font-size:11px;">—</span>`;
    const expandId=`ldrBdgExp_${esc(cat)}`;
    const mobExpandHtml=`<tr class="ldr-bdg-row-expand" id="${expandId}" style="display:none;"><td colspan="3"><div class="ldr-bdg-expand-grid">
      <div class="ldr-bdg-expand-row"><span class="ldr-bdg-expand-label">毎月の予算</span>${baseCell}</div>
      <div class="ldr-bdg-expand-row"><span class="ldr-bdg-expand-label">この月だけ変更</span>${moCell}</div>
    </div></td></tr>`;
    return`<tr class="ldr-bdg-row${cat==='total'?' ldr-bdg-row-total':''}" onclick="ldrBdgToggleExpand('${esc(cat)}')">
      <td><div class="ldr-bdg-cat-cell"><div class="ldr-bdg-dot" style="background:${color};"></div><span class="ldr-bdg-cat-name">${esc(catLabel)}</span></div></td>
      <td class="hide-mob" style="text-align:right;" onclick="event.stopPropagation()">${baseCell}</td>
      <td class="hide-mob" style="text-align:right;" onclick="event.stopPropagation()">${moCell}</td>
      <td class="ldr-bdg-act" style="color:var(--ink);">¥${fmt(actV)}</td>
      <td class="ldr-bdg-prog-cell">${progHtml}</td>
    </tr>${mobExpandHtml}`;
  }).join('');

  panel.innerHTML=`
<div class="ui-card ldr-bdg-top-card">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <div style="flex:1">${topCardHtml}</div>
    <button class="btn btn-ghost btn-sm" style="flex-shrink:0;margin-top:4px" onclick="event.stopPropagation();openBudgetSuggest()">実績から提案</button>
  </div>
</div>
<div class="ui-card" style="overflow-x:auto;">
  <table class="ldr-bdg-table">
    <thead><tr>
      <th style="min-width:110px;">カテゴリ</th>
      <th class="r hide-mob" style="min-width:110px;">毎月の予算</th>
      <th class="r hide-mob" style="min-width:110px;">この月だけ変更</th>
      <th class="r" style="min-width:80px;">実績</th>
      <th style="min-width:120px;">進捗</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
<div class="ldr-bdg-foot">毎月の予算は毎月共通です。「この月だけ変更」に入れた金額はこの月にだけ使われます。実績は記録した支出の取引から計算しています（固定費・サブスクは含みません）。各金額をクリックすると編集できます。</div>`;
}

function _bdgCellHtml(cat,field,val,isOverride){
  const isUnset=val===null;
  const displayVal=isUnset?(field==='base'?'＋ 設定':'＋ 変更'):`¥${fmt(val)}`;
  const muteClass=isUnset?(field==='base'?'muted':'muted-mo'):'';
  const xBtn=isOverride?`<button class="ldr-bdg-override-x" onclick="event.stopPropagation();ldrBdgClear('${esc(cat)}','${field}')" title="この月の上書きを解除">×</button>`:'';
  return`<span class="ldr-bdg-amt ${muteClass} ${isOverride?'override':''}" tabindex="0" role="button" data-bdgcat="${esc(cat)}" data-bdgfield="${field}" onclick="event.stopPropagation();ldrBdgEdit('${esc(cat)}','${field}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();ldrBdgEdit('${esc(cat)}','${field}');}" title="クリックして編集">${displayVal}</span>${xBtn}`;
}

let _bdgEditCat=null,_bdgEditField=null;
function ldrBdgEdit(cat,field){
  if(_bdgEditCat!==null)ldrBdgCancel();
  _bdgEditCat=cat;_bdgEditField=field;
  const base=budgets.base||{total:null,cats:{}};
  const ym=`${vy}-${String(vm+1).padStart(2,'0')}`;
  const moData=(budgets.months&&budgets.months[ym])||{};
  let curVal;
  if(field==='base'){curVal=cat==='total'?(base.total!==null&&base.total!==undefined?String(base.total):''):(base.cats&&base.cats[cat]!==undefined?String(base.cats[cat]):'');}
  else{curVal=cat==='total'?(moData.total!==undefined&&moData.total!==null?String(moData.total):''):(moData.cats&&moData.cats[cat]!==undefined?String(moData.cats[cat]):'');}
  // Find all matching spans by data attributes and replace the first visible one with input
  const spans=[...document.querySelectorAll(`#ldrPanelBudget .ldr-bdg-amt[data-bdgcat="${esc(cat)}"][data-bdgfield="${field}"]`)];
  const targetSpan=spans.find(s=>s.offsetParent!==null)||spans[0];
  if(!targetSpan)return;
  const sz=Math.max(6,(curVal||'').length+2);
  targetSpan.outerHTML=`<div class="ldr-bdg-edit-wrap" onclick="event.stopPropagation()"><input class="ldr-bdg-edit-in" id="ldrBdgIn" type="number" min="0" size="${sz}" value="${esc(curVal)}" placeholder="金額" onkeydown="ldrBdgKey(event,'${esc(cat)}','${field}')" onblur="ldrBdgSave('${esc(cat)}','${field}')"></div>`;
  const inp=document.getElementById('ldrBdgIn');if(inp){inp.focus();inp.select();}
}

function ldrBdgKey(e,cat,field){
  if(e.key==='Enter'){e.preventDefault();ldrBdgSave(cat,field);}
  else if(e.key==='Escape'){e.preventDefault();ldrBdgCancel();}
}

function ldrBdgCancel(){_bdgEditCat=null;_bdgEditField=null;renderBudgetPanel();}

function ldrBdgSave(cat,field){
  if(_bdgEditCat!==cat||_bdgEditField!==field)return;
  _bdgEditCat=null;_bdgEditField=null;
  const inp=document.getElementById('ldrBdgIn');
  const raw=inp?inp.value.trim():'';
  const val=raw===''?null:(isNaN(Number(raw))?null:Number(raw));
  const ym=`${vy}-${String(vm+1).padStart(2,'0')}`;
  if(!budgets.base)budgets.base={total:null,cats:{}};
  if(!budgets.months)budgets.months={};
  if(field==='base'){
    if(cat==='total'){budgets.base.total=val;}
    else{if(val===null){delete budgets.base.cats[cat];}else{if(!budgets.base.cats)budgets.base.cats={};budgets.base.cats[cat]=val;}}
  } else {
    if(!budgets.months[ym])budgets.months[ym]={};
    if(cat==='total'){if(val===null){delete budgets.months[ym].total;}else{budgets.months[ym].total=val;}}
    else{if(!budgets.months[ym].cats)budgets.months[ym].cats={};if(val===null){delete budgets.months[ym].cats[cat];}else{budgets.months[ym].cats[cat]=val;}}
    // Clean up empty month entry
    if(budgets.months[ym]&&budgets.months[ym].total===undefined&&(!budgets.months[ym].cats||!Object.keys(budgets.months[ym].cats).length))delete budgets.months[ym];
  }
  saveBudgets();
  renderBudgetPanel();
}

function ldrBdgClear(cat,field){
  if(field!=='month')return;
  const ym=`${vy}-${String(vm+1).padStart(2,'0')}`;
  if(!budgets.months||!budgets.months[ym])return;
  if(cat==='total'){delete budgets.months[ym].total;}
  else if(budgets.months[ym].cats){delete budgets.months[ym].cats[cat];}
  // Clean up empty
  const mo=budgets.months[ym];
  if(mo&&mo.total===undefined&&(!mo.cats||!Object.keys(mo.cats).length))delete budgets.months[ym];
  saveBudgets();
  renderBudgetPanel();
}

function ldrBdgToggleExpand(cat){
  // Only meaningful on mobile (≤640px); on desktop stopPropagation handles it
  if(window.innerWidth>640)return;
  const id=`ldrBdgExp_${cat}`;
  const el=document.getElementById(id);
  if(!el)return;
  el.style.display=el.style.display==='none'?'table-row':'none';
}

// ── budget suggestion modal ──
function openBudgetSuggest(){
  // Find up to 3 months with expense data, going back from the month before vy/vm
  const months=[];
  for(let i=1;i<=6&&months.length<3;i++){
    let y=vy,m=vm-i;
    while(m<0){m+=12;y--;}
    const hasData=txs.some(t=>{if(!t.date||t.type!=='expense')return false;const d=new Date(t.date);return d.getFullYear()===y&&d.getMonth()===m;});
    if(hasData)months.push({y,m});
  }
  if(!months.length){
    uiAlert('提案するための実績がまだありません');return;
  }
  // Compute per-category averages
  const catTotals={};
  months.forEach(({y,m})=>{
    const exp=txs.filter(t=>t.type==='expense'&&t.date&&(()=>{const d=new Date(t.date);return d.getFullYear()===y&&d.getMonth()===m;})());
    exp.forEach(t=>{
      catTotals[t.category]=(catTotals[t.category]||0)+t.amount;
    });
  });
  const base=budgets&&budgets.base?budgets.base:{total:null,cats:{}};
  // Build rows
  const cats=Object.keys(catTotals).sort((a,b)=>catTotals[b]-catTotals[a]);
  const ceil1k=v=>Math.ceil(v/1000)*1000;
  const moLabel=months.map(({y,m})=>`${m+1}月`).join('・');
  const moCount=months.length;
  const rows=cats.map(c=>{
    const avg=catTotals[c]/months.length; // 支出がなかった月も 0 として平均する
    const suggest=ceil1k(avg);
    const curBudget=base.cats&&base.cats[c]!==undefined?base.cats[c]:null;
    const defaultCheck=curBudget===null||(suggest!==curBudget);
    return{cat:c,avg,suggest,curBudget,check:defaultCheck};
  });
  const totalAvg=rows.reduce((s,r)=>s+r.avg,0);
  const totalSuggest=ceil1k(totalAvg);
  const totalCurBudget=base.total!==null&&base.total!==undefined?base.total:null;
  const totalCheck=totalCurBudget===null||(totalSuggest!==totalCurBudget);

  let overlay=document.getElementById('ldrBdgSuggestOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='ldrBdgSuggestOverlay';
    overlay.className='ldr-modal-overlay';
    overlay.onclick=function(e){if(e.target===this)closeBudgetSuggest();};
    document.body.appendChild(overlay);
  }
  const rowsHtml=rows.map((r,i)=>`<tr>
    <td class="name" style="font-family:'Space Grotesk',sans-serif;font-size:13px;">${esc(r.cat)}</td>
    <td class="ldr-suggest-amt">¥${fmt(r.avg)}</td>
    <td style="text-align:right;"><input class="ldr-suggest-in" id="ldrSugIn_${i}" type="number" min="0" value="${r.suggest}" onclick="event.stopPropagation()" style="font-family:'JetBrains Mono',monospace;"></td>
    <td class="ldr-suggest-amt">${r.curBudget!==null?'¥'+fmt(r.curBudget):'—'}</td>
    <td style="text-align:center;"><input type="checkbox" id="ldrSugChk_${i}" ${r.check?'checked':''} onclick="event.stopPropagation()"></td>
  </tr>`).join('');

  overlay.innerHTML=`<div class="ldr-modal" onclick="event.stopPropagation()" style="max-width:640px">
    <div class="ldr-modal-hdr">
      <div class="ldr-modal-title">実績から提案</div>
      <button class="ldr-modal-close" onclick="closeBudgetSuggest()">✕</button>
    </div>
    <div class="ldr-modal-body" style="padding-bottom:0">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;color:var(--ink3);margin-bottom:10px;">直近${moCount}か月（${moLabel}）の平均から提案しています。</div>
      <div style="overflow-x:auto;">
        <table class="ldr-suggest-tbl">
          <thead><tr>
            <th style="min-width:80px;">カテゴリ</th>
            <th class="r" style="min-width:80px;">平均実績</th>
            <th class="r" style="min-width:90px;">提案額</th>
            <th class="r" style="min-width:80px;">今の予算</th>
            <th style="min-width:40px;text-align:center;">適用</th>
          </tr></thead>
          <tbody>
            ${rowsHtml}
            <tr style="border-top:2px solid rgba(26,24,20,0.15);font-weight:700">
              <td style="font-family:'Space Grotesk',sans-serif;font-size:13px;">全体合計</td>
              <td class="ldr-suggest-amt">¥${fmt(totalAvg)}</td>
              <td style="text-align:right;"><input class="ldr-suggest-in" id="ldrSugInTotal" type="number" min="0" value="${totalSuggest}" onclick="event.stopPropagation()" style="font-family:'JetBrains Mono',monospace;"></td>
              <td class="ldr-suggest-amt">${totalCurBudget!==null?'¥'+fmt(totalCurBudget):'—'}</td>
              <td style="text-align:center;"><input type="checkbox" id="ldrSugChkTotal" ${totalCheck?'checked':''} onclick="event.stopPropagation()"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="ldr-modal-ftr">
      <button class="btn btn-ghost btn-sm" onclick="closeBudgetSuggest()">キャンセル</button>
      <div class="ldr-modal-ftr-r">
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();_budgetSuggestApply(${JSON.stringify(rows.map((_,i)=>i))})">選んだ項目を毎月の予算にする</button>
      </div>
    </div>
  </div>`;
  overlay.classList.add('open');
}
function closeBudgetSuggest(){
  const o=document.getElementById('ldrBdgSuggestOverlay');if(o)o.classList.remove('open');
}
function _budgetSuggestApply(idxArr){
  if(!budgets.base)budgets.base={total:null,cats:{}};
  idxArr.forEach(i=>{
    const chk=document.getElementById('ldrSugChk_'+i);
    if(!chk||!chk.checked)return;
    const inp=document.getElementById('ldrSugIn_'+i);
    if(!inp)return;
    const val=Number(inp.value);
    if(isNaN(val)||val<0)return;
    // Get cat from table row: we need to find it. Use data approach
    const tbl=document.querySelector('#ldrBdgSuggestOverlay .ldr-suggest-tbl tbody tr:nth-child('+(i+1)+') td:first-child');
    const cat=tbl?tbl.textContent.trim():'';
    if(!cat)return;
    if(!budgets.base.cats)budgets.base.cats={};
    budgets.base.cats[cat]=val;
  });
  // Total
  const chkTotal=document.getElementById('ldrSugChkTotal');
  if(chkTotal&&chkTotal.checked){
    const inpTotal=document.getElementById('ldrSugInTotal');
    if(inpTotal){const val=Number(inpTotal.value);if(!isNaN(val)&&val>=0)budgets.base.total=val;}
  }
  saveBudgets();
  closeBudgetSuggest();
  renderBudgetPanel();
  renderGuidePanel();renderLdrMobOnboard();
}
