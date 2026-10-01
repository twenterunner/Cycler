# Cycle Forecast PWA — flat source layout

Local-first React + TypeScript PWA for logging confirmed migraine and menstruation events and generating transparent probabilistic forecasts.

## Flat-file layout

This package intentionally contains **no folders**. Every source, configuration, documentation, icon and PWA asset is at repository root.

Key files:

- `App.tsx` — application shell and state orchestration.
- `db.ts` — local IndexedDB persistence.
- `statistics.ts` — transparent statistical utilities.
- `recurrence.ts` — recency-weighted recurrence model.
- `menstruationForecast.ts` — menstruation forecast.
- `migraineForecast.ts` — migraine recurrence + menstruation-phase association.
- `durationForecast.ts` — duration estimates.
- `PREDICTION_MODEL.md` — formulas, assumptions and limitations.
- `deploy-pages.yml` — GitHub Pages workflow template.

## Privacy

All health data stays in browser IndexedDB. There is no account, telemetry, analytics, API or remote health-data storage. Do not commit the separately supplied private seed JSON.

## Run locally

```bash
npm install
npm run dev
```

## Test and build

```bash
npm test
npm run build
npm run preview
```

The build output is written to `dist/`. The custom Vite build hook copies the root-level PWA manifest, service worker and icons into the build output.

## GitHub Pages

The application source remains flat. GitHub requires one special folder for Actions workflows:

```text
.github/workflows/deploy-pages.yml
```

To publish correctly:

1. Push all files to the repository, including `.github/workflows/deploy-pages.yml`.
2. In GitHub open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Open **Actions** and confirm **Deploy PWA to GitHub Pages** completes successfully.

Do not publish the raw Vite source directly from the repository root. The workflow runs `npm install`, `npm test`, and `npm run build`, then deploys the generated `dist/` output.

## Private seed data

The personal dates are deliberately not embedded in the public source package. Import the separately supplied `.health.json` file through **Settings → Import JSON**. The events then remain local to that browser/device.

## Important limitation

This software is a personal tracking/forecasting tool, not a diagnostic medical device. It does not infer medical causes or replace professional medical assessment.
