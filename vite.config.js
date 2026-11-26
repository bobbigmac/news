import { defineConfig } from 'vite';
import { splitClientDigest } from './scripts/digest-split.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath, URL } from 'node:url';

const CACHE_DIR = 'cache';

function loadJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./src/index.html', import.meta.url)),
        relationships: fileURLToPath(new URL('./src/relationships.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 8000,
    open: '/',
  },
  define: {
    // Inject digest data at build time for preview
  },
  plugins: [
    {
      name: 'inject-digest',
      transformIndexHtml(html) {
        // In dev, serve digest.json from cache; in build, it's copied separately
        return html;
      },
      configureServer(server) {
        // Serve split client digests in dev exactly as the build emits them:
        // prefer the built artifacts in dist, fall back to splitting the raw
        // cache digest with the same logic so dev matches prod behavior.
        const serveSplit = (kind) => (req, res) => {
          const builtPath = join('dist', kind === 'archive' ? 'digest-archive.json' : 'digest.json');
          if (existsSync(builtPath)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(readFileSync(builtPath, 'utf8'));
            return;
          }
          const cachePath = join(CACHE_DIR, 'digest.json');
          if (existsSync(cachePath)) {
            const full = JSON.parse(readFileSync(cachePath, 'utf8'));
            const split = splitClientDigest(full);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(kind === 'archive' ? split.archive : split.recent));
            return;
          }
          res.statusCode = 404;
          res.end('{}');
        };
        server.middlewares.use('/digest.json', serveSplit('recent'));
        server.middlewares.use('/digest-archive.json', serveSplit('archive'));
        // Also serve run-log.json
        server.middlewares.use('/run-log.json', (req, res, next) => {
          const runLogPath = join(CACHE_DIR, 'run-log.json');
          if (existsSync(runLogPath)) {
            const data = readFileSync(runLogPath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end('[]');
          }
        });
      },
    },
  ],
});
