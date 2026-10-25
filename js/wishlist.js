// ── SHOPPING ──
let expandedShopId = null;
let shopDraft = null;
let editingField = null; // {id, field}
let newShopDraft = null;
let shopSortMode = 'priority'; // 'priority' | 'month' | 'order'
let shopViewMode = 'list';     // 'list' | 'plan'
let candEditIdx = null;

const shopCategories = ['家具・インテリア','家電','アウトドア','その他'];
const STATUS_ORDER = ['検討中', '保留中', '購入済み'];
const PRIORITY_ORDER = ['high', 'mid', 'low'];
const PRIORITY_LABELS = {high:'高', mid:'中', low:'低'};

// ── INLINE EDITING ──
function startInline(e,field,id){
  e.stopPropagation();
  if(editingField&&String(editingField.id)===String(id)&&editingField.field===field)return;
  editingField={id,field};
  renderShopping();
  setTimeout(()=>{const el=document.getElementById(`ied-${field}-${id}`);if(el){el.focus();if(el.select)el.select();}},0);
}
function saveInline(field,id){
  const el=document.getElementById(`ied-${field}-${id}`);
  if(!el)return;
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  if(field==='name'){const v=el.value.trim();if(v)s.name=v;}
  else if(field==='price')s.price=el.value?parseFloat(el.value):null;
  else if(field==='memo')s.note=el.value;
  editingField=null;saveShop();renderShopping();
}
function cancelInline(){editingField=null;renderShopping();}
function saveShopMemo(id,val){const s=shopping.find(s=>String(s.id)===String(id));if(s){s.note=val;saveShop();}}
function saveShopName(id,val){const s=shopping.find(s=>String(s.id)===String(id));if(s){const v=val.trim();if(v)s.name=v;saveShop();}}
function inlineKeydown(e,field,id){
  if(e.key==='Enter'){e.preventDefault();saveInline(field,id);}
  if(e.key==='Escape'){e.stopPropagation();cancelInline();}
}
function changeCat(e,id){
  e.stopPropagation();
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  s.category=e.target.value;saveShop();renderShopping();
}
function changeShopStatus(e,id){
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  s.status=e.target.value;
  if(shopDraft&&String(shopDraft.id)===String(id))shopDraft.status=s.status;
  saveShop();renderShopping();
}
function changeShopPriority(e,id){
  e.stopPropagation();
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  s.priority=e.target.value;
  saveShop();renderShopping();
}
function changeShopTargetMonth(e,id){
  e.stopPropagation();
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  s.targetMonth=e.target.value||null;
  saveShop();renderShopping();
}

// ── NEW ITEM DRAFT ──
function startNewShopDraft(){
  newShopDraft={name:'',category:shopCategories[0],price:null,status:'検討中',note:'',priority:'mid',targetMonth:null};
  shopViewMode='list';
  renderShopping();
}
function saveNewShopDraft(){
  if(!newShopDraft)return;
  const nameEl=document.getElementById('ndName');
  const name=(nameEl?nameEl.value:'').trim();
  if(!name){if(nameEl)nameEl.focus();return;}
  const catEl=document.getElementById('ndCat');
  const priceEl=document.getElementById('ndPrice');
  const statusEl=document.getElementById('ndStatus');
  const memoEl=document.getElementById('ndMemo');
  const priEl=document.getElementById('ndPriority');
  const tmEl=document.getElementById('ndTargetMonth');
  const priceVal=priceEl&&priceEl.value?parseFloat(priceEl.value):null;
  shopping.push({
    id:crypto.randomUUID(),
    name,
    category:catEl?catEl.value:shopCategories[0],
    price:priceVal,
    status:statusEl?statusEl.value:'検討中',
    candidates:[],
    note:memoEl?memoEl.value.trim():'',
    priority:priEl?priEl.value:'mid',
    targetMonth:tmEl&&tmEl.value?tmEl.value:null
  });
  newShopDraft=null;saveShop();renderShopping();
}
function cancelNewShopDraft(){newShopDraft=null;renderShopping();}

function delShopItem(id){
  shopping=shopping.filter(s=>String(s.id)!==String(id));
  if(String(expandedShopId)===String(id)){expandedShopId=null;shopDraft=null;candEditIdx=null;}
  saveShop();renderShopping();
}
async function confirmDelShop(id){
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  if(await uiConfirm(`「${s.name}」を削除しますか？`,{title:'アイテムの削除',danger:true}))delShopItem(id);
}
function saveShop(){localStorage.setItem('hd_shopping',JSON.stringify(shopping));saveToSupabase();}

function toggleShopExpand(id){
  if(String(expandedShopId)===String(id)){expandedShopId=null;shopDraft=null;candEditIdx=null;}
  else{
    expandedShopId=id;
    const s=shopping.find(s=>String(s.id)===String(id));
    if(s){
      const copy=JSON.parse(JSON.stringify(s));
      (copy.candidates||[]).forEach(c=>{if(!c.id)c.id=crypto.randomUUID();});
      shopDraft=copy;
    }
    candEditIdx=null;
  }
  renderShopping();
}
function handleRowClick(e,id){
  if(e.target.closest('button,select,input,textarea'))return;
  if(editingField){cancelInline();return;}
  toggleShopExpand(id);
}
function saveExpand(id){
  if(!shopDraft)return;
  const idx=shopping.findIndex(s=>String(s.id)===String(id));
  if(idx>=0){
    shopping[idx].candidates=shopDraft.candidates;
    if(shopDraft.price!=null)shopping[idx].price=shopDraft.price;
  }
  expandedShopId=null;shopDraft=null;candEditIdx=null;
  saveShop();renderShopping();
}
function cancelExpand(){expandedShopId=null;shopDraft=null;candEditIdx=null;renderShopping();}

// ── VIEW / SORT ──
function setShopSort(mode){shopSortMode=mode;renderShopping();}
function setShopView(mode){
  shopViewMode=mode;
  if(mode!=='list'){expandedShopId=null;shopDraft=null;candEditIdx=null;}
  renderShopping();
}
function goToShopItem(id){
  shopViewMode='list';
  renderShopping();
  setTimeout(()=>toggleShopExpand(id),0);
}

// ── MONTH HELPERS ──
function shopMonthOptions(current){
  const now=new Date();
  let opts=`<option value=""${!current?' selected':''}>未定</option>`;
  for(let i=0;i<=11;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    let label;
    if(i===0)label=`今月（${d.getMonth()+1}月）`;
    else if(d.getFullYear()!==now.getFullYear())label=`${d.getFullYear()}年${d.getMonth()+1}月`;
    else label=`${d.getMonth()+1}月`;
    opts+=`<option value="${val}"${current===val?' selected':''}>${label}</option>`;
  }
  return opts;
}
function shopMonthLabel(ym){
  if(!ym)return'未定';
  const[y,m]=ym.split('-').map(Number);
  const now=new Date();
  if(y===now.getFullYear()&&m===now.getMonth()+1)return`今月（${m}月）`;
  return y===now.getFullYear()?`${m}月`:`${y}年${m}月`;
}
function getThreeMonthTotal(){
  const now=new Date();
  let total=0;
  for(let i=0;i<3;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    shopping.filter(s=>s.status!=='購入済み'&&s.targetMonth===ym).forEach(s=>{total+=(s.price||0);});
  }
  return total;
}

// ── SORT ──
function getSortedItems(){
  const all=[...shopping];
  if(shopSortMode==='priority'){
    return all.sort((a,b)=>{
      const si=STATUS_ORDER.indexOf(a.status??''),sj=STATUS_ORDER.indexOf(b.status??'');
      const sd=(si===-1?999:si)-(sj===-1?999:sj);if(sd!==0)return sd;
      const pi=PRIORITY_ORDER.indexOf(a.priority??'mid'),pj=PRIORITY_ORDER.indexOf(b.priority??'mid');
      const pd=(pi===-1?1:pi)-(pj===-1?1:pj);if(pd!==0)return pd;
      return(a.name??'').localeCompare(b.name??'','ja');
    });
  }else if(shopSortMode==='month'){
    return all.sort((a,b)=>{
      const si=STATUS_ORDER.indexOf(a.status??''),sj=STATUS_ORDER.indexOf(b.status??'');
      const sd=(si===-1?999:si)-(sj===-1?999:sj);if(sd!==0)return sd;
      const am=a.targetMonth||'zzz',bm=b.targetMonth||'zzz';
      if(am!==bm)return am.localeCompare(bm);
      const pi=PRIORITY_ORDER.indexOf(a.priority??'mid'),pj=PRIORITY_ORDER.indexOf(b.priority??'mid');
      return(pi===-1?1:pi)-(pj===-1?1:pj);
    });
  }else{
    const groups={};STATUS_ORDER.forEach(st=>groups[st]=[]);
    all.forEach(item=>{const st=item.status??'検討中';(groups[st]||(groups[st]=[])).push(item);});
    return[...(groups['検討中']||[]),...(groups['保留中']||[]),...(groups['購入済み']||[])];
  }
}

// ── CANDIDATE OPERATIONS ──
function addCandDraft(){
  if(!shopDraft)return;
  if(!shopDraft.candidates)shopDraft.candidates=[];
  shopDraft.candidates.push({id:crypto.randomUUID(),name:'',price:null,starred:false,pros:'',cons:'',memo:'',url:'',rating:0,chosen:false});
  candEditIdx=shopDraft.candidates.length-1;
  renderShopping();
  setTimeout(()=>{const el=document.getElementById(`cte-name-${candEditIdx}`);if(el)el.focus();},0);
}
function delCandDraft(ci){
  if(!shopDraft)return;
  shopDraft.candidates.splice(ci,1);
  if(candEditIdx===ci)candEditIdx=null;
  else if(candEditIdx!==null&&candEditIdx>ci)candEditIdx--;
  renderShopping();
}
function editCandInTable(ci){
  candEditIdx=ci;
  renderShopping();
  setTimeout(()=>{const el=document.getElementById(`cte-name-${ci}`);if(el)el.focus();},0);
}
function cancelCandEdit(){candEditIdx=null;renderShopping();}
function saveCandInTable(ci){
  if(!shopDraft||!shopDraft.candidates[ci])return;
  const c=shopDraft.candidates[ci];
  const n=document.getElementById(`cte-name-${ci}`);
  const p=document.getElementById(`cte-price-${ci}`);
  const pros=document.getElementById(`cte-pros-${ci}`);
  const cons=document.getElementById(`cte-cons-${ci}`);
  const m=document.getElementById(`cte-memo-${ci}`);
  const u=document.getElementById(`cte-url-${ci}`);
  if(n)c.name=n.value.trim();
  if(p)c.price=p.value?parseFloat(p.value):null;
  if(pros)c.pros=pros.value.trim();
  if(cons)c.cons=cons.value.trim();
  if(m)c.memo=m.value.trim();
  if(u)c.url=u.value.trim();
  candEditIdx=null;renderShopping();
}
function setCandRatingDraft(candId,rating){
  if(!shopDraft)return;
  const c=shopDraft.candidates.find(c=>String(c.id)===String(candId));
  if(!c)return;
  c.rating=(c.rating===rating)?0:rating;
  renderShopping();
}
async function chooseCandidate(itemId,candId){
  if(!shopDraft)return;
  const c=shopDraft.candidates.find(c=>String(c.id)===String(candId));
  if(!c)return;
  if(c.chosen){c.chosen=false;renderShopping();return;}
  shopDraft.candidates.forEach(c2=>c2.chosen=false);
  c.chosen=true;
  if(c.price){
    const ok=await uiConfirm(`予算を ¥${fmt(c.price)} にします`,{
      title:`「${c.name}」に決定`,
      okLabel:'予算も更新する',
      cancelLabel:'候補だけ決定'
    });
    if(ok)shopDraft.price=c.price;
  }
  renderShopping();
}

// ── STARS ──
function renderStars(rating,candId){
  let html='';
  for(let i=1;i<=5;i++){
    html+=`<span class="cmp-star${i<=(rating||0)?' filled':''}" onclick="event.stopPropagation();setCandRatingDraft('${esc(String(candId))}',${i})">★</span>`;
  }
  return`<span class="cmp-stars">${html}</span>`;
}

// ── COMPARISON TABLE ──
function buildComparisonTable(draft){
  const cands=draft.candidates||[];
  if(!cands.length){
    return`<div class="expand-empty">候補がありません。「＋ 候補を追加」で候補を追加してください。</div>`;
  }
  const activePrices=cands.map(c=>c.price||0).filter(p=>p>0);
  const minPrice=activePrices.length>1?Math.min(...activePrices):null;

  const ROWS=[
    {key:'name',  label:'候補名'},
    {key:'price', label:'価格'},
    {key:'rating',label:'評価'},
    {key:'pros',  label:'良い点'},
    {key:'cons',  label:'気になる点'},
    {key:'memo',  label:'メモ'},
    {key:'url',   label:'リンク'},
    {key:'_act',  label:'操作'},
  ];

  let tableHtml='';
  ROWS.forEach(({key,label})=>{
    let rowHtml=`<div class="cmp-label">${label}</div>`;
    cands.forEach((c,ci)=>{
      const isChosen=!!c.chosen;
      const isEd=candEditIdx===ci;
      let cell='';

      if(key==='name'){
        if(isEd){
          cell=`<input id="cte-name-${ci}" class="cte-in cte-in-title" type="text" value="${esc(c.name||'')}" placeholder="候補名" onclick="event.stopPropagation()">`;
        }else{
          cell=`<span class="cmp-cand-name">${esc(c.name||'（名前なし）')}</span>`;
          if(isChosen)cell+=`<span class="cmp-chosen-badge">✓ 決定</span>`;
        }
      }else if(key==='price'){
        if(isEd){
          cell=`<input id="cte-price-${ci}" class="cte-in cte-in-num" type="number" value="${c.price||''}" placeholder="0" onclick="event.stopPropagation()">`;
        }else if(c.price){
          const isMin=minPrice!==null&&c.price===minPrice;
          cell=`<span class="cmp-price${isMin?' cheapest':''}">¥${fmt(c.price)}</span>`;
        }else{
          cell=`<span class="cmp-empty">—</span>`;
        }
      }else if(key==='rating'){
        cell=renderStars(c.rating||0,c.id);
      }else if(key==='pros'||key==='cons'||key==='memo'){
        const val=c[key]||'';
        if(isEd){
          cell=`<textarea id="cte-${key}-${ci}" class="cte-ta" rows="2" onclick="event.stopPropagation()">${esc(val)}</textarea>`;
        }else{
          cell=val?`<span class="cmp-text-val">${esc(val)}</span>`:`<span class="cmp-empty">—</span>`;
        }
      }else if(key==='url'){
        if(isEd){
          cell=`<input id="cte-url-${ci}" class="cte-in" type="url" value="${esc(c.url||'')}" placeholder="https://..." onclick="event.stopPropagation()">`;
        }else if(c.url){
          cell=`<a href="${esc(c.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="cmp-link">↗ 開く</a>`;
        }else{
          cell=`<span class="cmp-empty">—</span>`;
        }
      }else if(key==='_act'){
        if(isEd){
          cell=`<button class="cmp-btn cmp-btn-save" onclick="event.stopPropagation();saveCandInTable(${ci})">保存</button><button class="cmp-btn" onclick="event.stopPropagation();cancelCandEdit()">キャンセル</button>`;
        }else{
          const chooseLabel=isChosen?'決定を取り消す':'これに決めた';
          cell=`<button class="cmp-btn cmp-btn-choose${isChosen?' is-chosen':''}" onclick="event.stopPropagation();chooseCandidate('${esc(String(draft.id))}','${esc(String(c.id))}')">${chooseLabel}</button><button class="cmp-btn cmp-btn-edit" onclick="event.stopPropagation();editCandInTable(${ci})">編集</button><button class="cmp-btn cmp-btn-del" onclick="event.stopPropagation();delCandDraft(${ci})">削除</button>`;
        }
      }

      rowHtml+=`<div class="cmp-cell cmp-cell-${key}${isChosen?' is-chosen':''}${isEd?' is-editing':''}">${cell}</div>`;
    });
    tableHtml+=`<div class="cmp-row cmp-row-${key}">${rowHtml}</div>`;
  });

  return`<div class="cmp-scroll-wrap"><div class="cmp-table">${tableHtml}</div></div>`;
}

// ── RENDER MAIN ──
function renderShopping(){
  const kentouItems=shopping.filter(s=>s.status==='検討中');
  const horyuItems=shopping.filter(s=>s.status==='保留中');
  const kentouAmt=kentouItems.reduce((s,i)=>s+(i.price||0),0);
  const horyuAmt=horyuItems.reduce((s,i)=>s+(i.price||0),0);

  const el1=document.getElementById('shopStatKentou');
  const el2=document.getElementById('shopStatHoryu');
  const el3=document.getElementById('shopStat3Mo');
  if(el1)el1.textContent='¥'+fmt(kentouAmt)+'（'+kentouItems.length+'件）';
  if(el2)el2.textContent='¥'+fmt(horyuAmt)+'（'+horyuItems.length+'件）';
  if(el3)el3.textContent='¥'+fmt(getThreeMonthTotal());

  // Update view seg active state
  document.querySelectorAll('#shopViewSeg .ui-seg-btn').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.view===shopViewMode);
  });

  // Show/hide sort selector (only relevant for list view)
  const sortSel=document.getElementById('shopSortSel');
  if(sortSel){
    sortSel.style.display=shopViewMode==='plan'?'none':'';
    sortSel.value=shopSortMode;
  }

  const listArea=document.getElementById('shopListArea');
  const planView=document.getElementById('shopPlanView');
  if(listArea)listArea.style.display=shopViewMode==='list'?'':'none';
  if(planView)planView.style.display=shopViewMode==='plan'?'':'none';

  if(shopViewMode==='plan'){
    renderShopPlan();
  }else{
    renderShopList();
  }
}

function renderShopList(){
  const sorted=getSortedItems();
  const statuses=['検討中','保留中','購入済み'];
  const grid=document.getElementById('shopGrid');
  if(!grid)return;

  if(!sorted.length&&!newShopDraft){
    grid.innerHTML='<div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--mute)">アイテムがありません</div>';
    return;
  }

  const HDR=['','品名','カテゴリ','予算','優先度','予定月','ステータス','メモ',''].map(h=>`<div class="shop-hdr-cell">${h}</div>`).join('');

  let newDraftRow='';
  if(newShopDraft){
    const nd=newShopDraft;
    const catOptsNd=shopCategories.map(c=>`<option${nd.category===c?' selected':''}>${c}</option>`).join('');
    const priOptsNd=Object.entries(PRIORITY_LABELS).map(([v,l])=>`<option value="${v}"${(nd.priority||'mid')===v?' selected':''}>${l}</option>`).join('');
    newDraftRow=`<div class="shop-row-draft">
      <div class="shop-cell nd-cell-handle"></div>
      <div class="shop-cell nd-cell-name" onclick="event.stopPropagation()"><input class="shop-name-in" id="ndName" value="${esc(nd.name)}" placeholder="品名を入力" onclick="event.stopPropagation()" autofocus></div>
      <div class="shop-cell nd-cell-cat" onclick="event.stopPropagation()"><select class="cat-sel" id="ndCat" onclick="event.stopPropagation()">${catOptsNd}</select></div>
      <div class="shop-cell shop-cell-price nd-cell-price" onclick="event.stopPropagation()"><input type="number" class="inline-edit-num" id="ndPrice" value="${nd.price||''}" placeholder="金額" style="width:88px;text-align:right" onclick="event.stopPropagation()"></div>
      <div class="shop-cell nd-cell-pri" onclick="event.stopPropagation()"><select class="priority-sel p-sel-${nd.priority||'mid'}" id="ndPriority" onclick="event.stopPropagation()">${priOptsNd}</select></div>
      <div class="shop-cell nd-cell-month" onclick="event.stopPropagation()"><select class="month-sel" id="ndTargetMonth" onclick="event.stopPropagation()">${shopMonthOptions(nd.targetMonth)}</select></div>
      <div class="shop-cell nd-cell-status" onclick="event.stopPropagation()"><select class="status-sel s-sel-${nd.status}" id="ndStatus" onclick="event.stopPropagation()">${statuses.map(st=>`<option${nd.status===st?' selected':''}>${st}</option>`).join('')}</select></div>
      <div class="shop-cell nd-cell-memo" onclick="event.stopPropagation()"><input class="shop-memo-in" id="ndMemo" value="${esc(nd.note||'')}" placeholder="メモ" onclick="event.stopPropagation()" style="width:100%;min-width:0"></div>
      <div class="shop-cell shop-cell-draft-act" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm draft-btn-cancel" onclick="event.stopPropagation();cancelNewShopDraft()">キャンセル</button><button class="btn btn-primary btn-sm draft-btn-save" onclick="event.stopPropagation();saveNewShopDraft()">保存</button></div>
    </div>`;
  }

  grid.innerHTML=HDR+sorted.map(s=>{
    const isExp=String(s.id)===String(expandedShopId);
    const draft=isExp&&shopDraft?shopDraft:s;
    const chosenCand=(draft.candidates||[]).find(c=>c.chosen);

    const statusSel=`<select class="status-sel s-sel-${s.status}" onchange="changeShopStatus(event,'${esc(String(s.id))}')" onclick="event.stopPropagation()">${statuses.map(st=>`<option${s.status===st?' selected':''}>${st}</option>`).join('')}</select>`;
    const catOpts=shopCategories.map(c=>`<option${s.category===c?' selected':''}>${c}</option>`).join('');
    const catExtra=s.category&&!shopCategories.includes(s.category)?`<option selected>${esc(s.category)}</option>`:'';
    const catSel=`<select class="cat-sel" onchange="changeCat(event,'${esc(String(s.id))}')" onclick="event.stopPropagation()">${catOpts}${catExtra}</select>`;
    const priCur=s.priority||'mid';
    const priOpts=Object.entries(PRIORITY_LABELS).map(([v,l])=>`<option value="${v}"${priCur===v?' selected':''}>${l}</option>`).join('');
    const priSel=`<select class="priority-sel p-sel-${priCur}" onchange="changeShopPriority(event,'${esc(String(s.id))}')" onclick="event.stopPropagation()">${priOpts}</select>`;
    const monthSel=`<select class="month-sel" onchange="changeShopTargetMonth(event,'${esc(String(s.id))}')" onclick="event.stopPropagation()">${shopMonthOptions(s.targetMonth)}</select>`;

    const isEdPrice=editingField&&String(editingField.id)===String(s.id)&&editingField.field==='price';

    let nameInner=`<input class="shop-name-in" value="${esc(s.name)}" onclick="event.stopPropagation()" oninput="saveShopName('${esc(String(s.id))}',this.value)">`;
    if(chosenCand)nameInner+=`<span class="shop-chosen-badge">決定: ${esc(chosenCand.name||'候補')}</span>`;
    const nameCell=`<div class="shop-cell shop-cell-name">${nameInner}</div>`;

    const priceCell=isEdPrice
      ?`<div class="shop-cell shop-cell-price"><div class="inline-edit-wrap"><input class="inline-edit-num" type="number" id="ied-price-${s.id}" value="${s.price||''}" placeholder="0" onclick="event.stopPropagation()" onkeydown="inlineKeydown(event,'price','${esc(String(s.id))}')"><button class="inline-ok" onclick="event.stopPropagation();saveInline('price','${esc(String(s.id))}')">✓</button><button class="inline-ng" onclick="event.stopPropagation();cancelInline()">✗</button></div></div>`
      :`<div class="shop-cell shop-cell-price shop-cell-editable">${s.price?`<span class="price-sym" onclick="startInline(event,'price','${esc(String(s.id))}')">¥</span><span class="editable-text" onclick="startInline(event,'price','${esc(String(s.id))}')">${fmt(s.price)}</span>`:`<span class="editable-text" style="color:var(--mute)" onclick="startInline(event,'price','${esc(String(s.id))}')">—</span>`}<span class="edit-pencil" onclick="startInline(event,'price','${esc(String(s.id))}')">✏</span></div>`;

    const memoCell=`<div class="shop-cell shop-cell-memo"><textarea class="shop-memo-in" rows="1" onclick="event.stopPropagation()" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';saveShopMemo('${esc(String(s.id))}',this.value)" placeholder="メモ">${esc(s.note||'')}</textarea></div>`;

    const row=`<div class="shop-row s-${s.status}${isExp?' expanded':''}" onclick="handleRowClick(event,'${esc(String(s.id))}')">
      <div class="shop-chev-cell" onclick="event.stopPropagation();toggleShopExpand('${esc(String(s.id))}')"><span class="shop-chev">${isExp?'▲':'▼'}</span></div>
      ${nameCell}
      <div class="shop-cell shop-cell-cat">${catSel}</div>
      ${priceCell}
      <div class="shop-cell shop-cell-pri">${priSel}</div>
      <div class="shop-cell shop-cell-month">${monthSel}</div>
      <div class="shop-cell shop-cell-status">${statusSel}</div>
      ${memoCell}
      <div class="shop-cell shop-del-cell"><button class="shop-del-btn" onclick="event.stopPropagation();confirmDelShop('${esc(String(s.id))}')">削除</button></div>
    </div>`;

    if(!isExp)return row;

    const candCount=(draft.candidates||[]).length;
    const panel=`<div class="shop-expand-panel">
      <div class="expand-cands-hdr">
        <span class="expand-label"><span class="expand-label-ja">候補比較（${candCount}件）</span></span>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="add-cand-btn" onclick="addCandDraft()">＋ 候補を追加</button>
          <button class="cand-act cand-act-edit" onclick="cancelExpand()">キャンセル</button>
          <button class="cand-act cand-act-del" onclick="saveExpand('${esc(String(s.id))}')">保存する</button>
        </div>
      </div>
      ${buildComparisonTable(draft)}
    </div>`;

    return row+panel;
  }).join('')+newDraftRow;

  if(newShopDraft){setTimeout(()=>{const el=document.getElementById('ndName');if(el)el.focus();},0);}
  setTimeout(()=>{document.querySelectorAll('.shop-memo-in').forEach(ta=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});},0);
}

// ── PLAN VIEW ──
function renderShopPlan(){
  const planView=document.getElementById('shopPlanView');
  if(!planView)return;
  const now=new Date();
  const activeItems=shopping.filter(s=>s.status!=='購入済み');

  function sortByPriority(arr){
    return arr.slice().sort((a,b)=>{
      const pi=PRIORITY_ORDER.indexOf(a.priority??'mid'),pj=PRIORITY_ORDER.indexOf(b.priority??'mid');
      return(pi===-1?1:pi)-(pj===-1?1:pj);
    });
  }
  function buildPlanCard(items,label,isUndef){
    const sorted=sortByPriority(items);
    const total=sorted.reduce((sum,s)=>sum+(s.price||0),0);
    const itemsHtml=sorted.map(s=>{
      const pri=s.priority||'mid';
      return`<div class="shop-plan-item" onclick="goToShopItem('${esc(String(s.id))}')" title="${esc(s.name)}"><span class="shop-pri-dot pri-${pri}"></span><span class="shop-plan-item-name">${esc(s.name)}</span><span class="shop-plan-item-price">${s.price?'¥'+fmt(s.price):''}</span></div>`;
    }).join('');
    return`<div class="shop-plan-card${!items.length?' is-empty':''}${isUndef?' shop-plan-card-undef':''}">
      <div class="shop-plan-card-hdr">
        <span class="shop-plan-month">${label}</span>
        ${total?`<span class="shop-plan-total">¥${fmt(total)}</span>`:''}
      </div>
      ${items.length?`<div class="shop-plan-items">${itemsHtml}</div>`:`<div class="shop-plan-none">予定なし</div>`}
    </div>`;
  }

  const monthCards=[];
  for(let i=0;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const items=activeItems.filter(s=>s.targetMonth===ym);
    monthCards.push(buildPlanCard(items,shopMonthLabel(ym),false));
  }
  const undefItems=activeItems.filter(s=>!s.targetMonth);
  const undefCard=buildPlanCard(undefItems,'未定',true);

  planView.innerHTML=`<div class="shop-plan-wrap"><div class="shop-plan-grid">${monthCards.join('')}${undefCard}</div></div>`;
}
