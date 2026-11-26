// Shared digest splitting for the client boot path. Used by scripts/build.js
// for the static output AND by the vite dev middleware so dev matches prod.
//
// The client never reads timeline/entities/topics/stats or per-story
// bodyText/wordCount/storyType — those exist for external dataset consumers.
// Splitting them out halves the boot payload, and windowing by recency means
// a first-time reader only downloads the 7-day digest up front; the archive
// loads lazily and only when the reader's window setting actually reaches it.

export const RECENT_WINDOW_DAYS = 7;

function newestStoryTime(cluster) {
  let newest = 0;
  for (const story of cluster.stories || []) {
    const time = Date.parse(story.published || '') || 0;
    if (time > newest) newest = time;
  }
  return newest || Date.parse(cluster.updated || cluster.created || '') || 0;
}

function slimCluster(cluster) {
  return {
    ...cluster,
    stories: (cluster.stories || []).map(({ bodyText, wordCount, storyType, ...story }) => story),
  };
}

export function slimClusterForClient(cluster) {
  return slimCluster(cluster);
}

// Splits the full public dataset into client artifacts:
//   recent:  clusters whose newest story is inside the window (slim)
//   archive: everything older (slim)
// Both carry the same envelope fields the client boots with.
export function splitClientDigest(publicDigest, now = Date.now()) {
  const cutoff = now - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = [];
  const archive = [];
  for (const cluster of publicDigest.clusters || []) {
    (newestStoryTime(cluster) >= cutoff ? recent : archive).push(slimCluster(cluster));
  }
  const envelope = {
    date: publicDigest.date,
    generated: publicDigest.generated,
    sources: publicDigest.sources,
    pipelineStats: publicDigest.pipelineStats,
  };
  return {
    recent: { ...envelope, clusters: recent },
    archive: { ...envelope, clusters: archive },
  };
}
