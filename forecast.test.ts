import { describe, expect, it } from 'vitest';
import type { HealthEvent } from './types';
import { durationDays, diffDays } from './dates';
import { normalizeEvents, logDate } from './eventOps';
import { normalizeImportedPayload } from './importExport';
import { buildForecast } from './forecastIndex';

const base = Date.UTC(2030,0,1);
const testEvents: HealthEvent[] = [
  ['migraine','2030-01-03','2030-01-04'],['migraine','2030-01-17','2030-01-19'],['migraine','2030-01-31','2030-02-01'],['migraine','2030-02-14','2030-02-16'],['migraine','2030-02-28','2030-03-01'],
  ['menstruation','2030-01-10','2030-01-13'],['menstruation','2030-02-07','2030-02-10'],['menstruation','2030-03-07','2030-03-10']
].map(([type,startDate,endDate],i)=>({id:`t${i}`,type:type as HealthEvent['type'],startDate,endDate,confirmed:true,createdAt:base+i,updatedAt:base+i}));

const anchor = '2030-03-12';

describe('core calculations', () => {
  it('calculates inclusive duration', () => expect(durationDays({ startDate:'2030-01-03', endDate:'2030-01-04' })).toBe(2));
  it('calculates intervals', () => expect(diffDays('2030-01-17','2030-01-03')).toBe(14));
  it('merges adjacent same-type events', () => {
    const e=testEvents[0]; const n={...e,id:'x',startDate:'2030-01-05',endDate:'2030-01-06'};
    const merged=normalizeEvents([e,n]); expect(merged).toHaveLength(1); expect(merged[0].endDate).toBe('2030-01-06');
  });
  it('extends an event when logging a continuation date', () => {
    const e={...testEvents[0],startDate:'2030-03-11',endDate:'2030-03-11'};
    expect(logDate([e],'migraine','2030-03-12')[0].endDate).toBe('2030-03-12');
  });
  it('builds next-event predictions', () => {
    const f=buildForecast(testEvents,anchor,120); expect(f.migraine.summary.nextLikelyStart).toBeTruthy(); expect(f.menstruation.summary.nextLikelyStart).toBeTruthy();
  });
  it('calculates both probability series', () => {
    const rows=[...buildForecast(testEvents,anchor,120).daily.values()]; expect(rows.some(r=>r.migraineProbability>0)).toBe(true); expect(rows.some(r=>r.menstruationProbability>0)).toBe(true);
  });
  it('keeps probabilities inside 0..1', () => {
    for(const r of buildForecast(testEvents,anchor,240).daily.values()){expect(r.migraineProbability).toBeGreaterThanOrEqual(0);expect(r.migraineProbability).toBeLessThanOrEqual(1);expect(r.menstruationProbability).toBeGreaterThanOrEqual(0);expect(r.menstruationProbability).toBeLessThanOrEqual(1)}
  });
  it('imports a private-style payload without embedding personal data in source', () => {
    const imported=normalizeImportedPayload({events:[{type:'migraine',startDate:'2031-01-01',endDate:'2031-01-02'}]}); expect(imported).toHaveLength(1); expect(imported[0].confirmed).toBe(true);
  });
  it('editing an event recalculates the forecast', () => {
    const before=buildForecast(testEvents,anchor,120).migraine.summary.nextLikelyStart;
    const edited=testEvents.map(e=>e.id==='t4'?{...e,startDate:'2030-03-03',endDate:'2030-03-04'}:e);
    expect(buildForecast(edited,anchor,120).migraine.summary.nextLikelyStart).not.toBe(before);
  });
  it('deleting an event changes the evidence set', () => {
    const before=buildForecast(testEvents,anchor,120).menstruation.recurrence.intervals.length;
    const after=buildForecast(testEvents.filter(e=>e.id!=='t7'),anchor,120).menstruation.recurrence.intervals.length;
    expect(after).toBe(before-1);
  });
});
