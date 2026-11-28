// Repeatable favicon sprite pipeline.
//
// Usage:
//   node scripts/build-favicon-sprite.js            reuse good tiles, fetch missing/broken
//   node scripts/build-favicon-sprite.js --no-fetch build sheet from existing tiles only
//   node scripts/build-favicon-sprite.js --force host1,host2   refetch specific hosts
//
// Outputs:
//   src/favicons/<host>.png        per-host 32px tiles (source material)
//   src/favicons/sprite.png        the shipped sheet (16 tiles per row)
//   src/styles/favicon-sprite.css  class offsets
//   src/favicon-sprite.js          FAVICON_SPRITE_HOSTS registry
//
// Quality rules:
//   - reject tiles with <10% visible coverage (empty/broken fetches)
//   - light-on-transparent glyphs (mean luminance >185) get a dark rounded chip
//     baked behind them so they read on the paper background
//   - everything else floats as a plain icon

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { SOURCE_RELATION_TREE } from '../src/source-tree.js';

const TILE = 32;
const COLUMNS = 16;
const TILES_DIR = 'src/favicons';
const CONCEPTS_DIR = 'src/favicons/concepts';
const OUT_SHEET = 'src/favicons/sprite.png';
const OUT_CSS = 'src/styles/favicon-sprite.css';
const OUT_REGISTRY = 'src/favicon-sprite.js';
const FETCH_TIMEOUT_MS = 12000;
const args = process.argv.slice(2);
const NO_FETCH = args.includes('--no-fetch');
const forceIdx = args.indexOf('--force');
const FORCE = forceIdx >= 0 ? new Set(args[forceIdx + 1].split(',').map(s => s.trim()).filter(Boolean)) : new Set();
const RENORMALIZE = args.includes('--renormalize'); // resample every cached tile through the current normalizer, no network

mkdirSync(TILES_DIR, { recursive: true });
mkdirSync(CONCEPTS_DIR, { recursive: true });
mkdirSync('src/favicons', { recursive: true });

// --- collect needed hosts -------------------------------------------------

function collectTreeHosts(nodes, out = new Set()) {
  for (const node of nodes) {
    for (const host of node.sources || []) out.add(host);
    if (node.icon && !node.icon.startsWith('concept:')) out.add(node.icon);
    collectTreeHosts(node.children || [], out);
  }
  return out;
}

const treeHosts = collectTreeHosts(SOURCE_RELATION_TREE);
const cachedHosts = existsSync('cache/favicons')
  ? readdirSync('cache/favicons').map(f => f.replace(/\.[^.]+$/, ''))
  : [];
const digestHosts = new Set();
try {
  const digest = JSON.parse(readFileSync('cache/digest.json', 'utf8'));
  const counts = new Map();
  for (const cluster of digest.clusters || []) {
    for (const story of cluster.stories || []) {
      try {
        const host = new URL(story.url || '').hostname.replace(/^www\./, '');
        if (host) counts.set(host, (counts.get(host) || 0) + 1);
      } catch { /* skip */ }
    }
  }
  for (const [host, count] of counts) if (count >= 1) digestHosts.add(host);
} catch { /* digest optional */ }

const neededHosts = new Set([...treeHosts, ...cachedHosts, ...digestHosts]);

// --- concept icons ---------------------------------------------------------

function collectConceptIcons(nodes, out = new Map()) {
  for (const node of nodes) {
    if (node.icon?.startsWith('concept:')) out.set(node.icon.slice('concept:'.length), true);
    collectConceptIcons(node.children || [], out);
  }
  return out;
}
const conceptIcons = [...new Set([
  'other', // Other Sources bucket is synthesized in source-groups.js, not the tree
  ...collectConceptIcons(SOURCE_RELATION_TREE).keys(),
])];

async function rasterizeConcepts() {
  const made = new Map();
  for (const name of conceptIcons) {
    const svgPath = join(CONCEPTS_DIR, `${name}.svg`);
    if (!existsSync(svgPath)) {
      console.warn(`  concept icon missing svg: ${name} (drop ${name}.svg into ${CONCEPTS_DIR})`);
      continue;
    }
    const png = await sharp(readFileSync(svgPath), { density: 96 })
      .resize(TILE, TILE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    writeFileSync(join(TILES_DIR, `concept-${name}.png`), png);
    made.set(`concept-${name}`, png);
  }
  return made;
}

// --- fetching ---------------------------------------------------------------

function extractPngsFromIco(buf) {
  // ICO: reserved(2) type(2) count(2), then count x 16-byte entries.
  // Entry: width(1) height(1) colors(1) reserved(1) planes(2) bpp(2) size(4) offset(4).
  // Images are either embedded PNGs (start 89 50 4E 47) or raw BMP/DIB.
  if (buf.length < 6) return [];
  const count = buf.readUInt16LE(4);
  const pngs = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + i * 16;
    if (entryOffset + 16 > buf.length) break;
    const width = buf[entryOffset] || 256;
    const size = buf.readUInt32LE(entryOffset + 8);
    const offset = buf.readUInt32LE(entryOffset + 12);
    if (offset + 8 > buf.length || offset + size > buf.length) continue;
    const image = buf.subarray(offset, offset + size);
    const isPng = image.length > 8 && image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47;
    if (isPng) pngs.push({ width, png: image });
  }
  return pngs.sort((a, b) => b.width - a.width);
}

async function fetchBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) favicon-fetch' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(host, path = '/') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${host}${path}`, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', accept: 'text/html' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Parses icon declarations out of homepage HTML — most modern sites never serve
// /favicon.ico or a root apple-touch-icon, they declare them in <link> tags.
// Returns candidate URLs ordered by preference: large PNGs, SVG, any icon.
function iconUrlsFromHtml(html, host) {
  if (!html) return [];
  const urls = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    if (!/rel=["'][^"']*icon/i.test(tag)) continue;
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href || href.startsWith('data:')) continue;
    let url;
    try {
      url = new URL(href, `https://${host}/`).href;
    } catch { continue; }
    const sizes = (tag.match(/sizes=["']([^"']+)["']/i) || [])[1] || '';
    const size = parseInt(sizes.split('x')[0], 10) || 0;
    urls.push({ url, size, svg: /svg/i.test(tag) || url.includes('.svg') });
  }
  urls.sort((a, b) => (b.svg - a.svg) || (b.size - a.size));
  return urls.map(u => u.url);
}

// Tenant keys (dev.to/user, medium.com/@user, timeout.com/london) are authors or
// editions, not sites — the right icon is the author's avatar or edition image,
// not the platform favicon. Profile-image upload URLs are the strongest signal;
// og:image is the fallback.
function avatarUrlsFromHtml(html) {
  if (!html) return [];
  const urls = [];
  for (const m of html.matchAll(/https?:\/\/[^"'\s]+\/(?:profile_image|uploads\/user)\/[^"'\s]+/gi)) urls.push(m[0]);
  const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og) urls.push(og[1]);
  return urls;
}

async function fetchFaviconPng(host) {
  // tenant keys: author avatar or edition image from the page HTML
  if (host.includes('/')) {
    const pageHtml = await fetchHtml(host);
    for (const url of avatarUrlsFromHtml(pageHtml)) {
      const buf = await fetchBuffer(url);
      if (!buf) continue;
      try {
        const meta = await sharp(buf).metadata();
        if ((meta.width || 0) >= 32) return buf;
      } catch { /* try next */ }
    }
    return null;
  }
  // 0. icons declared in the homepage HTML — where most modern sites put them
  const html = await fetchHtml(host);
  for (const url of iconUrlsFromHtml(html, host)) {
    const buf = await fetchBuffer(url);
    if (!buf) continue;
    try {
      const meta = await sharp(buf).metadata();
      if ((meta.width || 0) >= 32) return buf;
    } catch { /* not a readable image — try next candidate */ }
  }
  // 1. apple-touch-icon (usually high-res colour PNG)
  for (const name of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
    const buf = await fetchBuffer(`https://${host}/${name}`);
    if (buf) {
      try {
        const meta = await sharp(buf).metadata();
        if ((meta.width || 0) >= 48) return buf;
      } catch { /* not an image */ }
    }
  }
  // 2. /favicon.ico — decode embedded PNG entries
  const ico = await fetchBuffer(`https://${host}/favicon.ico`);
  if (ico) {
    const isPng = ico.length > 8 && ico[0] === 0x89 && ico[1] === 0x50;
    if (isPng) return ico;
    const entries = extractPngsFromIco(ico);
    if (entries.length) return entries[0].png;
  }
  // 3. gstatic favicon service
  const staticUrl = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${host}&size=64`;
  const gstatic = await fetchBuffer(staticUrl);
  if (gstatic) return gstatic;
  // 4. Wayback Machine — some newsrooms bot-block every direct fetch (AFP 403s
  // even browsers-shaped agents); the archived asset is the same file.
  for (const path of ['favicon.ico', 'apple-touch-icon.png']) {
    const archived = await fetchBuffer(`https://web.archive.org/web/2024id_/https://www.${host}/${path}`);
    if (!archived) continue;
    const isPng = archived.length > 8 && archived[0] === 0x89 && archived[1] === 0x50;
    if (isPng) return archived;
    const entries = extractPngsFromIco(archived);
    if (entries.length) return entries[0].png;
  }
  return null;
}

// --- tile analysis & normalization -----------------------------------------

async function analyzeTile(pngBuffer) {
  const { data } = await sharp(pngBuffer)
    .resize(TILE, TILE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0, sum2 = 0, visible = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) continue;
    visible++;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    sum2 += lum * lum;
  }
  const mean = visible ? sum / visible : 0;
  const variance = visible ? sum2 / visible - mean * mean : 0;
  return { coverage: visible / total, mean, std: Math.sqrt(variance) };
}

// Every cell in the sheet is exactly TILE x TILE with the glyph normalised
// inside a consistent inner box: transparent margins are trimmed first so a
// wide-but-short logo fills the same visual footprint as a square one, then
// the glyph is resampled into a square canvas — never cropped. Downscales use
// lanczos3 (clean area-averaging, the same approach favicon generators like
// favicon.io use); tiny sources upscale with nearest so pixel-art favicons
// keep hard edges instead of turning to mush.
const INNER = TILE - 4;

async function resampleSquare(pngBuffer, size) {
  let trimmed = pngBuffer;
  try {
    trimmed = await sharp(pngBuffer).trim({ threshold: 16 }).png().toBuffer();
  } catch { /* fully transparent or nothing to trim — keep original */ }
  const meta = await sharp(trimmed).metadata();
  const largest = Math.max(meta.width || 0, meta.height || 0);
  const kernel = largest <= size ? 'nearest' : 'lanczos3';
  return sharp(trimmed)
    .resize(size, size, { fit: 'contain', kernel, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.floor((TILE - size) / 2),
      bottom: Math.ceil((TILE - size) / 2),
      left: Math.floor((TILE - size) / 2),
      right: Math.ceil((TILE - size) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function normalizeTile(pngBuffer) {
  const base = await resampleSquare(pngBuffer, INNER);
  const stats = await analyzeTile(base);
  if (stats.coverage < 0.1) return { png: null, stats, reason: 'empty' };
  if (stats.mean > 185 && stats.std < 40) {
    // light glyph on transparency — bake a dark rounded chip behind it
    const chip = await sharp({
      create: {
        width: TILE, height: TILE, channels: 4,
        background: { r: 32, g: 33, b: 36, alpha: 1 },
      },
    }).png().toBuffer();
    const inset = await sharp(base)
      .resize(TILE - 8, TILE - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const roundedMask = Buffer.from(
      `<svg width="${TILE}" height="${TILE}"><rect x="0" y="0" width="${TILE}" height="${TILE}" rx="6" fill="#fff"/></svg>`
    );
    const chippedChip = await sharp(chip)
      .composite([{ input: roundedMask, blend: 'dest-in' }, { input: inset, blend: 'over' }])
      .png().toBuffer();
    return { png: chippedChip, stats, reason: 'light-glyph-chipped' };
  }
  return { png: base, stats, reason: 'ok' };
}

// --- main -------------------------------------------------------------------

const registryNotes = [];

async function tileForHost(host) {
  const key = `host:${host}`;
  const tilePath = join(TILES_DIR, `${host.replaceAll('/', '__')}.png`);
  if (existsSync(tilePath) && !FORCE.has(host)) {
    const existing = readFileSync(tilePath);
    const meta = await sharp(existing).metadata();
    const stats = await analyzeTile(existing);
    if (stats.coverage < 0.1) {
      registryNotes.push(`${host}: existing tile empty — refetching`);
    } else if (meta.width !== TILE || meta.height !== TILE) {
      // legacy tile written before uniform-cell normalization: it is still
      // valid source material, so resample it rather than hitting the network
      const renormalized = await normalizeTile(existing);
      if (renormalized.png) {
        writeFileSync(tilePath, renormalized.png);
        return { key, png: renormalized.png, source: `renormalized (${renormalized.reason})` };
      }
      registryNotes.push(`${host}: renormalize produced empty tile — refetching`);
    } else if (RENORMALIZE) {
      const renormalized = await normalizeTile(existing);
      if (renormalized.png) {
        writeFileSync(tilePath, renormalized.png);
        return { key, png: renormalized.png, source: `renormalized (${renormalized.reason})` };
      }
      return { key, png: existing, source: 'cache' };
    } else {
      return { key, png: existing, source: 'cache' };
    }
  }
  if (NO_FETCH) return { key, png: null, source: 'missing' };
  const fetched = await fetchFaviconPng(host);
  if (!fetched) return { key, png: null, source: 'unfetchable' };
  const normalized = await normalizeTile(fetched);
  if (!normalized.png) return { key, png: null, source: 'empty' };
  writeFileSync(tilePath, normalized.png);
  return { key, png: normalized.png, source: `fetched (${normalized.reason})` };
}

console.log(`needed hosts: ${neededHosts.size}, concept icons: ${conceptIcons.length}`);
const concepts = await rasterizeConcepts();

const tiles = new Map();
let fetched = 0, cached = 0, failed = 0;
const hostList = [...neededHosts].sort();
const CONCURRENCY = 8;
for (let i = 0; i < hostList.length; i += CONCURRENCY) {
  const batch = hostList.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(async host => {
    try {
      return { host, tile: await tileForHost(host) };
    } catch (err) {
      return { host, tile: null, error: err.message.slice(0, 60) };
    }
  }));
  for (const { host, tile, error } of results) {
    if (tile?.png) {
      tiles.set(host, tile.png);
      if (tile.source === 'cache') cached++;
      else { fetched++; console.log(`  + ${host} ${tile.source}`); }
    } else {
      failed++;
      console.log(`  - ${host} ${error ? `error: ${error}` : tile?.source || 'missing'}`);
    }
  }
}
for (const [key, png] of concepts) tiles.set(key, png);

// --- compose sheet -----------------------------------------------------------

const orderedKeys = [...tiles.keys()].sort();
const rows = Math.ceil(orderedKeys.length / COLUMNS);
const composites = orderedKeys.map((key, index) => ({
  input: tiles.get(key),
  left: (index % COLUMNS) * TILE,
  top: Math.floor(index / COLUMNS) * TILE,
}));

const sheet = await sharp({
  create: {
    width: COLUMNS * TILE,
    height: rows * TILE,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
}).composite(composites).png().toBuffer();
writeFileSync(OUT_SHEET, sheet);

const spriteId = host => String(host).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cssLines = [
  '/* Source favicon sprite classes. Generated by scripts/build-favicon-sprite.js. */',
  '.source-sprite {',
  "  background-image: url('../favicons/sprite.png');",
  '  background-repeat: no-repeat;',
  '}',
  '',
];
orderedKeys.forEach((key, index) => {
  const x = (index % COLUMNS) * TILE;
  const y = Math.floor(index / COLUMNS) * TILE;
  cssLines.push(`.source-icon-${spriteId(key)} { background-position: -${x}px -${y}px; }`);
});
writeFileSync(OUT_CSS, cssLines.join('\n') + '\n');

const registry = `// Generated by scripts/build-favicon-sprite.js.
// src/styles/favicon-sprite.css carries the actual sheet offsets for each
// canonical icon class; this file only tells rendering code whether a host has
// a sprite tile.
export const FAVICON_SPRITE_HOSTS = new Set([
${orderedKeys.map(key => `  '${spriteId(key)}',`).join('\n')}
]);

export function faviconSpriteId(host) {
  return String(host || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getFaviconSpriteClass(host) {
  const id = faviconSpriteId(host);
  return FAVICON_SPRITE_HOSTS.has(id) ? \`source-icon-\${id}\` : '';
}
`;
writeFileSync(OUT_REGISTRY, registry);

console.log(`\nsheet: ${orderedKeys.length} tiles (${rows} rows) -> ${OUT_SHEET}`);
console.log(`cached ${cached}, fetched ${fetched}, failed ${failed}`);
if (registryNotes.length) console.log('notes:', registryNotes.join('; '));
