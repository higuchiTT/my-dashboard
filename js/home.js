// ── HOME ──
function renderHome() {
  const todayStr = localDate();
  const now = new Date(todayStr+'T00:00:00');
  const w7 = new Date(now); w7.setDate(w7.getDate()+7);
  const pending = tasks.filter(t=>!t.done);
  const overdue = pending.filter(t=>t.due && t.due < todayStr);
  const thisWeek = pending.filter(t=>{if(!t.due)return false;return t.due>=todayStr && t.due<=localDate(w7);});

  // ── 0. Task strip ──
  const tsEl = document.getElementById('homeTaskStrip');
  if(tsEl) tsEl.innerHTML = `<div class="hm-task-strip" onclick="nav('todo')">
    <span class="hm-ts-item"><span class="hm-ts-num">${pending.length}</span> 未完了</span>
    <span class="hm-ts-sep">·</span>
    <span class="hm-ts-item hm-ts-od"><span class="hm-ts-num">${overdue.length}</span> 期限切れ</span>
    <span class="hm-ts-sep">·</span>
    <span class="hm-ts-item"><span class="hm-ts-num">${thisWeek.length}</span> 今週期限</span>
    <span class="hm-ts-arrow">To-Do ›</span>
  </div>`;

  // ── 1. 予定カード ──
  const endDate = new Date(now); endDate.setDate(endDate.getDate()+13);
  const endStr = localDate(endDate);
  const dayNames = '日月火水木金土'.split('');

  // Overdue items (oldest first, max 5)
  const overdueItems = overdue.slice().sort((a,b)=>a.due<b.due?-1:1);
  let overdueHTML = '';
  if(overdueItems.length) {
    const shown = overdueItems.slice(0,5);
    const rest = overdueItems.length - 5;
    overdueHTML = `<div class="hm-sched-group">
      <div class="hm-sched-date-label hm-sched-od-label">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M6 3.5V6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="6" cy="8.5" r=".6" fill="currentColor"/></svg>
        期限切れ <span class="hm-sched-od-count">${overdueItems.length}件</span>
      </div>
      ${shown.map(t=>`<div class="hm-sched-item hm-sched-task" onclick="nav('todo')">
        <span class="hm-sched-dot" style="background:${esc(getCatColor(t.category))}"></span>
        <span class="hm-sched-title">${esc(t.title)}</span>
        ${t.dueTime?`<span class="hm-sched-time">${esc(t.dueTime)}</span>`:''}
      </div>`).join('')}
      ${rest>0?`<div class="hm-sched-more" onclick="nav('todo')">他 ${rest} 件</div>`:''}
    </div>`;
  }

  // Daily groups: tasks + subs + trips in range
  const dailyGroups = {};
  pending.filter(t=>t.due && t.due>=todayStr && t.due<=endStr).forEach(t=>{
    if(!dailyGroups[t.due]) dailyGroups[t.due] = {tasks:[],subs:[],tripItems:[]};
    dailyGroups[t.due].tasks.push(t);
  });
  const activeSubs = subs.filter(s=>s.active && s.payDay);
  activeSubs.forEach(s=>{
    for(let cur=new Date(now);;cur.setDate(cur.getDate()+1)){
      const ds=localDate(cur);
      if(ds>endStr)break;
      const y=cur.getFullYear(),m=cur.getMonth(),day=cur.getDate();
      const daysInMo=new Date(y,m+1,0).getDate();
      const actualDay=Math.min(s.payDay,daysInMo);
      if(day!==actualDay)continue;
      if(s.cycle==='yearly'&&(s.payMonth||1)!==m+1)continue;
      const ym=`${y}-${String(m+1).padStart(2,'0')}`;
      const paid=txs.some(t=>String(t.subId)===String(s.id)&&t.subYm===ym);
      if(!dailyGroups[ds])dailyGroups[ds]={tasks:[],subs:[],tripItems:[]};
      dailyGroups[ds].subs.push({sub:s,ym,paid});
    }
  });
  // Trips: show once per trip — on today's row if ongoing, else on startDate if within range
  trips.filter(t=>!t.isIdea&&t.startDate&&t.endDate).forEach(t=>{
    const isOngoing=todayStr>=t.startDate&&todayStr<=t.endDate;
    let ds;
    if(isOngoing){
      ds=todayStr;
    } else if(t.startDate>=todayStr&&t.startDate<=endStr){
      ds=t.startDate;
    } else return;
    if(!dailyGroups[ds])dailyGroups[ds]={tasks:[],subs:[],tripItems:[]};
    const dayNum=isOngoing?Math.round((new Date(todayStr+'T00:00:00')-new Date(t.startDate+'T00:00:00'))/86400000)+1:null;
    const sd=new Date(t.startDate+'T00:00:00'),ed=new Date(t.endDate+'T00:00:00');
    const curY=new Date().getFullYear();
    const sPfx=sd.getFullYear()!==curY?`${sd.getFullYear()}/`:'';
    const rangeStr=`${sPfx}${sd.getMonth()+1}/${sd.getDate()}〜${ed.getMonth()+1}/${ed.getDate()}`;
    const label=isOngoing?`✈ ${t.dest} ${dayNum}日目`:`✈ ${t.dest}（${rangeStr}）`;
    dailyGroups[ds].tripItems.push({label,trip:t});
  });

  const tomorrowStr = localDate(new Date(now.getTime()+86400000));
  let daysHTML = '';
  Object.keys(dailyGroups).sort().forEach(ds=>{
    const dt = new Date(ds+'T00:00:00');
    const isToday = ds===todayStr;
    const isTomorrow = ds===tomorrowStr;
    let prefix = `${dt.getMonth()+1}/${dt.getDate()}（${dayNames[dt.getDay()]}）`;
    if(isToday) prefix = `今日 ${prefix}`;
    else if(isTomorrow) prefix = `明日 ${prefix}`;
    const {tasks:dayTasks,subs:daySubs,tripItems:dayTrips} = dailyGroups[ds];
    const items = [
      ...dayTasks.map(t=>`<div class="hm-sched-item hm-sched-task" onclick="nav('todo')">
        <span class="hm-sched-dot" style="background:${esc(getCatColor(t.category))}"></span>
        <span class="hm-sched-title">${esc(t.title)}</span>
        ${t.dueTime?`<span class="hm-sched-time">${esc(t.dueTime)}</span>`:''}
      </div>`),
      ...daySubs.map(({sub,paid})=>`<div class="hm-sched-item hm-sched-sub" onclick="event.stopPropagation();nav('finance');setTimeout(()=>{const btn=document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(4)');if(btn)ldrTab('subs',btn);},60)">
        <span class="hm-sched-sub-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 5h10" stroke="currentColor" stroke-width="1.3"/></svg></span>
        <span class="hm-sched-title">${esc(sub.name)} の支払い ¥${fmt(sub.price)}</span>
        ${paid?`<span class="hm-sched-paid">✓</span>`:''}
      </div>`),
      ...(dayTrips||[]).map(({label,trip})=>`<div class="hm-sched-item" onclick="openTripDetail('${esc(String(trip.id))}');nav('travel')">
        <span class="hm-sched-dot" style="background:var(--accent)"></span>
        <span class="hm-sched-title">${esc(label)}</span>
      </div>`)
    ].join('');
    daysHTML += `<div class="hm-sched-group">
      <div class="hm-sched-date-label${isToday?' hm-sched-today':''}">${esc(prefix)}</div>
      ${items}
    </div>`;
  });

  let scheduleContent = overdueHTML + daysHTML;
  if(!scheduleContent) scheduleContent = `<div class="hm-empty">2週間以内の予定はありません</div>`;
  const endDt = new Date(endStr+'T00:00:00');
  const subDateStr = `今日〜${endDt.getMonth()+1}/${endDt.getDate()}`;
  const schedEl = document.getElementById('homeScheduleCol');
  if(schedEl) schedEl.innerHTML = `<div class="hm-card">
    <div class="hm-card-hdr" onclick="nav('todo')">
      <div class="hm-card-hdr-left">
        <div class="hm-card-title">予定</div>
        <div class="hm-card-sub">${esc(subDateStr)}</div>
      </div>
      <div class="hm-card-link">To-Do ›</div>
    </div>
    <div class="hm-card-body hm-schedule-body">${scheduleContent}</div>
  </div>`;

  // ── 2. ファイナンスカード ──
  const nowDate = new Date();
  const cy = nowDate.getFullYear(), cm = nowDate.getMonth();
  const thisMonthTxs = txs.filter(t=>{
    if(!t.date||t.type==='transfer'||t.type==='adjust')return false;
    const d = new Date(t.date+'T00:00:00');
    return d.getFullYear()===cy && d.getMonth()===cm;
  });
  const income = thisMonthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = thisMonthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance = income - expense;
  const eb = getEffBudget(cy,cm);
  let budgetHTML = '';
  if(eb.total!==null && eb.total!==undefined) {
    const pct = eb.total>0?expense/eb.total*100:0;
    const over = expense>eb.total;
    const warn80 = pct>=80&&!over;
    const barColor = over?'var(--accent)':warn80?'var(--warn)':'var(--ok)';
    budgetHTML = `<div class="hm-finance-budget">
      <div class="hm-finance-budget-row">
        <span class="hm-finance-budget-label">予算</span>
        <span class="hm-finance-budget-val${over?' hm-finance-budget-over':warn80?' hm-finance-budget-warn':''}">支出 ¥${fmt(expense)} / ¥${fmt(eb.total)}</span>
        <span class="hm-finance-budget-pct${over?' over':warn80?' warn':''}">${Math.round(pct)}%</span>
      </div>
      <div class="hm-prog-wrap"><div class="hm-prog-bar" style="width:${Math.min(pct,100).toFixed(1)}%;background:${barColor}"></div></div>
    </div>`;
  } else {
    budgetHTML = `<div class="hm-finance-no-budget">予算は未設定です</div>`;
  }
  const asOf = todayStr;
  const activeAccounts = accounts.filter(a=>!a.archived).sort((a,b)=>(a.order||0)-(b.order||0));
  let netWorthHTML = '';
  if(!activeAccounts.length) {
    netWorthHTML = `<div class="hm-finance-no-acc">口座を登録すると純資産が表示されます</div>`;
  } else {
    const net = activeAccounts.reduce((s,a)=>s+accountBalance(a,asOf),0);
    const accRows = activeAccounts.slice(0,5).map(a=>{
      const bal = accountBalance(a,asOf);
      return `<div class="hm-acc-row"><span class="hm-acc-name">${esc(a.name)}</span><span class="hm-acc-bal${bal<0?' neg':''}">${bal<0?'-':''}¥${fmt(Math.abs(bal))}</span></div>`;
    }).join('');
    netWorthHTML = `<div class="hm-finance-net">
      <div class="hm-finance-net-label">純資産</div>
      <div class="hm-finance-net-val${net<0?' neg':''}">${net<0?'-':''}¥${fmt(Math.abs(net))}</div>
    </div><div class="hm-acc-list">${accRows}</div>`;
  }
  const monLabel = `${cy}年${cm+1}月`;
  const finEl = document.getElementById('homeFinanceCard');
  if(finEl) finEl.innerHTML = `<div class="hm-card">
    <div class="hm-card-hdr" onclick="nav('finance')">
      <div class="hm-card-hdr-left">
        <div class="hm-card-title">ファイナンス</div>
        <div class="hm-card-sub">${esc(monLabel)}</div>
      </div>
      <div class="hm-card-link">Ledger ›</div>
    </div>
    <div class="hm-card-body">
      <div class="hm-finance-nums">
        <div class="hm-finance-num-item"><div class="hm-finance-num-label">収入</div><div class="hm-finance-num-val inc">¥${fmt(income)}</div></div>
        <div class="hm-finance-num-item"><div class="hm-finance-num-label">支出</div><div class="hm-finance-num-val exp">¥${fmt(expense)}</div></div>
        <div class="hm-finance-num-item"><div class="hm-finance-num-label">収支</div><div class="hm-finance-num-val ${balance>=0?'pos':'neg'}">${balance>=0?'+':'−'}¥${fmt(Math.abs(balance))}</div></div>
      </div>
      ${budgetHTML}
      ${netWorthHTML}
      ${(()=>{
        const last=getLastImportAt();
        if(!last)return'';
        const now2=new Date();
        const diffDays=_daysSinceLocal(last);
        const lastStr=`${last.getMonth()+1}/${last.getDate()}`;
        if(diffDays>=7){
          return`<div style="display:flex;align-items:center;gap:8px;padding:6px 16px 8px;border-top:1px solid rgba(26,24,20,0.07);flex-wrap:wrap;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);font-weight:700;">取り込みから ${diffDays}日 (${lastStr})</span>
            <button style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);background:transparent;border:1px solid var(--accent);border-radius:4px;padding:2px 8px;cursor:pointer;" onclick="event.stopPropagation();nav('finance');setTimeout(()=>{_ldrOpenTab('import');},80)">取り込む ›</button>
          </div>`;
        }
        return`<div style="padding:5px 16px 8px;border-top:1px solid rgba(26,24,20,0.07);font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink3);">最後の CSV 取り込み: ${diffDays}日前（${lastStr}）</div>`;
      })()}
    </div>
  </div>`;

  // ── 3. 食事カード（14日帯）──
  const startFoodDate = new Date(now); startFoodDate.setDate(startFoodDate.getDate()-13);
  const foodDates = [];
  for(let i=0;i<14;i++){const d=new Date(startFoodDate);d.setDate(d.getDate()+i);foodDates.push(localDate(d));}
  const mealMap = {};
  meals.forEach(m=>{if(foodDates.includes(m.date))mealMap[m.date]=m;});
  const kindOrder14 = ['breakfast','lunch','dinner','snack'];
  const cellsHTML = foodDates.map(ds=>{
    const dt = new Date(ds+'T00:00:00');
    const isToday = ds===todayStr;
    const dow = dt.getDay();
    const dowClass = dow===0?' hm-food-sun':dow===6?' hm-food-sat':'';
    const meal = mealMap[ds];
    let thumbHTML = '';
    if(meal){
      const fp=(()=>{for(const s of(meal.sittings||[])){for(const d of(s.dishes||[])){if(d.photos&&d.photos.length)return d.photos[0];}}return null;})();
      const firstName = (()=>{for(const s of(meal.sittings||[])){for(const d of(s.dishes||[])){if(d.name)return d.name[0];}}return null;})();
      if(fp) thumbHTML=`<div style="border-radius:3px;overflow:hidden;margin-bottom:2px;aspect-ratio:1"><img data-path="${esc(fp.path)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
      else thumbHTML=`<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--paper2);border-radius:3px;margin-bottom:2px;font-size:12px;font-weight:700;font-family:'Space Grotesk',sans-serif;color:var(--ink3)">${esc(firstName||'●')}</div>`;
    } else {
      thumbHTML=`<div style="aspect-ratio:1;margin-bottom:2px;border-radius:3px;background:rgba(26,24,20,0.04)"></div>`;
    }
    const presentKinds = new Set();
    if(meal)(meal.sittings||[]).forEach(s=>presentKinds.add(s.kind));
    const dotsHTML = kindOrder14.map(k=>`<span class="hm-food-dot${presentKinds.has(k)?' active':''}"></span>`).join('');
    return `<div class="hm-food-cell${isToday?' hm-food-today':''}" onclick="foodHomeCell('${esc(ds)}')">
      <div class="hm-food-day${dowClass}">${dt.getDate()}</div>
      <div class="hm-food-dow-sm${dowClass}">${dayNames[dt.getDay()]}</div>
      ${thumbHTML}
      <div class="hm-food-dots">${dotsHTML}</div>
    </div>`;
  }).join('');
  let eatCount=0,homeCook=0,outEat=0;
  foodDates.forEach(ds=>{const m=mealMap[ds];if(!m)return;(m.sittings||[]).forEach(s=>{eatCount++;const hasOut=(s.dishes||[]).some(d=>d.type==='out');if(hasOut)outEat++;else homeCook++;});});
  const foodEl = document.getElementById('homeFoodCard');
  if(foodEl){
    foodEl.innerHTML = `<div class="hm-card">
      <div class="hm-card-hdr" onclick="nav('food')">
        <div class="hm-card-hdr-left">
          <div class="hm-card-title">食事</div>
          <div class="hm-card-sub">直近2週間</div>
        </div>
        <div class="hm-card-link">Food ›</div>
      </div>
      <div class="hm-card-body">
        <div class="hm-food-grid" id="homeFoodGrid">${cellsHTML}</div>
        <div class="hm-food-summary">2週間で食事 ${eatCount} 回（自炊 ${homeCook} / 外食 ${outEat}）</div>
      </div>
    </div>`;
    fillSignedUrls(document.getElementById('homeFoodGrid'));
  }
}

function foodHomeCell(ds) {
  nav('food');
  const dt = new Date(ds+'T00:00:00');
  foodCalY = dt.getFullYear();
  foodCalM = dt.getMonth();
  foodCalSelDay = ds;
  renderFood();
  const meal = meals.find(m=>m.date===ds);
  if(meal) setTimeout(()=>openFoodDetailPopup(String(meal.id)),60);
  else setTimeout(()=>openFoodModalNew(ds),60);
}
