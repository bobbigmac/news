// Manual generator — writes src/og-measured.jpg and src/og-relationships.jpg,
// committed and copied by the build like any static asset. Unlike the site-wide
// og-cover (a favicon texture), these are plain white cards that mirror what
// each page is about: the measured page shows the actual top and bottom of the
// source ordering; the relationships page is simple type on strips.
// Re-run after measurements change: node scripts/build-page-og-images.js
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { buildIconGrid } from './build-og-image.js';

const WIDTH = 1200;
const HEIGHT = 630;

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Measures a text line by rendering it alone and trimming transparent pixels —
// real glyph bounds, no font-metrics guessing.
async function measure(line) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * 2}" height="${line.size * 3}">
    <text x="20" y="${line.size * 2}" font-family="${line.font}" font-size="${line.size}" font-weight="${line.weight}" letter-spacing="${line.spacing || 0}">${esc(line.text)}</text>
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

const SERIF = 'Georgia, serif';
const SANS = 'Helvetica, Arial, sans-serif';
// Day-theme site palette — the card should read as a crop of the real page.
const INK = '#1a1a1a';
const MUTED = '#6b6357';
const RED = '#8b1a1a';
const PAPER = '#faf9f7';
const RULE = '#d9d6d0';
const CARD = '#ffffff';

async function writeCard(outPath, parts, icons = []) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>
    ${parts.join('\n')}
  </svg>`);
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: PAPER } })
    .composite([{ input: svg, left: 0, top: 0 }, ...icons])
    .jpeg({ quality: 90 })
    .toFile(outPath);
}

async function loadIcon(key) {
  const path = `src/favicons/${key}.png`;
  try {
    return await sharp(path).resize(22, 22).png().toBuffer();
  } catch {
    return null;
  }
}

// --- measured-sources: masthead like the real page, then card rows with
// rank + favicon + name + score, all reading left-to-right in both columns ---
async function buildMeasuredOg(outPath) {
  const data = JSON.parse(readFileSync('src/data/measured-sources.json', 'utf8'));
  // Small-sample rows are excluded — their positions are too unstable to put on a card.
  const ordered = data.sources.filter(s => s.stableSample).sort((a, b) => a.rank - b.rank);
  const top = ordered.slice(0, 7);
  const bottom = ordered.slice(-7);

  const parts = [];
  // Masthead: serif title (small-caps feel) + strapline + the 2px ink rule the
  // page header carries.
  parts.push(`<text x="${WIDTH / 2}" y="92" font-family="${SERIF}" font-size="54" font-weight="700" letter-spacing="1" fill="${INK}" text-anchor="middle">Measured Source Quality</text>`);
  parts.push(`<text x="${WIDTH / 2}" y="128" font-family="${SANS}" font-size="21" fill="${MUTED}" text-anchor="middle">Which headlines tell you something concrete — and which just want your click</text>`);
  parts.push(`<line x1="56" y1="152" x2="${WIDTH - 56}" y2="152" stroke="${INK}" stroke-width="2"/>`);

  const colW = 520;
  const columns = [
    { x: 56, head: 'The strongest headlines', rows: top },
    { x: WIDTH - 56 - colW, head: 'The weakest headlines', rows: bottom },
  ];
  const cardH = 42;
  const gap = 7;
  const headY = 188;
  const cardY0 = 204;
  const icons = [];
  for (const col of columns) {
    parts.push(`<text x="${col.x}" y="${headY}" font-family="${SERIF}" font-size="25" font-weight="700" fill="${INK}">${col.head}</text>`);
    for (let i = 0; i < col.rows.length; i++) {
      const source = col.rows[i];
      const y = cardY0 + i * (cardH + gap);
      const mid = y + cardH / 2;
      parts.push(`<rect x="${col.x}" y="${y}" width="${colW}" height="${cardH}" rx="4" fill="${CARD}" stroke="${RULE}" stroke-width="1"/>`);
      parts.push(`<text x="${col.x + 14}" y="${mid + 8}" font-family="${SANS}" font-size="20" font-weight="700" fill="${INK}">#${source.rank}</text>`);
      parts.push(`<text x="${col.x + 100}" y="${mid + 7}" font-family="${SANS}" font-size="21" font-weight="600" fill="${INK}">${esc(source.label)}</text>`);
      parts.push(`<text x="${col.x + colW - 14}" y="${mid + 8}" font-family="${SANS}" font-size="23" font-weight="700" fill="${INK}" text-anchor="end">${source.measuredQuality.toFixed(1)}</text>`);
      const iconKey = source.iconKey || source.key;
      const icon = await loadIcon(iconKey);
      if (icon) {
        icons.push({ input: icon, left: col.x + 66, top: Math.round(mid - 11) });
      } else {
        parts.push(`<circle cx="${col.x + 77}" cy="${mid}" r="11" fill="${RULE}"/>`);
        parts.push(`<text x="${col.x + 77}" y="${mid + 6}" font-family="${SANS}" font-size="15" font-weight="700" fill="${MUTED}" text-anchor="middle">${esc(source.label.charAt(0).toUpperCase())}</text>`);
      }
    }
  }

  const footY = cardY0 + 7 * (cardH + gap) + 16;
  parts.push(`<line x1="56" y1="${footY}" x2="${WIDTH - 56}" y2="${footY}" stroke="${RULE}" stroke-width="1"/>`);
  parts.push(`<text x="${WIDTH / 2}" y="${footY + 34}" font-family="${SANS}" font-size="21" fill="${MUTED}" text-anchor="middle">${data.sources.length} news sources ranked by text-metrics</text>`);

  await writeCard(outPath, parts, icons);
  return { top: top.length, bottom: bottom.length };
}

// --- relationships: simple type strips over white, like the site masthead ---
async function buildRelationshipsOg(outPath) {
  const lines = [
    { text: 'Source Relationships', font: SERIF, size: 76, weight: 700, spacing: 0, fill: '#f5f0e8' },
    { text: 'WHO OWNS AND FUNDS EACH OUTLET', font: SANS, size: 34, weight: 400, spacing: 5, fill: '#d8d4cc' },
    { text: 'The money and structure behind the news you read.', font: SANS, size: 28, weight: 400, spacing: 0, fill: '#c8c4bc' },
  ];
  const measured = [];
  for (const line of lines) measured.push({ ...line, ...(await measure(line)) });

  const PAD_X = 30;
  const PAD_Y = 14;
  const GAP = 26;
  const stripHeights = measured.map(m => m.h + PAD_Y * 2);
  const blockH = stripHeights.reduce((a, b) => a + b, 0) + GAP * (measured.length - 1);
  let y = Math.floor((HEIGHT - blockH) / 2);

  const parts = [`<rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" fill="none" stroke="${RED}" stroke-width="3"/>`];
  for (let i = 0; i < measured.length; i++) {
    const m = measured[i];
    const stripW = m.w + PAD_X * 2;
    const stripH = stripHeights[i];
    const stripX = Math.round((WIDTH - stripW) / 2);
    parts.push(`<rect x="${stripX}" y="${y}" width="${stripW}" height="${stripH}" rx="6" fill="#0a0a0a" opacity="0.92"/>`);
    const baseline = y + PAD_Y + m.ascent;
    parts.push(`<text x="${WIDTH / 2}" y="${baseline}" font-family="${m.font}" font-size="${m.size}" font-weight="${m.weight}" letter-spacing="${m.spacing}" fill="${m.fill}" text-anchor="middle">${esc(m.text)}</text>`);
    y += stripH + GAP;
  }
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('\n')}</svg>`);
  // Same volume-ordered favicon texture as the site-wide cover, dark strips over it.
  const { composites } = await buildIconGrid();
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#ffffff' } })
    .composite([...composites, { input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 88 })
    .toFile(outPath);
  return { lines: lines.length };
}

const measured = await buildMeasuredOg('src/og-measured.jpg');
console.log(`og-measured: top ${measured.top} vs bottom ${measured.bottom} -> src/og-measured.jpg`);
const rel = await buildRelationshipsOg('src/og-relationships.jpg');
console.log(`og-relationships: ${rel.lines} lines -> src/og-relationships.jpg`);
