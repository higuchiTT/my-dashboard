// ── SETTINGS ──
let _catEditId=null; // id of category being name-edited
let _catPaletteId=null; // id of category whose palette is open

const CAT_PALETTE=['#f97316','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ef4444','#ec4899',
  '#06b6d4','#84cc16','#14b8a6','#a78bfa','#fb923c','#92400e','#0e7490','#5a6b3a','#059669',
  '#6b7280','#1d4ed8','#be185d','#047857'];

function renderLdrSettings(){
  const p=document.getElementById('ldrPanelSettings');if(!p)return;
  const cats=txRules.categories||[];
  const expCats=cats.filter(c=>c.kind==='expense').sort((a,b)=>(a.order||0)-(b.order||0));
  const incCats=cats.filter(c=>c.kind==='income').sort((a,b)=>(a.order||0)-(b.order||0));

  function _countUsage(name){
    return txs.filter(t=>t.category===name).length;
  }

  function _catRowHtml(c,idx,total){
    const isOther=c.name==='その他';
    const count=_countUsage(c.name);
    const swatchStyle=`background:${esc(c.color)};`;
    const nameCell=_catEditId===String(c.id)
      ?`<input class="ldr-cat-name-in" id="catNameIn_${esc(String(c.id))}" value="${esc(c.name)}" style="width:${Math.max(60,c.name.length*9+16)}px;" onclick="event.stopPropagation()" onfocus="event.stopPropagation()" onkeydown="event.stopPropagation();_catNameKey(event,'${esc(String(c.id))}')" onblur="event.stopPropagation();_catNameSave('${esc(String(c.id))}')">`
      :`<span class="ldr-cat-name-text" onclick="event.stopPropagation();${isOther?'':` _catStartEdit('${esc(String(c.id))}')`}">${esc(c.name)}</span>`;
    const paletteHtml=`<div class="ldr-cat-palette${_catPaletteId===String(c.id)?' open':''}" id="catPal_${esc(String(c.id))}" onclick="event.stopPropagation()">
      <div class="ldr-cat-palette-grid">${CAT_PALETTE.map(col=>`<div class="ldr-cat-palette-swatch" style="background:${esc(col)};" onclick="event.stopPropagation();_catSetColor('${esc(String(c.id))}','${esc(col)}')"></div>`).join('')}</div>
    </div>`;
    const visBtn=`<button class="ldr-cat-vis-btn" onclick="event.stopPropagation();_catToggleHidden('${esc(String(c.id))}')">${c.hidden?'表示':'非表示'}</button>`;
    const delBtn=isOther?'':`<button class="ldr-cat-del-btn" onclick="event.stopPropagation();_catDelete('${esc(String(c.id))}')" title="削除">✕</button>`;
    const upDis=idx===0;
    const downDis=idx===total-1;
    const upClick=upDis?'':` _catMoveUp('${esc(String(c.id))}')`;
    const downClick=downDis?'':` _catMoveDown('${esc(String(c.id))}')`;
    const moveHtml=`<div class="ldr-cat-move-btns"><button class="ldr-cat-move-btn" onclick="event.stopPropagation();${upClick}" ${upDis?'disabled':''} title="上へ">▲</button><button class="ldr-cat-move-btn" onclick="event.stopPropagation();${downClick}" ${downDis?'disabled':''} title="下へ">▼</button></div>`;
    return`<tr class="ldr-cat-tr${c.hidden?' hidden-cat':''}" id="catRow_${esc(String(c.id))}" draggable="true" ondragstart="event.stopPropagation();_catDragStart(event,'${esc(String(c.id))}')" ondragover="event.stopPropagation();_catDragOver(event,'${esc(String(c.id))}')" ondrop="event.stopPropagation();_catDrop(event,'${esc(String(c.id))}')" ondragleave="event.stopPropagation();_catDragLeave(event)">
      <td onclick="event.stopPropagation()"><span class="ldr-cat-handle">⠿</span></td>
      <td onclick="event.stopPropagation()">${moveHtml}</td>
      <td onclick="event.stopPropagation()" style="position:relative;">${paletteHtml}<button class="ldr-cat-swatch-btn" style="${swatchStyle}" onclick="event.stopPropagation();_catTogglePalette('${esc(String(c.id))}')" title="色を変更"></button></td>
      <td class="ldr-cat-name-cell" onclick="event.stopPropagation()">${nameCell}</td>
      <td class="ldr-cat-count r" onclick="event.stopPropagation()">${count}</td>
      <td onclick="event.stopPropagation()">${visBtn}</td>
      <td onclick="event.stopPropagation()">${delBtn}</td>
    </tr>`;
  }

  const expTable=`<table class="ldr-cat-table"><thead><tr><th style="width:28px;"></th><th style="width:40px;"></th><th style="width:32px;">色</th><th>名前</th><th class="r hide-mob" style="min-width:50px;">件数</th><th style="min-width:60px;"></th><th style="width:32px;"></th></tr></thead><tbody>${expCats.map((c,i)=>_catRowHtml(c,i,expCats.length)).join('')}</tbody></table>
    <div class="ldr-cat-add-row"><input class="ldr-cat-add-in" id="catAddExpIn" placeholder="カテゴリ名" onclick="event.stopPropagation()" onkeydown="event.stopPropagation();if(event.key==='Enter'){event.preventDefault();_catAdd('expense');}"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();_catAdd('expense')">＋ 追加</button></div>`;
  const incTable=`<table class="ldr-cat-table"><thead><tr><th style="width:28px;"></th><th style="width:40px;"></th><th style="width:32px;">色</th><th>名前</th><th class="r hide-mob" style="min-width:50px;">件数</th><th style="min-width:60px;"></th><th style="width:32px;"></th></tr></thead><tbody>${incCats.map((c,i)=>_catRowHtml(c,i,incCats.length)).join('')}</tbody></table>
    <div class="ldr-cat-add-row"><input class="ldr-cat-add-in" id="catAddIncIn" placeholder="カテゴリ名" onclick="event.stopPropagation()" onkeydown="event.stopPropagation();if(event.key==='Enter'){event.preventDefault();_catAdd('income');}"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();_catAdd('income')">＋ 追加</button></div>`;

  p.innerHTML=`<div style="padding:20px;max-width:780px;">
    <div class="ldr-settings-section ui-card" style="padding:16px 18px;">
      <div class="ldr-settings-title">カテゴリ</div>
      <div class="ldr-cat-kind-label">支出</div>${expTable}
      <div class="ldr-cat-kind-label" style="margin-top:18px;">収入</div>${incTable}
    </div>
    <div class="ldr-settings-section ui-card" style="padding:16px 18px;margin-top:14px;">
      ${_renderImportRulesSection()}
    </div>
  </div>`;
  // Re-attach palette close handler
  setTimeout(()=>{
    document.querySelectorAll('.ldr-cat-name-in').forEach(el=>{if(el.id&&el.id.startsWith('catNameIn_'))el.focus&&el.focus();});
  },10);
}

function _catRenderRefresh(){
  if(!txRules.categories)return;
  _catEditId=null; // reset edit state on save
  saveTxRules();
  renderLdrSettings();
}

// ── drag and drop for categories ──
let _catDragSrcId=null;
function _catDragStart(e,id){_catDragSrcId=id;e.dataTransfer.effectAllowed='move';}
function _catDragOver(e,id){e.preventDefault();e.dataTransfer.dropEffect='move';const row=document.getElementById('catRow_'+id);if(row)row.classList.add('ldr-cat-drag-over');}
function _catDragLeave(e){document.querySelectorAll('.ldr-cat-drag-over').forEach(r=>r.classList.remove('ldr-cat-drag-over'));}
// ── ▲▼ ボタンによる順序移動 ──
function _catMoveUp(id){
  const cats=txRules.categories;
  const c=cats&&cats.find(x=>String(x.id)===String(id));
  if(!c)return;
  const sameKind=cats.filter(x=>x.kind===c.kind).sort((a,b)=>(a.order||0)-(b.order||0));
  const idx=sameKind.findIndex(x=>String(x.id)===String(id));
  if(idx<=0)return;
  sameKind.splice(idx-1,0,sameKind.splice(idx,1)[0]);
  sameKind.forEach((x,i)=>x.order=i);
  _catRenderRefresh();
}
function _catMoveDown(id){
  const cats=txRules.categories;
  const c=cats&&cats.find(x=>String(x.id)===String(id));
  if(!c)return;
  const sameKind=cats.filter(x=>x.kind===c.kind).sort((a,b)=>(a.order||0)-(b.order||0));
  const idx=sameKind.findIndex(x=>String(x.id)===String(id));
  if(idx<0||idx>=sameKind.length-1)return;
  sameKind.splice(idx+1,0,sameKind.splice(idx,1)[0]);
  sameKind.forEach((x,i)=>x.order=i);
  _catRenderRefresh();
}
function _catDrop(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.ldr-cat-drag-over').forEach(r=>r.classList.remove('ldr-cat-drag-over'));
  if(!_catDragSrcId||_catDragSrcId===targetId)return;
  const cats=txRules.categories;
  const srcIdx=cats.findIndex(c=>String(c.id)===_catDragSrcId);
  const tgtIdx=cats.findIndex(c=>String(c.id)===targetId);
  if(srcIdx<0||tgtIdx<0)return;
  // Only reorder within same kind
  if(cats[srcIdx].kind!==cats[tgtIdx].kind)return;
  // Re-assign orders
  const sameKind=cats.filter(c=>c.kind===cats[srcIdx].kind).sort((a,b)=>(a.order||0)-(b.order||0));
  const srcPos=sameKind.findIndex(c=>String(c.id)===_catDragSrcId);
  const tgtPos=sameKind.findIndex(c=>String(c.id)===targetId);
  sameKind.splice(tgtPos,0,sameKind.splice(srcPos,1)[0]);
  sameKind.forEach((c,i)=>c.order=i);
  _catDragSrcId=null;
  _catRenderRefresh();
}

// ── palette ──
function _catTogglePalette(id){
  _catPaletteId=(_catPaletteId===String(id))?null:String(id);
  renderLdrSettings();
}
function _catSetColor(id,color){
  const c=txRules.categories&&txRules.categories.find(x=>String(x.id)===String(id));
  if(!c)return;
  c.color=color;
  _catPaletteId=null;
  _catRenderRefresh();
}

// ── name edit ──
function _catStartEdit(id){
  _catEditId=String(id);
  _catPaletteId=null;
  renderLdrSettings();
  setTimeout(()=>{const el=document.getElementById('catNameIn_'+id);if(el){el.focus();el.select();}},10);
}
function _catNameKey(e,id){
  if(e.key==='Enter'){e.preventDefault();_catNameSave(id);}
  else if(e.key==='Escape'){e.preventDefault();_catEditId=null;renderLdrSettings();}
}
async function _catNameSave(id){
  const inp=document.getElementById('catNameIn_'+id);
  if(!inp)return;
  const newName=inp.value.trim();
  const c=txRules.categories&&txRules.categories.find(x=>String(x.id)===String(id));
  if(!c){_catEditId=null;renderLdrSettings();return;}
  const oldName=c.name;
  if(!newName||newName===oldName){_catEditId=null;renderLdrSettings();return;}
  // Check duplicate
  if(txRules.categories.some(x=>x.name===newName&&String(x.id)!==String(id))){
    await uiAlert(`「${newName}」は既に存在します`);
    setTimeout(()=>{const el=document.getElementById('catNameIn_'+id);if(el){el.focus();el.select();}},10);
    return;
  }
  // Count usages
  const usedTxs=txs.filter(t=>t.category===oldName).length;
  const usedBudgets=(()=>{let n=0;const bc=budgets.base&&budgets.base.cats;if(bc&&bc[oldName]!==undefined)n++;if(budgets.months)Object.values(budgets.months).forEach(m=>{if(m.cats&&m.cats[oldName]!==undefined)n++;});return n;})();
  const usedRules=(txRules.rules||[]).filter(r=>r.category===oldName).length;
  const usedSubs=subs.filter(s=>s.txCategory===oldName).length;
  const total=usedTxs+usedBudgets+usedRules+usedSubs;
  if(total>0){
    const ok=await uiConfirm(`${total} 件の取引・予算・ルールが新しい名前「${newName}」に変わります。続けますか？`,{title:'カテゴリ名の変更',okLabel:'変更する'});
    if(!ok){_catEditId=null;renderLdrSettings();return;}
  }
  // Apply rename
  c.name=newName;
  txs.forEach(t=>{if(t.category===oldName)t.category=newName;});
  if(budgets.base&&budgets.base.cats&&budgets.base.cats[oldName]!==undefined){budgets.base.cats[newName]=budgets.base.cats[oldName];delete budgets.base.cats[oldName];}
  if(budgets.months)Object.values(budgets.months).forEach(m=>{if(m.cats&&m.cats[oldName]!==undefined){m.cats[newName]=m.cats[oldName];delete m.cats[oldName];}});
  (txRules.rules||[]).forEach(r=>{if(r.category===oldName)r.category=newName;});
  subs.forEach(s=>{if(s.txCategory===oldName)s.txCategory=newName;});
  _catEditId=null;
  saveTx();saveBudgets();saveSubs();
  saveTxRules();
  renderLdrSettings();
}

// ── toggle hidden ──
function _catToggleHidden(id){
  const c=txRules.categories&&txRules.categories.find(x=>String(x.id)===String(id));
  if(!c||c.name==='その他')return;
  c.hidden=!c.hidden;
  _catRenderRefresh();
}

// ── add category ──
function _catAdd(kind){
  const inputId=kind==='expense'?'catAddExpIn':'catAddIncIn';
  const inp=document.getElementById(inputId);
  if(!inp)return;
  const name=inp.value.trim();
  if(!name){inp.focus();return;}
  if(txRules.categories&&txRules.categories.some(c=>c.name===name)){
    uiAlert(`「${name}」は既に存在します`);
    return;
  }
  // Pick unused color
  const usedColors=new Set((txRules.categories||[]).map(c=>c.color));
  const color=CAT_PALETTE.find(col=>!usedColors.has(col))||CAT_PALETTE[0];
  const maxOrder=Math.max(0,...(txRules.categories||[]).filter(c=>c.kind===kind).map(c=>c.order||0));
  if(!txRules.categories)txRules.categories=[];
  txRules.categories.push({id:crypto.randomUUID(),name,kind,color,order:maxOrder+1,hidden:false});
  inp.value='';
  _catRenderRefresh();
}

// ── delete category ──
async function _catDelete(id){
  const c=txRules.categories&&txRules.categories.find(x=>String(x.id)===String(id));
  if(!c||c.name==='その他')return;
  const count=txs.filter(t=>t.category===c.name).length;
  const inBudget=(()=>{const bc=budgets.base&&budgets.base.cats;let n=0;if(bc&&bc[c.name]!==undefined)n++;if(budgets.months)Object.values(budgets.months).forEach(m=>{if(m.cats&&m.cats[c.name]!==undefined)n++;});return n;})();
  const inRules=(txRules.rules||[]).filter(r=>r.category===c.name).length;
  const inSubs=subs.filter(s=>s.txCategory===c.name).length;
  const total=count+inBudget+inRules+inSubs;
  if(total===0){
    const ok=await uiConfirm(`「${esc(c.name)}」を削除しますか？`,{title:'カテゴリを削除',okLabel:'削除',danger:true});
    if(!ok)return;
    txRules.categories=txRules.categories.filter(x=>String(x.id)!==String(id));
    _catRenderRefresh();
    return;
  }
  // Show migration dialog
  _catDeleteWithMigration(c);
}

async function _catDeleteWithMigration(c){
  const sameKindCats=(txRules.categories||[]).filter(x=>x.kind===c.kind&&x.name!=='その他'&&String(x.id)!==String(c.id)&&!x.hidden);
  const fallback='その他';
  const opts=[{name:fallback},...sameKindCats];
  const count=txs.filter(t=>t.category===c.name).length;
  const inBudget=(()=>{const bc=budgets.base&&budgets.base.cats;let n=0;if(bc&&bc[c.name]!==undefined)n++;if(budgets.months)Object.values(budgets.months).forEach(m=>{if(m.cats&&m.cats[c.name]!==undefined)n++;});return n;})();
  const inRules=(txRules.rules||[]).filter(r=>r.category===c.name).length;
  const inSubs=subs.filter(s=>s.txCategory===c.name).length;
  // Show a custom dialog for migration
  let overlay=document.getElementById('catDelMigOverlay');
  if(!overlay){overlay=document.createElement('div');overlay.id='catDelMigOverlay';overlay.className='ldr-modal-overlay';document.body.appendChild(overlay);}
  const selOpts=opts.map(o=>`<option value="${esc(o.name)}">${esc(o.name)}</option>`).join('');
  overlay.innerHTML=`<div class="ldr-modal" onclick="event.stopPropagation()" style="max-width:480px;">
    <div class="ldr-modal-hdr"><div class="ldr-modal-title">「${esc(c.name)}」を削除</div><button class="ldr-modal-close" onclick="document.getElementById('catDelMigOverlay').classList.remove('open')">✕</button></div>
    <div class="ldr-modal-body">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;color:var(--ink2);line-height:1.6;">このカテゴリは ${count} 件の取引・${inBudget>0?`予算 ${inBudget} 件・`:''}${inRules>0?`ルール ${inRules} 件・`:''}${inSubs>0?`固定費 ${inSubs} 件・`:''}で使用されています。<br>移し先のカテゴリを選んでください。<br><small style="color:var(--mute);">予算は移し先に合算せず、移し先に予算がある場合は削除元の予算を破棄します。</small></div>
      <div><label class="ldr-modal-lbl" for="catDelMigSel">移し先カテゴリ</label><select class="ldr-modal-in" id="catDelMigSel" onclick="event.stopPropagation()">${selOpts}</select></div>
    </div>
    <div class="ldr-modal-ftr"><div></div><div class="ldr-modal-ftr-r">
      <button class="btn btn-ghost" onclick="document.getElementById('catDelMigOverlay').classList.remove('open')">キャンセル</button>
      <button class="btn btn-primary" style="background:var(--accent);" onclick="event.stopPropagation();_catDeleteConfirm('${esc(String(c.id))}')">削除して移す</button>
    </div></div>
  </div>`;
  overlay.classList.add('open');
}

function _catDeleteConfirm(id){
  const overlay=document.getElementById('catDelMigOverlay');
  const sel=document.getElementById('catDelMigSel');
  const toName=sel?sel.value:'その他';
  const c=txRules.categories&&txRules.categories.find(x=>String(x.id)===String(id));
  if(!c){if(overlay)overlay.classList.remove('open');return;}
  const oldName=c.name;
  // Migrate txs
  txs.forEach(t=>{if(t.category===oldName)t.category=toName;});
  // Migrate rules
  (txRules.rules||[]).forEach(r=>{if(r.category===oldName)r.category=toName;});
  // Migrate subs
  subs.forEach(s=>{if(s.txCategory===oldName)s.txCategory=toName;});
  // Handle budgets: base
  if(budgets.base&&budgets.base.cats&&budgets.base.cats[oldName]!==undefined){
    // If toName has no budget, move; otherwise discard
    if(budgets.base.cats[toName]===undefined)budgets.base.cats[toName]=budgets.base.cats[oldName];
    delete budgets.base.cats[oldName];
  }
  if(budgets.months)Object.values(budgets.months).forEach(m=>{
    if(m.cats&&m.cats[oldName]!==undefined){
      if(m.cats[toName]===undefined)m.cats[toName]=m.cats[oldName];
      delete m.cats[oldName];
    }
  });
  txRules.categories=txRules.categories.filter(x=>String(x.id)!==String(id));
  if(overlay)overlay.classList.remove('open');
  saveTx();saveBudgets();saveSubs();
  saveTxRules();
  renderLdrSettings();
}
