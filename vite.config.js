import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = 'cache';

function loadJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
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
        // Serve cache/digest.json as /digest.json in dev
        server.middlewares.use('/digest.json', (req, res, next) => {
          const digestPath = join(CACHE_DIR, 'digest.json');
          if (existsSync(digestPath)) {
            const data = readFileSync(digestPath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end('{}');
          }
        });
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
