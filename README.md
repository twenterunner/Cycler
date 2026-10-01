# Cycler — direct GitHub Pages deployment

This build is plain static HTML/CSS/JavaScript. No npm, Vite, React build step, or GitHub Actions are required.

## Deploy

1. Upload/overwrite all files from this package directly in the repository root on `main`.
2. GitHub → Settings → Pages.
3. Source: **Deploy from a branch**.
4. Branch: **main**.
5. Folder: **/(root)**.
6. Save.

## Forecast model v3

The near-term forecast now uses an ensemble rather than a flat long-horizon recurrence score:

- robust, recency-weighted inter-event interval distribution;
- probability conditioned on the time elapsed since the last confirmed event;
- Fourier-derived dominant rhythm as a secondary phase signal;
- observed migraine timing relative to menstruation as a shrunk secondary signal;
- duration distribution converted into the probability of actually having the event on each day;
- recurring forecasts are propagated with increasing uncertainty.

With the supplied history, the model detects an approximately 14-day migraine rhythm and a weaker approximately 22-day menstruation rhythm. These are statistical patterns, not medical conclusions.

## Initial history

The dates supplied for the initial 2026 history are now bundled into `app.js`. On the first v3 run, the supplied history is merged automatically with existing local data (overlapping events are not duplicated). Settings also contains **Load initial shared history** if you ever want to restore missing seed history manually.

**Privacy warning:** because this repository is public, bundling these dates means the event dates are visible to anyone who can view the repository/source. New events entered in the app still remain only in IndexedDB on the device and are not uploaded.

## Cache upgrade

Overwrite `sw.js` as well. Version 3 uses a new cache name so the updated forecast/UI is picked up rather than an older cached build.

## v4 changes

- Stronger split heatmap: purple = migraine probability, rose = menstruation probability.
- Non-linear colour intensity makes forecast peaks visible even when absolute probabilities are moderate.
- M/P daily probabilities are explicitly defined in the UI.
- Added Android PWA install button using the browser install prompt, with Chrome fallback instructions.
- Manifest/install metadata strengthened; service worker cache bumped to v4.


## v5
- M% is rendered directly inside the purple probability block.
- P% is rendered directly inside the rose probability block.
- Trends now contains live Fourier spectra for migraine and menstruation start dates.
- Forecasts recalculate automatically after every confirmed add/edit/delete; newer intervals are weighted more strongly.
