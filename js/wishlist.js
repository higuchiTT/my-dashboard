// ── SHOPPING ──
let expandedShopId = null;
let shopDraft = null;
let editingField = null; // {id, field}
let newShopDraft = null;
const shopCategories = ['家具・インテリア','家電','アウトドア','その他'];
const STATUS_ORDER = ['検討中', '保留中', '購入済み'];

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
function startNewShopDraft(){
  newShopDraft={name:'',category:shopCategories[0],price:null,status:'検討中',note:''};
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
  const priceVal=priceEl&&priceEl.value?parseFloat(priceEl.value):null;
  shopping.push({id:crypto.randomUUID(),name,category:catEl?catEl.value:shopCategories[0],price:priceVal,status:statusEl?statusEl.value:'検討中',candidates:[],note:memoEl?memoEl.value.trim():''});
  newShopDraft=null;saveShop();renderShopping();
}
function cancelNewShopDraft(){newShopDraft=null;renderShopping();}
function delShopItem(id){
  shopping=shopping.filter(s=>String(s.id)!==String(id));
  if(String(expandedShopId)===String(id)){expandedShopId=null;shopDraft=null;}
  saveShop();renderShopping();
}
async function confirmDelShop(id){
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  if(await uiConfirm(`「${s.name}」を削除しますか？`,{title:'アイテムの削除',danger:true}))delShopItem(id);
}
function saveShop(){localStorage.setItem('hd_shopping',JSON.stringify(shopping));saveToSupabase();}
function toggleShopExpand(id){
  if(String(expandedShopId)===String(id)){expandedShopId=null;shopDraft=null;}
  else{expandedShopId=id;const s=shopping.find(s=>String(s.id)===String(id));if(s)shopDraft=JSON.parse(JSON.stringify(s));}
  renderShopping();
}
function handleRowClick(e,id){
  if(e.target.closest('button,select,input,textarea'))return;
  if(editingField){cancelInline();return;}
  toggleShopExpand(id);
}
function changeShopStatus(e,id){
  const s=shopping.find(s=>String(s.id)===String(id));if(!s)return;
  s.status=e.target.value;
  if(shopDraft&&String(shopDraft.id)===String(id))shopDraft.status=s.status;
  saveShop();renderShopping();
}
function saveExpand(id){
  if(!shopDraft)return;
  const idx=shopping.findIndex(s=>String(s.id)===String(id));
  if(idx>=0){shopping[idx].candidates=shopDraft.candidates;}
  expandedShopId=null;shopDraft=null;
  saveShop();renderShopping();
}
function cancelExpand(){expandedShopId=null;shopDraft=null;renderShopping();}

function renderShopping(){
  const all=shopping;
  const kentouItems=all.filter(s=>s.status==='検討中');
  const horyuItems=all.filter(s=>s.status==='保留中');
  const kentouAmt=kentouItems.reduce((s,i)=>s+(i.price||0),0);
  const horyuAmt=horyuItems.reduce((s,i)=>s+(i.price||0),0);
  const el1=document.getElementById('shopStatKentou');
  const el2=document.getElementById('shopStatHoryu');
  if(el1)el1.textContent='¥'+fmt(kentouAmt)+'（'+kentouItems.length+'件）';
  if(el2)el2.textContent='¥'+fmt(horyuAmt)+'（'+horyuItems.length+'件）';
  const grid=document.getElementById('shopGrid');
  if(!all.length&&!newShopDraft){grid.innerHTML='<div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--mute)">アイテムがありません</div>';return;}
  const statuses=['検討中','保留中','購入済み'];
  const sorted=[...shopping].sort((a,b)=>{
    // 1. ステータス
    const si=STATUS_ORDER.indexOf(a.status??'');
    const sj=STATUS_ORDER.indexOf(b.status??'');
    const sd=(si===-1?999:si)-(sj===-1?999:sj);
    if(sd!==0)return sd;
    // 2. カテゴリ
    const ci=shopCategories.indexOf(a.category??'');
    const cj=shopCategories.indexOf(b.category??'');
    const cd=(ci===-1?999:ci)-(cj===-1?999:cj);
    if(cd!==0)return cd;
    // 3. 予算（降順）
    const pd=(b.price??0)-(a.price??0);
    if(pd!==0)return pd;
    // 4. 品名（50音順）
    return(a.name??'').localeCompare(b.name??'','ja');
  });
  const HDR=['','品名','カテゴリ','予算','ステータス','メモ',''].map(h=>`<div class="shop-hdr-cell">${h}</div>`).join('');
  let newDraftRow='';
  if(newShopDraft){
    const nd=newShopDraft;
    const catOptsNd=shopCategories.map(c=>`<option${nd.category===c?' selected':''}>${c}</option>`).join('');
    newDraftRow=`<div class="shop-row-draft">
      <div class="shop-cell"></div>
      <div class="shop-cell" onclick="event.stopPropagation()"><input class="shop-name-in" id="ndName" value="${esc(nd.name)}" placeholder="品名を入力" onclick="event.stopPropagation()" autofocus></div>
      <div class="shop-cell" onclick="event.stopPropagation()"><select class="cat-sel" id="ndCat" onclick="event.stopPropagation()">${catOptsNd}</select></div>
      <div class="shop-cell shop-cell-price" onclick="event.stopPropagation()"><input type="number" class="inline-edit-num" id="ndPrice" value="${nd.price||''}" placeholder="金額" style="width:88px;text-align:right;" onclick="event.stopPropagation()"></div>
      <div class="shop-cell" onclick="event.stopPropagation()"><select class="status-sel s-sel-${nd.status}" id="ndStatus" onclick="event.stopPropagation()">${statuses.map(st=>`<option${nd.status===st?' selected':''}>${st}</option>`).join('')}</select></div>
      <div class="shop-cell" style="display:flex;align-items:center;gap:8px;" onclick="event.stopPropagation()"><input class="shop-memo-in" id="ndMemo" value="${esc(nd.note||'')}" placeholder="メモを追加" style="flex:1;" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm draft-btn-cancel" onclick="event.stopPropagation();cancelNewShopDraft()">キャンセル</button><button class="btn btn-primary btn-sm draft-btn-save" onclick="event.stopPropagation();saveNewShopDraft()">保存</button></div>
      <div class="shop-cell" onclick="event.stopPropagation()"></div>
    </div>`;
  }
  grid.innerHTML=HDR+sorted.map((s,idx)=>{
    const isExp=String(s.id)===String(expandedShopId);
    const draft=isExp&&shopDraft?shopDraft:s;
    const candCount=(draft.candidates||[]).length;
    const statusSel=`<select class="status-sel s-sel-${s.status}" onchange="changeShopStatus(event,'${esc(String(s.id))}')" onclick="event.stopPropagation()">${statuses.map(st=>`<option${s.status===st?' selected':''}>${st}</option>`).join('')}</select>`;
    const catOpts=shopCategories.map(c=>`<option${s.category===c?' selected':''}>${c}</option>`).join('');
    const catExtra=s.category&&!shopCategories.includes(s.category)?`<option selected>${esc(s.category)}</option>`:'';
    const catSel=`<select class="cat-sel" onchange="changeCat(event,'${esc(String(s.id))}')" onclick="event.stopPropagation()">${catOpts}${catExtra}</select>`;
    const isEdPrice=editingField&&String(editingField.id)===String(s.id)&&editingField.field==='price';
    const nameCell=`<div class="shop-cell shop-cell-name"><input class="shop-name-in" value="${esc(s.name)}" onclick="event.stopPropagation()" oninput="saveShopName('${esc(String(s.id))}',this.value)"></div>`;
    const priceCell=isEdPrice
      ?`<div class="shop-cell shop-cell-price"><div class="inline-edit-wrap"><input class="inline-edit-num" type="number" id="ied-price-${s.id}" value="${s.price||''}" placeholder="0" onclick="event.stopPropagation()" onkeydown="inlineKeydown(event,'price','${esc(String(s.id))}')"><button class="inline-ok" onclick="event.stopPropagation();saveInline('price','${esc(String(s.id))}')">✓</button><button class="inline-ng" onclick="event.stopPropagation();cancelInline()">✗</button></div></div>`
      :`<div class="shop-cell shop-cell-price shop-cell-editable">${s.price?`<span class="price-sym" onclick="startInline(event,'price','${esc(String(s.id))}')">¥</span><span class="editable-text" onclick="startInline(event,'price','${esc(String(s.id))}')">${fmt(s.price)}</span>`:`<span class="editable-text" style="color:var(--mute)" onclick="startInline(event,'price','${esc(String(s.id))}')">—</span>`}<span class="edit-pencil" onclick="startInline(event,'price','${esc(String(s.id))}')">✏</span></div>`;
    const memoCell=`<div class="shop-cell shop-cell-memo"><textarea class="shop-memo-in" rows="1" onclick="event.stopPropagation()" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';saveShopMemo('${esc(String(s.id))}',this.value)" placeholder="メモを追加">${esc(s.note||'')}</textarea></div>`;
    const row=`<div class="shop-row s-${s.status}${isExp?' expanded':''}" onclick="handleRowClick(event,'${esc(String(s.id))}')">
      <div class="shop-chev-cell" onclick="event.stopPropagation();toggleShopExpand('${esc(String(s.id))}')"><span class="shop-chev">${isExp?'▲':'▼'}</span></div>
      ${nameCell}
      <div class="shop-cell shop-cell-cat">${catSel}</div>
      ${priceCell}
      <div class="shop-cell shop-cell-status">${statusSel}</div>
      ${memoCell}
      <div class="shop-cell shop-del-cell"><button class="shop-del-btn" onclick="event.stopPropagation();confirmDelShop('${esc(String(s.id))}')">削除</button></div>
    </div>`;
    if(!isExp)return row;
    const cands=(draft.candidates||[]).map((c,ci)=>{
      const desc=c.description||(c.pros||[]).join('、');
      return`<div class="cand-row" id="cand-card-${ci}" draggable="true"
        ondragstart="candDragStart(event,${ci})" ondragover="candDragOver(event,${ci})"
        ondragleave="candDragLeave(event)" ondrop="candDrop(event,${ci})">
        <div class="cand-drag">⠿</div>
        <div class="cand-num">${ci+1}</div>
        <div class="cand-name-col">
          <div class="cand-name-text">${esc(c.name)}</div>
        </div>
        <div class="cand-price">¥${fmt(c.price||0)}</div>
        <input class="cand-memo-in" value="${esc(c.memo||'')}" placeholder="メモ"
          oninput="updateCandMemo(${ci},this.value)" onclick="event.stopPropagation()">
        <input class="cand-url-in" id="cand-url-${ci}" value="${esc(c.url||'')}" placeholder="https://..."
          oninput="updateCandUrl(${ci},this.value);toggleCandUrlIcon(${ci})" onclick="event.stopPropagation()">
        <a class="cand-url-open" id="cand-url-link-${ci}" href="${esc(c.url||'#')}" target="_blank" rel="noopener"
          onclick="event.stopPropagation();if(!this.dataset.has)return false" data-has="${c.url?'1':''}"
          style="${c.url?'':'visibility:hidden'}" title="リンクを開く">↗</a>
        <button class="cand-act cand-act-edit" onclick="event.stopPropagation();editCandDraft(${ci})">編集</button>
        <button class="cand-act cand-act-del" onclick="event.stopPropagation();delCandDraft(${ci})">削除</button>
      </div>`;
    }).join('');
    const panel=`<div class="shop-expand-panel">
      <div class="expand-cands-hdr">
        <span class="expand-label"><span class="expand-label-ja">候補比較（${candCount}件）</span></span>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="add-cand-btn" onclick="addCandDraft()">＋ 候補を追加</button>
          <button class="cand-act cand-act-edit" onclick="cancelExpand()">キャンセル</button>
          <button class="cand-act cand-act-del" onclick="saveExpand('${esc(String(s.id))}')">保存する</button>
        </div>
      </div>
      <div class="cands-panel">
        <div class="cands-col-hdr">
          <div class="cchdr cchdr-drag"></div>
          <div class="cchdr cchdr-num">順位</div>
          <div class="cchdr cchdr-name">候補名</div>
          <div class="cchdr cchdr-price">価格</div>
          <div class="cchdr cchdr-memo">メモ</div>
          <div class="cchdr cchdr-url">URL</div>
          <div class="cchdr" style="flex:0 0 20px"></div>
          <div class="cchdr cchdr-act">操作</div>
        </div>
        ${cands||'<div class="expand-empty">候補がありません</div>'}
      </div>
    </div>`;
    return row+panel;
  }).join('')+newDraftRow;
  if(newShopDraft){setTimeout(()=>{const el=document.getElementById('ndName');if(el)el.focus();},0);}
  setTimeout(()=>{document.querySelectorAll('.shop-memo-in').forEach(ta=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});},0);
}

// ── CANDIDATE DRAFT OPS ──
function toggleStarDraft(ci){if(!shopDraft)return;shopDraft.candidates[ci].starred=!shopDraft.candidates[ci].starred;renderShopping();}
function addCandDraft(){
  if(!shopDraft)return;
  if(!shopDraft.candidates)shopDraft.candidates=[];
  shopDraft.candidates.push({name:'',price:0,starred:false,pros:[],cons:[],memo:'',url:''});
  renderShopping();
  setTimeout(()=>editCandDraft(shopDraft.candidates.length-1),0);
}
function delCandDraft(ci){if(!shopDraft)return;shopDraft.candidates.splice(ci,1);renderShopping();}
let dragCi=null;
function candDragStart(e,ci){dragCi=ci;e.dataTransfer.effectAllowed='move';e.currentTarget.classList.add('dragging');}
function candDragOver(e,ci){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function candDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function candDrop(e,ci){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  if(dragCi===null||dragCi===ci){dragCi=null;return;}
  const [moved]=shopDraft.candidates.splice(dragCi,1);
  shopDraft.candidates.splice(ci,0,moved);
  dragCi=null;renderShopping();
}
function updateCandMemo(ci,val){if(shopDraft&&shopDraft.candidates[ci])shopDraft.candidates[ci].memo=val;}
function updateCandUrl(ci,val){if(shopDraft&&shopDraft.candidates[ci])shopDraft.candidates[ci].url=val;}
function toggleCandUrlIcon(ci){
  const link=document.getElementById('cand-url-link-'+ci);
  const inp=document.getElementById('cand-url-'+ci);
  if(!link||!inp)return;
  const val=inp.value.trim();
  if(val){link.href=val;link.style.visibility='visible';link.dataset.has='1';}
  else{link.href='#';link.style.visibility='hidden';link.dataset.has='';}
}
function autoResizeMemo(id){const ta=document.getElementById(id);if(!ta)return;ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}
function editCandDraft(ci){
  const card=document.getElementById('cand-card-'+ci);if(!card||!shopDraft)return;
  card.classList.add('editing');
  const c=shopDraft.candidates[ci];
  card.innerHTML=`
    <div class="cand-drag" style="cursor:default;color:rgba(26,24,20,0.2)">⠿</div>
    <div class="cand-num">${ci+1}</div>
    <div class="cand-name-col" style="overflow:visible">
      <input id="ce-name-${ci}" class="cand-in cand-in-name" value="${esc(c.name)}" placeholder="候補名" onclick="event.stopPropagation()">
    </div>
    <div style="flex:0 0 90px;min-width:0">
      <input id="ce-price-${ci}" class="cand-in cand-in-price" type="number" value="${c.price||''}" placeholder="0" onclick="event.stopPropagation()">
    </div>
    <div style="flex:1;min-width:0;margin-left:16px">
      <input id="ce-memo-${ci}" class="cand-in" value="${esc(c.memo||'')}" placeholder="メモ" onclick="event.stopPropagation()">
    </div>
    <div style="flex:0 0 220px;min-width:0;margin-left:10px">
      <input id="ce-url-${ci}" class="cand-in" value="${esc(c.url||'')}" placeholder="https://..." onclick="event.stopPropagation()">
    </div>
    <div class="cand-edit-actions">
      <button class="cand-act" onclick="event.stopPropagation();renderShopping()">キャンセル</button>
      <button class="cand-act cand-act-edit" onclick="event.stopPropagation();saveCandEdit(${ci})">保存</button>
    </div>`;
  card.querySelector('#ce-name-'+ci)?.focus();
}
function saveCandEdit(ci){
  if(!shopDraft)return;
  const c=shopDraft.candidates[ci];
  const n=document.getElementById('ce-name-'+ci),p=document.getElementById('ce-price-'+ci),m=document.getElementById('ce-memo-'+ci),u=document.getElementById('ce-url-'+ci);
  if(n)c.name=n.value.trim();
  if(p)c.price=p.value?parseFloat(p.value):0;
  if(m)c.memo=m.value.trim();
  if(u)c.url=u.value.trim();
  renderShopping();
}
