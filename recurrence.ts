import type { ISODate } from './types';
import { addDays, diffDays } from './dates';
import { mad, median, normalPdf, normalize, recencyWeights, robustify, weightedMean, weightedMedian, weightedStd } from './statistics';

export interface RecurrenceModel {
  intervals: number[];
  center: number;
  sigma: number;
  firstStart: Map<ISODate, number>;
  allStarts: Map<ISODate, number>;
  intervalPmf: number[];
}

function convolve(a: number[], b: number[], maxIndex: number): number[] {
  const out = Array(maxIndex + 1).fill(0);
  for (let i = 0; i < a.length && i <= maxIndex; i++) {
    if (!a[i]) continue;
    for (let j = 1; j < b.length && i + j <= maxIndex; j++) {
      if (b[j]) out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

export function buildRecurrenceModel(
  starts: ISODate[],
  anchorDate: ISODate,
  horizon = 180,
  decay = 0.84
): RecurrenceModel {
  const sorted = [...starts].sort();
  const intervals = sorted.slice(1).map((d, i) => diffDays(d, sorted[i])).filter((x) => x > 0);
  if (!sorted.length || !intervals.length) {
    return { intervals, center: 0, sigma: 8, firstStart: new Map(), allStarts: new Map(), intervalPmf: [] };
  }

  const robust = robustify(intervals);
  const weights = recencyWeights(robust.length, decay);
  const wm = weightedMean(robust, weights);
  const wmed = weightedMedian(robust, weights);
  const center = 0.6 * wm + 0.4 * wmed;
  const robustSigma = Math.max(1.2, mad(robust));
  const empiricalSigma = Math.max(1.2, weightedStd(robust, weights, wm));
  const smallSampleInflation = Math.sqrt(1 + 4 / intervals.length);
  const sigma = Math.max(1.5, 0.5 * robustSigma + 0.5 * empiricalSigma) * smallSampleInflation;

  // Interval kernel: a recency-weighted empirical Gaussian mixture plus a robust central component.
  const maxInterval = Math.max(90, Math.ceil(center + 5 * sigma));
  const intervalRaw = Array(maxInterval + 1).fill(0);
  for (let d = 1; d <= maxInterval; d++) {
    let empirical = 0;
    for (let i = 0; i < robust.length; i++) {
      empirical += weights[i] * normalPdf(d, robust[i], Math.max(1.25, sigma * 0.45));
    }
    empirical /= weights.reduce((a, b) => a + b, 0);
    intervalRaw[d] = 0.55 * empirical + 0.45 * normalPdf(d, center, sigma);
  }
  const norm = normalize(intervalRaw.slice(1));
  const intervalPmf = [0, ...norm];

  const last = sorted[sorted.length - 1];
  const elapsedAtAnchor = Math.max(0, diffDays(anchorDate, last));
  const firstRaw: number[] = Array(horizon + 1).fill(0);
  for (let dayAhead = 0; dayAhead <= horizon; dayAhead++) {
    const interval = elapsedAtAnchor + dayAhead;
    if (interval <= 0 || interval >= intervalPmf.length) continue;
    firstRaw[dayAhead] = intervalPmf[interval];
  }
  const firstNorm = normalize(firstRaw);

  const all = [...firstNorm];
  let generation = [...firstNorm];
  for (let cycle = 2; cycle <= 10; cycle++) {
    generation = convolve(generation, intervalPmf, horizon);
    const mass = generation.reduce((a, b) => a + b, 0);
    if (mass < 0.001) break;
    for (let i = 0; i <= horizon; i++) all[i] += generation[i];
  }

  const firstStart = new Map<ISODate, number>();
  const allStarts = new Map<ISODate, number>();
  for (let i = 0; i <= horizon; i++) {
    if (firstNorm[i] > 0) firstStart.set(addDays(anchorDate, i), firstNorm[i]);
    if (all[i] > 0) allStarts.set(addDays(anchorDate, i), all[i]);
  }

  return { intervals, center, sigma, firstStart, allStarts, intervalPmf };
}

export function recurrenceDescription(model: RecurrenceModel): string {
  if (!model.intervals.length) return 'Not enough confirmed intervals yet';
  return `Typical interval ≈ ${Math.round(model.center)} days (median ${Math.round(median(model.intervals))} days)`;
}
