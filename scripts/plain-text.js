// Feeds deliver HTML in description/content — sometimes entire self-contained
// item cards (Techmeme embeds headline, byline, permalink chrome and body in
// one blob). Anything stored as story text must be plain text: markup is
// structure, not content, and letting it through means foreign cards render
// nested inside our own article chrome.
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201C', rdquo: '\u201D', hellip: '…', copy: '©', reg: '®',
  trade: '™', times: '×', divide: '÷', middot: '·', bull: '•',
  deg: '°', plusmn: '±', micro: 'µ', para: '¶', sect: '§',
  laquo: '«', raquo: '»', pound: '£', euro: '€', yen: '¥', cent: '¢',
};

export function decodeEntities(text) {
  // Decode to fixpoint: feed text is frequently double-encoded (&amp;nbsp;
  // means a literal "&nbsp;" after one pass). Three iterations covers any
  // realistic nesting; genuine text containing entity names verbatim is
  // vanishingly rare compared to the certain damage of visible entities.
  let out = text || '';
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);?/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-zA-Z]+);?/g, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
    if (next === out) break;
    out = next;
  }
  return out;
}

export function toPlainText(html) {
  if (!html) return '';
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}
