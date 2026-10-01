import type { MouseEvent } from 'react';
import type { DailyPrediction, HealthEvent, ISODate } from './types';
import { formatLong } from './dates';

export function DayDetails({ date, prediction, events, onEdit, onClose }: {
  date: ISODate;
  prediction?: DailyPrediction;
  events: HealthEvent[];
  onEdit: (event: HealthEvent) => void;
  onClose: () => void;
}) {
  const dayEvents = events.filter((e) => date >= e.startDate && date <= e.endDate);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="sheet" onMouseDown={(e: MouseEvent<HTMLElement>) => e.stopPropagation()}>
        <div className="sheet-head"><div><h2>{formatLong(date)}</h2><p className="muted">Confirmed observations override forecasts.</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
        {dayEvents.length > 0 && <div className="confirmed-list">
          {dayEvents.map((event) => <button key={event.id} className={`confirmed-item ${event.type}`} onClick={() => onEdit(event)}>● {event.type === 'migraine' ? 'Migraine' : 'Menstruation'} · edit</button>)}
        </div>}
        {prediction ? <>
          <div className="prob-detail migraine"><strong>Migraine</strong><span>{Math.round(prediction.migraineProbability * 100)}%</span></div>
          <ul className="reason-list">{prediction.migraineReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <div className="prob-detail menstruation"><strong>Menstruation</strong><span>{Math.round(prediction.menstruationProbability * 100)}%</span></div>
          <ul className="reason-list">{prediction.menstruationReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </> : <p className="muted">No forecast is generated for this past unconfirmed date.</p>}
      </section>
    </div>
  );
}
