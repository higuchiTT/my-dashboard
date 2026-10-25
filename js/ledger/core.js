// ── FINANCE ──
// ── Category master helpers ──
function _catDefaultDefs(){
  // Closed-scope defaults used only for initialization
  const EXP=[
    {name:'食費',color:'#f97316'},{name:'家賃',color:'#92400e'},{name:'光熱費',color:'#f59e0b'},
    {name:'通信費',color:'#0e7490'},{name:'交通費',color:'#3b82f6'},{name:'娯楽',color:'#8b5cf6'},
    {name:'医療',color:'#ef4444'},{name:'衣服',color:'#ec4899'},{name:'日用品',color:'#22c55e'},
    {name:'その他',color:'#6b7280'}
  ];
  const INC=[
    {name:'給与',color:'#5a6b3a'},{name:'副収入',color:'#059669'}
  ];
  return{exp:EXP,inc:INC};
}

// 自動で作るカテゴリは名前から決まる ID にする（複数の端末で同時に作っても、同期のマージで重複しない）
function _catAutoId(kind,name){return 'cat:'+kind+':'+name;}
function _initCategories(){
  // Build from defaults if missing or empty
  const defs=_catDefaultDefs();
  if(!txRules.categories||!txRules.categories.length){
    let order=0;
    txRules.categories=[
      ...defs.exp.map(d=>({id:_catAutoId('expense',d.name),name:d.name,kind:'expense',color:d.color,order:order++,hidden:false})),
      ...defs.inc.map(d=>({id:_catAutoId('income',d.name),name:d.name,kind:'income',color:d.color,order:order++,hidden:false}))
    ];
  }
  // Ensure 'その他' exists and is undeletable/uneditable
  if(!txRules.categories.some(c=>c.name==='その他')){
    txRules.categories.push({id:_catAutoId('expense','その他'),name:'その他',kind:'expense',color:'#6b7280',order:9999,hidden:false});
  }
  // Add categories from existing txs that are not in master
  const masterNames=new Set(txRules.categories.map(c=>c.name));
  const PALETTE=['#f97316','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ef4444','#ec4899','#06b6d4','#84cc16','#14b8a6','#a78bfa','#fb923c'];
  let extraOrder=txRules.categories.length;
  txs.forEach(t=>{
    if(t.category&&!masterNames.has(t.category)){
      const kind=(t.type==='income')?'income':'expense';
      const color=PALETTE[extraOrder%PALETTE.length];
      txRules.categories.push({id:_catAutoId(kind,t.category),name:t.category,kind,color,order:extraOrder++,hidden:false});
      masterNames.add(t.category);
    }
  });
}

function getCategories(kind){
  if(!txRules.categories)return[];
  return txRules.categories.filter(c=>c.kind===kind&&!c.hidden).sort((a,b)=>(a.order||0)-(b.order||0));
}
function getAllCategories(){
  if(!txRules.categories)return[];
  return txRules.categories.slice().sort((a,b)=>(a.order||0)-(b.order||0));
}
function catColor(name){
  if(!txRules.categories)return'#6b7280';
  const c=txRules.categories.find(x=>x.name===name);
  return c?c.color:'#6b7280';
}
const LDR_MONTHS='1月 2月 3月 4月 5月 6月 7月 8月 9月 10月 11月 12月'.split(' ');
let ldrTxFilter='all';        // overview recent: all/income/expense
let ldrListFilter='all';      // txlist: all/income/expense
let ldrListSearch='';
let ldrListCat='all';
let ldrEditingTxId=null;      // null=new, string=edit
let ldrTxModalType='expense'; // current modal type
let _ldrOpenMenuId=null;
let _ldrOpenMenuEl=null;      // currently open ... menu

function _ldrActiveTab(){const a=document.querySelector('#ldrSubtabs .ui-seg-btn.active');return a?a.getAttribute('onclick').match(/'(\w+)'/)?.[1]||'overview':'overview';}
function chMonth(d){vm+=d;if(vm>11){vm=0;vy++;}if(vm<0){vm=11;vy--;}const t=_ldrActiveTab();if(t==='overview')renderFinance();else if(t==='txlist')renderLdrTxList();else if(t==='budget')renderBudgetPanel();else if(t==='accounts')renderAccountsPanel();else if(t==='subs')renderSubs();else if(t==='review')renderReviewPanel();}
function goMonthToday(){const n=new Date();vy=n.getFullYear();vm=n.getMonth();const t=_ldrActiveTab();if(t==='overview')renderFinance();else if(t==='txlist')renderLdrTxList();else if(t==='budget')renderBudgetPanel();else if(t==='accounts')renderAccountsPanel();else if(t==='subs')renderSubs();else if(t==='review')renderReviewPanel();}
function saveTx(){localStorage.setItem('hd_tx',JSON.stringify(txs));saveToSupabase();renderHome();}
function saveTxRules(){localStorage.setItem('ledger_tx_rules',JSON.stringify(txRules));saveToSupabase();ldrListInitDone=false;}

// ── normTxName ──
function normTxName(s,forMatch){
  if(!s)return'';
  let n=String(s).normalize('NFKC').trim().replace(/\s+/g,' ');
  n=n.replace(/^\d{4,8}\s+/,'');
  n=n.replace(/([ァ-ヶ])-/g,'$1ー'); // 半角カナの長音（ｰ ではなく - のもの）
  if(forMatch)n=n.toLowerCase();
  return n;
}
// ── txCoreName: 類似店舗マッチ用のコア店名を取り出す ──
function txCoreName(name){
  const n=normTxName(name,true);
  if(!n)return'';
  let parts=n.split(/\s+/).filter(p=>p.length>0);
  // 末尾のトークンが店舗名サフィックスなら除去（複数語のときのみ）
  if(parts.length>1){
    const locSuffix=/(店|支店|店舗|駅前|駅東口|駅西口|本店|本町)$/;
    if(locSuffix.test(parts[parts.length-1]))parts=parts.slice(0,-1);
  }
  // 数字のみのトークン・#N・No.N（店番号）を除去
  parts=parts.filter(p=>!/^(\d+|#\d+|no\.\d+)$/i.test(p));
  const result=parts.join(' ');
  return result.length>=2?result:n;
}

// ── sub-tab navigation ──
function ldrTab(tab, el){
  try{localStorage.setItem('ledger_subtab',tab);}catch(e){}
  document.querySelectorAll('#ldrSubtabs .ui-seg-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  ['overview','txlist','accounts','subs','budget','review','import','settings'].forEach(t=>{
    const p=document.getElementById('ldrPanel'+t.charAt(0).toUpperCase()+t.slice(1));
    if(p)p.style.display=(t===tab?'block':'none');
  });
  // mobile onboard: only show on overview
  const mobOnboard=document.getElementById('ldrMobOnboard');
  if(mobOnboard)mobOnboard.style.display=(tab==='overview')?'':'none';
  const showMon=tab==='overview'||tab==='txlist'||tab==='budget'||tab==='accounts'||tab==='subs'||tab==='review';
  const nav=document.getElementById('ldrMonNav');
  if(nav)nav.style.display=showMon?'':'none';
  if(tab==='overview')renderFinance();
  else if(tab==='txlist')renderLdrTxList();
  else if(tab==='subs'){renderSubs();}
  else if(tab==='accounts')renderAccountsPanel();
  else if(tab==='budget')renderBudgetPanel();
  else if(tab==='review')renderReviewPanel();
  else if(tab==='import')renderLdrImport();
  else if(tab==='settings')renderLdrSettings();
}
function restoreLdrSubtab(){
  let tab='overview';
  try{tab=localStorage.getItem('ledger_subtab')||'overview';}catch(e){}
  const btn=document.querySelector(`#ldrSubtabs .ui-seg-btn[onclick*="'${tab}'"]`);
  if(btn)ldrTab(tab,btn);else renderFinance();
}
function renderLdrPlaceholder(panelId,title,desc){
  const p=document.getElementById(panelId);if(!p)return;
  p.innerHTML=`<div class="ui-card ldr-coming-soon"><div class="ldr-coming-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="12" y2="12"/></svg></div><div class="ldr-coming-title">${esc(title)}</div><div class="ldr-coming-text">${esc(desc)}</div></div>`;
}
