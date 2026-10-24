// ── TRAVEL ──
let tripModalId=null;
function fmtTripDateRange(t){
  if(!t.startDate&&!t.endDate)return t.timing||'';
  const sd=new Date(t.startDate+'T00:00:00'),ed=new Date(t.endDate+'T00:00:00');
  const curY=new Date().getFullYear();
  const days=Math.round((ed-sd)/86400000)+1;
  const sPfx=sd.getFullYear()!==curY?`${sd.getFullYear()}/`:'';
  const ePfx=ed.getFullYear()!==curY&&ed.getFullYear()!==sd.getFullYear()?`${ed.getFullYear()}/`:'';
  return`${sPfx}${sd.getMonth()+1}/${sd.getDate()}〜${ePfx}${ed.getMonth()+1}/${ed.getDate()}（${days}日間）`;
}
function toggleAddTrip(){const f=document.getElementById('addTripForm');f.classList.toggle('open');if(f.classList.contains('open'))document.getElementById('tripDest').focus();}
function addTrip(){
  const dest=document.getElementById('tripDest').value.trim();
  if(!dest){document.getElementById('tripDest').focus();return;}
  const b=document.getElementById('tripBudgetInput').value;
  let sd=document.getElementById('tripStartDate').value;
  let ed=document.getElementById('tripEndDate').value;
  if(sd&&ed&&ed<sd){document.getElementById('tripEndDate').focus();return;}
  if(!sd&&ed)sd=ed;
  trips.push({id:crypto.randomUUID(),dest,timing:document.getElementById('tripTiming').value.trim(),startDate:sd||null,endDate:ed||null,budget:b?parseFloat(b):null,status:document.getElementById('tripStatus').value,note:document.getElementById('tripNote').value.trim()});
  saveTrips();
  document.getElementById('tripDest').value='';document.getElementById('tripTiming').value='';document.getElementById('tripStartDate').value='';document.getElementById('tripEndDate').value='';document.getElementById('tripBudgetInput').value='';document.getElementById('tripNote').value='';
  toggleAddTrip();renderTravel();
}
function setTripStatus(id,status){const t=trips.find(t=>String(t.id)===String(id));if(t){t.status=status;saveTrips();renderTravel();}}
function delTrip(id){trips=trips.filter(t=>String(t.id)!==String(id));saveTrips();renderTravel();}
function saveTrips(){localStorage.setItem('hd_trips',JSON.stringify(trips));saveToSupabase();}
function setTripF(f,el){tripFilter=f;document.querySelectorAll('#page-travel .fchip').forEach(c=>c.classList.remove('active'));el.classList.add('active');renderTravel();}
function openTripModal(id){
  const t=trips.find(t=>String(t.id)===String(id));if(!t)return;
  tripModalId=String(t.id);
  document.getElementById('tripModalDest').value=t.dest||'';
  document.getElementById('tripModalStart').value=t.startDate||'';
  document.getElementById('tripModalEnd').value=t.endDate||'';
  document.getElementById('tripModalTiming').value=t.timing||'';
  document.getElementById('tripModalBudget').value=t.budget!=null?t.budget:'';
  document.getElementById('tripModalStatus').value=t.status||'検討中';
  document.getElementById('tripModalNote').value=t.note||'';
  document.getElementById('tripModalDelWrap').innerHTML=`<button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(139,58,24,0.3);" onclick="confirmDelTripModal();event.stopPropagation()">削除</button>`;
  document.getElementById('tripModal').classList.add('open');
}
function closeTripModal(){document.getElementById('tripModal').classList.remove('open');tripModalId=null;}
function saveTripModal(){
  if(!tripModalId)return;
  const t=trips.find(t=>String(t.id)===tripModalId);if(!t)return;
  const dest=document.getElementById('tripModalDest').value.trim();
  if(!dest){document.getElementById('tripModalDest').focus();return;}
  let sd=document.getElementById('tripModalStart').value;
  let ed=document.getElementById('tripModalEnd').value;
  if(sd&&ed&&ed<sd){document.getElementById('tripModalEnd').focus();return;}
  if(!sd&&ed)sd=ed;
  t.dest=dest;
  t.startDate=sd||null;t.endDate=ed||null;
  t.timing=document.getElementById('tripModalTiming').value.trim();
  const b=document.getElementById('tripModalBudget').value;
  t.budget=b?parseFloat(b):null;
  t.status=document.getElementById('tripModalStatus').value;
  t.note=document.getElementById('tripModalNote').value.trim();
  saveTrips();closeTripModal();renderTravel();
}
function confirmDelTripModal(){
  if(!tripModalId)return;
  document.getElementById('tripModalDelWrap').innerHTML=`<span class="ldr-del-confirm">削除しますか?</span><button class="btn btn-ghost btn-sm" style="color:var(--accent);margin-left:8px;" onclick="execDelTripModal();event.stopPropagation()">はい</button>`;
}
function execDelTripModal(){
  if(!tripModalId)return;
  trips=trips.filter(t=>String(t.id)!==tripModalId);
  saveTrips();closeTripModal();renderTravel();
}
function renderTravel(){
  const STATUSES=['検討中','計画中','予約済み','完了'];
  document.getElementById('tripN1').textContent=trips.filter(t=>t.status==='検討中').length;
  document.getElementById('tripN2').textContent=trips.filter(t=>t.status==='計画中').length;
  document.getElementById('tripN3').textContent=trips.filter(t=>t.status==='予約済み').length;
  const budgetTotal=trips.filter(t=>t.budget&&t.status!=='完了').reduce((s,t)=>s+(t.budget||0),0);
  document.getElementById('tripBudget').textContent='¥'+fmt(budgetTotal);
  let list=tripFilter==='all'?trips:trips.filter(t=>t.status===tripFilter);
  const grid=document.getElementById('tripGrid');
  if(!list.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1;padding:48px"><div class="ei">✈</div><div>旅行プランを追加してください</div></div>';return;}
  grid.innerHTML=list.map(t=>{
    const dateStr=t.startDate?fmtTripDateRange(t):t.timing||'';
    return`<div class="trip-card s-${esc(t.status)}">
      <div class="trip-card-top">
        <div class="trip-dest">${esc(t.dest)}</div>
        <span class="trip-badge ${esc(t.status)}">${esc(t.status)}</span>
      </div>
      <div class="trip-meta">
        ${dateStr?`<div class="trip-meta-row"><span class="trip-meta-icon">📅</span>${esc(dateStr)}</div>`:''}
        ${t.budget?`<div class="trip-meta-row"><span class="trip-meta-icon">💴</span>¥${fmt(t.budget)}</div>`:'<div class="trip-meta-row"><span class="trip-meta-icon">💴</span><span style="color:var(--mute)">予算未定</span></div>'}
      </div>
      ${t.note?`<div class="trip-note">${esc(t.note)}</div>`:'<div class="trip-note"></div>'}
      <div class="trip-actions">
        ${STATUSES.map(s=>`<button class="trip-sbtn ${esc(s)} ${t.status===s?'act':''}" onclick="setTripStatus('${esc(String(t.id))}','${esc(s)}');event.stopPropagation()">${esc(s)}</button>`).join('')}
        <button class="trip-edit-btn" onclick="openTripModal('${esc(String(t.id))}');event.stopPropagation()">編集</button>
        <button class="btn-kill" style="margin-left:auto" onclick="delTrip('${esc(String(t.id))}');event.stopPropagation()">✕</button>
      </div>
    </div>`;
  }).join('');
}
