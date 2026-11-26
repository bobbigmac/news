import { canonicalCategory, getDisplayedStories, getFeedStories, getNewestStoryDate } from './view-model.js';
import { matchesWatchWords, state, ui } from './state.js';
import { isClusterRead, isClusterUpdatedSinceRead, markClusterRead } from './reading.js';
import { getClusterInterest, scoreClusterAgainstSignals, setClusterInterest } from './signals.js';
import { storySearchText } from './search.js';

const escapeHtml = text => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return dateStr || ''; }
}

export function relativeAge(dateStr) {
  if (!dateStr) return '';
  try {
    const ts = new Date(dateStr).getTime();
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch { return ''; }
}

function pickLeadImage(cluster) {
  const withImage = (cluster.stories || []).filter(s => s.image && s.image !== 'None');
  if (!withImage.length) return null;
  return withImage[0];
}

function isLatestCluster(cluster, referenceTime) {
  const added = Date.parse(cluster.updated || cluster.created || '');
  return !!added && referenceTime - added <= 24 * 60 * 60 * 1000;
}

function renderSummaryHtml(cluster, summary) {
  return `<div class="article-summary"><span class="summary-full">${escapeHtml(summary)}</span></div>`;
}

function clearArticleListeners(article) {
  for (const cleanup of article._articleCleanup || []) cleanup();
  article._articleCleanup = [];
}

function trackArticleListener(article, element, type, listener) {
  element.addEventListener(type, listener);
  article._articleCleanup.push(() => element.removeEventListener(type, listener));
}

export function populateArticleShell(article, cluster) {
  clearArticleListeners(article);
  const category = canonicalCategory(cluster.category);
  article.className = 'article grid-item article-lazy';
  article.dataset.clusterId = cluster.id;
  article.dataset.headline = (cluster.headline || 'Untitled').toLowerCase();
  article.dataset.summary = `${cluster.summary || ''} ${cluster.shortSummary || ''}`.toLowerCase();
  article.dataset.category = category.toLowerCase();
  article.dataset.stories = getFeedStories(cluster, state.disabledSources)
    .map(storySearchText)
    .join(' ')
    .toLowerCase();

  const header = document.createElement('div');
  header.className = 'article-header';
  const categoryEl = document.createElement('div');
  categoryEl.className = 'article-category';
  categoryEl.textContent = category;
  const ageEl = document.createElement('div');
  ageEl.className = 'article-age';
  ageEl.textContent = relativeAge(getNewestStoryDate(cluster));
  header.append(categoryEl, ageEl);

  const headline = document.createElement('h2');
  headline.className = 'article-headline';
  headline.textContent = cluster.headline || 'Untitled';
  article.replaceChildren(header, headline);
  return article;
}

export function renderArticleShell(cluster) {
  return populateArticleShell(document.createElement('article'), cluster);
}

export function renderArticle(cluster, settings, isPluginLead, latestReferenceTime, target = null) {
  const category = canonicalCategory(cluster.category);
  const headline = cluster.headline || 'Untitled';
  const summary = cluster.summary || '';
  const wasUpdated = isClusterUpdatedSinceRead(cluster);
  const storyCount = (cluster.stories || []).length;
  const enabledStories = getDisplayedStories(
    cluster,
    state.disabledSources,
    state.sourceInclude,
    state.viewModel?.controlByHost,
  );
  const isSingleton = storyCount === 1;
  const singletonStory = isSingleton ? cluster.stories[0] : null;

  // For multi-story clusters, build the expandable source list.
  // For singletons, the headline itself links to the source — no list needed.
  let linksHtml = '';
  let headlineHtml = '';
  if (isSingleton && singletonStory) {
    const sourceParts = [];
    if (singletonStory.source) sourceParts.push(singletonStory.source);
    if (singletonStory.sourceName) sourceParts.push(singletonStory.sourceName);
    const byline = sourceParts.length ? ` — ${sourceParts.join(' · ')}` : '';
    headlineHtml = `<h2 class="article-headline"><a href="${singletonStory.url || '#'}" target="_blank" rel="noopener">${escapeHtml(headline)}</a><span class="singleton-byline">${escapeHtml(byline)}</span></h2>`;
  } else {
    linksHtml = enabledStories.map(s => {
      const sourceParts = [];
      if (s.source) sourceParts.push(s.source);
      if (s.sourceName) sourceParts.push(s.sourceName);
      const sourceHtml = sourceParts.length
        ? `<span class="story-source">— ${escapeHtml(sourceParts.join(' · '))}</span>` : '';
      return `<li><a href="${s.url || '#'}" target="_blank" rel="noopener">${escapeHtml(s.title || 'Untitled')}</a>${sourceHtml}</li>`;
    }).join('');
    headlineHtml = `<h2 class="article-headline">${escapeHtml(headline)}</h2>`;
  }

  const article = target || document.createElement('article');
  clearArticleListeners(article);
  article.className = 'article grid-item';
  if (isSingleton) article.classList.add('singleton');
  article.dataset.clusterId = cluster.id;
  article.dataset.headline = headline.toLowerCase();
  article.dataset.summary = `${summary} ${cluster.shortSummary || ''}`.toLowerCase();
  article.dataset.category = category.toLowerCase();
  article.dataset.stories = getFeedStories(cluster, state.disabledSources)
    .map(storySearchText)
    .join(' ')
    .toLowerCase();
  if (wasUpdated) article.classList.add('has-updates');
  if (matchesWatchWords(cluster)) article.classList.add('watch-match');

  // Signal-derived styling (subtle — these are guesses, not explicit signals)
  const signalScore = scoreClusterAgainstSignals(cluster);
  if (signalScore.score >= 1) article.classList.add('signal-suggested');
  else if (signalScore.score <= -3) article.classList.add('signal-demoted');

  let imageHtml = '';
  if (settings.images !== 'none') {
    let showImage = false;
    if (settings.images === 'all') {
      showImage = true;
    } else if (settings.images === 'minimal') {
      showImage = isPluginLead;
    } else if (settings.images === 'latest') {
      showImage = isLatestCluster(cluster, latestReferenceTime);
    }
    if (showImage) {
      const imgStory = pickLeadImage(cluster);
      if (imgStory) {
        imageHtml = `<img class="article-image" src="${imgStory.image}" alt="" loading="lazy" onerror="this.style.display='none'">`;
      }
    }
  }

  const interest = getClusterInterest(cluster.id);
  const summaryHtml = renderSummaryHtml(cluster, summary);

  // For singletons, no expandable source list — the headline is the link.
  // For multi-story clusters, keep the expandable list behaviour.
  const bodyHtml = isSingleton
    ? summaryHtml
    : `<div class="article-body${settings.expandAll ? ' show-links' : ''}">
         ${summaryHtml}
         <div class="story-links">
           <ul>${linksHtml}</ul>
         </div>
       </div>`;

  article.innerHTML = `
    <div class="article-header">
      <div class="article-category">${category}</div>
      <div class="article-header-right">
        <div class="article-age">${relativeAge(getNewestStoryDate(cluster))}</div>
        <button class="interest-btn interested-btn ${interest === 'interested' ? 'active' : ''}" data-signal="interested" title="Relevant — show more like this">✓</button>
        <button class="interest-btn not-interested-btn ${interest === 'not-interested' ? 'active' : ''}" data-signal="not-interested" title="Ignore — show less like this">✕</button>
      </div>
    </div>
    ${imageHtml}
    ${headlineHtml}
    ${bodyHtml}
  `;

  // Apply interest-based visibility class
  if (interest === 'not-interested') article.classList.add('downranked');

  // Click toggles between summary and source links (multi-story only).
  // Singletons don't have an expandable list — the headline links directly.
  if (!isSingleton) {
    const body = article.querySelector('.article-body');
    trackArticleListener(article, article, 'click', (e) => {
      if (e.target.tagName === 'A' || e.target.closest('.interest-btn')) return;
      body.classList.toggle('show-links');
      ui.relayout();
    });
  }

  // Interest signal buttons — both mark as read and set signal
  article.querySelectorAll('.interest-btn').forEach(btn => {
    trackArticleListener(article, btn, 'click', (e) => {
      e.stopPropagation();
      const signal = btn.dataset.signal;
      setClusterInterest(cluster, signal);
      markClusterRead(cluster);
      article.classList.remove('has-updates');
      article.classList.add('is-read');
      const newInterest = getClusterInterest(cluster.id);
      article.classList.toggle('downranked', newInterest === 'not-interested');
      // Remove the article from the DOM after brief visual feedback
      // We don't re-render the digest — the cached signal profile keeps
      // remaining articles in their current order
      setTimeout(() => {
        article.remove();
        ui.relayout();
      }, 300);
    });
  });

  return article;
}
