import type { Confidence, ForecastSummary, HealthEvent, ISODate } from './types';
import { addDays, dateInEvent } from './dates';
import { buildDurationForecast } from './durationForecast';
import { buildRecurrenceModel, type RecurrenceModel } from './recurrence';
import { clamp } from './statistics';

export interface MenstruationModel {
  recurrence: RecurrenceModel;
  dailyStart: Map<ISODate, number>;
  dailyOccupancy: Map<ISODate, number>;
  summary: ForecastSummary;
  durationLabel: string;
}

function confidenceFrom(model: RecurrenceModel): Confidence {
  const n = model.intervals.length + 1;
  if (n >= 10 && model.sigma / Math.max(1, model.center) < 0.16) return 'High';
  if (n >= 5 && model.sigma / Math.max(1, model.center) < 0.38) return 'Moderate';
  return 'Low';
}

function summaryFromFirstStart(
  first: Map<ISODate, number>,
  durationLabel: string,
  confidence: Confidence
): ForecastSummary {
  const entries = [...first.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) {
    return { type: 'menstruation', nextLikelyStart: null, nextStartProbability: 0, windowStart: null, windowEnd: null, durationLabel, confidence };
  }
  const likely = entries.reduce((best, x) => x[1] > best[1] ? x : best, entries[0]);
  let cdf = 0;
  let low: ISODate | null = null;
  let high: ISODate | null = null;
  for (const [date, p] of entries) {
    cdf += p;
    if (!low && cdf >= 0.1) low = date;
    if (!high && cdf >= 0.9) { high = date; break; }
  }
  return {
    type: 'menstruation',
    nextLikelyStart: likely[0],
    nextStartProbability: likely[1],
    windowStart: low,
    windowEnd: high,
    durationLabel,
    confidence
  };
}

export function buildMenstruationModel(events: HealthEvent[], anchorDate: ISODate, horizon = 180): MenstruationModel {
  const periods = events.filter((e) => e.type === 'menstruation').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recurrence = buildRecurrenceModel(periods.map((e) => e.startDate), anchorDate, horizon, 0.86);
  const duration = buildDurationForecast(periods);
  const dailyStart = recurrence.allStarts;
  const dailyOccupancy = new Map<ISODate, number>();

  for (const [start, pStart] of dailyStart) {
    for (let lag = 0; lag <= 10; lag++) {
      const pContinue = duration.survival(lag);
      if (pContinue <= 0.01) continue;
      const date = addDays(start, lag);
      dailyOccupancy.set(date, (dailyOccupancy.get(date) ?? 0) + pStart * pContinue);
    }
  }

  for (const [date, p] of dailyOccupancy) dailyOccupancy.set(date, clamp(p, 0, 0.95));

  // Confirmed observations always override probabilistic forecasts.
  for (const event of periods) {
    for (let date = event.startDate; date <= event.endDate; date = addDays(date, 1)) dailyOccupancy.set(date, 1);
    dailyStart.set(event.startDate, 1);
  }

  const summary = summaryFromFirstStart(recurrence.firstStart, duration.label, confidenceFrom(recurrence));
  return { recurrence, dailyStart, dailyOccupancy, summary, durationLabel: duration.label };
}

export function menstruationReasons(model: MenstruationModel, date: ISODate, events: HealthEvent[]): string[] {
  const confirmed = events.some((e) => e.type === 'menstruation' && dateInEvent(date, e));
  if (confirmed) return ['Confirmed menstruation event'];
  const reasons: string[] = [];
  const pStart = model.dailyStart.get(date) ?? 0;
  if (pStart > 0.05) reasons.push(`Near the most likely cycle start based on confirmed cycle intervals`);
  if (model.recurrence.intervals.length) reasons.push(`Uses ${model.recurrence.intervals.length} confirmed cycle intervals with recent cycles weighted more`);
  if (!reasons.length) reasons.push('Low probability under the current cycle interval distribution');
  return reasons;
}
