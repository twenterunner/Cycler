# Architecture

## 1. Application architecture

- React + TypeScript + Vite single-page PWA.
- Static deployment to GitHub Pages.
- Manual service worker caches the app shell and fetched static assets for offline use.
- IndexedDB is the only persistent event store.
- Forecasts are recomputed in memory from confirmed local observations after every mutation.
- No backend, account, API, telemetry, analytics, or cloud health-data storage.

## 2. Data model

```ts
interface HealthEvent {
  id: string;
  type: 'migraine' | 'menstruation';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  confirmed: true;
  createdAt: number;
  updatedAt: number;
  notes?: string;
}
```

Duration is derived inclusively. Predictions are never written as confirmed observations.

## 3. Prediction methodology

See `PREDICTION_MODEL.md` for exact formulas. In summary:

- Recurrence is modeled from confirmed start-to-start intervals.
- Recent intervals receive greater weight.
- Median/MAD provide robust protection against outliers.
- Small samples widen uncertainty and shrink signals toward observed baseline risk.
- Menstruation daily probability combines start-date uncertainty with observed duration.
- Migraine has an independent recurrence signal plus a separately measured temporal association around menstruation starts.
- The two migraine signals are combined on the log-odds scale with evidence-dependent weights to reduce double-counting.
- Duration is estimated separately from event-start probability.

## 4. Small-sample handling

- No forecast without enough recurrence evidence.
- Dispersion is inflated when interval count is small.
- Relative-day associations use Beta smoothing.
- Association multipliers are capped, then shrunk toward 1.
- Confidence cannot be High with the supplied amount of data.
- Future probabilities are capped below 100%; only confirmed event days display 100%.

## 5. UI/navigation

Bottom navigation:

- **Today** — one-tap logging/continuation and editing.
- **Calendar** — forecast cards plus swipeable week/month calendar with M/P probabilities.
- **Trends** — descriptive event/cycle statistics and relative-day association chart.
- **Settings** — local JSON import/export and local-data clearing.

Tap a date for probability details and plain-language reasons. Tap a confirmed event to edit or delete it.

## 6. Risks and assumptions

- Forecasts assume confirmed events through the current date have actually been logged.
- Missing events can bias interval and association estimates.
- Small datasets can create unstable patterns even with shrinkage.
- Temporal association is not medical causation.
- The implementation is not clinically validated and must not be used as a diagnostic device.
- A public GitHub repository must not embed the user's private health dates. They are supplied as a separate local import artifact.
