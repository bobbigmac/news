// Manual generator — writes src/og-cover.jpg, which is committed and copied by the
// build like any static asset. Source favicons (volume-ordered,
// so the sources readers actually see most lead the texture) on a white base,
// spaced so the white shows between them, with the masthead type composited
// over it — each line on its own dark strip. Runs at build so the grid grows
// as the source base does.
import sharp from 'sharp';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadJson } from './cache-io.js';

// Extracts the largest PNG-compressed frame from an ICO container — modern
// ICOs embed real PNG data for their larger frames, which sharp can then read.
// Returns { png, size } of the biggest frame, or null if none is PNG-encoded.
function extractIcoPng(path) {
  const buf = readFileSync(path);
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const count = buf.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    const w = buf[off] || 256;
    const size = buf.readUInt32LE(off + 8);
    const dataOff = buf.readUInt32LE(off + 12);
    if (dataOff + size > buf.length) continue;
    // PNG magic
    if (buf.readUInt32BE(dataOff) === 0x89504e47) {
      if (!best || w > best.size) best = { png: buf.subarray(dataOff, dataOff + size), size: w };
    }
  }
  return best;
}

// Collects every source with icon artwork >= minSize px, from cached original
// downloads: large PNGs directly, PNG frames extracted from ICO containers.
// Keyed by host so quad slots line up with the tile inventory.
function collectHiresIcons(cacheDir, minSize) {
  const dir = join(cacheDir, 'favicons');
  if (!existsSync(dir)) return new Map();
  const hires = new Map();
  for (const f of readdirSync(dir)) {
    const host = f.replace(/\.(png|ico)$/, '');
    const path = join(dir, f);
    try {
      if (f.endsWith('.png')) hires.set(host, { input: path });
      else if (f.endsWith('.ico')) {
        const frame = extractIcoPng(path);
        if (frame) hires.set(host, { input: frame.png });
      }
    } catch { /* unreadable — skip */ }
  }
  return hires;
}

const WIDTH = 1200;
const HEIGHT = 630;
const TILE = 28;  // content size after cropping the baked-in 2px tile margin —
                  // native pixels, never upscaled
const PITCH = 28; // tiles touch — full coverage, no gaps
const CROP = { left: 2, top: 2, width: 28, height: 28 };
const FAVICONS_DIR = 'src/favicons';
const CACHE_DIR = 'cache';

const LINES = [
  { text: 'The Daily Broadsheet', font: 'Georgia, serif', size: 84, weight: 700, spacing: 0, fill: '#f5f0e8' },
  { text: 'A DAILY NEWS DIGEST', font: 'Helvetica, Arial, sans-serif', size: 42, weight: 400, spacing: 6, fill: '#d8d4cc' },
  { text: 'Good news! Well, some of it is.', font: 'Helvetica, Arial, sans-serif', size: 30, weight: 400, spacing: 0, fill: '#c8c4bc' },
];

// Measures a text line by rendering it alone and trimming transparent pixels —
// real glyph bounds, no font-metrics guessing for the strip sizes.
async function measure(line) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * 2}" height="${line.size * 3}">
    <text x="20" y="${line.size * 2}" font-family="${line.font}" font-size="${line.size}" font-weight="${line.weight}" letter-spacing="${line.spacing}">${line.text}</text>
  </svg>`);
  const img = sharp(svg, { density: 72 });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1, ascent: line.size * 2 - minY };
}

export async function buildOgImage(outPath) {
  // Order tiles by source volume in the digest so the grid is led by the
  // highest-volume outlets rather than alphabetically arbitrary ones.
  const digest = loadJson(join(CACHE_DIR, 'digest.json'), { clusters: [] });
  const volume = new Map();
  for (const c of digest.clusters) {
    for (const s of c.stories || []) {
      try {
        const host = new URL(s.url || '').hostname.replace(/^www\./, '');
        if (host) volume.set(host, (volume.get(host) || 0) + 1);
      } catch { /* bad url — skip */ }
    }
  }

  const tiles = readdirSync(FAVICONS_DIR)
    .filter(f => f.endsWith('.png') && f !== 'sprite.png')
    .map(f => ({
      file: join(FAVICONS_DIR, f),
      host: f.replace(/\.png$/, ''),
    }));
  const scoreOf = (tile) => volume.get(tile.host)
    || volume.get(tile.host.split('.').slice(-2).join('.'))
    || 0;
  // Volume first, then a deterministic spread within equal scores so
  // letter-fallback tiles don't clump alphabetically.
  const spread = (host) => [...host].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 997;
  tiles.sort((a, b) => scoreOf(b) - scoreOf(a) || spread(a.host) - spread(b.host));

  // Grid is oversized and centred, so tiles clip at all four edges — no
  // margin of bare base anywhere on the canvas.
  const cols = Math.ceil(WIDTH / PITCH) + 2;
  const rows = Math.ceil(HEIGHT / PITCH) + 2;
  const cells = cols * rows;
  const offsetX = Math.round((WIDTH - ((cols - 1) * PITCH + TILE)) / 2);
  const offsetY = Math.round((HEIGHT - ((rows - 1) * PITCH + TILE)) / 2);

  // Quad slots: sources with real hi-res artwork (>= 64px native — cached
  // original PNGs, or PNG frames extracted from ICO containers) get a 2x2
  // cell slot at native-or-downscaled size, never upscaled. Scattered
  // irregularly through the grid rather than clumped.
  const QUAD_MIN = 64; // source artwork floor — never upscale into a slot
  const hiresRaw = collectHiresIcons(CACHE_DIR, QUAD_MIN);
  const quads = [];
  for (const [host, art] of hiresRaw) {
    try {
      const meta = await sharp(art.input).metadata();
      if (meta.width >= QUAD_MIN && meta.height >= QUAD_MIN) {
        quads.push({ host, input: await sharp(art.input).resize(PITCH * 2, PITCH * 2).png().toBuffer(), vol: volume.get(host) || 0 });
      }
    } catch { /* unreadable — skip */ }
  }
  quads.sort((a, b) => b.vol - a.vol || spread(a.host) - spread(b.host));
  const quadHosts = new Set(quads.map(q => q.host));

  // Irregular scatter: deterministic shuffled position order, quads keep at
  // least one cell of ordinary tiles between each other so they read as
  // accents in the texture rather than a clustered block.
  const occupied = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const quadPositions = [];
  for (let y = 1; y < rows - 2; y++) for (let x = 1; x < cols - 2; x++) quadPositions.push([x, y]);
  quadPositions.sort((a, b) => spread(a[0] * 1000 + a[1] + '') - spread(b[0] * 1000 + b[1] + ''));
  const nearQuad = (x, y) => {
    for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 3; dx++) {
      if (occupied[y + dy]?.[x + dx]) return true;
    }
    return false;
  };
  const quadComposites = [];
  let qi = 0;
  for (const [x, y] of quadPositions) {
    if (qi >= quads.length) break;
    if (occupied[y][x] || occupied[y][x + 1] || occupied[y + 1][x] || occupied[y + 1][x + 1]) continue;
    if (nearQuad(x, y)) continue;
    quadComposites.push({
      input: quads[qi].input,
      left: offsetX + x * PITCH,
      top: offsetY + y * PITCH,
    });
    occupied[y][x] = occupied[y][x + 1] = occupied[y + 1][x] = occupied[y + 1][x + 1] = true;
    qi++;
  }

  // Ordinary tiles fill every unoccupied cell, volume-ordered, skipping any
  // source already placed as a quad.
  const fillTiles = tiles.filter(t => !quadHosts.has(t.host) && !quadHosts.has(t.host.split('.').slice(-2).join('.')));
  const cropped = await Promise.all(fillTiles.slice(0, cells).map(t =>
    sharp(t.file).extract(CROP).png().toBuffer()
  ));
  const composites = [...quadComposites];
  // The denser cropped grid needs more cells than the tile inventory has, so
  // tiles cycle — but round two onward starts at a hashed offset per row so
  // repeats don't line up in visible columns.
  let ti = 0;
  let icons = qi;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (occupied[y][x]) continue;
      composites.push({
        input: cropped[ti % cropped.length],
        left: offsetX + x * PITCH,
        top: offsetY + y * PITCH,
      });
      ti++;
      icons++;
    }
    if (ti >= fillTiles.length) ti += spread('row' + y) % 17;
  }

  // Masthead: measure every line, then lay strips+text out centred as a block.
  const measured = [];
  for (const line of LINES) measured.push({ ...line, ...(await measure(line)) });

  const PAD_X = 28;
  const PAD_Y = 12;
  const GAP = 22;
  const stripHeights = measured.map(m => m.h + PAD_Y * 2);
  const blockH = stripHeights.reduce((a, b) => a + b, 0) + GAP * (measured.length - 1);
  let y = Math.floor((HEIGHT - blockH) / 2);

  const parts = ['<rect x="40" y="40" width="1120" height="550" fill="none" stroke="#8b1a1a" stroke-width="3"/>'];
  for (let i = 0; i < measured.length; i++) {
    const m = measured[i];
    const stripW = m.w + PAD_X * 2;
    const stripH = stripHeights[i];
    const stripX = Math.round((WIDTH - stripW) / 2);
    parts.push(`<rect x="${stripX}" y="${y}" width="${stripW}" height="${stripH}" rx="6" fill="#0a0a0a" opacity="0.9"/>`);
    const baseline = y + PAD_Y + m.ascent;
    parts.push(`<text x="${WIDTH / 2}" y="${baseline}" font-family="${m.font}" font-size="${m.size}" font-weight="${m.weight}" letter-spacing="${m.spacing}" fill="${m.fill}" text-anchor="middle">${m.text}</text>`);
    y += stripH + GAP;
  }

  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('\n')}</svg>`);

  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#ffffff' } })
    .composite([...composites, { input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 88 })
    .toFile(outPath);
  return { icons, cells, quads: qi };
}

// Standalone: node scripts/build-og-image.js [out] — manual generation, then commit the output
if (process.argv[1]?.endsWith('build-og-image.js')) {
  const out = process.argv[2] || 'src/og-cover.jpg';
  const { icons, cells, quads } = await buildOgImage(out);
  console.log(`og-image: ${icons} icons (${quads} quads) across ${cells} cells -> ${out}`);
}
