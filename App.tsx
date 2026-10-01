import { useEffect, useMemo, useState } from 'react';
import type { EventType, HealthEvent, ISODate } from './types';
import { getEvents, putEvent, deleteEvent, replaceAllEvents, clearAllEvents } from './db';
import { buildForecast } from './forecastIndex';
import { todayISO } from './dates';
import { logDate, normalizeEvents } from './eventOps';
import { TodayView } from './TodayView';
import { CalendarView } from './CalendarView';
import { TrendsView } from './TrendsView';
import { SettingsView } from './SettingsView';
import { ForecastCard } from './ForecastCard';
import { EventEditor } from './EventEditor';
import { DayDetails } from './DayDetails';

export default function App(){
  const [events,setEvents]=useState<HealthEvent[]>([]);
  const [tab,setTab]=useState<'today'|'calendar'|'trends'|'settings'>('today');
  const [editing,setEditing]=useState<HealthEvent|null>(null);
  const [selectedDate,setSelectedDate]=useState<ISODate|null>(null);
  const today=todayISO();
  useEffect(()=>{getEvents().then(setEvents)},[]);
  const forecast=useMemo(()=>buildForecast(events,today,730),[events,today]);

  async function persistAll(next:HealthEvent[]){ const normalized=normalizeEvents(next); await replaceAllEvents(normalized); setEvents(normalized); }
  async function quickLog(type:EventType){ await persistAll(logDate(events,type,today)); }
  async function endToday(event:HealthEvent){ await saveEvent({ ...event, endDate: today, updatedAt: Date.now() }); }
  async function saveEvent(event:HealthEvent){ await putEvent(event); await persistAll(events.map(e=>e.id===event.id?event:e)); setEditing(null); }
  async function removeEvent(id:string){ await deleteEvent(id); await persistAll(events.filter(e=>e.id!==id)); setEditing(null); }
  async function doReset(){await clearAllEvents();setEvents([])}

  return <div className="app-shell">
    <header className="topbar"><div><strong>Cycle Forecast</strong><span>Private · local-first</span></div><span className="offline-badge">Offline ready</span></header>
    <main>
      {tab==='today'&&<TodayView today={today} events={events} onLog={quickLog} onEnd={endToday} onEdit={setEditing}/>} 
      {tab==='calendar'&&<><div className="page-intro"><h1>Calendar</h1><p>Confirmed events and probability forecasts.</p></div><div className="forecast-grid"><ForecastCard forecast={forecast.migraine.summary}/><ForecastCard forecast={forecast.menstruation.summary}/></div><CalendarView events={events} daily={forecast.daily} onSelectDate={setSelectedDate}/></>}
      {tab==='trends'&&<TrendsView events={events}/>} 
      {tab==='settings'&&<SettingsView events={events} onImport={persistAll} onReset={doReset}/>} 
    </main>
    <nav className="bottom-nav">{(['today','calendar','trends','settings'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}><span>{t==='today'?'●':t==='calendar'?'▦':t==='trends'?'⌁':'⚙'}</span>{t[0].toUpperCase()+t.slice(1)}</button>)}</nav>
    {editing&&<EventEditor event={editing} onSave={saveEvent} onDelete={removeEvent} onClose={()=>setEditing(null)}/>} 
    {selectedDate&&<DayDetails date={selectedDate} prediction={forecast.daily.get(selectedDate)} events={events} onEdit={(e)=>{setSelectedDate(null);setEditing(e)}} onClose={()=>setSelectedDate(null)}/>} 
  </div>
}
