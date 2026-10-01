import type { Confidence, ForecastSummary, HealthEvent, ISODate } from './types';
import { addDays, dateInEvent, diffDays, eachDay } from './dates';
import { buildDurationForecast } from './durationForecast';
import { buildRecurrenceModel, type RecurrenceModel } from './recurrence';
import type { MenstruationModel } from './menstruationForecast';
import { clamp, logistic, logit, normalize } from './statistics';

export interface MigraineModel {
  recurrence: RecurrenceModel;
  dailyStart: Map<ISODate, number>;
  dailyOccupancy: Map<ISODate, number>;
  phaseMultipliers: Map<number, number>;
  phaseWeights: Map<ISODate, number>;
  summary: ForecastSummary;
  baselineDailyRate: number;
  durationLabel: string;
}

function confidenceFrom(model: RecurrenceModel, menstrualCycles: number): Confidence {
  const n = model.intervals.length + 1;
  if (n >= 14 && menstrualCycles >= 10 && model.sigma / Math.max(1, model.center) < 0.20) return 'High';
  if (n >= 7 && model.sigma / Math.max(1, model.center) < 0.42) return 'Moderate';
  return 'Low';
}

function historicalBaseline(migraines: HealthEvent[], allEvents: HealthEvent[]): number {
  if (!migraines.length || !allEvents.length) return 0;
  const first = allEvents.map((e) => e.startDate).sort()[0];
  const last = allEvents.map((e) => e.endDate).sort().at(-1)!;
  const days = Math.max(1, diffDays(last, first) + 1);
  const migraineDays = new Set(migraines.flatMap((e) => eachDay(e.startDate, e.endDate))).size;
  // Beta(1,4) shrinkage prevents small samples from creating extreme baselines.
  return (migraineDays + 1) / (days + 5);
}

function buildPhaseMultipliers(migraines: HealthEvent[], menstruations: HealthEvent[], baseline: number): Map<number, number> {
  const result = new Map<number, number>();
  for (let rel = -7; rel <= 7; rel++) {
    let hits = 0;
    let trials = 0;
    for (const period of menstruations) {
      const date = addDays(period.startDate, rel);
      trials++;
      if (migraines.some((m) => dateInEvent(date, m))) hits++;
    }
    // Beta smoothing + shrink multiplier toward 1 because the sample is small.
    const smoothedRate = (hits + 1) / (trials + 2);
    const raw = smoothedRate / Math.max(0.02, baseline);
    const evidenceWeight = trials / (trials + 8);
    const shrunk = Math.exp(evidenceWeight * Math.log(clamp(raw, 0.4, 3.0)));
    result.set(rel, shrunk);
  }
  return result;
}

function phaseWeightForDate(date: ISODate, menstruation: MenstruationModel, multipliers: Map<number, number>): number {
  let logMultiplier = 0;
  let probabilityMass = 0;
  for (let rel = -7; rel <= 7; rel++) {
    const possibleStart = addDays(date, -rel);
    const pStart = Math.min(1, menstruation.dailyStart.get(possibleStart) ?? 0);
    if (!pStart) continue;
    probabilityMass += pStart;
    logMultiplier += pStart * Math.log(multipliers.get(rel) ?? 1);
  }
  if (probabilityMass > 1) logMultiplier /= probabilityMass;
  return Math.exp(logMultiplier);
}

function summaryFromFirst(
  first: Map<ISODate, number>,
  durationLabel: string,
  confidence: Confidence
): ForecastSummary {
  const entries = [...first.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return { type: 'migraine', nextLikelyStart: null, nextStartProbability: 0, windowStart: null, windowEnd: null, durationLabel, confidence };
  const likely = entries.reduce((best, x) => x[1] > best[1] ? x : best, entries[0]);
  let cdf = 0;
  let low: ISODate | null = null;
  let high: ISODate | null = null;
  for (const [date, p] of entries) {
    cdf += p;
    if (!low && cdf >= 0.1) low = date;
    if (!high && cdf >= 0.9) { high = date; break; }
  }
  return { type: 'migraine', nextLikelyStart: likely[0], nextStartProbability: likely[1], windowStart: low, windowEnd: high, durationLabel, confidence };
}

export function buildMigraineModel(
  events: HealthEvent[],
  menstruation: MenstruationModel,
  anchorDate: ISODate,
  horizon = 180
): MigraineModel {
  const migraines = events.filter((e) => e.type === 'migraine').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const periods = events.filter((e) => e.type === 'menstruation').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recurrence = buildRecurrenceModel(migraines.map((e) => e.startDate), anchorDate, horizon, 0.84);
  const duration = buildDurationForecast(migraines);
  const baselineDailyRate = historicalBaseline(migraines, events);
  if (migraines.length < 2) {
    const empty = new Map<ISODate, number>();
    const phaseMultipliers = buildPhaseMultipliers(migraines, periods, 0.01);
    return {
      recurrence,
      dailyStart: empty,
      dailyOccupancy: empty,
      phaseMultipliers,
      phaseWeights: empty,
      summary: { type: 'migraine', nextLikelyStart: null, nextStartProbability: 0, windowStart: null, windowEnd: null, durationLabel: duration.label, confidence: 'Low' },
      baselineDailyRate: 0,
      durationLabel: duration.label
    };
  }
  const phaseMultipliers = buildPhaseMultipliers(migraines, periods, baselineDailyRate);
  const phaseWeights = new Map<ISODate, number>();

  // Convert recurrence starts to occupancy probability using the empirical duration survival curve.
  const rhythmOccupancy = new Map<ISODate, number>();
  for (const [start, pStart] of recurrence.allStarts) {
    for (let lag = 0; lag <= 10; lag++) {
      const pContinue = duration.survival(lag);
      if (pContinue <= 0.01) continue;
      const date = addDays(start, lag);
      rhythmOccupancy.set(date, (rhythmOccupancy.get(date) ?? 0) + pStart * pContinue);
    }
  }

  const rhythmEvidence = recurrence.intervals.length / (recurrence.intervals.length + 5);
  const menstrualEvidence = periods.length / (periods.length + 10);
  const dailyOccupancy = new Map<ISODate, number>();

  for (let day = 0; day <= horizon; day++) {
    const date = addDays(anchorDate, day);
    const rhythmP = clamp(rhythmOccupancy.get(date) ?? baselineDailyRate, 0.005, 0.9);
    const multiplier = phaseWeightForDate(date, menstruation, phaseMultipliers);
    phaseWeights.set(date, multiplier);

    // Transparent combination on the log-odds scale. Both signals are shrunk toward baseline.
    const rhythmSignal = logit(rhythmP) - logit(baselineDailyRate);
    const combined = logistic(
      logit(baselineDailyRate) +
      rhythmEvidence * rhythmSignal +
      menstrualEvidence * Math.log(multiplier)
    );
    dailyOccupancy.set(date, clamp(combined, 0.005, 0.95));
  }

  // Adjust the *next-start* distribution by the observed menstrual association, then renormalize.
  const firstEntries = [...recurrence.firstStart.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const adjustedRaw = firstEntries.map(([date, p]) => p * Math.pow(phaseWeightForDate(date, menstruation, phaseMultipliers), menstrualEvidence));
  const adjusted = normalize(adjustedRaw);
  const dailyStart = new Map<ISODate, number>(firstEntries.map(([date], i) => [date, adjusted[i]]));

  const summary = summaryFromFirst(dailyStart, duration.label, confidenceFrom(recurrence, periods.length));

  for (const event of migraines) {
    for (let date = event.startDate; date <= event.endDate; date = addDays(date, 1)) dailyOccupancy.set(date, 1);
  }
  return { recurrence, dailyStart, dailyOccupancy, phaseMultipliers, phaseWeights, summary, baselineDailyRate, durationLabel: duration.label };
}

export function migraineReasons(model: MigraineModel, date: ISODate, events: HealthEvent[]): string[] {
  if (events.some((e) => e.type === 'migraine' && dateInEvent(date, e))) return ['Confirmed migraine event'];
  const reasons: string[] = [];
  const p = model.dailyOccupancy.get(date) ?? model.baselineDailyRate;
  const phase = model.phaseWeights.get(date) ?? 1;
  if (p > model.baselineDailyRate * 1.35) reasons.push('Higher than the observed baseline based on the migraine recurrence pattern');
  if (phase > 1.08) reasons.push('Historically, migraine has occurred more often near this predicted menstruation phase');
  if (phase < 0.92) reasons.push('Historically, migraine has occurred less often near this predicted menstruation phase');
  reasons.push(`Forecast is shrunk toward the observed baseline because the dataset is still small`);
  return reasons;
}
