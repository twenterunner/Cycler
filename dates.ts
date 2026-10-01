import type { ISODate, HealthEvent } from './types';

const DAY_MS = 86_400_000;

export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): ISODate {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / DAY_MS);
}

export function durationDays(event: Pick<HealthEvent, 'startDate' | 'endDate'>): number {
  return diffDays(event.endDate, event.startDate) + 1;
}

export function dateInEvent(date: ISODate, event: Pick<HealthEvent, 'startDate' | 'endDate'>): boolean {
  return date >= event.startDate && date <= event.endDate;
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthStart(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function monthEnd(date: ISODate): ISODate {
  const d = parseISODate(monthStart(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toISODate(d);
}

export function startOfWeek(date: ISODate): ISODate {
  const d = parseISODate(date);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(date, mondayOffset);
}

export function formatShort(date: ISODate): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(parseISODate(date));
}

export function formatLong(date: ISODate): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseISODate(date));
}
