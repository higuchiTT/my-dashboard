// ── IMPORT ──
let _importState=null;
let _importFilter='all';

function _parseCSV(text){
  const rows=[];let i=0,n=text.length;
  while(i<n){
    const row=[];
    while(i<n&&text[i]!=='\n'&&text[i]!=='\r'){
      if(text[i]==='"'){
        i++;let cell='';
        while(i<n){
          if(text[i]==='"'){if(i+1<n&&text[i+1]==='"'){cell+='"';i+=2;}else{i++;break;}}
          else{cell+=text[i++];}
        }
        row.push(cell);
        if(i<n&&text[i]===',')i++;
      } else {
        let s=i;while(i<n&&text[i]!==','&&text[i]!=='\n'&&text[i]!=='\r')i++;
        row.push(text.slice(s,i));
        if(i<n&&text[i]===',')i++;
      }
    }
    if(i<n&&text[i]==='\r'&&i+1<n&&text[i+1]==='\n')i++;
    if(i<n)i++;
    if(row.some(c=>c.trim()!==''))rows.push(row);
  }
  return rows;
}

function _parseDateStr(s){
  if(!s)return null;
  s=String(s).trim();
  let m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m)return`${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function _parseAmtStr(s){
  if(!s||!String(s).trim())return 0;
  const n=parseFloat(String(s).replace(/[,円¥\s]/g,''));
  return isNaN(n)?0:Math.abs(n);
}

function _detectImportFormat(headers){
  const hs=headers.map(h=>String(h).trim());
  if(hs.some(h=>h==='摘要内容')&&hs.some(h=>h==='支払い金額')&&hs.some(h=>h==='預かり金額'))return'mufg';
  if(hs.some(h=>h.includes('利用日'))&&hs.some(h=>h.includes('利用店名')))return'rakuten';
  return'unknown';
}

function _defaultAccountForFormat(fmt){
  const aa=accounts.filter(a=>!a.archived);
  if(fmt==='mufg'){
    const a=aa.find(a=>a.kind==='bank'&&(a.name.includes('UFJ')||a.name.includes('三菱')));
    if(a)return String(a.id);
    const b=aa.find(a=>a.kind==='bank');
    if(b)return String(b.id);
  }
  if(fmt==='rakuten'){
    const a=aa.find(a=>a.kind==='card'&&a.name.includes('楽天'));
    if(a)return String(a.id);
    const b=aa.find(a=>a.kind==='card');
    if(b)return String(b.id);
  }
  return'';
}

function _parseMUFGRows(csvRows){
  const headers=csvRows[0].map(h=>h.trim());
  const get=name=>headers.indexOf(name);
  const iDate=get('日付'),iSum=get('摘要'),iCont=get('摘要内容'),iDeb=get('支払い金額'),iCre=get('預かり金額'),iMemo=get('メモ');
  const parsed=[];let skip=0;
  for(let i=1;i<csvRows.length;i++){
    const r=csvRows[i];
    const date=_parseDateStr(iDate>=0?r[iDate]:'');
    if(!date){skip++;continue;}
    const rawTitle=(iCont>=0&&r[iCont]&&r[iCont].trim())?r[iCont].trim():(iSum>=0?(r[iSum]||'').trim():'');
    const debit=iDeb>=0?_parseAmtStr(r[iDeb]):0;
    const credit=iCre>=0?_parseAmtStr(r[iCre]):0;
    const note=iMemo>=0?(r[iMemo]||'').trim():'';
    parsed.push({date,rawTitle,debit,credit,note});
  }
  return{rows:parsed,skipCount:skip};
}

function _parseRakutenRows(csvRows){
  const headers=csvRows[0].map(h=>h.trim());
  const fi=pred=>headers.findIndex(pred);
  const iDate=fi(h=>h.includes('利用日'));
  const iTitle=fi(h=>h.includes('利用店名'));
  let iAmt=fi(h=>h.includes('利用金額'));
  if(iAmt<0)iAmt=fi(h=>h.includes('支払総額'));
  const parsed=[];let skip=0;
  for(let i=1;i<csvRows.length;i++){
    const r=csvRows[i];
    const date=_parseDateStr(iDate>=0?r[iDate]:'');
    if(!date){skip++;continue;}
    const rawTitle=iTitle>=0?(r[iTitle]||'').trim():'';
    const amtVal=parseFloat((iAmt>=0?r[iAmt]:'0').replace(/[,円¥\s]/g,''))||0;
    const debit=amtVal>0?amtVal:0;
    const credit=amtVal<0?Math.abs(amtVal):0;
    parsed.push({date,rawTitle,debit,credit,note:''});
  }
  return{rows:parsed,skipCount:skip};
}

function _parseUnknownRows(csvRows,colAssign){
  const parsed=[];let skip=0;
  const {iDate,iTitle,iDebit,iCredit,iSigned}=colAssign;
  for(let i=1;i<csvRows.length;i++){
    const r=csvRows[i];
    const date=_parseDateStr(iDate>=0?r[iDate]:'');
    if(!date){skip++;continue;}
    const rawTitle=iTitle>=0?(r[iTitle]||'').trim():'';
    let debit=0,credit=0;
    if(iSigned>=0){
      const v=parseFloat((r[iSigned]||'0').replace(/[,円¥\s]/g,''))||0;
      if(v>0)debit=v;else if(v<0)credit=Math.abs(v);
    } else {
      debit=iDebit>=0?_parseAmtStr(r[iDebit]):0;
      credit=iCredit>=0?_parseAmtStr(r[iCredit]):0;
    }
    parsed.push({date,rawTitle,debit,credit,note:''});
  }
  return{rows:parsed,skipCount:skip};
}

function _buildImportRows(parsedRows,accountId){
  const keyCount={};
  return parsedRows.map(p=>{
    const srcName=normTxName(p.rawTitle);
    const srcKey=normTxName(p.rawTitle,true);
    const debit=p.debit||0,credit=p.credit||0;
    const kind=credit>0?'income':'expense';
    const amount=kind==='income'?credit:debit;
    const kindKey=kind==='income'?'in':'out';
    const baseKey=`${accountId}|${p.date}|${amount}|${kindKey}|${srcKey}`;
    keyCount[baseKey]=(keyCount[baseKey]||0)+1;
    const seq=keyCount[baseKey];
    const importKey=seq===1?baseKey:`${baseKey}|#${seq}`;
    const alreadyImported=txs.some(t=>t.importKey===importKey);
    let dupStatus=null;
    if(alreadyImported)dupStatus='imported';
    else if(txs.some(t=>!t.importKey&&String(t.accountId)===String(accountId)&&t.date===p.date&&t.amount===amount&&t.type===kind))dupStatus='possible';
    return{
      _id:crypto.randomUUID(),checked:!alreadyImported,date:p.date,title:srcName||p.rawTitle,
      srcName,rawTitle:p.rawTitle,amount,kind,note:p.note||'',importKey,dupStatus,
      basis:'none',type:kind,category:'その他',toAccountId:'',autoRule:false,_autoRuleSet:false,_userToggledRule:false,_initial:null,
    };
  });
}

function _applyAutoClassify(rows,accountId){
  rows.forEach(row=>{
    const srcKey=normTxName(row.title,true);
    const rules=txRules.rules||[];
    let found=false;
    for(const r of rules){
      if(!r.keyword)continue;
      if(srcKey.includes(r.keyword.toLowerCase())){
        row.type=r.type;row.category=r.category||'その他';row.toAccountId=r.toAccountId||'';row.basis='rule';row._ruleId=String(r.id);found=true;break;
      }
    }
    if(!found){
      // ② 学習（srcName/タイトルの完全一致）
      const matching=txs.filter(t=>{const ts=t.srcName?normTxName(t.srcName,true):normTxName(t.title,true);return ts===srcKey&&ts!=='';});
      if(matching.length){
        const ref=matching.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
        row.basis='learned';
        if(ref.type==='transfer'){
          row.type='transfer';
          const toAcc=ref.toAccountId&&String(ref.toAccountId)!==String(accountId)?ref.toAccountId:(ref.fromAccountId||'');
          row.toAccountId=toAcc||'';
        } else {
          row.type=ref.type||row.kind;row.category=ref.category||'その他';row.toAccountId='';
        }
      } else {
        // ③ 学習（txCoreName が一致する類似店舗）
        const coreName=txCoreName(row.title);
        if(coreName&&coreName!==srcKey){
          const coreMatching=txs.filter(t=>{
            const ts=t.srcName?txCoreName(t.srcName):txCoreName(t.title);
            return ts===coreName&&ts!==''&&(t.type==='expense'||t.type==='income');
          });
          if(coreMatching.length){
            const ref=coreMatching.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
            row.basis='similar';
            row.type=ref.type||row.kind;row.category=ref.category||'その他';row.toAccountId='';
          }
        }
      }
    }
  });
}

function _initImportInitial(rows){
  rows.forEach(r=>{
    r._initial={type:r.type,category:r.category,toAccountId:r.toAccountId};
    r._autoRuleSet=false;r._userToggledRule=false;
  });
}

function _checkAutoRule(row){
  if(!row._initial)return;
  const differs=row.type!==row._initial.type||row.category!==row._initial.category||row.toAccountId!==row._initial.toAccountId;
  if(differs){
    if(!row._userToggledRule){row.autoRule=true;row._autoRuleSet=true;}
  } else {
    if(row._autoRuleSet&&!row._userToggledRule){row.autoRule=false;row._autoRuleSet=false;}
  }
}

// ── MULTI-FILE HELPERS ──
function _importAllRows(){
  if(!_importState)return[];
  return _importState.files.flatMap(f=>f.rows);
}

function _importFindRow(id){
  if(!_importState)return null;
  for(const f of _importState.files){
    const row=f.rows.find(r=>r._id===id);
    if(row)return{row,file:f};
  }
  return null;
}

async function _importHandleFiles(files){
  if(!files||!files.length)return;
  const fileObjects=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];
    const buf=await file.arrayBuffer();
    let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf);}
    catch(e){text=new TextDecoder('shift_jis').decode(buf);}
    if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
    const csvRows=_parseCSV(text);
    if(!csvRows.length){uiAlert(`${file.name}: CSVを読み込めませんでした`);continue;}
    const headers=csvRows[0].map(h=>h.trim());
    const detectedFormat=_detectImportFormat(headers);
    const accountId=_defaultAccountForFormat(detectedFormat);
    if(detectedFormat==='unknown'){
      fileObjects.push({fileIdx:i,fileName:file.name,format:'unknown',formatName:'形式不明',accountId,rows:[],skipCount:0,totalCount:csvRows.length-1,csvRows,colAssign:{iDate:-1,iTitle:-1,iDebit:-1,iCredit:-1,iSigned:-1},pendingParse:true,showColAssign:false});
    } else {
      let pr;
      if(detectedFormat==='mufg')pr=_parseMUFGRows(csvRows);
      else pr=_parseRakutenRows(csvRows);
      const rows=_buildImportRows(pr.rows,accountId);
      _applyAutoClassify(rows,accountId);
      _initImportInitial(rows);
      fileObjects.push({fileIdx:i,fileName:file.name,format:detectedFormat,formatName:detectedFormat==='mufg'?'三菱UFJ銀行':'楽天カード',accountId,rows,skipCount:pr.skipCount,totalCount:pr.rows.length+pr.skipCount,csvRows,colAssign:{iDate:-1,iTitle:-1,iDebit:-1,iCredit:-1,iSigned:-1},pendingParse:false,showColAssign:false});
    }
  }
  if(!fileObjects.length)return;
  _importState={files:fileObjects};
  _importFilter='all';
  renderLdrImport();
}

function _importFromFileInput(files){_importHandleFiles(files);}

function _importApplyColAssign(fi){
  if(!_importState)return;
  const f=_importState.files[fi];if(!f||!f.csvRows)return;
  const get=id=>{const el=document.getElementById(id+'_'+fi);return el?parseInt(el.value):-1;};
  const colAssign={iDate:get('impColDate'),iTitle:get('impColTitle'),iDebit:get('impColDebit'),iCredit:get('impColCredit'),iSigned:get('impColSigned')};
  const pr=_parseUnknownRows(f.csvRows,colAssign);
  const rows=_buildImportRows(pr.rows,f.accountId);
  _applyAutoClassify(rows,f.accountId);
  _initImportInitial(rows);
  f.rows=rows;f.skipCount=pr.skipCount;f.totalCount=pr.rows.length+pr.skipCount;f.colAssign=colAssign;f.pendingParse=false;f.showColAssign=false;
  renderLdrImport();
}

function _importShowColAssign(fi){
  if(!_importState)return;
  const f=_importState.files[fi];if(f){f.showColAssign=true;renderLdrImport();}
}

function _importSetAccount(fi,accId){
  if(!_importState)return;
  const f=_importState.files[fi];if(!f)return;
  f.accountId=accId;
  if(f.rows.length){_applyAutoClassify(f.rows,accId);_initImportInitial(f.rows);}
  renderLdrImport();
}

function _importToggleCheck(id){
  const found=_importFindRow(id);
  if(found){found.row.checked=!found.row.checked;_refreshImportConfirmCount();}
}

function _importToggleAll(val){
  if(!_importState)return;
  _importState.files.forEach(f=>f.rows.forEach(r=>{if(r.type!=='skip')r.checked=val;}));
  _refreshImportTbody();
}

function _importSetFilter(f){
  _importFilter=f;
  _refreshImportTbody();
}

function _importSetType(id,type){
  if(!_importState)return;
  const found=_importFindRow(id);if(!found)return;
  const{row,file}=found;
  row.type=type;if(type==='skip')row.checked=false;
  _checkAutoRule(row);
  const srcKey=normTxName(row.title,true);
  let otherCount=0;
  file.rows.forEach(r=>{if(r._id!==id&&normTxName(r.title,true)===srcKey&&srcKey!=''){r.type=type;if(type==='skip')r.checked=false;_checkAutoRule(r);otherCount++;}});
  if(otherCount>=1)_importShowToast(`同じお店の ${otherCount} 件も変更しました`);
  _refreshImportTbody();
}

function _importSetCat(id,cat){
  if(!_importState)return;
  const found=_importFindRow(id);if(!found)return;
  const{row,file}=found;
  row.category=cat;
  _checkAutoRule(row);
  const srcKey=normTxName(row.title,true);
  let otherCount=0;
  file.rows.forEach(r=>{if(r._id!==id&&normTxName(r.title,true)===srcKey&&srcKey!=''){r.category=cat;_checkAutoRule(r);otherCount++;}});
  if(otherCount>=1)_importShowToast(`同じお店の ${otherCount} 件も変更しました`);
  _refreshImportTbody();
}

function _importSetToAcc(id,accId){
  if(!_importState)return;
  const found=_importFindRow(id);if(!found)return;
  const{row,file}=found;
  row.toAccountId=accId;
  _checkAutoRule(row);
  const srcKey=normTxName(row.title,true);
  let otherCount=0;
  file.rows.forEach(r=>{if(r._id!==id&&normTxName(r.title,true)===srcKey&&srcKey!=''){r.toAccountId=accId;_checkAutoRule(r);otherCount++;}});
  if(otherCount>=1)_importShowToast(`同じお店の ${otherCount} 件も変更しました`);
  _refreshImportTbody();
}

function _importToggleAutoRule(id){
  const found=_importFindRow(id);
  if(found){const row=found.row;row.autoRule=!row.autoRule;row._autoRuleSet=false;row._userToggledRule=true;}
}

function _importEditTitle(id,el){
  if(!_importState)return;
  const found=_importFindRow(id);if(!found)return;
  const row=found.row;
  const inp=document.createElement('input');
  inp.className='ldr-imp-title-in';inp.type='text';inp.value=row.title;
  inp.style.width=Math.max(80,row.title.length*8)+'px';
  el.replaceWith(inp);inp.focus();inp.select();
  const done=()=>{
    const v=inp.value.trim()||row.title;row.title=v;
    const sp=document.createElement('span');sp.className='ldr-imp-title-cell';sp.textContent=v;
    sp.onclick=ev=>{ev.stopPropagation();_importEditTitle(id,sp);};
    inp.replaceWith(sp);
  };
  inp.onblur=done;
  inp.onclick=e=>e.stopPropagation();
  inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.value=row.title;inp.blur();}};
}

function _refreshImportTbody(){
  if(!_importState)return;
  _importState.files.forEach((f,fi)=>{
    const tbody=document.getElementById(`ldrImportTbody_${fi}`);
    if(!tbody)return;
    let rows=f.rows;
    if(_importFilter==='unclassified')rows=rows.filter(r=>r.basis==='none'&&r.type!=='skip');
    else if(_importFilter==='dup')rows=rows.filter(r=>r.dupStatus);
    tbody.innerHTML=rows.map(r=>_importRowHtml(r,f)).join('');
  });
  _refreshImportConfirmCount();
}

function _refreshImportConfirmCount(){
  const btn=document.getElementById('ldrImportConfirmBtn');
  if(!btn||!_importState)return;
  const cnt=_importAllRows().filter(r=>r.checked&&r.type!=='skip').length;
  btn.textContent=`${cnt} 件を取り込む`;
}

let _importToastTimer=null;
function _importShowToast(msg){
  let toastEl=document.getElementById('ldrImportToast');
  if(toastEl){
    toastEl.textContent=msg;
    toastEl.classList.add('visible');
    if(_importToastTimer)clearTimeout(_importToastTimer);
    _importToastTimer=setTimeout(()=>toastEl.classList.remove('visible'),3000);
  }
}

function _importRowHtml(row,st){
  const id=esc(String(row._id));
  const noAcc=!st.accountId;
  // Show visible cats; also include current row.category even if hidden
  const visCats=getAllCategories().filter(c=>!c.hidden);
  const extraCat=(row.category&&!visCats.some(c=>c.name===row.category))?[{name:row.category}]:[];
  const catKeys=[...visCats,...extraCat].map(c=>c.name);
  const catOpts=catKeys.map(c=>`<option value="${esc(c)}"${c===row.category?' selected':''}>${esc(c)}</option>`).join('');
  const toAccList=accounts.filter(a=>!a.archived&&String(a.id)!==String(st.accountId));
  const toAccOpts=`<option value="">振替先を選択</option>`+toAccList.map(a=>`<option value="${esc(String(a.id))}"${String(a.id)===String(row.toAccountId)?' selected':''}>${esc(a.name)}</option>`).join('');
  const typeSel=`<select class="ldr-imp-sel" onchange="event.stopPropagation();_importSetType('${id}',this.value)" onclick="event.stopPropagation()"><option value="expense"${row.type==='expense'?' selected':''}>支出</option><option value="income"${row.type==='income'?' selected':''}>収入</option><option value="transfer"${row.type==='transfer'?' selected':''}${noAcc?' disabled':''}>振替</option><option value="skip"${row.type==='skip'?' selected':''}>取り込まない</option></select>`;
  let catCell='';
  if(row.type==='transfer')catCell=`<select class="ldr-imp-sel" onchange="event.stopPropagation();_importSetToAcc('${id}',this.value)" onclick="event.stopPropagation()" style="min-width:100px;">${toAccOpts}</select>`;
  else if(row.type==='skip')catCell=`<span style="color:var(--mute);font-size:12px;">—</span>`;
  else catCell=`<select class="ldr-imp-sel" onchange="event.stopPropagation();_importSetCat('${id}',this.value)" onclick="event.stopPropagation()" style="min-width:90px;">${catOpts}</select>`;
  let basisBadge='';
  if(row.basis==='rule')basisBadge=`<span class="ldr-imp-badge ldr-imp-badge-rule">ルール</span>`;
  else if(row.basis==='learned')basisBadge=`<span class="ldr-imp-badge ldr-imp-badge-learned">前回と同じ</span>`;
  else if(row.basis==='similar')basisBadge=`<span class="ldr-imp-badge ldr-imp-badge-similar">似たお店</span>`;
  else basisBadge=`<span class="ldr-imp-badge ldr-imp-badge-none">未分類</span>`;
  let dupBadge='';
  if(row.dupStatus==='imported')dupBadge=`<span class="ldr-imp-badge ldr-imp-badge-imported">取り込み済み</span>`;
  else if(row.dupStatus==='possible')dupBadge=`<span class="ldr-imp-badge ldr-imp-badge-dup">重複の可能性</span>`;
  const amtCls=row.kind==='income'?'inc':'exp';
  const amtSign=row.kind==='income'?'+':'-';
  const imported=row.dupStatus==='imported'?'imp-imported':'';
  return`<tr class="ldr-imp-row ${imported}" id="ldrImpRow_${id}">
    <td class="imp-col-check" onclick="event.stopPropagation()"><input type="checkbox" ${row.checked?'checked':''} onclick="event.stopPropagation();_importToggleCheck('${id}')"></td>
    <td class="imp-col-date ldr-tx-date" style="white-space:nowrap;">${esc(row.date)}</td>
    <td class="imp-col-title"><span class="ldr-imp-title-cell" onclick="event.stopPropagation();_importEditTitle('${id}',this)">${esc(row.title)}</span></td>
    <td class="imp-col-amt ldr-imp-amt ${amtCls}">${amtSign}¥${fmt(row.amount)}</td>
    <td class="imp-col-type" onclick="event.stopPropagation()">${typeSel}</td>
    <td class="imp-col-cat" onclick="event.stopPropagation()">${catCell}</td>
    <td class="imp-col-badges">${basisBadge}${dupBadge}</td>
    <td class="imp-col-autorule" onclick="event.stopPropagation()"><label class="imp-autorule-lbl" onclick="event.stopPropagation()"><input type="checkbox" ${row.autoRule?'checked':''} title="今後もこの分類" onclick="event.stopPropagation();_importToggleAutoRule('${id}')"><span class="imp-autorule-txt">今後もこの分類</span></label></td>
  </tr>`;
}

function _renderColAssignUI(csvRows,colAssign,fi){
  const headers=csvRows[0].map(h=>h.trim());
  const opts=`<option value="-1">—</option>`+headers.map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join('');
  const selFor=(id,def)=>`<select id="${id}_${fi}" class="ldr-imp-sel" onclick="event.stopPropagation()" style="min-width:120px;">${opts.replace(`value="${def}"`,`value="${def}" selected`)}</select>`;
  const ca=colAssign||{iDate:-1,iTitle:-1,iDebit:-1,iCredit:-1,iSigned:-1};
  return`<div class="ldr-col-assign ui-card" style="padding:14px 16px;margin-bottom:16px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px;">列の割り当て</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">日付列</span>${selFor('impColDate',ca.iDate)}</div>
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">内容列</span>${selFor('impColTitle',ca.iTitle)}</div>
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">出金列</span>${selFor('impColDebit',ca.iDebit)}</div>
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">入金列</span>${selFor('impColCredit',ca.iCredit)}</div>
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">符号付き金額</span>${selFor('impColSigned',ca.iSigned)}</div>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();_importApplyColAssign(${fi})">取り込み開始</button>
    </div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:12px;color:var(--ink3);margin-top:8px;">先頭行: ${headers.map(h=>`<code style="background:var(--paper3);padding:1px 4px;border-radius:3px;">${esc(h)}</code>`).join(' ')}</div>
  </div>`;
}

let _rulesCatFilter='all';
let _rulesSortOrder='keyword'; // 'keyword' | 'hits' | 'lastUsed'
function _renderImportRulesSection(){
  const rules=txRules.rules||[];
  const catKeys=getAllCategories().filter(c=>!c.hidden).map(c=>c.name);
  const catOpts=catKeys.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const activeAcc=accounts.filter(a=>!a.archived);
  const toAccOpts=`<option value="">選択</option>`+activeAcc.map(a=>`<option value="${esc(String(a.id))}">${esc(a.name)}</option>`).join('');
  // Filter rules
  let filteredRules=_rulesCatFilter==='all'?rules.slice():rules.filter(r=>r.category===_rulesCatFilter||(r.type==='transfer'&&_rulesCatFilter==='__transfer__')||(r.type==='skip'&&_rulesCatFilter==='__skip__'));
  // Sort rules
  if(_rulesSortOrder==='hits')filteredRules.sort((a,b)=>(b.hits||0)-(a.hits||0));
  else if(_rulesSortOrder==='lastUsed')filteredRules.sort((a,b)=>(b.lastUsedAt||'').localeCompare(a.lastUsedAt||''));
  else filteredRules.sort((a,b)=>(a.keyword||'').localeCompare(b.keyword||''));
  // Date age check
  const todayStr=today();
  const _isOldDate=(d)=>{if(!d)return true;return(new Date(todayStr)-new Date(d))/(864e5)>=180;};
  const rulesRows=filteredRules.map(r=>{
    const rid=esc(String(r.id));
    let cls='';
    if(r.type==='skip')cls='取り込まない';
    else if(r.type==='transfer'){const an=accounts.find(a=>String(a.id)===String(r.toAccountId));cls=`振替 → ${an?esc(an.name):'?'}`;}
    else{const tl=r.type==='expense'?'支出':'収入';cls=`${tl}・${esc(r.category||'その他')}`;}
    const kw=r.keyword||'';
    const hitsVal=r.hits||0;
    const dateVal=r.lastUsedAt||'';
    const dateOld=_isOldDate(dateVal);
    return`<tr class="ldr-rules-row"><td><input class="ldr-rules-kw-in" value="${esc(kw)}" style="width:${Math.max(80,kw.length*9+20)}px;" onchange="event.stopPropagation();_ruleUpdateKw('${rid}',this.value)" oninput="event.stopPropagation();this.style.width=Math.max(80,this.value.length*9+20)+'px'" onclick="event.stopPropagation()" onfocus="event.stopPropagation()"></td><td style="font-family:'Space Grotesk',sans-serif;font-size:13px;">${cls}</td><td class="r" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink3);white-space:nowrap;">${hitsVal}</td><td class="r" style="font-family:'JetBrains Mono',monospace;font-size:12px;white-space:nowrap;${dateOld?'color:var(--mute);':''}">${esc(dateVal||'—')}</td><td><button class="btn-kill" onclick="event.stopPropagation();_ruleDelete('${rid}')">✕</button></td></tr>`;
  }).join('');
  const filterSel=rules.length?`<select class="ldr-imp-sel" onclick="event.stopPropagation()" onchange="event.stopPropagation();_rulesCatFilter=this.value;renderLdrSettings()" style="min-width:100px;">
    <option value="all"${_rulesCatFilter==='all'?' selected':''}>すべて</option>
    ${catKeys.map(c=>`<option value="${esc(c)}"${_rulesCatFilter===c?' selected':''}>${esc(c)}</option>`).join('')}
    <option value="__transfer__"${_rulesCatFilter==='__transfer__'?' selected':''}>振替</option>
    <option value="__skip__"${_rulesCatFilter==='__skip__'?' selected':''}>取り込まない</option>
  </select>`:'';
  const sortSel=rules.length?`<select class="ldr-imp-sel" onclick="event.stopPropagation()" onchange="event.stopPropagation();_rulesSortOrder=this.value;renderLdrSettings()" style="min-width:130px;">
    <option value="keyword"${_rulesSortOrder==='keyword'?' selected':''}>キーワード順</option>
    <option value="hits"${_rulesSortOrder==='hits'?' selected':''}>使用回数の多い順</option>
    <option value="lastUsed"${_rulesSortOrder==='lastUsed'?' selected':''}>最近使った順</option>
  </select>`:'';
  return`<div class="ldr-rules-section" style="padding:0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;"><div style="font-family:'Newsreader',serif;font-size:17px;font-weight:800;">分類ルール</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;">${filterSel}${sortSel}</div></div>
    ${rules.length?`<table class="ldr-rules-table"><thead><tr><th>キーワード</th><th>分類</th><th class="r" style="min-width:60px;">使用回数</th><th class="r" style="min-width:100px;">最後に使った日</th><th style="width:40px;"></th></tr></thead><tbody>${rulesRows||'<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--mute);font-size:12px;">該当なし</td></tr>'}</tbody></table>`:'<div style="font-family:\'Space Grotesk\',sans-serif;font-size:13px;color:var(--mute);margin-bottom:12px;">ルールはまだありません</div>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:${rules.length?'14px':'0'};">
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">キーワード</span><input id="ruleNewKw" class="ldr-rules-kw-in" placeholder="例: スーパー" onclick="event.stopPropagation()" onfocus="event.stopPropagation()" style="width:160px;"></div>
      <div class="ldr-col-assign-col"><span class="ldr-col-lbl">種類</span><select id="ruleNewType" class="ldr-imp-sel" onchange="event.stopPropagation();_ruleAddFormTypeChange()" onclick="event.stopPropagation()" style="min-width:100px;"><option value="expense">支出</option><option value="income">収入</option><option value="transfer">振替</option><option value="skip">取り込まない</option></select></div>
      <div id="ruleNewCatWrap" class="ldr-col-assign-col"><span class="ldr-col-lbl">カテゴリ</span><select id="ruleNewCat" class="ldr-imp-sel" onclick="event.stopPropagation()" style="min-width:100px;">${catOpts}</select></div>
      <div id="ruleNewAccWrap" class="ldr-col-assign-col" style="display:none;"><span class="ldr-col-lbl">振替先</span><select id="ruleNewAcc" class="ldr-imp-sel" onclick="event.stopPropagation()" style="min-width:140px;">${toAccOpts}</select></div>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();_ruleAdd()">追加</button>
    </div>
  </div>`;
}

function _ruleAddFormTypeChange(){
  const t=document.getElementById('ruleNewType');if(!t)return;
  const cat=document.getElementById('ruleNewCatWrap');const acc=document.getElementById('ruleNewAccWrap');
  if(cat)cat.style.display=(t.value==='transfer'||t.value==='skip')?'none':'flex';
  if(acc)acc.style.display=t.value==='transfer'?'flex':'none';
}

function _ruleAdd(){
  const kwEl=document.getElementById('ruleNewKw');
  const kw=(kwEl&&kwEl.value.trim().toLowerCase())||'';
  if(!kw){if(kwEl)kwEl.focus();return;}
  const type=(document.getElementById('ruleNewType')&&document.getElementById('ruleNewType').value)||'expense';
  const cat=(type==='expense'||type==='income')?(document.getElementById('ruleNewCat')&&document.getElementById('ruleNewCat').value||'その他'):'';
  const toAccId=type==='transfer'?(document.getElementById('ruleNewAcc')&&document.getElementById('ruleNewAcc').value||''):'';
  if(!txRules.rules)txRules.rules=[];
  const existing=txRules.rules.findIndex(r=>r.keyword===kw);
  const ruleObj={id:existing>=0?txRules.rules[existing].id:crypto.randomUUID(),keyword:kw,type,category:cat,toAccountId:toAccId};
  if(existing>=0)txRules.rules[existing]=ruleObj;else txRules.rules.push(ruleObj);
  saveTxRules();
  renderLdrSettings();
}

function _ruleDelete(id){
  if(!txRules.rules)return;
  txRules.rules=txRules.rules.filter(r=>String(r.id)!==String(id));
  saveTxRules();
  renderLdrSettings();
}

function _ruleUpdateKw(id,val){
  if(!txRules.rules)return;
  const r=txRules.rules.find(r=>String(r.id)===String(id));
  if(r){r.keyword=val.trim().toLowerCase();saveTxRules();}
}

function _importConfirm(){
  if(!_importState)return;
  const allRows=_importAllRows();
  const toAdd=allRows.filter(r=>r.checked&&r.type!=='skip');
  if(!toAdd.length){uiAlert('取り込む取引がありません');return;}
  // Build a map from row _id -> file accountId
  const rowAccMap={};
  _importState.files.forEach(f=>f.rows.forEach(r=>{rowAccMap[r._id]=f.accountId;}));
  const ruleRows=allRows.filter(r=>r.autoRule);
  const ruleKeys=new Set();
  ruleRows.forEach(r=>{
    const kw=normTxName(r.title,true);if(!kw)return;
    if(!txRules.rules)txRules.rules=[];
    const idx=txRules.rules.findIndex(x=>x.keyword===kw);
    const existing=idx>=0?txRules.rules[idx]:{};
    const obj={...existing,id:existing.id||crypto.randomUUID(),keyword:kw,type:r.type,category:r.category,toAccountId:r.toAccountId};
    if(idx>=0)txRules.rules[idx]=obj;else txRules.rules.push(obj);
    ruleKeys.add(kw);
  });
  const ruleCount=ruleKeys.size;
  const todayStr=today();
  toAdd.filter(r=>r.basis==='rule'&&r._ruleId).forEach(r=>{
    const rule=(txRules.rules||[]).find(x=>String(x.id)===String(r._ruleId));
    if(rule){rule.hits=(rule.hits||0)+1;rule.lastUsedAt=todayStr;}
  });
  const needSaveRules=ruleRows.length||toAdd.some(r=>r.basis==='rule'&&r._ruleId);
  if(needSaveRules)saveTxRules();
  toAdd.forEach(r=>{
    const accId=rowAccMap[r._id]||'';
    let tx;
    const _now=new Date().toISOString();
    if(r.type==='transfer'){
      tx={id:crypto.randomUUID(),type:'transfer',title:r.title,amount:r.amount,date:r.date,note:r.note,srcName:r.srcName,importKey:r.importKey,importedAt:_now};
      if(r.kind==='expense'){if(accId)tx.fromAccountId=accId;if(r.toAccountId)tx.toAccountId=r.toAccountId;}
      else{if(r.toAccountId)tx.fromAccountId=r.toAccountId;if(accId)tx.toAccountId=accId;}
    } else {
      tx={id:crypto.randomUUID(),type:r.type,title:r.title,amount:r.amount,category:r.category,date:r.date,note:r.note,srcName:r.srcName,importKey:r.importKey,importedAt:_now};
      if(accId)tx.accountId=accId;
    }
    txs.push(tx);
  });
  saveTx();
  renderGuidePanel();renderLdrMobOnboard();
  const count=toAdd.length;
  _importState=null;_importFilter='all';
  const p=document.getElementById('ldrPanelImport');
  const ruleMsg=ruleCount?`<div style="font-family:'Space Grotesk',sans-serif;font-size:14px;color:var(--ok);margin-top:8px;">${ruleCount} 件の分類を覚えました</div>`:'';
  if(p)p.innerHTML=`<div style="padding:48px 20px;text-align:center;"><div style="font-family:'Newsreader',serif;font-size:24px;font-weight:800;margin-bottom:12px;">${count} 件を取り込みました</div>${ruleMsg}<div style="margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;"><button class="btn btn-primary" onclick="ldrTab('txlist',document.querySelector('#ldrSubtabs .ui-seg-btn:nth-child(2)'))">取引一覧を見る</button><button class="btn btn-ghost" onclick="renderLdrImport()">さらに取り込む</button></div></div>`;
}

function _importCancel(){
  _importState=null;_importFilter='all';
  renderLdrImport();
}

function _renderImportFileSection(f,fi,activeAcc){
  const accSel=`<select class="ldr-imp-sel" onchange="event.stopPropagation();_importSetAccount(${fi},this.value)" onclick="event.stopPropagation()" style="min-width:160px;"><option value="">口座未設定</option>${activeAcc.map(a=>`<option value="${esc(String(a.id))}"${String(a.id)===String(f.accountId)?' selected':''}>${esc(a.name)}</option>`).join('')}</select>`;
  let filtRows=f.rows;
  if(_importFilter==='unclassified')filtRows=f.rows.filter(r=>r.basis==='none'&&r.type!=='skip');
  else if(_importFilter==='dup')filtRows=f.rows.filter(r=>r.dupStatus);
  const colAssignHtml=(f.pendingParse||f.showColAssign)?_renderColAssignUI(f.csvRows,f.colAssign,fi):'';
  const tableHtml=f.pendingParse?'':`<div class="ui-card" style="overflow-x:auto;margin-bottom:8px;">
    <table class="ldr-imp-tbl">
      <thead><tr>
        <th style="width:32px;"></th>
        <th style="min-width:80px;">日付</th>
        <th style="min-width:120px;">内容</th>
        <th class="r" style="min-width:90px;">金額</th>
        <th style="min-width:100px;">種類</th>
        <th style="min-width:100px;">カテゴリ・振替先</th>
        <th style="min-width:80px;">根拠</th>
        <th style="width:60px;">今後も<br><span style="font-weight:400;font-size:9px;letter-spacing:0;text-transform:none;color:var(--mute);">直した行は自動でオン</span></th>
      </tr></thead>
      <tbody id="ldrImportTbody_${fi}">${filtRows.map(r=>_importRowHtml(r,f)).join('')}</tbody>
    </table>
  </div>`;
  const showColBtn=!f.pendingParse?`<button class="btn btn-ghost btn-sm" onclick="_importShowColAssign(${fi})">列の割り当てを変更</button>`:'';
  return`<div class="ldr-import-file-section">
    <div class="ldr-import-status">
      <span class="ldr-import-format-badge">${esc(f.formatName)}</span>
      ${accSel}
      <span class="ldr-import-count" style="font-size:11px;color:var(--ink3);">${esc(f.fileName)}</span>
      ${!f.pendingParse?`<span class="ldr-import-count">${f.rows.length} 件</span>`:''}
      ${!f.pendingParse&&f.skipCount>0?`<span class="ldr-import-count">${f.skipCount} 件スキップ</span>`:''}
      ${showColBtn}
    </div>
    ${colAssignHtml}
    ${tableHtml}
  </div>`;
}

function renderLdrImport(){
  const p=document.getElementById('ldrPanelImport');if(!p)return;
  const st=_importState;
  const activeAcc=accounts.filter(a=>!a.archived);

  // Drop zone state: no files loaded yet
  if(!st){
    p.innerHTML=`<div style="padding:20px;max-width:900px;">
      <div class="ldr-import-drop ui-card" id="ldrImportDrop" onclick="document.getElementById('ldrImportFileIn').click()">
        <div class="ldr-import-drop-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <div class="ldr-import-drop-title">CSV ファイルをドロップ、またはクリックして選択</div>
        <div class="ldr-import-drop-sub">三菱UFJ銀行・楽天カードの CSV に対応（複数可）</div>
        <input type="file" id="ldrImportFileIn" accept=".csv" multiple style="display:none" onchange="event.stopPropagation();_importFromFileInput(this.files)">
      </div>
      <div class="ldr-settings-rules-link">分類ルールは <a onclick="ldrTab('settings',document.querySelector('#ldrSubtabs .ui-seg-btn[onclick*=\'settings\']'))">設定 ›</a> で管理できます。</div>
    </div>`;
    const dz=document.getElementById('ldrImportDrop');
    if(dz){
      dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});
      dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
      dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer.files.length)_importHandleFiles(e.dataTransfer.files);});
    }
    return;
  }

  // Review UI (single or multi-file)
  const isSingle=st.files.length===1;
  const f0=st.files[0];
  const checkedCount=_importAllRows().filter(r=>r.checked&&r.type!=='skip').length;

  // Rule explanation (change 7)
  const ruleCount=(txRules.rules||[]).length;
  const ruleColor=ruleCount===0?'color:var(--accent);font-weight:600;':'color:var(--ink3);';
  const ruleLink=`<a style="cursor:pointer;text-decoration:underline;" onclick="ldrTab('settings',document.querySelector('#ldrSubtabs .ui-seg-btn[onclick*=\'settings\']'))">設定 › 分類ルール</a>`;
  const ruleInfoHtml=`<div class="ldr-import-rule-info" style="${ruleColor}">分類を直した行は、次回から同じお店に自動で使われます（${ruleLink} で確認・削除できます）</div>`;

  if(isSingle&&f0.pendingParse){
    // Single unknown file: show drop zone with col-assign
    const colAssignHtml=_renderColAssignUI(f0.csvRows,f0.colAssign,0);
    p.innerHTML=`<div style="padding:20px;max-width:900px;">
      <div class="ldr-import-drop ui-card" id="ldrImportDrop" onclick="document.getElementById('ldrImportFileIn').click()">
        <div class="ldr-import-drop-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <div class="ldr-import-drop-title">CSV ファイルをドロップ、またはクリックして選択</div>
        <div class="ldr-import-drop-sub">三菱UFJ銀行・楽天カードの CSV に対応（複数可）</div>
        <input type="file" id="ldrImportFileIn" accept=".csv" multiple style="display:none" onchange="event.stopPropagation();_importFromFileInput(this.files)">
      </div>
      ${colAssignHtml}
      <div class="ldr-settings-rules-link">分類ルールは <a onclick="ldrTab('settings',document.querySelector('#ldrSubtabs .ui-seg-btn[onclick*=\'settings\']'))">設定 ›</a> で管理できます。</div>
    </div>`;
    const dz=document.getElementById('ldrImportDrop');
    if(dz){
      dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});
      dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
      dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer.files.length)_importHandleFiles(e.dataTransfer.files);});
    }
    return;
  }

  // Build file sections HTML
  let fileSectionsHtml='';
  if(isSingle){
    // Single file: exact same layout as before (just use fi=0)
    const f=f0;
    let filtRows=f.rows;
    if(_importFilter==='unclassified')filtRows=f.rows.filter(r=>r.basis==='none'&&r.type!=='skip');
    else if(_importFilter==='dup')filtRows=f.rows.filter(r=>r.dupStatus);
    const colAssignHtml=(f.showColAssign&&f.csvRows)?_renderColAssignUI(f.csvRows,f.colAssign,0):'';
    const accSel=`<select class="ldr-imp-sel" onchange="event.stopPropagation();_importSetAccount(0,this.value)" onclick="event.stopPropagation()" style="min-width:160px;"><option value="">口座未設定</option>${activeAcc.map(a=>`<option value="${esc(String(a.id))}"${String(a.id)===String(f.accountId)?' selected':''}>${esc(a.name)}</option>`).join('')}</select>`;
    fileSectionsHtml=`<div class="ldr-import-status">
      <span class="ldr-import-format-badge">${esc(f.formatName)}</span>
      ${accSel}
      <span class="ldr-import-count">${f.rows.length} 件</span>
      ${f.skipCount>0?`<span class="ldr-import-count">${f.skipCount} 件スキップ</span>`:''}
      <button class="btn btn-ghost btn-sm" onclick="_importShowColAssign(0)">列の割り当てを変更</button>
    </div>
    ${colAssignHtml}
    <div class="ui-card" style="overflow-x:auto;">
      <table class="ldr-imp-tbl">
        <thead><tr>
          <th style="width:32px;"></th>
          <th style="min-width:80px;">日付</th>
          <th style="min-width:120px;">内容</th>
          <th class="r" style="min-width:90px;">金額</th>
          <th style="min-width:100px;">種類</th>
          <th style="min-width:100px;">カテゴリ・振替先</th>
          <th style="min-width:80px;">根拠</th>
          <th style="width:60px;">今後も<br><span style="font-weight:400;font-size:9px;letter-spacing:0;text-transform:none;color:var(--mute);">直した行は自動でオン</span></th>
        </tr></thead>
        <tbody id="ldrImportTbody_0">${filtRows.map(r=>_importRowHtml(r,f)).join('')}</tbody>
      </table>
    </div>`;
  } else {
    // Multiple files: per-file sections
    fileSectionsHtml=st.files.map((f,fi)=>_renderImportFileSection(f,fi,activeAcc)).join('');
  }

  p.innerHTML=`<div style="padding:20px;max-width:1200px;">
    ${ruleInfoHtml}
    <div id="ldrImportToast" class="ldr-import-toast"></div>
    <div class="ldr-import-bulk-bar">
      <button class="btn btn-ghost btn-sm" onclick="_importToggleAll(true)">すべて選択</button>
      <button class="btn btn-ghost btn-sm" onclick="_importToggleAll(false)">すべて解除</button>
      <button class="ui-pill${_importFilter==='all'?' active':''}" onclick="_importSetFilter('all')">すべて</button>
      <button class="ui-pill${_importFilter==='unclassified'?' active':''}" onclick="_importSetFilter('unclassified')">未分類のみ</button>
      <button class="ui-pill${_importFilter==='dup'?' active':''}" onclick="_importSetFilter('dup')">重複のみ</button>
    </div>
    ${fileSectionsHtml}
    <div class="ldr-imp-confirm-bar" id="ldrImportConfirmBar">
      <button class="btn btn-ghost" onclick="_importCancel()">キャンセル</button>
      <button class="btn btn-primary" id="ldrImportConfirmBtn" onclick="_importConfirm()">${checkedCount} 件を取り込む</button>
    </div>
  </div>`;
}
