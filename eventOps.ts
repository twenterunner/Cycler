import type { EventType, HealthEvent, ISODate } from './types';
import { addDays } from './dates';

export function normalizeEvents(events: HealthEvent[]): HealthEvent[] {
  const result: HealthEvent[] = [];
  for (const type of ['migraine', 'menstruation'] as EventType[]) {
    const rows = events.filter((e) => e.type === type).sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (const event of rows) {
      const last = result.filter((e) => e.type === type).at(-1);
      if (last && event.startDate <= addDays(last.endDate, 1)) {
        last.endDate = last.endDate > event.endDate ? last.endDate : event.endDate;
        last.updatedAt = Math.max(last.updatedAt, event.updatedAt);
        if (event.notes) last.notes = [last.notes, event.notes].filter(Boolean).join(' · ');
      } else {
        result.push({ ...event });
      }
    }
  }
  return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function logDate(events: HealthEvent[], type: EventType, date: ISODate): HealthEvent[] {
  const existing = events.find((e) => e.type === type && date >= e.startDate && date <= e.endDate);
  if (existing) return events;

  const previous = events.find((e) => e.type === type && e.endDate === addDays(date, -1));
  const next = events.find((e) => e.type === type && e.startDate === addDays(date, 1));
  const now = Date.now();

  if (previous && next && previous.id !== next.id) {
    return normalizeEvents(events.map((e) => e.id === previous.id
      ? { ...e, endDate: next.endDate, updatedAt: now }
      : e).filter((e) => e.id !== next.id));
  }
  if (previous) return events.map((e) => e.id === previous.id ? { ...e, endDate: date, updatedAt: now } : e);
  if (next) return events.map((e) => e.id === next.id ? { ...e, startDate: date, updatedAt: now } : e);

  return [...events, {
    id: crypto.randomUUID(), type, startDate: date, endDate: date, confirmed: true,
    createdAt: now, updatedAt: now
  }];
}
