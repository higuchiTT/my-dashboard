// ── SUPABASE CONFIG ──
const SUPABASE_URL      = 'https://omlaxzscsifxfkmhdfic.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tbGF4enNjc2lmeGZrbWhkZmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTgyNzIsImV4cCI6MjA5NTczNDI3Mn0.tAIUF4ZiywP0wBWXSMvBW9ZMcB0K8qXOQ_DIFCvubP8';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STATE ──
let tasks    = JSON.parse(localStorage.getItem('hd_tasks')    || '[]');
let txs      = JSON.parse(localStorage.getItem('hd_tx')       || '[]');
let shopping = JSON.parse(localStorage.getItem('hd_shopping') || '[]');
let subs     = JSON.parse(localStorage.getItem('hd_subs')     || '[]');
let trips    = JSON.parse(localStorage.getItem('hd_trips')    || '[]');
let meals    = (()=>{ try{ return JSON.parse(localStorage.getItem('food_meals')||'[]'); }catch(e){ return []; } })();
let budgets  = (()=>{try{const v=JSON.parse(localStorage.getItem('ledger_budgets'));if(v&&typeof v==='object'&&!Array.isArray(v))return v;}catch(e){}return{base:{total:null,cats:{}},months:{}};})();
let accounts = (()=>{try{const v=JSON.parse(localStorage.getItem('ledger_accounts'));if(Array.isArray(v))return v;}catch(e){}return[];})();
let txRules  = (()=>{try{const v=JSON.parse(localStorage.getItem('ledger_tx_rules'));if(v&&typeof v==='object'&&!Array.isArray(v))return v;}catch(e){}return{rules:[]};})();
let ldrAccFilter = (()=>{try{return localStorage.getItem('ledger_acc_filter')||'all';}catch(e){return'all';}})();
let _ldrOpenAccMenuId = null;
let _ldrAccModalId = null;
let _ldrBalAdjAccId = null;
let tripFilter = 'all';
let shopFilter = 'all';
let reflections = (()=>{ try{ return JSON.parse(localStorage.getItem('reflections')||'[]'); }catch(e){ return []; } })();
let notesFilter = { tag: null, search: '' };
let notesVisibleCount = 50;
let notesNewTags = [];
let notesEditId = null;
let notesEditTags = [];
let _notesCal = { y: new Date().getFullYear(), m: new Date().getMonth() };

// ── TODO STATE ──
let todoState = {
  viewFilter: null,
  sectionFilter: null,
  tagFilter: null,
};
const tvOpenSections = { today: true, thisweek: false, later: false, undef: false };
let vy = new Date().getFullYear(), vm = new Date().getMonth();
const PAGE_TITLES = { home:'ホーム', todo:'TODO', finance:'家計 / 資産', shopping:'買い物リスト', travel:'旅行', food:'食事' };

const SUB_CAT_COLORS = {
  '住居':'#6366f1','光熱費':'#f59e0b','通信':'#06b6d4','交通':'#10b981',
  '動画':'#e11d48','音楽':'#7c3aed','AI':'#0891b2',
  'ストレージ':'#059669','ショッピング':'#d97706',
  '仕事':'#3b82f6','ゲーム':'#8b5cf6','その他':'#6b7280'
};

// ── TASK NOTES (separate store) ──
let taskNotes = {};
function loadTaskNotes(){try{taskNotes=JSON.parse(localStorage.getItem('hd_task_notes')||'{}');}catch(e){taskNotes={};}}
function saveTaskNotes(){localStorage.setItem('hd_task_notes',JSON.stringify(taskNotes));saveToSupabase();}
function migrateTaskNotes(){
  const titleSet=new Set(tasks.map(t=>t.title));
  const isOldFormat=Object.keys(taskNotes).some(k=>titleSet.has(k));
  if(!isOldFormat)return;
  const newNotes={};
  tasks.forEach(t=>{if(taskNotes[t.title]!==undefined)newNotes[t.id]=taskNotes[t.title];});
  taskNotes=newNotes;
  saveTaskNotes();
}
