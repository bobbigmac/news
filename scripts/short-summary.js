// Compact-summary fallback for clusters that predate LLM-written
// short_summary fields, or whose LLM response omitted the field. The primary
// short summary is written by the normal cluster-summary LLM call; this helper
// never makes another call.
export function deriveShortSummary(summary, headline) {
  const clean = String(summary || '').replace(/\s+/g, ' ').trim();
  const source = clean || String(headline || '').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  const firstSentence = source.split(/(?<=[.!?])\s+/)[0] || source;
  const words = firstSentence.split(' ').filter(Boolean);
  if (words.length <= 24) return firstSentence;
  return `${words.slice(0, 24).join(' ').replace(/[,:;\-–—]+$/, '')}…`;
}
