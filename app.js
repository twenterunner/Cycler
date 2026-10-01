(() => {
  'use strict';

  const APP_VERSION = '2026.10.01-main-static-1';
  const DB_NAME = 'cycler-local-db';
  const STORE = 'events';
  const app = document.getElementById('app');

  const state = {
    events: [],
    tab: 'today',
    calendarMode: 'month',
    cursor: todayISO(),
    selectedDate: null,
    editingId: null,
    addType: null,
    touchX: null,
  };

  // ---------- Date helpers ----------
  function parseISO(s) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  function iso(d) { return d.toISOString().slice(0,10); }
  function todayISO() {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function addDays(s,n){ const d=parseISO(s); d.setUTCDate(d.getUTCDate()+n); return iso(d); }
  function diffDays(a,b){ return Math.round((parseISO(a)-parseISO(b))/86400000); }
  function durationDays(e){ return diffDays(e.endDate,e.startDate)+1; }
  function eachDay(a,b){ const out=[]; for(let d=a; d<=b; d=addDays(d,1)) out.push(d); return out; }
  function startOfWeek(s){ const d=parseISO(s); const wd=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-wd); return iso(d); }
  function monthStart(s){ return s.slice(0,7)+'-01'; }
  function monthEnd(s){ const d=parseISO(monthStart(s)); d.setUTCMonth(d.getUTCMonth()+1); d.setUTCDate(0); return iso(d); }
  function formatLong(s){ return new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(parseISO(s)); }
  function formatShort(s){ return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',timeZone:'UTC'}).format(parseISO(s)); }
  function formatMonth(s){ return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(parseISO(s)); }
  function inEvent(date,e){ return date>=e.startDate && date<=e.endDate; }
  function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  // ---------- Statistics ----------
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  function median(a){ if(!a.length)return 0; const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
  function percentile(a,p){ if(!a.length)return 0; const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p,l=Math.floor(i),h=Math.ceil(i); return l===h?s[l]:s[l]+(s[h]-s[l])*(i-l); }
  const recencyWeights=(n,decay=.84)=>Array.from({length:n},(_,i)=>decay**(n-1-i));
  function weightedMean(v,w){ const sw=w.reduce((a,b)=>a+b,0); return sw?v.reduce((s,x,i)=>s+x*w[i],0)/sw:mean(v); }
  function weightedMedian(v,w){ if(!v.length)return 0; const p=v.map((x,i)=>[x,w[i]]).sort((a,b)=>a[0]-b[0]); const total=p.reduce((s,x)=>s+x[1],0); let r=0; for(const [x,z] of p){r+=z;if(r>=total/2)return x;} return p[p.length-1][0]; }
  function weightedStd(v,w,c=weightedMean(v,w)){ if(v.length<2)return 0; const sw=w.reduce((a,b)=>a+b,0); return Math.sqrt(v.reduce((s,x,i)=>s+w[i]*(x-c)**2,0)/Math.max(sw,1e-9)); }
  function mad(v){ if(!v.length)return 0; const m=median(v); return median(v.map(x=>Math.abs(x-m)))*1.4826; }
  function robustify(v){ if(v.length<5)return [...v]; const m=median(v),s=Math.max(1,mad(v)); return v.map(x=>clamp(x,m-3*s,m+3*s)); }
  function normalPdf(x,m,s){ s=Math.max(.75,s); return Math.exp(-.5*((x-m)/s)**2)/(s*Math.sqrt(2*Math.PI)); }
  function normalize(v){ const s=v.reduce((a,b)=>a+b,0); return s>0?v.map(x=>x/s):v.map(()=>0); }
  function logit(p){ p=clamp(p,.001,.999); return Math.log(p/(1-p)); }
  function logistic(x){ return 1/(1+Math.exp(-x)); }

  // ---------- IndexedDB ----------
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'}); };
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function loadEvents(){ const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readonly'); const r=tx.objectStore(STORE).getAll(); r.onsuccess=()=>resolve(r.result||[]); r.onerror=()=>reject(r.error); }); }
  async function saveAll(events){ const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); const st=tx.objectStore(STORE); st.clear(); events.forEach(e=>st.put(e)); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }

  // ---------- Event operations ----------
  function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function normalizeEvents(events){
    const result=[];
    for(const type of ['migraine','menstruation']){
      const rows=events.filter(e=>e.type===type).sort((a,b)=>a.startDate.localeCompare(b.startDate));
      for(const raw of rows){
        const event={...raw};
        const last=[...result].reverse().find(e=>e.type===type);
        if(last && event.startDate<=addDays(last.endDate,1)){
          last.endDate=last.endDate>event.endDate?last.endDate:event.endDate;
          last.updatedAt=Math.max(last.updatedAt||0,event.updatedAt||0,Date.now());
          if(event.notes && !last.notes) last.notes=event.notes;
        } else result.push(event);
      }
    }
    return result.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.type.localeCompare(b.type));
  }
  async function commitEvents(events,msg){ state.events=normalizeEvents(events); await saveAll(state.events); render(); if(msg) toast(msg); }
  async function quickLog(type){
    const t=todayISO();
    if(state.events.some(e=>e.type===type&&inEvent(t,e))) return;
    const y=addDays(t,-1); const prev=state.events.find(e=>e.type===type&&e.endDate===y);
    let next;
    if(prev) next=state.events.map(e=>e.id===prev.id?{...e,endDate:t,updatedAt:Date.now()}:e);
    else next=[...state.events,{id:uid(),type,startDate:t,endDate:t,confirmed:true,createdAt:Date.now(),updatedAt:Date.now()}];
    await commitEvents(next,prev?'Event extended':'Event logged');
  }
  function newEvent(type,date){ return {id:uid(),type,startDate:date,endDate:date,confirmed:true,createdAt:Date.now(),updatedAt:Date.now(),notes:''}; }

  // ---------- Forecast models ----------
  function durationForecast(events){
    const d=events.map(durationDays).filter(x=>x>0);
    if(!d.length) return {expected:1,low:1,high:1,label:'insufficient data',survival:lag=>lag===0?1:0};
    const w=recencyWeights(d.length,.88),expected=weightedMean(d,w),low=Math.max(1,Math.round(percentile(d,.25))),high=Math.max(1,Math.round(percentile(d,.75)));
    return {expected,low,high,label:low===high?`${low} day${low===1?'':'s'}`:`${low}–${high} days`,survival:lag=>(d.filter(x=>x>lag).length+.5)/(d.length+1)};
  }
  function recurrenceModel(starts,anchor,horizon=730,decay=.84){
    const sorted=[...starts].sort(); const intervals=sorted.slice(1).map((d,i)=>diffDays(d,sorted[i])).filter(x=>x>0);
    if(!sorted.length||!intervals.length) return {intervals,center:0,sigma:8,firstStart:new Map(),allStarts:new Map()};
    const robust=robustify(intervals),w=recencyWeights(robust.length,decay),wm=weightedMean(robust,w),wmed=weightedMedian(robust,w),center=.6*wm+.4*wmed;
    const sigma=Math.max(1.5,.5*Math.max(1.2,mad(robust))+.5*Math.max(1.2,weightedStd(robust,w,wm)))*Math.sqrt(1+4/intervals.length);
    const maxInt=Math.max(120,Math.ceil(center+5*sigma)); const raw=Array(maxInt+1).fill(0),sw=w.reduce((a,b)=>a+b,0);
    for(let d=1;d<=maxInt;d++){
      let emp=0; for(let i=0;i<robust.length;i++) emp+=w[i]*normalPdf(d,robust[i],Math.max(1.25,sigma*.45)); emp/=sw;
      raw[d]=.55*emp+.45*normalPdf(d,center,sigma);
    }
    const pmf=[0,...normalize(raw.slice(1))],last=sorted.at(-1),elapsed=Math.max(0,diffDays(anchor,last));
    const firstRaw=Array(horizon+1).fill(0); for(let i=0;i<=horizon;i++){const interval=elapsed+i;if(interval>0&&interval<pmf.length)firstRaw[i]=pmf[interval];}
    const firstNorm=normalize(firstRaw),firstStart=new Map(),allStarts=new Map();
    // Approximate later cycles using Gaussian centers. First cycle remains fully normalized.
    for(let i=0;i<=horizon;i++) if(firstNorm[i]>0) firstStart.set(addDays(anchor,i),firstNorm[i]);
    for(let cycle=1;cycle<=Math.ceil(horizon/Math.max(center,1))+1;cycle++){
      const c=diffDays(last,anchor)+cycle*center;
      for(let i=0;i<=horizon;i++){
        const p=normalPdf(i,c,Math.sqrt(cycle)*sigma);
        if(p>.00001) allStarts.set(addDays(anchor,i),(allStarts.get(addDays(anchor,i))||0)+p);
      }
    }
    const max=Math.max(...allStarts.values(),1); for(const [d,p] of allStarts) allStarts.set(d,Math.min(.95,p/max*.28));
    return {intervals,center,sigma,firstStart,allStarts};
  }
  function confidence(rec,extra=99,type='generic'){
    const n=rec.intervals.length+1,cv=rec.center?rec.sigma/rec.center:99;
    if(type==='menstruation'){ if(n>=10&&cv<.16)return'High'; if(n>=5&&cv<.38)return'Moderate'; return'Low'; }
    if(n>=14&&extra>=10&&cv<.20)return'High'; if(n>=7&&cv<.42)return'Moderate'; return'Low';
  }
  function summary(type,first,durationLabel,conf){
    const entries=[...first.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    if(!entries.length) return {type,nextLikelyStart:null,nextStartProbability:0,windowStart:null,windowEnd:null,durationLabel,confidence:conf};
    const likely=entries.reduce((best,x)=>x[1]>best[1]?x:best,entries[0]); let c=0,lo=null,hi=null;
    for(const [d,p] of entries){ c+=p; if(!lo&&c>=.1)lo=d; if(!hi&&c>=.9){hi=d;break;} }
    return {type,nextLikelyStart:likely[0],nextStartProbability:likely[1],windowStart:lo,windowEnd:hi,durationLabel,confidence:conf};
  }
  function buildMenstruation(events,anchor,horizon){
    const periods=events.filter(e=>e.type==='menstruation').sort((a,b)=>a.startDate.localeCompare(b.startDate));
    const rec=recurrenceModel(periods.map(e=>e.startDate),anchor,horizon,.84),dur=durationForecast(periods),dailyStart=new Map(rec.allStarts),occ=new Map();
    for(const [s,p] of dailyStart) for(let lag=0;lag<=10;lag++){const pc=dur.survival(lag);if(pc>.01){const d=addDays(s,lag);occ.set(d,(occ.get(d)||0)+p*pc);}}
    for(const [d,p] of occ) occ.set(d,clamp(p,0,.95));
    periods.forEach(e=>{eachDay(e.startDate,e.endDate).forEach(d=>occ.set(d,1));dailyStart.set(e.startDate,1)});
    return {periods,rec,dur,dailyStart,occ,summary:summary('menstruation',rec.firstStart,dur.label,confidence(rec,0,'menstruation'))};
  }
  function historicalBaseline(migraines,events){
    if(!migraines.length||!events.length)return 0;
    const first=[...events].sort((a,b)=>a.startDate.localeCompare(b.startDate))[0].startDate,last=[...events].sort((a,b)=>a.endDate.localeCompare(b.endDate)).at(-1).endDate;
    const days=Math.max(1,diffDays(last,first)+1),migDays=new Set(migraines.flatMap(e=>eachDay(e.startDate,e.endDate))).size;
    return (migDays+1)/(days+5);
  }
  function phaseMultipliers(migraines,periods,baseline){
    const m=new Map(); for(let rel=-7;rel<=7;rel++){let hits=0,trials=0;for(const p of periods){const d=addDays(p.startDate,rel);trials++;if(migraines.some(x=>inEvent(d,x)))hits++;}const rate=(hits+1)/(trials+2),raw=rate/Math.max(.02,baseline),ew=trials/(trials+8);m.set(rel,Math.exp(ew*Math.log(clamp(raw,.4,3))));} return m;
  }
  function phaseWeight(date,men,mults){ let logM=0,mass=0;for(let rel=-7;rel<=7;rel++){const start=addDays(date,-rel),p=Math.min(1,men.dailyStart.get(start)||0);if(!p)continue;mass+=p;logM+=p*Math.log(mults.get(rel)||1);}if(mass>1)logM/=mass;return Math.exp(logM); }
  function buildMigraine(events,men,anchor,horizon){
    const migraines=events.filter(e=>e.type==='migraine').sort((a,b)=>a.startDate.localeCompare(b.startDate)),periods=men.periods,rec=recurrenceModel(migraines.map(e=>e.startDate),anchor,horizon,.84),dur=durationForecast(migraines),baseline=historicalBaseline(migraines,events);
    const mults=phaseMultipliers(migraines,periods,baseline||.01),phaseWeights=new Map(),occ=new Map(),rhythm=new Map();
    if(migraines.length<2) return {migraines,rec,dur,baseline,dailyStart:new Map(),occ,phaseWeights,summary:summary('migraine',new Map(),dur.label,'Low')};
    for(const [s,p] of rec.allStarts) for(let lag=0;lag<=10;lag++){const pc=dur.survival(lag);if(pc>.01){const d=addDays(s,lag);rhythm.set(d,(rhythm.get(d)||0)+p*pc);}}
    const re=rec.intervals.length/(rec.intervals.length+5),me=periods.length/(periods.length+10);
    for(let i=0;i<=horizon;i++){const d=addDays(anchor,i),rp=clamp(rhythm.get(d)||baseline,.005,.9),pw=phaseWeight(d,men,mults);phaseWeights.set(d,pw);const sig=logit(rp)-logit(Math.max(.005,baseline));occ.set(d,clamp(logistic(logit(Math.max(.005,baseline))+re*sig+me*Math.log(pw)),.005,.95));}
    const first=[...rec.firstStart.entries()].sort((a,b)=>a[0].localeCompare(b[0])),adj=normalize(first.map(([d,p])=>p*Math.pow(phaseWeight(d,men,mults),me))),dailyStart=new Map(first.map(([d],i)=>[d,adj[i]]));
    migraines.forEach(e=>eachDay(e.startDate,e.endDate).forEach(d=>occ.set(d,1)));
    return {migraines,rec,dur,baseline,dailyStart,occ,phaseWeights,summary:summary('migraine',dailyStart,dur.label,confidence(rec,periods.length,'migraine'))};
  }
  function buildForecast(events,anchor,horizon=730){
    const men=buildMenstruation(events,anchor,horizon),mig=buildMigraine(events,men,anchor,horizon),daily=new Map();
    // Calendar can inspect a year before today as well. Historical non-confirmed probabilities are descriptive/back-fit estimates.
    for(let i=-400;i<=horizon;i++){
      const d=addDays(anchor,i),cm=events.some(e=>e.type==='migraine'&&inEvent(d,e)),cp=events.some(e=>e.type==='menstruation'&&inEvent(d,e));
      let mp,pp;
      if(i>=0){ mp=cm?1:(mig.occ.get(d)??mig.baseline??0); pp=cp?1:(men.occ.get(d)??0); }
      else { mp=cm?1:historicalDayEstimate(d,mig.migraines,mig.rec); pp=cp?1:historicalDayEstimate(d,men.periods,men.rec); }
      daily.set(d,{date:d,migraineProbability:clamp(mp||0),menstruationProbability:clamp(pp||0),confirmedMigraine:cm,confirmedMenstruation:cp});
    }
    return {men,mig,daily};
  }
  function historicalDayEstimate(date,events,rec){
    if(!events.length||!rec.center)return 0;
    const nearest=Math.min(...events.map(e=>Math.abs(diffDays(date,e.startDate))));
    const phaseDist=Math.min(...events.map(e=>{const delta=Math.abs(diffDays(date,e.startDate));const r=delta%Math.max(1,Math.round(rec.center));return Math.min(r,Math.max(1,Math.round(rec.center))-r);}));
    return clamp(.03+.17*Math.exp(-phaseDist/Math.max(1,rec.sigma))+.15*Math.exp(-nearest/2),0,.5);
  }
  function reasons(type,date,fc){
    if(type==='migraine'){
      if(state.events.some(e=>e.type==='migraine'&&inEvent(date,e))) return ['Confirmed migraine event.'];
      const p=fc.daily.get(date)?.migraineProbability||0,base=fc.mig.baseline||0,pw=fc.mig.phaseWeights.get(date)||1,r=[];
      if(p>base*1.35)r.push('Higher than the observed baseline based on the migraine recurrence pattern.');
      if(pw>1.08)r.push('Historically, migraine has occurred more often near this predicted menstruation phase.');
      if(pw<.92)r.push('Historically, migraine has occurred less often near this predicted menstruation phase.');
      r.push('The forecast is shrunk toward the observed baseline because the dataset is still small.'); return r;
    }
    if(state.events.some(e=>e.type==='menstruation'&&inEvent(date,e))) return ['Confirmed menstruation event.'];
    const p=fc.men.dailyStart.get(date)||0,r=[]; if(p>.05)r.push('Near the most likely cycle start based on confirmed cycle intervals.');
    if(fc.men.rec.intervals.length)r.push(`Uses ${fc.men.rec.intervals.length} confirmed cycle intervals with recent cycles weighted more.`); if(!r.length)r.push('Low probability under the current cycle interval distribution.'); return r;
  }

  // ---------- Rendering ----------
  function forecastCard(s){
    const label=s.type==='migraine'?'Migraine':'Menstruation';
    return `<section class="forecast-card ${s.type}"><div class="forecast-title-row"><span class="event-dot"></span><strong>${label}</strong><span class="confidence">${s.confidence} confidence</span></div><div class="forecast-main">${s.nextLikelyStart?formatShort(s.nextLikelyStart):'Not enough data'}</div><div class="forecast-prob">${s.nextLikelyStart?`Peak next-start probability ${Math.round(s.nextStartProbability*100)}%`:'Add more confirmed events'}</div><div class="forecast-meta"><span>Window: ${s.windowStart&&s.windowEnd?`${formatShort(s.windowStart)}–${formatShort(s.windowEnd)}`:'—'}</span><span>Duration: ${s.durationLabel}</span></div></section>`;
  }
  function render(){
    const t=todayISO(),fc=buildForecast(state.events,t,730);
    app.innerHTML=`<div class="app-shell"><header class="topbar"><div><strong>Cycle Forecast</strong><span>Private · local-first · ${APP_VERSION}</span></div><span class="offline-badge">Offline ready</span></header><main id="main"></main><nav class="bottom-nav">${[['today','●','Today'],['calendar','▦','Calendar'],['trends','⌁','Trends'],['settings','⚙','Settings']].map(([id,ic,l])=>`<button data-tab="${id}" class="${state.tab===id?'active':''}"><span>${ic}</span>${l}</button>`).join('')}</nav></div>`;
    const main=document.getElementById('main');
    if(state.tab==='today') main.innerHTML=renderToday(t,fc);
    if(state.tab==='calendar') main.innerHTML=renderCalendar(t,fc);
    if(state.tab==='trends') main.innerHTML=renderTrends();
    if(state.tab==='settings') main.innerHTML=renderSettings();
    bind(fc);
    if(state.selectedDate) openDaySheet(state.selectedDate,fc);
    if(state.editingId||state.addType) openEditSheet();
  }
  function renderToday(t,fc){
    function card(type,label){const existing=state.events.find(e=>e.type===type&&inEvent(t,e)),y=state.events.find(e=>e.type===type&&e.endDate===addDays(t,-1));return `<section class="quick-card"><h3>${label}</h3>${existing?`<p>Logged today.</p><div class="quick-actions"><button class="secondary" data-edit="${existing.id}">Edit</button><button class="secondary" data-end="${existing.id}">End today</button></div>`:`<p>${y?'Continue yesterday’s event?':'No event logged today.'}</p><button class="primary" data-log="${type}">${y?`${label} continues today`:`Log ${label.toLowerCase()} today`}</button>`}</section>`;}
    return `<div class="page-intro"><h1>Today</h1><p>${formatLong(t)}</p></div><div class="forecast-grid">${forecastCard(fc.mig.summary)}${forecastCard(fc.men.summary)}</div><h2 class="section-title">Quick log</h2><div class="quick-grid">${card('migraine','Migraine')}${card('menstruation','Menstruation')}</div><p class="privacy-note">Stored only on this device. This app tracks observations and estimates probabilities; it does not diagnose or explain medical causes.</p>`;
  }
  function visibleDates(){
    if(state.calendarMode==='week'){const s=startOfWeek(state.cursor);return Array.from({length:7},(_,i)=>addDays(s,i));}
    const first=monthStart(state.cursor),grid=startOfWeek(first),last=monthEnd(state.cursor),out=[];for(let d=grid;;d=addDays(d,1)){out.push(d);if(out.length%7===0&&d>=last)break;}return out;
  }
  function renderCalendar(t,fc){
    const dates=visibleDates(),title=state.calendarMode==='month'?formatMonth(state.cursor):formatLong(state.cursor);
    const cells=dates.map(d=>{const p=fc.daily.get(d)||{migraineProbability:0,menstruationProbability:0},inMonth=d.slice(0,7)===state.cursor.slice(0,7),dayEvents=state.events.filter(e=>inEvent(d,e)),m=p.migraineProbability||0,s=p.menstruationProbability||0,bg=`linear-gradient(135deg,rgba(114,87,213,${.05+.22*m}) 0 48%,rgba(220,91,131,${.05+.22*s}) 52% 100%)`;return `<button class="day-cell ${!inMonth&&state.calendarMode==='month'?'dim':''} ${d===t?'today':''}" data-date="${d}" style="background:${bg}"><span class="day-num">${Number(d.slice(8))}</span><div class="event-marks">${dayEvents.some(e=>e.type==='migraine')?'<span class="mark migraine">● M</span>':''}${dayEvents.some(e=>e.type==='menstruation')?'<span class="mark menstruation">● P</span>':''}</div>${!dayEvents.some(e=>e.type==='migraine')?`<span class="mini">M ${Math.round(m*100)}%</span>`:''}${!dayEvents.some(e=>e.type==='menstruation')?`<span class="mini">P ${Math.round(s*100)}%</span>`:''}</button>`;}).join('');
    return `<div class="page-intro"><h1>Calendar</h1><p>Confirmed events and probability forecasts.</p></div><div class="forecast-grid">${forecastCard(fc.mig.summary)}${forecastCard(fc.men.summary)}</div><section class="calendar-card" id="calendar-card"><div class="calendar-toolbar"><div class="segmented"><button data-mode="week" class="${state.calendarMode==='week'?'active':''}">Week</button><button data-mode="month" class="${state.calendarMode==='month'?'active':''}">Month</button></div><strong>${title}</strong><div class="nav-buttons"><button data-nav="-1">‹</button><button data-nav="today">Today</button><button data-nav="1">›</button></div></div><div class="weekday-row">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid ${state.calendarMode}">${cells}</div><div class="legend"><span><b class="m">● M</b> confirmed migraine</span><span><b class="p">● P</b> confirmed menstruation</span></div><p class="calendar-hint">Swipe or use the arrows to move through time. Percentages are forecasts; confirmed observations override forecasts.</p></section>`;
  }
  function renderTrends(){
    const m=state.events.filter(e=>e.type==='migraine').sort((a,b)=>a.startDate.localeCompare(b.startDate)),p=state.events.filter(e=>e.type==='menstruation').sort((a,b)=>a.startDate.localeCompare(b.startDate)),md=m.map(durationDays),pd=p.map(durationDays),mi=m.slice(1).map((e,i)=>diffDays(e.startDate,m[i].startDate)),pi=p.slice(1).map((e,i)=>diffDays(e.startDate,p[i].startDate)),overlap=m.filter(x=>p.some(y=>x.startDate<=y.endDate&&x.endDate>=y.startDate)).length,rel=Array.from({length:15},(_,i)=>i-7).map(r=>({r,rate:p.length?p.filter(x=>m.some(y=>inEvent(addDays(x.startDate,r),y))).length/p.length:0}));
    const stat=(t,v)=>`<section class="stat"><span>${t}</span><strong>${v}</strong></section>`;
    return `<div class="page-intro"><h1>Trends</h1><p>Descriptive statistics from confirmed events.</p></div>${state.events.length?`<div class="stats-grid">${stat('Migraine events',m.length)}${stat('Migraine duration',md.length?`${mean(md).toFixed(1)} d avg · ${median(md).toFixed(1)} d median`:'—')}${stat('Migraine interval',mi.length?`${mean(mi).toFixed(1)} d avg`:'—')}${stat('Menstruation cycles',p.length)}${stat('Period duration',pd.length?`${mean(pd).toFixed(1)} d avg`:'—')}${stat('Cycle length',pi.length?`${mean(pi).toFixed(1)} d avg`:'—')}${stat('Overlapping migraine episodes',`${overlap}/${m.length}`)}</div><section class="trend-card"><h2>Migraine by day relative to menstruation start</h2><div class="rel-chart">${rel.map(x=>`<div class="rel-col"><div class="rel-bar" style="height:${Math.max(2,x.rate*120)}px" title="${Math.round(x.rate*100)}%"></div><span>${x.r>0?'+'+x.r:x.r}</span></div>`).join('')}</div><p class="muted">Observed relationship, not proof of causation.</p></section>`:`<section class="empty-card">Import or log confirmed events to populate trends.</section>`}</div>`;
  }
  function renderSettings(){ return `<div class="page-intro"><h1>Settings</h1><p>Data stays in this browser unless you export it yourself.</p></div><section class="settings-card"><h2>Data</h2><button class="primary" id="export-json">Export JSON</button><button class="secondary" id="import-json">Import JSON</button><input class="file-input" id="import-file" type="file" accept="application/json"><button class="danger-btn" id="clear-data">Clear all data</button><p class="muted">Private health exports should not be committed to a public GitHub repository.</p></section><section class="settings-card"><h2>Privacy & limits</h2><p>No telemetry, analytics, accounts or server storage. Forecasts are statistical estimates from confirmed events and are not medical advice.</p><p class="code-note">Deployment: direct static files from GitHub Pages main / root. No build step or GitHub Actions required.</p></section>`; }

  function bind(fc){
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.selectedDate=null;state.editingId=null;state.addType=null;render();});
    document.querySelectorAll('[data-log]').forEach(b=>b.onclick=()=>quickLog(b.dataset.log));
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.edit;render();});
    document.querySelectorAll('[data-end]').forEach(b=>b.onclick=async()=>{const id=b.dataset.end,t=todayISO();await commitEvents(state.events.map(e=>e.id===id?{...e,endDate:t,updatedAt:Date.now()}:e),'Event ended');});
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.calendarMode=b.dataset.mode;render();});
    document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
    document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{state.selectedDate=b.dataset.date;render();});
    const cal=document.getElementById('calendar-card'); if(cal){cal.ontouchstart=e=>state.touchX=e.touches[0].clientX;cal.ontouchend=e=>{if(state.touchX==null)return;const dx=e.changedTouches[0].clientX-state.touchX;if(Math.abs(dx)>50)navigate(dx<0?'1':'-1');state.touchX=null;};}
    const exp=document.getElementById('export-json'); if(exp)exp.onclick=exportJson;
    const imp=document.getElementById('import-json'),file=document.getElementById('import-file'); if(imp&&file){imp.onclick=()=>file.click();file.onchange=()=>importJson(file.files?.[0]);}
    const clear=document.getElementById('clear-data'); if(clear)clear.onclick=async()=>{if(confirm('Delete all locally stored events?'))await commitEvents([],'All data cleared');};
  }
  function navigate(v){
    if(v==='today'){state.cursor=todayISO();render();return;}
    const dir=Number(v),d=parseISO(state.cursor); if(state.calendarMode==='month')d.setUTCMonth(d.getUTCMonth()+dir);else d.setUTCDate(d.getUTCDate()+7*dir);state.cursor=iso(d);render();
  }

  // ---------- Sheets ----------
  function openDaySheet(date,fc){
    const e=state.events.filter(x=>inEvent(date,x)),p=fc.daily.get(date)||{migraineProbability:0,menstruationProbability:0};
    const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<section class="sheet"><div class="sheet-head"><div><h2>${formatLong(date)}</h2><p class="muted">Confirmed observations override forecasts.</p></div><button class="icon-btn" id="close-day">×</button></div>${e.length?`<div class="confirmed-list">${e.map(x=>`<button class="confirmed-item ${x.type}" data-sheet-edit="${x.id}">● ${x.type==='migraine'?'Migraine':'Menstruation'} · edit</button>`).join('')}</div>`:''}<div class="add-row"><button class="secondary" data-add="migraine">+ Migraine</button><button class="secondary" data-add="menstruation">+ Menstruation</button></div><div class="prob-detail"><strong>Migraine</strong><span>${Math.round(p.migraineProbability*100)}%</span></div><ul class="reason-list">${reasons('migraine',date,fc).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="prob-detail"><strong>Menstruation</strong><span>${Math.round(p.menstruationProbability*100)}%</span></div><ul class="reason-list">${reasons('menstruation',date,fc).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
    node.onclick=e2=>{if(e2.target===node){state.selectedDate=null;render();}};document.body.appendChild(node);
    node.querySelector('#close-day').onclick=()=>{state.selectedDate=null;render();};
    node.querySelectorAll('[data-sheet-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.sheetEdit;state.selectedDate=null;render();});
    node.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{state.addType=b.dataset.add;state.selectedDate=date;state.editingId=null;openEditSheet();node.remove();});
  }
  function openEditSheet(){
    const existing=state.editingId?state.events.find(e=>e.id===state.editingId):null,date=state.selectedDate||todayISO(),draft=existing?{...existing}:newEvent(state.addType||'migraine',date);
    const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<section class="sheet"><div class="sheet-head"><h2>${existing?'Edit event':'Add event'}</h2><button class="icon-btn" id="close-edit">×</button></div><label>Type<select id="ev-type"><option value="migraine" ${draft.type==='migraine'?'selected':''}>Migraine</option><option value="menstruation" ${draft.type==='menstruation'?'selected':''}>Menstruation</option></select></label><div class="form-grid"><label>Start date<input id="ev-start" type="date" value="${draft.startDate}"></label><label>End date<input id="ev-end" type="date" value="${draft.endDate}"></label></div><div class="duration-chip" id="duration-chip">Duration: ${durationDays(draft)} day${durationDays(draft)===1?'':'s'}</div><label>Notes (optional)<textarea id="ev-notes" rows="3">${esc(draft.notes||'')}</textarea></label><p class="error-text" id="edit-error"></p><div class="sheet-actions">${existing?'<button class="danger-btn" id="delete-event">Delete</button>':'<span></span>'}<button class="primary" id="save-event">Save</button></div></section>`;
    document.body.appendChild(node);
    const start=node.querySelector('#ev-start'),end=node.querySelector('#ev-end'),chip=node.querySelector('#duration-chip'),err=node.querySelector('#edit-error'),save=node.querySelector('#save-event');
    function validate(){const valid=start.value&&end.value&&start.value<=end.value;if(valid){const n=diffDays(end.value,start.value)+1;chip.textContent=`Duration: ${n} day${n===1?'':'s'}`;err.textContent='';save.disabled=false;}else{chip.textContent='Duration: invalid';err.textContent='End date must be on or after start date.';save.disabled=true;}}
    start.oninput=validate;end.oninput=validate;validate();
    function close(){state.editingId=null;state.addType=null;state.selectedDate=null;node.remove();render();}
    node.onclick=e=>{if(e.target===node)close();};node.querySelector('#close-edit').onclick=close;
    save.onclick=async()=>{const row={...draft,type:node.querySelector('#ev-type').value,startDate:start.value,endDate:end.value,notes:node.querySelector('#ev-notes').value.trim()||undefined,updatedAt:Date.now(),confirmed:true};const next=existing?state.events.map(e=>e.id===row.id?row:e):[...state.events,row];state.editingId=null;state.addType=null;state.selectedDate=null;node.remove();await commitEvents(next,existing?'Event updated':'Event added');};
    const del=node.querySelector('#delete-event');if(del)del.onclick=async()=>{if(confirm('Delete this event?')){state.editingId=null;node.remove();await commitEvents(state.events.filter(e=>e.id!==existing.id),'Event deleted');}};
  }

  // ---------- Import/export ----------
  function normalizeImported(raw){ const rows=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.events)?raw.events:null); if(!rows)throw new Error('Invalid file: expected an events array.'); const now=Date.now(); return rows.map((e,i)=>{if(!e||!['migraine','menstruation'].includes(e.type))throw new Error(`Invalid event type at row ${i+1}.`);if(!/^\d{4}-\d{2}-\d{2}$/.test(e.startDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(e.endDate||''))throw new Error(`Invalid date at row ${i+1}.`);if(e.endDate<e.startDate)throw new Error(`End date precedes start date at row ${i+1}.`);return{id:e.id||uid(),type:e.type,startDate:e.startDate,endDate:e.endDate,confirmed:true,createdAt:Number(e.createdAt)||now,updatedAt:now,notes:typeof e.notes==='string'?e.notes:undefined};}); }
  function exportJson(){ const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),events:state.events},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cycle-forecast-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  async function importJson(file){ if(!file)return; try{const raw=JSON.parse(await file.text());await commitEvents(normalizeImported(raw),'Data imported');}catch(e){alert(e.message||String(e));} }
  function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),1800);}

  // ---------- Boot ----------
  async function boot(){
    try{state.events=normalizeEvents(await loadEvents());}catch(e){console.error(e);state.events=[];}
    render();
    if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.error)); }
  }
  boot();
})();
