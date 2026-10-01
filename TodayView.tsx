import type { EventType, HealthEvent, ISODate } from './types';
import { addDays, dateInEvent, formatLong } from './dates';

export function TodayView({ today, events, onLog, onEnd, onEdit }: { today: ISODate; events: HealthEvent[]; onLog:(type:EventType)=>void; onEnd:(event:HealthEvent)=>void; onEdit:(e:HealthEvent)=>void }) {
  const card=(type:EventType,label:string)=>{
    const existing=events.find(e=>e.type===type&&dateInEvent(today,e));
    const yesterday=events.find(e=>e.type===type&&e.endDate===addDays(today,-1));
    return <section className={`quick-card ${type}`}><h3>{label}</h3>{existing?<><p>Logged today.</p><div className="quick-actions"><button className="secondary" onClick={()=>onEdit(existing)}>Edit</button><button className="secondary" onClick={()=>onEnd(existing)}>End today</button></div></>:<><p>{yesterday?'Continue yesterday’s event?':'No event logged today.'}</p><button className="primary" onClick={()=>onLog(type)}>{yesterday?`${label} continues today`:`Log ${label.toLowerCase()} today`}</button></>}</section>
  };
  return <div><div className="page-intro"><h1>Today</h1><p>{formatLong(today)}</p></div><div className="quick-grid">{card('migraine','Migraine')}{card('menstruation','Menstruation')}</div><p className="privacy-note">Stored only on this device. This app tracks observations and estimates probabilities; it does not diagnose or explain medical causes.</p></div>;
}
