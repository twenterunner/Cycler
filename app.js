(() => {
  'use strict';

  const APP_VERSION = '2026.10.01-phase-v12';
  const DB_NAME = 'cycler-local-db';
  const STORE = 'events';
  const app = document.getElementById('app');


  // Initial history supplied by the user. Because this is a static GitHub Pages app,
  // values embedded here are visible in the public repository/source code.
  const SEED_DATA_VERSION = 'shared-history-2026-v1';
  const INITIAL_EVENTS = [
    {id:'seed-migraine-1',type:'migraine',startDate:'2026-05-04',endDate:'2026-05-07',confirmed:true,createdAt:1767225600001,updatedAt:1767225600001},
    {id:'seed-migraine-2',type:'migraine',startDate:'2026-05-19',endDate:'2026-05-21',confirmed:true,createdAt:1767225600002,updatedAt:1767225600002},
    {id:'seed-migraine-3',type:'migraine',startDate:'2026-06-17',endDate:'2026-06-18',confirmed:true,createdAt:1767225600003,updatedAt:1767225600003},
    {id:'seed-migraine-4',type:'migraine',startDate:'2026-07-01',endDate:'2026-07-02',confirmed:true,createdAt:1767225600004,updatedAt:1767225600004},
    {id:'seed-migraine-5',type:'migraine',startDate:'2026-07-14',endDate:'2026-07-16',confirmed:true,createdAt:1767225600005,updatedAt:1767225600005},
    {id:'seed-migraine-6',type:'migraine',startDate:'2026-07-28',endDate:'2026-07-30',confirmed:true,createdAt:1767225600006,updatedAt:1767225600006},
    {id:'seed-migraine-7',type:'migraine',startDate:'2026-08-14',endDate:'2026-08-15',confirmed:true,createdAt:1767225600007,updatedAt:1767225600007},
    {id:'seed-migraine-8',type:'migraine',startDate:'2026-08-24',endDate:'2026-08-26',confirmed:true,createdAt:1767225600008,updatedAt:1767225600008},
    {id:'seed-migraine-9',type:'migraine',startDate:'2026-09-08',endDate:'2026-09-10',confirmed:true,createdAt:1767225600009,updatedAt:1767225600009},
    {id:'seed-migraine-10',type:'migraine',startDate:'2026-09-26',endDate:'2026-09-27',confirmed:true,createdAt:1767225600010,updatedAt:1767225600010},
    {id:'seed-menstruation-1',type:'menstruation',startDate:'2026-05-28',endDate:'2026-05-30',confirmed:true,createdAt:1767225600101,updatedAt:1767225600101},
    {id:'seed-menstruation-2',type:'menstruation',startDate:'2026-06-17',endDate:'2026-06-18',confirmed:true,createdAt:1767225600102,updatedAt:1767225600102},
    {id:'seed-menstruation-3',type:'menstruation',startDate:'2026-07-14',endDate:'2026-07-16',confirmed:true,createdAt:1767225600103,updatedAt:1767225600103},
    {id:'seed-menstruation-4',type:'menstruation',startDate:'2026-08-03',endDate:'2026-08-07',confirmed:true,createdAt:1767225600104,updatedAt:1767225600104},
    {id:'seed-menstruation-5',type:'menstruation',startDate:'2026-08-24',endDate:'2026-08-26',confirmed:true,createdAt:1767225600105,updatedAt:1767225600105},
    {id:'seed-menstruation-6',type:'menstruation',startDate:'2026-09-07',endDate:'2026-09-10',confirmed:true,createdAt:1767225600106,updatedAt:1767225600106}
  ];

  const state = {
    events: [],
    tab: 'today',
    calendarMode: 'month',
    cursor: todayISO(),
    selectedDate: null,
    editingId: null,
    addType: null,
    touchX: null,
    installReady: false,
    installed: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
    dataRevision: 0,
    trendHorizon: 30,
  };

  const forecastCache = new Map();
  let trendsHtmlCache = null;

  function invalidateDerivedCaches(){
    forecastCache.clear();
    trendsHtmlCache = null;
    state.dataRevision += 1;
  }

  // Keep the normal UI fast: 180 future days are enough for Today, the current
  // calendar and the 7/30-day Trends outlook. If the user navigates further
  // into the future, expand the horizon only as far as that view requires.
  function forecastHorizonForView(anchor=todayISO()){
    let horizon=120;
    if(state.tab==='calendar'){
      const visibleEnd=state.calendarMode==='month'?monthEnd(state.cursor):addDays(startOfWeek(state.cursor),6);
      const ahead=diffDays(visibleEnd,anchor);
      if(ahead>95) horizon=Math.min(730,Math.max(120,ahead+35));
    }
    return horizon;
  }

  function getForecast(anchor=todayISO(),horizon=120){
    const key = `${state.dataRevision}|${anchor}|${horizon}`;
    if(forecastCache.has(key)) return forecastCache.get(key);
    const value = buildForecast(state.events,anchor,horizon);
    forecastCache.set(key,value);
    // Keep only the most recent few horizons so navigation stays responsive
    // without retaining unnecessary forecast maps.
    while(forecastCache.size>3){forecastCache.delete(forecastCache.keys().next().value);}
    return value;
  }

  const isSamsungInternet = /SamsungBrowser/i.test(navigator.userAgent);

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    // Samsung Internet currently mints WebAPKs that may be rejected by Play Protect
    // on recent Android versions. Do not trigger that installation path there.
    if (isSamsungInternet) {
      event.preventDefault();
      state.installReady = false;
      if (app.innerHTML) render();
      return;
    }
    event.preventDefault();
    deferredInstallPrompt = event;
    state.installReady = true;
    if (app.innerHTML) render();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    state.installReady = false;
    state.installed = true;
    if (app.innerHTML) render();
  });

  function openInChrome(){
    const target = location.href.replace(/^https?:\/\//, '');
    const intent = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
    location.href = intent;
    setTimeout(() => {
      alert('Open Cycler in Google Chrome, then use Chrome menu ⋮ → Install app / Add to Home screen.');
    }, 1200);
  }

  async function installApp(){
    if(state.installed){ toast('Cycler is already installed'); return; }
    if(isSamsungInternet){
      openInChrome();
      return;
    }
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      state.installReady = false;
      if(choice && choice.outcome === 'accepted') toast('Cycler installation started');
      render();
      return;
    }
    alert('Open Cycler in Google Chrome and use the browser menu (⋮) → Install app / Add to Home screen. If the option is not shown yet, reload once and try again.');
  }

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
  async function commitEvents(events,msg){
    state.events=normalizeEvents(events);
    invalidateDerivedCaches();
    if(msg) toast(msg);
    // Yield once before rebuilding the statistical model. This lets the tap,
    // sheet close and paint complete first on slower Android devices.
    setTimeout(()=>render(),0);
    try{ await saveAll(state.events); }catch(err){ console.error('Failed to persist events',err); toast('Could not save locally'); }
  }
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
  // v10 uses a conservative probabilistic ensemble:
  // 1) conditional renewal timing from the last confirmed start,
  // 2) robust interval density (empirical KDE + heavy-tailed Student kernel),
  // 3) recency weighting chosen by rolling historical validation,
  // 4) a Fourier modifier whose influence is checked on prior held-out events,
  // 5) for migraine only, a shrunk menstruation-phase modifier,
  // 6) observed duration to convert start timing into P(active on this date).

  function studentKernel(x,m,s,nu=4){
    s=Math.max(.8,s); const z=(x-m)/s;
    return Math.pow(1+(z*z)/nu,-(nu+1)/2)/s;
  }

  function durationForecast(events){
    const d=events.map(durationDays).filter(x=>x>0);
    if(!d.length) return {expected:1,low:1,high:1,label:'insufficient data',survival:lag=>lag===0?1:0};
    const w=recencyWeights(d.length,.90), expected=weightedMean(d,w), low=Math.max(1,Math.round(percentile(d,.25))), high=Math.max(1,Math.round(percentile(d,.75))), sw=w.reduce((a,b)=>a+b,0);
    return {expected,low,high,label:low===high?`${low} day${low===1?'':'s'}`:`${low}–${high} days`,survival:lag=>{
      const alive=d.reduce((sum,x,i)=>sum+(x>lag?w[i]:0),0);
      return clamp((alive+.45)/(sw+.9),0,1);
    }};
  }

  function fitIntervalDistribution(intervals,decay=.90){
    if(!intervals.length) return {pmf:[0],center:0,sigma:8,decay};
    const robust=robustify(intervals),w=recencyWeights(robust.length,decay),sw=w.reduce((a,b)=>a+b,0),wm=weightedMean(robust,w),wmed=weightedMedian(robust,w);
    const center=.45*wm+.55*wmed,scaleCore=Math.max(1.2,.55*Math.max(1,mad(robust))+.45*Math.max(1,weightedStd(robust,w,wm))),sigma=scaleCore*Math.sqrt(1+1.8/Math.max(1,intervals.length));
    const maxObserved=Math.max(...robust),maxInt=Math.max(90,Math.ceil(center+7*sigma),Math.ceil(maxObserved*1.45)),raw=Array(maxInt+1).fill(0),band=Math.max(1.15,sigma*.40);
    for(let d=1;d<=maxInt;d++){
      let empirical=0;for(let i=0;i<robust.length;i++)empirical+=w[i]*normalPdf(d,robust[i],band);
      empirical/=Math.max(sw,1e-9);
      raw[d]=.62*empirical+.38*studentKernel(d,center,Math.max(1.3,sigma),4);
    }
    return {pmf:[0,...normalize(raw.slice(1))],center,sigma,decay};
  }

  function intervalMassAround(pmf,d,window=1){
    let p=0;for(let k=Math.max(1,d-window);k<=Math.min(pmf.length-1,d+window);k++)p+=pmf[k]||0;
    return Math.max(1e-9,p);
  }

  function chooseDecay(intervals){
    if(intervals.length<5)return .90;
    const candidates=[.72,.82,.90,.97,1.0],scores=[];
    for(const decay of candidates){
      let score=0,n=0;
      for(let i=3;i<intervals.length;i++){
        const fit=fitIntervalDistribution(intervals.slice(0,i),decay),actual=intervals[i];
        score+=Math.log(intervalMassAround(fit.pmf,actual,1));n++;
      }
      score-=Math.abs(decay-.90)*.08;
      scores.push({decay,score:score/Math.max(1,n)});
    }
    scores.sort((a,b)=>b.score-a.score);return scores[0].decay;
  }

  function recurrenceModel(starts,anchor,horizon=730){
    const sorted=[...starts].sort(),intervals=sorted.slice(1).map((d,i)=>diffDays(d,sorted[i])).filter(x=>x>0);
    if(!sorted.length||!intervals.length)return{intervals,center:0,sigma:8,pmf:[0],elapsed:0,firstStart:new Map(),decay:.90};
    const decay=chooseDecay(intervals),fit=fitIntervalDistribution(intervals,decay),pmf=fit.pmf,last=sorted.at(-1),elapsed=Math.max(0,diffDays(anchor,last)),firstRaw=Array(horizon+1).fill(0);
    for(let i=0;i<=horizon;i++){const interval=elapsed+i;if(interval>=1&&interval<pmf.length)firstRaw[i]=pmf[interval];}
    if(firstRaw.reduce((a,b)=>a+b,0)<1e-8){for(let i=0;i<=Math.min(horizon,90);i++)firstRaw[i]=studentKernel(elapsed+i,Math.max(elapsed,fit.center),Math.max(4,fit.sigma*1.7),4);}
    const firstNorm=normalize(firstRaw),firstStart=new Map();firstNorm.forEach((p,i)=>{if(p>1e-9)firstStart.set(addDays(anchor,i),p);});
    return{intervals,center:fit.center,sigma:fit.sigma,pmf,elapsed,firstStart,decay};
  }

  function rawSpectralModel(starts,minPeriod=7,maxPeriod=60){
    const sorted=[...starts].sort();
    if(sorted.length<4)return{period:0,strength:0,phase:0,sigma:5,origin:sorted[0]||null,prominence:0,coherence:0};
    const origin=sorted[0],pos=sorted.map(d=>diffDays(d,origin)),span=Math.max(...pos)+1,series=Array(span).fill(0);pos.forEach(i=>series[i]=1);
    const avg=mean(series),windowed=series.map((x,i)=>{const win=span>1?.5*(1-Math.cos(2*Math.PI*i/(span-1))):1;return(x-avg)*win;}),amps=[],periods=[];
    for(let p=minPeriod;p<=maxPeriod+1e-9;p+=.25){let re=0,im=0,om=2*Math.PI/p;for(let t=0;t<span;t++){re+=windowed[t]*Math.cos(om*t);im+=windowed[t]*Math.sin(om*t);}periods.push(p);amps.push(Math.hypot(re,im));}
    const best=Math.max(...amps),idx=amps.indexOf(best),period=periods[idx],prominence=best/Math.max(.0001,median(amps)),rw=recencyWeights(pos.length,.92),sw=rw.reduce((a,b)=>a+b,0);let cs=0,ss=0;
    for(let i=0;i<pos.length;i++){const th=2*Math.PI*pos[i]/period;cs+=rw[i]*Math.cos(th);ss+=rw[i]*Math.sin(th);}
    const coherence=clamp(Math.hypot(cs,ss)/Math.max(sw,1e-9),0,1);let angle=Math.atan2(ss,cs);if(angle<0)angle+=2*Math.PI;
    const phase=angle/(2*Math.PI)*period,sampleFactor=clamp((sorted.length-3)/8,0,1),strength=clamp((prominence-1.25)/4.5,0,1)*Math.sqrt(coherence)*sampleFactor,sigma=Math.max(1.8,period*(.09+.11*(1-strength)));
    return{period,strength,phase,sigma,origin,prominence,coherence};
  }

  function spectralScore(date,m){
    if(!m||!m.period||!m.origin)return 1;
    const t=diffDays(date,m.origin),p=m.period,x=((t-m.phase)%p+p)%p,dist=Math.min(x,p-x);
    return Math.exp(-.5*(dist/m.sigma)**2);
  }

  function validateSpectralContribution(starts){
    const sorted=[...starts].sort();if(sorted.length<6)return 0;
    let gain=0,tests=0;
    for(let i=5;i<sorted.length;i++){
      const train=sorted.slice(0,i),intervals=train.slice(1).map((d,j)=>diffDays(d,train[j])).filter(x=>x>0),last=train.at(-1),actual=diffDays(sorted[i],last);
      if(intervals.length<3||actual<1)continue;
      const fit=fitIntervalDistribution(intervals,chooseDecay(intervals)),sp=rawSpectralModel(train);if(!sp.period||sp.strength<=0)continue;
      const base=fit.pmf.slice(),mod=Array(base.length).fill(0);for(let d=1;d<base.length;d++)mod[d]=base[d]*(.18+.82*spectralScore(addDays(last,d),sp));
      const mn=[0,...normalize(mod.slice(1))],pb=intervalMassAround(base,actual,1),ps=intervalMassAround(mn,actual,1);gain+=Math.log(ps/pb);tests++;
    }
    if(!tests)return 0;const avg=gain/tests,evidence=clamp(tests/5,0,1);return clamp(avg/.28,0,1)*evidence;
  }

  function spectralModel(starts,minPeriod=7,maxPeriod=60){
    const base=rawSpectralModel(starts,minPeriod,maxPeriod),validation=validateSpectralContribution(starts),predictiveWeight=base.strength*(.08+.92*validation);
    return{...base,validation,predictiveWeight};
  }


  // Phase-state rhythm model used for recurrent future opportunities.
  // The raw interval model treats a 28-day gap as one very long interval. If a
  // strong ~14-day rhythm exists, it can instead represent a skipped 14-day
  // opportunity. This keeps near-term recurrent peaks visible without forcing
  // the next-event forecast itself to become artificially overconfident.
  function latentRhythmModel(starts,spectral){
    const sorted=[...starts].sort();
    if(sorted.length<5||!spectral?.period)return null;
    const p=spectral.period,intervals=sorted.slice(1).map((d,i)=>diffDays(d,sorted[i])).filter(x=>x>0);
    if(intervals.length<4)return null;
    const multiples=intervals.map(x=>Math.max(1,Math.round(x/p))),residuals=intervals.map((x,i)=>x-multiples[i]*p),robust=robustify(residuals),w=recencyWeights(robust.length,.90);
    const bias=weightedMean(robust,w),spread=Math.max(1.25,weightedStd(robust,w,bias)),sigma=Math.min(p*.36,spread*Math.sqrt(1+1.25/Math.max(1,robust.length))),totalCycles=multiples.reduce((a,b)=>a+b,0),hitRate=clamp((intervals.length+2)/(totalCycles+3),.45,.94);
    const coherence=clamp(spectral.coherence||0),prominence=clamp(((spectral.prominence||1)-1.5)/5,0,1),validation=clamp(spectral.validation||0),jitterQuality=clamp(1-sigma/Math.max(2,p*.45),0,1),sample=clamp((sorted.length-4)/7,0,1);
    const evidence=clamp(.34*coherence+.24*prominence+.24*jitterQuality+.18*validation,0,1),weight=clamp(evidence*sample*.58,0,.46),effectivePeriod=clamp(p+.40*bias,p*.90,p*1.10),drift=Math.max(.55,sigma*.32);
    return{period:p,effectivePeriod,bias,sigma,drift,hitRate,weight,lastStart:sorted.at(-1),coherence,prominence,validation,jitterQuality};
  }

  function rhythmRecurringMass(rhythm,anchor,horizon){
    const out=Array(horizon+1).fill(0);if(!rhythm?.lastStart||!rhythm.effectivePeriod)return out;
    const elapsed=Math.max(0,diffDays(anchor,rhythm.lastStart)),p=rhythm.effectivePeriod,firstCycle=Math.max(1,Math.floor(elapsed/p));
    for(let cycle=firstCycle;cycle<=Math.ceil((elapsed+horizon+6*p)/p);cycle++){
      const center=cycle*p-elapsed;if(center<-6*rhythm.sigma)continue;if(center>horizon+6*rhythm.sigma)break;
      const sigma=Math.sqrt(rhythm.sigma*rhythm.sigma+Math.max(0,cycle-1)*rhythm.drift*rhythm.drift),mass=rhythm.hitRate;
      for(let i=0;i<=horizon;i++)out[i]+=mass*normalPdf(i,center,sigma);
    }
    return out;
  }

  function fourierSpectrum(starts,minPeriod=7,maxPeriod=60,step=.5){
    const sorted=[...starts].sort();if(sorted.length<4)return[];
    const origin=sorted[0],pos=sorted.map(d=>diffDays(d,origin)),span=Math.max(...pos)+1,series=Array(span).fill(0);pos.forEach(i=>series[i]=1);
    const avg=mean(series),windowed=series.map((x,i)=>{const win=span>1?.5*(1-Math.cos(2*Math.PI*i/(span-1))):1;return(x-avg)*win;}),out=[];let maxAmp=0;
    for(let period=minPeriod;period<=maxPeriod+1e-9;period+=step){let re=0,im=0,om=2*Math.PI/period;for(let t=0;t<span;t++){re+=windowed[t]*Math.cos(om*t);im+=windowed[t]*Math.sin(om*t);}const amp=Math.hypot(re,im);maxAmp=Math.max(maxAmp,amp);out.push({period,amp});}
    return out.map(x=>({period:x.period,amplitude:maxAmp?x.amp/maxAmp:0}));
  }

  function fourierChart(title,starts,spectral,kind){
    const data=fourierSpectrum(starts);if(!data.length)return`<section class="trend-card fourier-card"><h2>${title}</h2><p class="muted">Not enough confirmed event starts for a Fourier spectrum yet.</p></section>`;
    const W=640,H=220,L=44,R=18,T=24,B=34,plotW=W-L-R,plotH=H-T-B,minP=7,maxP=60,x=p=>L+(p-minP)/(maxP-minP)*plotW,y=a=>T+(1-a)*plotH,pts=data.map(d=>`${x(d.period).toFixed(1)},${y(d.amplitude).toFixed(1)}`).join(' '),xticks=[7,14,21,28,35,42,49,56],yticks=[0,.5,1],peak=spectral?.period||data.reduce((b,d)=>d.amplitude>b.amplitude?d:b,data[0]).period,px=x(peak);
    return `<section class="trend-card fourier-card ${kind}"><div class="trend-title-row"><div><h2>${title}</h2><p class="muted">Repeating timing signal in confirmed event starts.</p></div><strong class="fourier-peak">Peak ≈ ${peak.toFixed(1)} d</strong></div><svg class="fourier-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} Fourier spectrum">${yticks.map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" class="gridline"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" class="axis-label">${Math.round(v*100)}</text>`).join('')}${xticks.map(v=>`<line x1="${x(v)}" y1="${T}" x2="${x(v)}" y2="${H-B}" class="gridline vertical"/><text x="${x(v)}" y="${H-10}" text-anchor="middle" class="axis-label">${v}</text>`).join('')}<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" class="axis"/><line x1="${px}" y1="${T}" x2="${px}" y2="${H-B}" class="peak-line"/><polyline points="${pts}" class="spectrum-line"/><circle cx="${px}" cy="${y(1)}" r="4.5" class="peak-dot"/><text x="${W-R}" y="${H-10}" text-anchor="end" class="axis-title">Period (days)</text><text x="${L}" y="14" class="axis-title">Relative amplitude (%)</text></svg></section>`;
  }

  function normalizeMapArray(arr,anchor){const n=normalize(arr),m=new Map();n.forEach((p,i)=>{if(p>1e-9)m.set(addDays(anchor,i),p);});return m;}
  function mapToArray(map,anchor,horizon){return Array.from({length:horizon+1},(_,i)=>map.get(addDays(anchor,i))||0);}

  function migrainePhaseModel(migraines,periods){
    const rels=Array.from({length:15},(_,i)=>i-7),profile=new Map();if(!migraines.length||!periods.length){rels.forEach(r=>profile.set(r,1));return{profile,strength:0,nearFraction:0};}
    const starts=[...migraines,...periods].map(e=>e.startDate).sort(),span=Math.max(1,diffDays(starts.at(-1),starts[0])+1),baselineStart=clamp(migraines.length/span,.01,.35),raw=new Map();
    for(const rel of rels){let hits=0;for(const p of periods){const d=addDays(p.startDate,rel);if(migraines.some(m=>m.startDate===d))hits++;}const rate=(hits+.7)/(periods.length+1.4),ratio=clamp(rate/baselineStart,.45,3.5),shrink=periods.length/(periods.length+7);raw.set(rel,Math.exp(shrink*Math.log(ratio)));}
    for(const r of rels)profile.set(r,.22*(raw.get(r-1)||raw.get(r))+.56*raw.get(r)+.22*(raw.get(r+1)||raw.get(r)));
    let near=0;for(const m of migraines){const ds=periods.map(p=>Math.abs(diffDays(m.startDate,p.startDate)));if(ds.length&&Math.min(...ds)<=3)near++;}
    const cycleIntervals=periods.slice(1).map((p,i)=>diffDays(p.startDate,periods[i].startDate)),nearFraction=near/migraines.length,expectedNear=clamp(7/Math.max(14,median(cycleIntervals)||28),.12,.45),enrichment=clamp((nearFraction-expectedNear)/Math.max(.15,1-expectedNear),0,1),sample=clamp(Math.min(migraines.length,periods.length)/10,0,1);
    return{profile,nearFraction,strength:.26*enrichment*sample};
  }

  function menstrualPhaseScore(date,menStartMass,phase){
    if(!phase||!phase.profile||!menStartMass.size)return 1;let weighted=0,mass=0;
    for(let rel=-7;rel<=7;rel++){const ps=menStartMass.get(addDays(date,-rel))||0;if(!ps)continue;weighted+=ps*(phase.profile.get(rel)||1);mass+=ps;}
    return mass?weighted/mass:1;
  }

  function blendStartForecast(rec,spectral,anchor,horizon,type,extraScoreFn=null){
    const base=normalize(mapToArray(rec.firstStart,anchor,horizon));if(!base.some(Boolean))return new Map();
    const specScores=base.map((_,i)=>Math.max(.03,spectralScore(addDays(anchor,i),spectral))),specMean=base.reduce((sum,p,i)=>sum+p*specScores[i],0)||1,specCap=type==='migraine'?.34:.20,specWeight=specCap*clamp(spectral?.predictiveWeight||0,0,1);
    let phaseScores=null,phaseMean=1,phaseWeight=0;if(extraScoreFn){phaseScores=base.map((_,i)=>Math.max(.25,extraScoreFn(addDays(anchor,i))));phaseMean=base.reduce((sum,p,i)=>sum+p*phaseScores[i],0)||1;phaseWeight=Math.min(.26,extraScoreFn.strength||0);}
    let combined=base.map((p,i)=>p? p*Math.pow(specScores[i]/specMean,specWeight)*(phaseScores?Math.pow(phaseScores[i]/phaseMean,phaseWeight):1):0);combined=normalize(combined);
    const n=rec.intervals.length,trust=type==='migraine'?clamp(.54+n*.045,.58,.92):clamp(.50+n*.05,.56,.88),broad=normalize(combined.map((_,i)=>studentKernel(rec.elapsed+i,rec.center,Math.max(3.5,rec.sigma*1.65),4)));
    combined=normalize(combined.map((p,i)=>trust*p+(1-trust)*broad[i]));return normalizeMapArray(combined,anchor);
  }

  function renewalStartMass(nextStart,rec,spectral,anchor,horizon,phaseMultiplierFn=null,rhythm=null){
    const all=Array(horizon+1).fill(0),pmf=rec.pmf||[0];let current=mapToArray(nextStart,anchor,horizon);
    for(let cycle=1;cycle<=Math.ceil(horizon/Math.max(1,rec.center))+2;cycle++){
      for(let i=0;i<=horizon;i++)all[i]+=current[i]||0;
      const next=Array(horizon+1).fill(0);for(let i=0;i<=horizon;i++)if(current[i]>1e-12){for(let k=1;k<pmf.length&&i+k<=horizon;k++)if(pmf[k]>1e-12)next[i+k]+=current[i]*pmf[k];}
      const target=next.reduce((a,b)=>a+b,0);if(target<1e-8)break;
      const sw=clamp(spectral?.predictiveWeight||0,0,1)*(spectral?.period?.18:0);
      for(let i=0;i<=horizon;i++)if(next[i]>0){const d=addDays(anchor,i),sp=spectral?.period?Math.pow(.25+.75*spectralScore(d,spectral),sw):1,ph=phaseMultiplierFn?phaseMultiplierFn(d):1;next[i]*=sp*ph;}
      const after=next.reduce((a,b)=>a+b,0);if(after>0){const scale=target/after;for(let i=0;i<=horizon;i++)next[i]*=scale;}current=next;
    }
    if(rhythm?.weight>0){
      const rm=rhythmRecurringMass(rhythm,anchor,horizon);
      for(let i=0;i<=horizon;i++){
        const fade=Math.exp(-i/105),w=rhythm.weight*fade;
        all[i]=(1-w)*all[i]+w*rm[i];
      }
    }
    const m=new Map();all.forEach((p,i)=>{if(p>1e-8)m.set(addDays(anchor,i),clamp(p,0,.92));});return m;
  }

  function occurrenceFromStartMass(startMass,dur,anchor,horizon){
    const noEvent=Array(horizon+1).fill(1);
    for(const [s,p] of startMass){const si=diffDays(s,anchor);if(si<0||si>horizon)continue;for(let lag=0;lag<=12&&si+lag<=horizon;lag++){const surv=dur.survival(lag);if(surv<.005)continue;noEvent[si+lag]*=(1-clamp(p*surv,0,.95));}}
    const out=new Map();for(let i=0;i<=horizon;i++){const p=clamp(1-noEvent[i],0,.95);if(p>1e-8)out.set(addDays(anchor,i),p);}return out;
  }

  function confidence(rec,extra=99,type='generic'){const n=rec.intervals.length+1,cv=rec.center?rec.sigma/rec.center:99;if(type==='menstruation'){if(n>=10&&cv<.16)return'High';if(n>=5&&cv<.38)return'Moderate';return'Low';}if(n>=14&&extra>=10&&cv<.20)return'High';if(n>=7&&cv<.42)return'Moderate';return'Low';}
  function summary(type,nextStart,occ,durationLabel,conf,spectral,anchor){
    const entries=[...nextStart.entries()].sort((a,b)=>a[0].localeCompare(b[0]));if(!entries.length)return{type,nextLikelyStart:null,nextStartProbability:0,peakActiveDate:null,peakActiveProbability:0,windowStart:null,windowEnd:null,durationLabel,confidence:conf,spectralPeriod:spectral?.period||0,spectralStrength:spectral?.strength||0};
    const likely=entries.reduce((best,x)=>x[1]>best[1]?x:best,entries[0]);let c=0,lo=null,hi=null;for(const [d,p] of entries){c+=p;if(!lo&&c>=.1)lo=d;if(!hi&&c>=.9){hi=d;break;}}
    const peakEnd=hi?addDays(hi,10):null,oe=[...occ.entries()].filter(([d])=>(!anchor||d>=anchor)&&(!peakEnd||d<=peakEnd)),peak=oe.length?oe.reduce((b,x)=>x[1]>b[1]?x:b,oe[0]):[likely[0],likely[1]];
    return{type,nextLikelyStart:likely[0],nextStartProbability:likely[1],peakActiveDate:peak[0],peakActiveProbability:peak[1],windowStart:lo,windowEnd:hi,durationLabel,confidence:conf,spectralPeriod:spectral?.period||0,spectralStrength:spectral?.strength||0};
  }

  function buildMenstruation(events,anchor,horizon){
    const periods=events.filter(e=>e.type==='menstruation').sort((a,b)=>a.startDate.localeCompare(b.startDate)),dur=durationForecast(periods),rec=recurrenceModel(periods.map(e=>e.startDate),anchor,horizon),spectral=spectralModel(periods.map(e=>e.startDate));
    if(periods.length<2)return{periods,rec,dur,spectral,nextStart:new Map(),startMass:new Map(),occ:new Map(),summary:summary('menstruation',new Map(),new Map(),dur.label,'Low',spectral,anchor)};
    const nextStart=blendStartForecast(rec,spectral,anchor,horizon,'menstruation'),startMass=renewalStartMass(nextStart,rec,spectral,anchor,horizon),occ=occurrenceFromStartMass(startMass,dur,anchor,horizon);periods.forEach(e=>eachDay(e.startDate,e.endDate).forEach(d=>occ.set(d,1)));
    return{periods,rec,dur,spectral,nextStart,startMass,occ,summary:summary('menstruation',nextStart,occ,dur.label,confidence(rec,0,'menstruation'),spectral,anchor)};
  }

  function historicalBaseline(migraines,events){
    if(!migraines.length||!events.length)return 0;const first=[...events].sort((a,b)=>a.startDate.localeCompare(b.startDate))[0].startDate,last=[...events].sort((a,b)=>a.endDate.localeCompare(b.endDate)).at(-1).endDate,days=Math.max(1,diffDays(last,first)+1),migDays=new Set(migraines.flatMap(e=>eachDay(e.startDate,e.endDate))).size;return(migDays+1)/(days+6);
  }

  function buildMigraine(events,men,anchor,horizon){
    const migraines=events.filter(e=>e.type==='migraine').sort((a,b)=>a.startDate.localeCompare(b.startDate)),starts=migraines.map(e=>e.startDate),dur=durationForecast(migraines),rec=recurrenceModel(starts,anchor,horizon),spectral=spectralModel(starts),rhythm=latentRhythmModel(starts,spectral),baseline=historicalBaseline(migraines,events),phase=migrainePhaseModel(migraines,men.periods);
    if(migraines.length<2)return{migraines,rec,dur,spectral,rhythm,baseline,phase,unexplainedFloor:baseline*.2,nextStart:new Map(),startMass:new Map(),occ:new Map(),summary:summary('migraine',new Map(),new Map(),dur.label,'Low',spectral,anchor)};
    const extra=d=>menstrualPhaseScore(d,men.startMass,phase);extra.strength=phase.strength;const nextStart=blendStartForecast(rec,spectral,anchor,horizon,'migraine',extra),phaseMult=d=>Math.pow(Math.max(.4,menstrualPhaseScore(d,men.startMass,phase)),phase.strength),startMass=renewalStartMass(nextStart,rec,spectral,anchor,horizon,phaseMult,rhythm),occ=occurrenceFromStartMass(startMass,dur,anchor,horizon),reliability=clamp(.35+.045*rec.intervals.length+.25*(spectral.predictiveWeight||0)+.12*(rhythm?.weight||0)+phase.strength,.35,.91),unexplainedFloor=clamp(baseline*(1-reliability)*.27,.0035,.04);
    migraines.forEach(e=>eachDay(e.startDate,e.endDate).forEach(d=>occ.set(d,1)));return{migraines,rec,dur,spectral,rhythm,baseline,phase,unexplainedFloor,nextStart,startMass,occ,summary:summary('migraine',nextStart,occ,dur.label,confidence(rec,men.periods.length,'migraine'),spectral,anchor)};
  }

  function buildForecast(events,anchor,horizon=730){
    const men=buildMenstruation(events,anchor,horizon),mig=buildMigraine(events,men,anchor,horizon),daily=new Map();
    for(let i=-400;i<=horizon;i++){
      const d=addDays(anchor,i),cm=events.some(e=>e.type==='migraine'&&inEvent(d,e)),cp=events.some(e=>e.type==='menstruation'&&inEvent(d,e));let mp,pp;
      if(i>=0){const modeled=mig.occ.get(d)||0;mp=cm?1:clamp(1-(1-modeled)*(1-(mig.unexplainedFloor||0)),0,.97);pp=cp?1:clamp(men.occ.get(d)||0,0,.97);}else{mp=cm?1:historicalDayEstimate(d,mig.migraines,mig.rec);pp=cp?1:historicalDayEstimate(d,men.periods,men.rec);}
      daily.set(d,{date:d,migraineProbability:clamp(mp||0),menstruationProbability:clamp(pp||0),confirmedMigraine:cm,confirmedMenstruation:cp});
    }
    return{men,mig,daily};
  }

  function historicalDayEstimate(date,events,rec){
    if(!events.length||!rec.center)return 0;const nearest=Math.min(...events.map(e=>Math.abs(diffDays(date,e.startDate)))),phaseDist=Math.min(...events.map(e=>{const delta=Math.abs(diffDays(date,e.startDate)),r=delta%Math.max(1,Math.round(rec.center));return Math.min(r,Math.max(1,Math.round(rec.center))-r);}));return clamp(.02+.15*Math.exp(-phaseDist/Math.max(1,rec.sigma))+.14*Math.exp(-nearest/2),0,.48);
  }

  function reasons(type,date,fc){
    if(type==='migraine'){
      if(state.events.some(e=>e.type==='migraine'&&inEvent(date,e)))return['Confirmed migraine event.'];
      const r=['Probability is based mainly on conditional time since the last event and the observed interval distribution.'];
      if(fc.mig.spectral?.predictiveWeight>.01)r.push('A validated Fourier rhythm contributes to timing; recurrent future peaks use a phase-state model whose uncertainty widens with time.');
      if(fc.mig.phase?.strength>.01)r.push('The menstruation timing relationship contributes with small-sample shrinkage.');
      r.push('Observed duration is folded into the probability of migraine being active on this date.');return r;
    }
    if(state.events.some(e=>e.type==='menstruation'&&inEvent(date,e)))return['Confirmed menstruation event.'];
    const r=['Probability is conditional on time since the last confirmed start and the historical cycle intervals.'];
    if(fc.men.spectral?.predictiveWeight>.01)r.push('A Fourier rhythm modifier contributes only when historical validation supports it.');
    r.push('Observed period duration is folded into the probability of menstruating on this date.');return r;
  }

  // ---------- Rendering ----------
  // Calendar colour is intentionally much lighter at low probability and much steeper near local peaks.
  // The number remains the absolute probability; only visual intensity is normalized within the visible period.
  function heatAlpha(p,minP,maxP){
    p=clamp(p||0);
    const absolute=clamp((p-.04)/.56,0,1);
    const relative=maxP>minP+.015?clamp((p-minP)/(maxP-minP),0,1):absolute;
    const score=.32*Math.pow(absolute,1.35)+.68*Math.pow(relative,1.75);
    return clamp(.018+.80*score,.018,.82);
  }
  function probabilityLabel(kind,p,visualAlpha){
    p=clamp(p||0);const pct=Math.round(p*100),isM=kind==='migraine';
    const light=visualAlpha>=.42;
    const fg=light?'#fff':(isM?'#4c36a8':'#9a2a50');
    return `<span class="prob-label ${kind}" style="color:${fg}"><b>${isM?'M':'P'}</b> ${pct}%</span>`;
  }
  function confirmedLabel(kind,label){
    return `<span class="confirmed-label ${kind}">${label}</span>`;
  }
  function forecastCard(s){
    const label=s.type==='migraine'?'Migraine':'Menstruation';
    return `<section class="forecast-card ${s.type}"><div class="forecast-title-row"><span class="event-dot"></span><strong>${label}</strong><span class="confidence">${s.confidence} confidence</span></div><div class="forecast-main">${s.nextLikelyStart?formatShort(s.nextLikelyStart):'Not enough data'}</div><div class="forecast-prob">${s.nextLikelyStart?`Likely start ${Math.round(s.nextStartProbability*100)}% · peak day ${Math.round(s.peakActiveProbability*100)}% on ${formatShort(s.peakActiveDate)}`:'Add more confirmed events'}</div><div class="forecast-meta"><span>Window: ${s.windowStart&&s.windowEnd?`${formatShort(s.windowStart)}–${formatShort(s.windowEnd)}`:'—'}</span><span>Duration: ${s.durationLabel}</span></div>${s.spectralPeriod?`<div class="model-note">Rhythm signal ≈ ${s.spectralPeriod.toFixed(1)} d</div>`:''}</section>`;
  }
  function ensureShell(){
    if(document.querySelector('.app-shell')) return;
    app.innerHTML=`<div class="app-shell"><header class="topbar"><div><strong>Cycle Forecast</strong><span>Private · local-first · ${APP_VERSION}</span></div><div class="top-actions" id="top-actions"></div></header><main id="main"></main><nav class="bottom-nav">${[['today','●','Today'],['calendar','▦','Calendar'],['trends','⌁','Trends'],['settings','⚙','Settings']].map(([id,ic,l])=>`<button data-tab="${id}"><span>${ic}</span>${l}</button>`).join('')}</nav></div>`;
  }
  function render(){
    const t=todayISO(),horizon=forecastHorizonForView(t),fc=getForecast(t,horizon);
    ensureShell();
    const topActions=document.getElementById('top-actions');
    if(topActions) topActions.innerHTML=!state.installed?`<button class="install-top" id="install-app">${isSamsungInternet?'Install via Chrome':'Install app'}</button><span class="offline-badge">Offline ready</span>`:'<span class="installed-badge">Installed</span><span class="offline-badge">Offline ready</span>';
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
    const main=document.getElementById('main');
    if(state.tab==='today') main.innerHTML=renderToday(t,fc);
    if(state.tab==='calendar') main.innerHTML=renderCalendar(t,fc);
    if(state.tab==='trends') main.innerHTML=renderTrends(fc);
    if(state.tab==='settings') main.innerHTML=renderSettings();
    bind(fc);
    if(state.selectedDate) openDaySheet(state.selectedDate,fc);
    if(state.editingId||state.addType) openEditSheet();
  }
  function renderToday(t,fc){
    const p=fc.daily.get(t)||{migraineProbability:0,menstruationProbability:0};
    function card(type,label,prob){
      const existing=state.events.find(e=>e.type===type&&inEvent(t,e)),y=state.events.find(e=>e.type===type&&e.endDate===addDays(t,-1));
      return `<section class="quick-card today-prob ${type}"><div class="today-prob-head"><h3>${label}</h3><strong>${Math.round(prob*100)}%</strong></div>${existing?`<p>Confirmed today.</p><div class="quick-actions"><button class="secondary" data-edit="${existing.id}">Edit</button><button class="secondary" data-end="${existing.id}">End today</button></div>`:`<p>${y?'Continue yesterday’s event?':'Estimated probability today.'}</p><button class="primary" data-log="${type}">${y?`${label} continues today`:`Log ${label.toLowerCase()} today`}</button>`}</section>`;
    }
    return `<div class="page-intro"><h1>Today</h1><p>${formatLong(t)}</p></div><div class="forecast-grid">${forecastCard(fc.mig.summary)}${forecastCard(fc.men.summary)}</div><h2 class="section-title">Today</h2><div class="quick-grid">${card('migraine','Migraine',p.migraineProbability)}${card('menstruation','Menstruation',p.menstruationProbability)}</div><p class="privacy-note">Probabilities update automatically from confirmed history. Stored only on this device.</p>`;
  }
  function visibleDates(){
    if(state.calendarMode==='week'){const s=startOfWeek(state.cursor);return Array.from({length:7},(_,i)=>addDays(s,i));}
    const first=monthStart(state.cursor),grid=startOfWeek(first),last=monthEnd(state.cursor),out=[];for(let d=grid;;d=addDays(d,1)){out.push(d);if(out.length%7===0&&d>=last)break;}return out;
  }
  function renderCalendar(t,fc){
    const dates=visibleDates(),title=state.calendarMode==='month'?formatMonth(state.cursor):formatLong(state.cursor);
    const values=dates.map(d=>fc.daily.get(d)||{migraineProbability:0,menstruationProbability:0});
    const migValues=values.map(x=>x.migraineProbability||0),perValues=values.map(x=>x.menstruationProbability||0);
    const mMin=Math.min(...migValues),mMax=Math.max(...migValues),pMin=Math.min(...perValues),pMax=Math.max(...perValues);
    const cells=dates.map(d=>{
      const p=fc.daily.get(d)||{migraineProbability:0,menstruationProbability:0},inMonth=d.slice(0,7)===state.cursor.slice(0,7),dayEvents=state.events.filter(e=>inEvent(d,e)),m=p.migraineProbability||0,s=p.menstruationProbability||0;
      const ma=heatAlpha(m,mMin,mMax),pa=heatAlpha(s,pMin,pMax);
      const bg=`linear-gradient(to bottom,rgba(88,65,190,${ma}) 0%,rgba(88,65,190,${ma}) 49%,rgba(255,255,255,.98) 49.2%,rgba(255,255,255,.98) 50.8%,rgba(213,57,105,${pa}) 51%,rgba(213,57,105,${pa}) 100%)`;
      const topContent=dayEvents.some(e=>e.type==='migraine')?confirmedLabel('migraine','● Migraine'):probabilityLabel('migraine',m,ma);
      const bottomContent=dayEvents.some(e=>e.type==='menstruation')?confirmedLabel('menstruation','● Period'):probabilityLabel('menstruation',s,pa);
      return `<button class="day-cell heat-cell ${!inMonth&&state.calendarMode==='month'?'dim':''} ${d===t?'today':''}" data-date="${d}" style="background:${bg}"><span class="day-num">${Number(d.slice(8))}</span><div class="day-zone top-zone">${topContent}</div><div class="day-zone bottom-zone">${bottomContent}</div></button>`;
    }).join('');
    return `<div class="page-intro"><h1>Calendar</h1><p>M = migraine active · P = menstruation active.</p></div><section class="calendar-card" id="calendar-card"><div class="calendar-toolbar"><div class="segmented"><button data-mode="week" class="${state.calendarMode==='week'?'active':''}">Week</button><button data-mode="month" class="${state.calendarMode==='month'?'active':''}">Month</button></div><strong>${title}</strong><div class="nav-buttons"><button data-nav="-1">‹</button><button data-nav="today">Today</button><button data-nav="1">›</button></div></div><div class="weekday-row">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid ${state.calendarMode}">${cells}</div><div class="legend heat-legend"><span><b class="m">Purple</b> migraine probability</span><span><b class="p">Rose</b> menstruation probability</span><span>Very pale = low relative interest; saturated = local peak in the displayed period.</span></div><p class="calendar-hint">Swipe or use the arrows to move through time. Confirmed observations override forecasts.</p></section>`;
  }
  function probabilityOutlookChart(fc,days){
    const start=todayISO(),data=Array.from({length:days},(_,i)=>{const d=addDays(start,i),p=fc.daily.get(d)||{migraineProbability:0,menstruationProbability:0};return{date:d,m:100*(p.migraineProbability||0),p:100*(p.menstruationProbability||0)};});
    const W=680,H=260,L=44,R=18,T=22,B=38,plotW=W-L-R,plotH=H-T-B,x=i=>L+(days===1?0:i/(days-1))*plotW,y=v=>T+(1-v/100)*plotH,mPts=data.map((d,i)=>`${x(i).toFixed(1)},${y(d.m).toFixed(1)}`).join(' '),pPts=data.map((d,i)=>`${x(i).toFixed(1)},${y(d.p).toFixed(1)}`).join(' '),yticks=[0,25,50,75,100],xEvery=days<=7?1:5,xticks=data.map((d,i)=>({d,i})).filter(({i})=>i===0||i===days-1||i%xEvery===0);
    return `<section class="trend-card outlook-card"><div class="trend-title-row"><div><h2>Probability outlook</h2><p class="muted">Probability of each event being active on each future date.</p></div><div class="segmented compact"><button data-trend-range="7" class="${days===7?'active':''}">7 days</button><button data-trend-range="30" class="${days===30?'active':''}">30 days</button></div></div><svg class="outlook-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Migraine and menstruation probability outlook">${yticks.map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" class="gridline"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" class="axis-label">${v}%</text>`).join('')}${xticks.map(({d,i})=>`<text x="${x(i)}" y="${H-10}" text-anchor="middle" class="axis-label">${formatShort(d.date)}</text>`).join('')}<polyline points="${mPts}" class="outlook-line migraine"/><polyline points="${pPts}" class="outlook-line menstruation"/>${data.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d.m)}" r="${days===7?3.5:2.2}" class="outlook-dot migraine"><title>${formatShort(d.date)} · M ${Math.round(d.m)}%</title></circle><circle cx="${x(i)}" cy="${y(d.p)}" r="${days===7?3.5:2.2}" class="outlook-dot menstruation"><title>${formatShort(d.date)} · P ${Math.round(d.p)}%</title></circle>`).join('')}<text x="${L}" y="14" class="axis-title">Daily probability</text></svg><div class="outlook-legend"><span class="migraine">● Migraine</span><span class="menstruation">● Menstruation</span></div></section>`;
  }

  function renderTrends(fc){
    const trendKey=`${state.dataRevision}|${todayISO()}|${state.trendHorizon}`;if(trendsHtmlCache&&trendsHtmlCache.key===trendKey)return trendsHtmlCache.html;
    const m=state.events.filter(e=>e.type==='migraine').sort((a,b)=>a.startDate.localeCompare(b.startDate)),p=state.events.filter(e=>e.type==='menstruation').sort((a,b)=>a.startDate.localeCompare(b.startDate));
    const html=`<div class="page-intro"><h1>Trends</h1><p>Future probability and repeating timing signals.</p></div>${state.events.length?`${probabilityOutlookChart(fc,state.trendHorizon)}<div class="fourier-grid">${fourierChart('Migraine Fourier spectrum',m.map(e=>e.startDate),fc.mig.spectral,'migraine')}${fourierChart('Menstruation Fourier spectrum',p.map(e=>e.startDate),fc.men.spectral,'menstruation')}</div><p class="privacy-note model-learning-short">The forecast is rebuilt after every confirmed event; component influence adapts as more history becomes available.</p>`:`<section class="empty-card">Log confirmed events to populate trends.</section>`}</div>`;
    trendsHtmlCache={key:trendKey,html};return html;
  }

  function renderSettings(){
    const installState=state.installed
      ? 'Cycler is installed on this device.'
      : isSamsungInternet
        ? 'Samsung Internet detected. On recent Android versions its generated WebAPK can be blocked by Play Protect. Open Cycler in Google Chrome and install it there instead.'
        : (state.installReady?'Android install prompt is ready.':'If Chrome does not offer installation yet, reload once and use Chrome menu ⋮ → Install app / Add to Home screen.');
    return `<div class="page-intro"><h1>Settings</h1><p>Data stays in this browser unless you export it yourself.</p></div><section class="settings-card install-card"><h2>Install on Android</h2><p>Install Cycler as a standalone app with its own home-screen icon. It will continue to work offline.</p><button class="primary" id="install-app-settings" ${state.installed?'disabled':''}>${state.installed?'Installed':(isSamsungInternet?'Open in Chrome to install':'Install Cycler')}</button><p class="muted">${installState}</p></section><section class="settings-card"><h2>Data</h2><button class="primary" id="export-json">Export JSON</button><button class="secondary" id="import-json">Import JSON</button><input class="file-input" id="import-file" type="file" accept="application/json"><button class="secondary" id="load-shared-history">Load initial shared history</button><button class="danger-btn" id="clear-data">Clear all data</button><p class="muted">Private health exports should not be committed to a public GitHub repository.</p></section><section class="settings-card"><h2>Probability labels</h2><p><strong>M</strong> means the modelled probability that migraine is active on that date. <strong>P</strong> means the modelled probability that menstruation is active on that date.</p><p class="muted">They combine forecasted start timing with observed event duration.</p></section><section class="settings-card"><h2>Learning</h2><p>Every confirmed event automatically recalculates the forecast model. Newer observations are weighted more strongly while older history remains part of the model.</p><p class="muted">The model checks whether rhythm signals improved earlier forecasts before giving them much influence.</p></section><section class="settings-card"><h2>Privacy & limits</h2><p>No telemetry, analytics, accounts or server storage. Forecasts are statistical estimates from confirmed events and are not medical advice.</p><p class="code-note">Deployment: direct static files from GitHub Pages main / root. No build step or GitHub Actions required.</p></section>`;
  }

  function bind(fc){
    const installTop=document.getElementById('install-app'); if(installTop)installTop.onclick=installApp;
    const installSettings=document.getElementById('install-app-settings'); if(installSettings)installSettings.onclick=installApp;
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.selectedDate=null;state.editingId=null;state.addType=null;render();});
    document.querySelectorAll('[data-log]').forEach(b=>b.onclick=()=>quickLog(b.dataset.log));
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.edit;state.selectedDate=null;openEditSheet();});
    document.querySelectorAll('[data-end]').forEach(b=>b.onclick=async()=>{const id=b.dataset.end,t=todayISO();await commitEvents(state.events.map(e=>e.id===id?{...e,endDate:t,updatedAt:Date.now()}:e),'Event ended');});
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.calendarMode=b.dataset.mode;render();});
    document.querySelectorAll('[data-trend-range]').forEach(b=>b.onclick=()=>{state.trendHorizon=Number(b.dataset.trendRange)||30;trendsHtmlCache=null;render();});
    document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
    document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{state.selectedDate=b.dataset.date;openDaySheet(state.selectedDate,fc);});
    const cal=document.getElementById('calendar-card'); if(cal){cal.ontouchstart=e=>state.touchX=e.touches[0].clientX;cal.ontouchend=e=>{if(state.touchX==null)return;const dx=e.changedTouches[0].clientX-state.touchX;if(Math.abs(dx)>50)navigate(dx<0?'1':'-1');state.touchX=null;};}
    const exp=document.getElementById('export-json'); if(exp)exp.onclick=exportJson;
    const imp=document.getElementById('import-json'),file=document.getElementById('import-file'); if(imp&&file){imp.onclick=()=>file.click();file.onchange=()=>importJson(file.files?.[0]);}
    const loadSeed=document.getElementById('load-shared-history'); if(loadSeed)loadSeed.onclick=async()=>{await commitEvents(mergeSeedHistory(state.events),'Initial history loaded');localStorage.setItem(SEED_DATA_VERSION,'done');};
    const clear=document.getElementById('clear-data'); if(clear)clear.onclick=async()=>{if(confirm('Delete all locally stored events?')){localStorage.setItem(SEED_DATA_VERSION,'done');await commitEvents([],'All data cleared');}};
  }
  function navigate(v){
    if(v==='today'){state.cursor=todayISO();render();return;}
    const dir=Number(v),d=parseISO(state.cursor); if(state.calendarMode==='month')d.setUTCMonth(d.getUTCMonth()+dir);else d.setUTCDate(d.getUTCDate()+7*dir);state.cursor=iso(d);render();
  }

  // ---------- Sheets ----------
  function openDaySheet(date,fc){
    const e=state.events.filter(x=>inEvent(date,x)),p=fc.daily.get(date)||{migraineProbability:0,menstruationProbability:0};
    const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<section class="sheet"><div class="sheet-head"><div><h2>${formatLong(date)}</h2><p class="muted">Confirmed observations override forecasts.</p></div><button class="icon-btn" id="close-day">×</button></div>${e.length?`<div class="confirmed-list">${e.map(x=>`<button class="confirmed-item ${x.type}" data-sheet-edit="${x.id}">● ${x.type==='migraine'?'Migraine':'Menstruation'} · edit</button>`).join('')}</div>`:''}<div class="add-row"><button class="secondary" data-add="migraine">+ Migraine</button><button class="secondary" data-add="menstruation">+ Menstruation</button></div><div class="prob-detail"><strong>Migraine active on this date</strong><span>${Math.round(p.migraineProbability*100)}%</span></div><ul class="reason-list">${reasons('migraine',date,fc).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="prob-detail"><strong>Menstruating on this date</strong><span>${Math.round(p.menstruationProbability*100)}%</span></div><ul class="reason-list">${reasons('menstruation',date,fc).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
    const closeDay=()=>{state.selectedDate=null;node.remove();};
    node.onclick=e2=>{if(e2.target===node)closeDay();};document.body.appendChild(node);
    node.querySelector('#close-day').onclick=closeDay;
    node.querySelectorAll('[data-sheet-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.sheetEdit;state.selectedDate=null;node.remove();openEditSheet();});
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

  function mergeSeedHistory(existing){
    const next=[...existing];
    for(const seed of INITIAL_EVENTS){
      const covered=next.some(e=>e.type===seed.type && !(e.endDate<seed.startDate||e.startDate>seed.endDate));
      if(!covered) next.push({...seed});
    }
    return normalizeEvents(next);
  }

  // ---------- Import/export ----------
  function normalizeImported(raw){ const rows=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.events)?raw.events:null); if(!rows)throw new Error('Invalid file: expected an events array.'); const now=Date.now(); return rows.map((e,i)=>{if(!e||!['migraine','menstruation'].includes(e.type))throw new Error(`Invalid event type at row ${i+1}.`);if(!/^\d{4}-\d{2}-\d{2}$/.test(e.startDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(e.endDate||''))throw new Error(`Invalid date at row ${i+1}.`);if(e.endDate<e.startDate)throw new Error(`End date precedes start date at row ${i+1}.`);return{id:e.id||uid(),type:e.type,startDate:e.startDate,endDate:e.endDate,confirmed:true,createdAt:Number(e.createdAt)||now,updatedAt:now,notes:typeof e.notes==='string'?e.notes:undefined};}); }
  function exportJson(){ const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),events:state.events},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cycle-forecast-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  async function importJson(file){ if(!file)return; try{const raw=JSON.parse(await file.text());await commitEvents(normalizeImported(raw),'Data imported');}catch(e){alert(e.message||String(e));} }
  function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),1800);}

  // ---------- Boot ----------
  async function boot(){
    try{
      state.events=normalizeEvents(await loadEvents());
      if(localStorage.getItem(SEED_DATA_VERSION)!=='done'){
        state.events=mergeSeedHistory(state.events);
        await saveAll(state.events);
        localStorage.setItem(SEED_DATA_VERSION,'done');
      }
    }catch(e){console.error(e);state.events=[];}
    invalidateDerivedCaches();
    render();
    if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error)); }
  }
  boot();
})();
