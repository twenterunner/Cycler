import type { HealthEvent } from './types';
import { diffDays, durationDays, addDays, dateInEvent } from './dates';
import { mean, median } from './statistics';

export function TrendsView({events}:{events:HealthEvent[]}){
  const migraine=events.filter(e=>e.type==='migraine').sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const periods=events.filter(e=>e.type==='menstruation').sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const md=migraine.map(durationDays), pd=periods.map(durationDays);
  const mi=migraine.slice(1).map((e,i)=>diffDays(e.startDate,migraine[i].startDate));
  const pi=periods.slice(1).map((e,i)=>diffDays(e.startDate,periods[i].startDate));
  const overlap=migraine.filter(m=>periods.some(p=>m.startDate<=p.endDate&&m.endDate>=p.startDate)).length;
  const rel=Array.from({length:15},(_,i)=>i-7).map(r=>({r,rate:periods.length?periods.filter(p=>migraine.some(m=>dateInEvent(addDays(p.startDate,r),m))).length/periods.length:0}));
  return <div><div className="page-intro"><h1>Trends</h1><p>Descriptive statistics from confirmed events.</p></div><div className="stats-grid"><Stat t="Migraine events" v={`${migraine.length}`}/><Stat t="Migraine duration" v={`${mean(md).toFixed(1)} d avg · ${median(md).toFixed(1)} d median`}/><Stat t="Migraine interval" v={`${mean(mi).toFixed(1)} d avg`}/><Stat t="Menstruation cycles" v={`${periods.length}`}/><Stat t="Period duration" v={`${mean(pd).toFixed(1)} d avg`}/><Stat t="Cycle length" v={`${mean(pi).toFixed(1)} d avg`}/><Stat t="Overlapping migraine episodes" v={`${overlap}/${migraine.length}`}/></div><section className="trend-card"><h2>Migraine by day relative to menstruation start</h2><div className="rel-chart">{rel.map(x=><div className="rel-col" key={x.r}><div className="rel-bar" style={{height:`${Math.max(2,x.rate*120)}px`}} title={`${Math.round(x.rate*100)}%`}/><span>{x.r>0?`+${x.r}`:x.r}</span></div>)}</div><p className="muted">Observed relationship, not proof of causation.</p></section></div>;
}
function Stat({t,v}:{t:string;v:string}){return <section className="stat"><span>{t}</span><strong>{v}</strong></section>}
