// ── NAV ──
function nav(page) {
  if(page==='calendar') page='home';
  if(!document.getElementById('page-'+page)) page='home';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.hm-bnav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>{ if(b.getAttribute('onclick')===`nav('${page}')`) b.classList.add('active'); });
  document.querySelectorAll('.hm-bnav-item').forEach(b=>{ if(b.getAttribute('onclick')===`nav('${page}')`) b.classList.add('active'); });
  if(page==='home')     renderHome();
  if(page==='todo')     renderTodayView();
  if(page==='finance')  { restoreLdrSubtab(); }
  if(page==='shopping') renderShopping();
  if(page==='travel')   renderTravel();
  if(page==='food')     renderFood();
  if(page==='notes')    renderNotes();
}
