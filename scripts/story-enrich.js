// Per-story enrichment for the public dataset.
//
// Adds three fields to each story object that external consumers (e.g. a
// Ceefax/teletext renderer) need but our own frontend doesn't use:
//
//   - bodyText: cleaned plain-text body (description + content, stripped of
//     HTML, truncated). Gives consumers text to render per-story, not just
//     the cluster-level summary.
//   - wordCount: body text word count, for pagination onto fixed-width pages.
//   - storyType: heuristic classification — "news", "analysis", "video",
//     "feature", "opinion" — based on URL patterns and content signals.
//
// All pattern-based, no LLM calls. Good enough for consumer-side grouping;
// not bulletproof by design.

function stripHtml(text) {
  return (text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

const MAX_BODY_CHARS = 600;

// Classify a story by type using URL patterns and title heuristics.
// Returns one of: "news", "analysis", "video", "feature", "opinion".
export function classifyStoryType(story) {
  const url = (story.url || '').toLowerCase();
  const title = (story.title || story.originalTitle || '').toLowerCase();
  const desc = (story.description || '').toLowerCase();

  // Video content — BBC video articles, YouTube embeds, etc.
  if (/\/videos?\//.test(url) || /\/av\//.test(url) || /\/watch\b/.test(url) ||
      story.image === '' && /watch:/.test(title)) {
    return 'video';
  }

  // Analysis / explainers
  if (/\/analysis\//.test(url) || /analysis|explainer|what we know|how does|why does|what is/.test(title)) {
    return 'analysis';
  }

  // Opinion / comment / editorial
  if (/\/comment|\/opinion|\/editorial\//.test(url) || /opinion|comment|columnist|editorial|my view/.test(title)) {
    return 'opinion';
  }

  // Features / lifestyle / reviews — long-form, not breaking news
  if (/\/features?\//.test(url) || /review|how to|guide|tips|recipe|travel|lifestyle/.test(title)) {
    return 'feature';
  }

  // Default: straight news report
  return 'news';
}

// Enrich a single story object with bodyText, wordCount, and storyType.
// Mutates the story in place and returns it.
export function enrichStory(story) {
  const rawBody = stripHtml(story.content || story.description || '');
  // Fall back to title if no body text available (old stories stored without content).
  const body = rawBody || stripHtml(story.title || story.originalTitle || '');
  story.bodyText = body.length > MAX_BODY_CHARS
    ? body.substring(0, MAX_BODY_CHARS).replace(/\s+\S*$/, '') + '...'
    : body;
  story.wordCount = wordCount(story.bodyText);
  story.storyType = classifyStoryType(story);
  return story;
}

// Enrich all stories in a digest's clusters.
export function enrichAllStories(digest) {
  for (const cluster of (digest.clusters || [])) {
    for (const story of (cluster.stories || [])) {
      // Don't re-enrich if already done (idempotent).
      if (story.bodyText !== undefined) continue;
      enrichStory(story);
    }
  }
}
