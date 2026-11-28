// Manual generator — writes src/og-measured.jpg and src/og-relationships.jpg,
// committed and copied by the build like any static asset. Unlike the site-wide
// og-cover (a favicon texture), these are plain white cards that mirror what
// each page is about: the measured page shows the actual top and bottom of the
// source ordering; the relationships page is simple type on strips.
// Re-run after measurements change: node scripts/build-page-og-images.js
import sharp from 'sharp';
import { readFileSync } from 'fs';

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
const INK = '#1a1815';
const MUTED = '#6b655c';
const RED = '#8b1a1a';
const PAPER = '#ffffff';

async function writeCard(outPath, parts) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>
    ${parts.join('\n')}
  </svg>`);
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: PAPER } })
    .composite([{ input: svg, left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toFile(outPath);
}

// --- measured-sources: title intro, top six left / bottom six right, footer ---
async function buildMeasuredOg(outPath) {
  const data = JSON.parse(readFileSync('src/data/measured-sources.json', 'utf8'));
  const ordered = [...data.sources].sort((a, b) => a.rank - b.rank);
  const top = ordered.slice(0, 6);
  const bottom = ordered.slice(-6);

  const parts = [];
  const title = { text: 'Measured source quality', font: SERIF, size: 64, weight: 700, spacing: 0 };
  const titleM = await measure(title);
  parts.push(`<text x="${WIDTH / 2}" y="${96 + titleM.ascent}" font-family="${title.font}" font-size="${title.size}" font-weight="${title.weight}" fill="${INK}" text-anchor="middle">${esc(title.text)}</text>`);
  const sub = { text: 'Which headlines tell you something concrete — and which just want your click', font: SANS, size: 27, weight: 400, spacing: 0 };
  const subM = await measure(sub);
  parts.push(`<text x="${WIDTH / 2}" y="${138 + subM.ascent}" font-family="${sub.font}" font-size="${sub.size}" fill="${MUTED}" text-anchor="middle">${esc(sub.text)}</text>`);
  parts.push(`<line x1="80" y1="196" x2="${WIDTH - 80}" y2="196" stroke="${RED}" stroke-width="2"/>`);

  const colY0 = 236;
  const rowH = 52;
  const headSize = 22;
  const rowSize = 27;
  const columns = [
    { x: 90, align: 'start', head: 'STRONGEST HEADLINES', rows: top, scoreFill: INK },
    { x: WIDTH - 90, align: 'end', head: 'WEAKEST HEADLINES', rows: bottom, scoreFill: INK },
  ];
  for (const col of columns) {
    const anchor = col.align === 'end' ? 'end' : 'start';
    parts.push(`<text x="${col.x}" y="${colY0}" font-family="${SANS}" font-size="${headSize}" font-weight="700" letter-spacing="3" fill="${RED}" text-anchor="${anchor}">${col.head}</text>`);
    let y = colY0 + 30;
    for (const source of col.rows) {
      y += rowH - 16;
      const label = `#${source.rank} ${source.label}`;
      const score = source.measuredQuality.toFixed(1);
      if (col.align === 'start') {
        parts.push(`<text x="${col.x}" y="${y}" font-family="${SANS}" font-size="${rowSize}" fill="${INK}" text-anchor="start">${esc(label)}</text>`);
        parts.push(`<text x="${WIDTH / 2 - 40}" y="${y}" font-family="${SANS}" font-size="${rowSize}" font-weight="700" fill="${col.scoreFill}" text-anchor="end">${score}</text>`);
      } else {
        parts.push(`<text x="${WIDTH / 2 + 40}" y="${y}" font-family="${SANS}" font-size="${rowSize}" font-weight="700" fill="${col.scoreFill}" text-anchor="start">${score}</text>`);
        parts.push(`<text x="${col.x}" y="${y}" font-family="${SANS}" font-size="${rowSize}" fill="${INK}" text-anchor="end">${esc(label)}</text>`);
      }
      y += 6;
    }
  }
  parts.push(`<line x1="${WIDTH / 2}" y1="${colY0 - 14}" x2="${WIDTH / 2}" y2="${colY0 + 6 * rowH + 8}" stroke="#d8d4cc" stroke-width="1"/>`);

  const foot = { text: `${data.sources.length} news sources ranked by text-metrics`, font: SANS, size: 26, weight: 400, spacing: 0 };
  const footM = await measure(foot);
  parts.push(`<line x1="80" y1="${HEIGHT - 96}" x2="${WIDTH - 80}" y2="${HEIGHT - 96}" stroke="${RED}" stroke-width="2"/>`);
  parts.push(`<text x="${WIDTH / 2}" y="${HEIGHT - 78 + footM.ascent}" font-family="${foot.font}" font-size="${foot.size}" fill="${MUTED}" text-anchor="middle">${esc(foot.text)}</text>`);
  parts.push(`<rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" fill="none" stroke="${RED}" stroke-width="3"/>`);

  await writeCard(outPath, parts);
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
  await writeCard(outPath, parts);
  return { lines: lines.length };
}

const measured = await buildMeasuredOg('src/og-measured.jpg');
console.log(`og-measured: top ${measured.top} vs bottom ${measured.bottom} -> src/og-measured.jpg`);
const rel = await buildRelationshipsOg('src/og-relationships.jpg');
console.log(`og-relationships: ${rel.lines} lines -> src/og-relationships.jpg`);
