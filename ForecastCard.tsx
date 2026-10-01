import type { ForecastSummary } from './types';
import { formatShort } from './dates';

export function ForecastCard({ forecast }: { forecast: ForecastSummary }) {
  const label = forecast.type === 'migraine' ? 'Migraine' : 'Menstruation';
  return (
    <section className={`forecast-card ${forecast.type}`}>
      <div className="forecast-title-row">
        <span className="event-dot" />
        <strong>{label}</strong>
        <span className={`confidence ${forecast.confidence.toLowerCase()}`}>{forecast.confidence} confidence</span>
      </div>
      <div className="forecast-main">{forecast.nextLikelyStart ? formatShort(forecast.nextLikelyStart) : 'Not enough data'}</div>
      <div className="forecast-prob">Most likely start date · {Math.round(forecast.nextStartProbability * 100)}%</div>
      <div className="forecast-meta">
        <span>Window: {forecast.windowStart && forecast.windowEnd ? `${formatShort(forecast.windowStart)}–${formatShort(forecast.windowEnd)}` : '—'}</span>
        <span>Duration: {forecast.durationLabel}</span>
      </div>
    </section>
  );
}
