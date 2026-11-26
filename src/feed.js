import { populateArticleShell, renderArticle, renderArticleShell } from './article.js';
import { bindImageLayout, getGridMetrics, initMasonry } from './layout.js';
import { refreshGlimpseObserver, refreshReadObserver } from './reading.js';
import { clusterMatchesSearch, getSearchQuery, updateMarkReadButton } from './search.js';
import { state } from './state.js';

const HYDRATE_ROOT_MARGIN = '1200px 0px';

class FeedView {
  constructor() {
    this.context = null;
    this.observer = null;
    this.query = '';
    this.nodes = new Map();
    this.clusterById = new Map();
    this.visibleIds = new Set();
    this.heights = new Map();
    this.hydratedCount = 0;
    this.columnWidth = 0;
    this.observedNodes = new Set();
  }

  disconnectObserver() {
    if (this.observer) this.observer.disconnect();
    this.observer = null;
  }

  clear() {
    this.disconnectObserver();
    this.context = null;
    this.query = '';
    this.nodes.clear();
    this.clusterById = new Map();
    this.visibleIds = new Set();
    this.heights = new Map();
    this.hydratedCount = 0;
    this.columnWidth = 0;
    this.observedNodes = new Set();
    if (state.masonry) {
      state.masonry.destroy();
      state.masonry = null;
    }
  }

  heightKey(cluster) {
    const settings = this.context?.settings || {};
    return [
      cluster.contentVersion || 1,
      settings.font,
      settings.fontsize,
      settings.columns,
      settings.images,
      settings.expandAll,
      settings.groupByTag,
      this.showsImage(cluster),
      Math.round(this.columnWidth),
    ].join(':');
  }

  showsImage(cluster) {
    const settings = this.context.settings;
    if (settings.images === 'none') return false;
    if (!(cluster.stories || []).some(story => story.image && story.image !== 'None')) return false;
    if (settings.images === 'all') return true;
    if (settings.images === 'minimal') return this.context.pluginLeadIds.has(cluster.id);
    if (settings.images === 'latest') {
      const added = Date.parse(cluster.updated || cluster.created || '');
      return !!added && this.context.latestReferenceTime - added <= 24 * 60 * 60 * 1000;
    }
    return false;
  }

  estimatedHeight(cluster) {
    const text = `${cluster.headline || ''} ${cluster.summary || ''}`;
    const charsPerLine = Math.max(28, Math.floor(this.columnWidth / 7));
    const textLines = Math.ceil(text.length / charsPerLine);
    return 88 + textLines * 24 + (this.showsImage(cluster) ? this.columnWidth * 0.5625 : 0);
  }

  knownHeight(cluster) {
    const entry = this.heights.get(cluster.id);
    if (entry?.key === this.heightKey(cluster)) return entry.height;
    return null;
  }

  hydrate(article) {
    if (!article?.classList.contains('article-lazy') || article.classList.contains('hidden')) return false;
    const cluster = this.clusterById.get(article.dataset.clusterId);
    if (!cluster) return false;

    article.style.height = '';
    renderArticle(
      cluster,
      this.context.settings,
      this.context.pluginLeadIds.has(cluster.id),
      this.context.latestReferenceTime,
      article,
    );
    bindImageLayout(article);
    const actualHeight = article.offsetHeight;
    this.heights.set(cluster.id, { key: this.heightKey(cluster), height: actualHeight });
    this.hydratedCount++;
    return true;
  }

  unload(article) {
    if (!article || article.classList.contains('article-lazy')) return false;
    const cluster = this.clusterById.get(article.dataset.clusterId);
    if (!cluster) return false;

    const actualHeight = article.offsetHeight;
    this.heights.set(cluster.id, { key: this.heightKey(cluster), height: actualHeight });
    article.style.height = `${actualHeight}px`;
    populateArticleShell(article, cluster);
    this.hydratedCount--;
    return true;
  }

  finishChanges(relayout = false) {
    if (relayout) state.masonry?.layout();
    refreshGlimpseObserver();
    refreshReadObserver();
  }

  observe(article) {
    if (this.observedNodes.has(article)) return;
    this.observedNodes.add(article);
    this.observer?.observe(article);
  }

  ensureObserver() {
    if (this.observer || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(entries => {
      let resized = false;
      let changed = false;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const result = this.hydrate(entry.target);
          resized = result || resized;
          changed = result || changed;
        } else {
          changed = this.unload(entry.target) || changed;
        }
      }
      if (changed) this.finishChanges(resized);
    }, { rootMargin: HYDRATE_ROOT_MARGIN });
  }

  nodeFor(cluster) {
    let node = this.nodes.get(cluster.id);
    if (node) {
      if (!node.classList.contains('article-lazy')) this.unload(node);
      populateArticleShell(node, cluster);
      return node;
    }

    node = renderArticleShell(cluster);
    node.addEventListener('click', event => {
      if (!node.classList.contains('article-lazy')) return;
      event.stopPropagation();
      const resized = this.hydrate(node);
      this.finishChanges(resized);
    });
    this.nodes.set(cluster.id, node);
    return node;
  }

  matchingClusters() {
    return this.context.clusters.filter(cluster =>
      !this.query || clusterMatchesSearch(cluster, this.query));
  }

  mount(context) {
    const sheet = document.getElementById('broadsheet');
    if (!sheet) return;

    if (this.context) {
      for (const node of this.nodes.values()) this.unload(node);
    }

    this.context = context;
    this.query = getSearchQuery();
    this.clusterById = new Map(context.clusters.map(cluster => [cluster.id, cluster]));
    const measuredWidth = getGridMetrics(sheet).colWidth;
    this.columnWidth = measuredWidth > 0 ? measuredWidth : 320;

    const matching = this.matchingClusters();
    this.visibleIds = new Set(matching.map(cluster => cluster.id));
    for (const [id, node] of this.nodes) {
      if (!this.clusterById.has(id)) {
        this.observer?.unobserve?.(node);
        this.observedNodes.delete(node);
        node.remove();
        this.nodes.delete(id);
      }
    }

    this.ensureObserver();
    const orderedNodes = context.clusters.map(cluster => {
      const node = this.nodeFor(cluster);
      node.style.height = `${this.knownHeight(cluster) ?? this.estimatedHeight(cluster)}px`;
      node.classList.toggle('hidden', !this.visibleIds.has(cluster.id));
      this.observe(node);
      return node;
    });
    sheet.replaceChildren(...orderedNodes);
    this.hydratedCount = 0;

    initMasonry();
    refreshGlimpseObserver();
    refreshReadObserver();
    updateMarkReadButton();
  }

  syncSearch() {
    if (!this.context) return false;
    const query = getSearchQuery();
    if (query === this.query) return true;

    this.query = query;
    const matching = this.matchingClusters();
    this.visibleIds = new Set(matching.map(cluster => cluster.id));

    let unloaded = false;
    for (const [id, node] of this.nodes) {
      const visible = this.visibleIds.has(id);
      if (!visible) unloaded = this.unload(node) || unloaded;
      node.classList.toggle('hidden', !visible);
    }

    state.masonry?.layout();
    if (unloaded) this.finishChanges();
    else {
      refreshGlimpseObserver();
      refreshReadObserver();
    }
    updateMarkReadButton();
    return true;
  }

  stats() {
    return {
      hydrated: this.hydratedCount,
      total: this.visibleIds.size,
      query: this.query,
    };
  }
}

const feedView = new FeedView();

export function clearFeed() {
  feedView.clear();
}

export function renderFeed(context) {
  feedView.mount(context);
}

export function syncFeedToSearch() {
  return feedView.syncSearch();
}

export function getFeedRenderState() {
  return feedView.stats();
}
