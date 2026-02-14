import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = process.env.TARGET_BROWSER || 'chrome';

const apiBase = process.env.API_BASE || 'https://app.fitmycv.io';

// Simple plugin to copy static assets (icons + locales) to dist
function copyStaticAssets(outDir) {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const iconsSrc = resolve(__dirname, 'icons');
      const iconsDest = resolve(outDir, 'icons');
      if (existsSync(iconsSrc)) {
        mkdirSync(iconsDest, { recursive: true });
        cpSync(iconsSrc, iconsDest, { recursive: true, filter: (s) => !s.endsWith('README.md') });
      }

      const localesSrc = resolve(__dirname, 'locales');
      const localesDest = resolve(outDir, 'locales');
      if (existsSync(localesSrc)) {
        mkdirSync(localesDest, { recursive: true });
        cpSync(localesSrc, localesDest, { recursive: true });
      }
    },
  };
}

const outDir = resolve(__dirname, `dist/${browser}`);

export default defineConfig({
  root: __dirname,
  define: {
    __API_BASE__: JSON.stringify(apiBase),
  },
  build: {
    outDir,
    emptyOutDir: true,
  },
  plugins: [
    webExtension({
      manifest: resolve(__dirname, 'manifest.json'),
      additionalInputs: [
        'content-scripts/extractor.js',
        'content-scripts/auth-receiver.js',
      ],
      browser,
    }),
    copyStaticAssets(outDir),
  ],
});
