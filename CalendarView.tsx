import { useMemo, useRef, useState, type TouchEvent } from 'react';
import type { DailyPrediction, HealthEvent, ISODate } from './types';
import { addDays, formatShort, monthEnd, monthStart, parseISODate, startOfWeek, todayISO } from './dates';

export function CalendarView({ events, daily, onSelectDate }: {
  events: HealthEvent[];
  daily: Map<ISODate, DailyPrediction>;
  onSelectDate: (date: ISODate) => void;
}) {
  const [mode, setMode] = useState<'month'|'week'>('month');
  const [cursor, setCursor] = useState<ISODate>(todayISO());
  const touch = useRef<number | null>(null);

  const visible = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = monthStart(cursor);
    const firstGrid = startOfWeek(first);
    const last = monthEnd(cursor);
    const dates: ISODate[] = [];
    for (let d = firstGrid; d <= addDays(last, 6); d = addDays(d, 1)) {
      dates.push(d);
      if (dates.length % 7 === 0 && d >= last) break;
    }
    return dates;
  }, [cursor, mode]);

  function navigate(dir: number) {
    const d = parseISODate(cursor);
    if (mode === 'month') d.setUTCMonth(d.getUTCMonth() + dir);
    else d.setUTCDate(d.getUTCDate() + dir * 7);
    setCursor(d.toISOString().slice(0, 10));
  }

  const title = new Intl.DateTimeFormat(undefined, mode === 'month' ? { month:'long', year:'numeric'} : { day:'numeric', month:'short', year:'numeric'}).format(parseISODate(cursor));
  return <section className="calendar-card" onTouchStart={(e: TouchEvent<HTMLElement>)=>touch.current=e.touches[0].clientX} onTouchEnd={(e: TouchEvent<HTMLElement>)=>{ if(touch.current===null)return; const dx=e.changedTouches[0].clientX-touch.current; if(Math.abs(dx)>50) navigate(dx<0?1:-1); touch.current=null; }}>
    <div className="calendar-toolbar">
      <div className="segmented"><button className={mode==='week'?'active':''} onClick={()=>setMode('week')}>Week</button><button className={mode==='month'?'active':''} onClick={()=>setMode('month')}>Month</button></div>
      <strong>{title}</strong>
      <div className="nav-buttons"><button onClick={()=>navigate(-1)}>‹</button><button onClick={()=>setCursor(todayISO())}>Today</button><button onClick={()=>navigate(1)}>›</button></div>
    </div>
    <div className="weekday-row">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d}>{d}</span>)}</div>
    <div className={`calendar-grid ${mode}`}>
      {visible.map(date => {
        const p = daily.get(date);
        const inMonth = date.slice(0,7)===cursor.slice(0,7);
        const isToday = date===todayISO();
        const dayEvents = events.filter(e=>date>=e.startDate&&date<=e.endDate);
        const m = p?.migraineProbability ?? 0;
        const s = p?.menstruationProbability ?? 0;
        const bg = `linear-gradient(135deg, rgba(114,87,213,${0.05+0.22*m}) 0 48%, rgba(220,91,131,${0.05+0.22*s}) 52% 100%)`;
        return <button key={date} className={`day-cell ${!inMonth&&mode==='month'?'dim':''} ${isToday?'today':''}`} style={{background:bg}} onClick={()=>onSelectDate(date)}>
          <span className="day-num">{Number(date.slice(8))}</span>
          <div className="event-marks">{dayEvents.some(e=>e.type==='migraine')&&<span className="mark migraine">● M</span>}{dayEvents.some(e=>e.type==='menstruation')&&<span className="mark menstruation">● P</span>}</div>
          {!dayEvents.some(e=>e.type==='migraine')&&p&&<span className="mini">M {Math.round(m*100)}%</span>}
          {!dayEvents.some(e=>e.type==='menstruation')&&p&&<span className="mini">P {Math.round(s*100)}%</span>}
        </button>;
      })}
    </div>
    <p className="calendar-hint">Swipe or use the arrows to move through time. Percentages are forecasts; ● marks confirmed events.</p>
  </section>;
}
