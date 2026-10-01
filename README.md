# Cycler — direct GitHub Pages deployment

This build is intentionally plain static HTML/CSS/JavaScript. There is no npm, Vite, React build step, or GitHub Actions requirement.

## Deploy

1. Upload the files from this package directly to the repository root on `main`.
2. GitHub → Settings → Pages.
3. Source: **Deploy from a branch**.
4. Branch: **main**.
5. Folder: **/(root)**.
6. Save.

The live site should then be available at the repository's GitHub Pages URL.

Health data is stored only in IndexedDB in the browser. Do not commit private health-data exports to a public repository.
