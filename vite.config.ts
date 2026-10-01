import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const flatPwaAssets = (): Plugin => ({
  name: 'flat-pwa-assets',
  closeBundle() {
    const root = process.cwd();
    const dist = resolve(root, 'dist');
    mkdirSync(dist, { recursive: true });
    for (const file of ['manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png']) {
      copyFileSync(resolve(root, file), resolve(dist, file));
    }
  }
});

export default defineConfig({
  plugins: [react(), flatPwaAssets()],
  base: './'
});
