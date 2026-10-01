import type { HealthEvent } from './types';
import { durationDays } from './dates';
import { median, percentile, recencyWeights, weightedMean } from './statistics';

export interface DurationForecast {
  expected: number;
  median: number;
  low: number;
  high: number;
  label: string;
  survival: (daysAfterStart: number) => number;
}

export function buildDurationForecast(events: HealthEvent[]): DurationForecast {
  const durations = events.map(durationDays).filter((d) => d > 0);
  if (!durations.length) {
    return { expected: 1, median: 1, low: 1, high: 1, label: 'insufficient data', survival: (lag) => lag === 0 ? 1 : 0 };
  }
  const weights = recencyWeights(durations.length, 0.88);
  const expected = weightedMean(durations, weights);
  const med = median(durations);
  const low = Math.max(1, Math.round(percentile(durations, 0.25)));
  const high = Math.max(low, Math.round(percentile(durations, 0.75)));
  const label = low === high ? `${low} day${low === 1 ? '' : 's'}` : `${low}–${high} days`;
  const survival = (daysAfterStart: number): number => {
    if (daysAfterStart < 0) return 0;
    // Laplace smoothing avoids false zero-certainty with a small dataset.
    const continuing = durations.filter((d) => d > daysAfterStart).length;
    return (continuing + 0.5) / (durations.length + 1);
  };
  return { expected, median: med, low, high, label, survival };
}
