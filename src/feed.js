import { populateArticleShell, renderArticle, renderArticleShell } from './article.js';
import { assignColumns, createColumnShells, getGridMetrics } from './layout.js';
import { refreshGlimpseObserver, refreshReadObserver } from './reading.js';
import { clusterMatchesSearch, getSearchQuery, updateMarkReadButton } from './search.js';
import { state } from './state.js';

class FeedView {
  constructor() {
    this.context = null;
    this.query = '';
    this.nodes = new Map();
    this.clusterById = new Map();
    this.visibleIds = new Set();
    this.heights = new Map();
    this.hydratedCount = 0;
    this.columnWidth = 0;
    this.collapsedGroups = new Set();
    this.renderToken = 0;
  }

  clear() {
    this.renderToken++;
    this.windowFramePending = false;
    this.context = null;
    this.query = '';
    this.nodes.clear();
    this.clusterById = new Map();
    this.visibleIds = new Set();
    this.heights = new Map();
    this.hydratedCount = 0;
    this.columnWidth = 0;
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

  finishChanges() {
    refreshGlimpseObserver();
    refreshReadObserver();
  }

  nodeFor(cluster) {
    let node = this.nodes.get(cluster.id);
    if (node) {
      if (!node.classList.contains('article-lazy')) this.unload(node);
      populateArticleShell(node, cluster);
      return node;
    }

    node = renderArticleShell(cluster);
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
        node.remove();
        this.nodes.delete(id);
      }
    }

    this.bindDriver();
    // Progressive materialization: the column assignment is pure math over
    // height estimates and runs synchronously, but creating thousands of
    // shell nodes in one go blocks first paint for new readers. Skeleton
    // containers go up immediately, then article shells materialize in
    // feed order — one chunk synchronously for the first screens, the rest
    // across animation frames.
    const heightOf = cluster => this.knownHeight(cluster) ?? this.estimatedHeight(cluster);
    const heightHint = cluster => this.visibleIds.has(cluster.id) ? heightOf(cluster) : 0;

    const materialize = cluster => {
      const node = this.nodeFor(cluster);
      node.style.height = `${heightOf(cluster)}px`;
      node.classList.toggle('hidden', !this.visibleIds.has(cluster.id));
      return node;
    };

    // Worklist: [cluster, targetColumn] pairs in feed order.
    const worklist = [];
    const grouping = context.grouping || null;
    sheet.classList.toggle('grouped-feed', !!grouping);
    sheet.replaceChildren();

    if (grouping) {
      for (const group of grouping.groups) {
        const details = document.createElement('details');
        details.className = 'story-group';
        details.open = !this.collapsedGroups.has(group.id);
        details.dataset.groupId = group.id;
        details.addEventListener('toggle', () => {
          if (details.open) this.collapsedGroups.delete(group.id);
          else this.collapsedGroups.add(group.id);
          this.scheduleWindowUpdate();
        });

        const summary = document.createElement('summary');
        summary.className = 'story-group-head';
        const crumb = document.createElement('span');
        crumb.className = 'story-group-crumb';
        crumb.textContent = (group.pathParts || []).slice(0, -1).join(' / ');
        const title = document.createElement('span');
        title.className = 'story-group-title';
        title.textContent = group.label;
        const count = document.createElement('span');
        count.className = 'story-group-count';
        count.textContent = String(group.clusters.length);
        summary.appendChild(crumb);
        summary.appendChild(title);
        summary.appendChild(count);
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'story-group-body';
        const columnEls = createColumnShells();
        body.replaceChildren(...columnEls);
        details.appendChild(body);
        sheet.appendChild(details);

        const assignment = assignColumns(group.clusters, heightHint);
        assignment.forEach((columnClusters, columnIndex) => {
          for (const cluster of columnClusters) worklist.push([cluster, columnEls[columnIndex]]);
        });
      }

      if (grouping.ungrouped.length) {
        const band = document.createElement('div');
        band.className = 'feed-ungrouped';
        const columnEls = createColumnShells();
        band.replaceChildren(...columnEls);
        sheet.appendChild(band);
        const assignment = assignColumns(grouping.ungrouped, heightHint);
        assignment.forEach((columnClusters, columnIndex) => {
          for (const cluster of columnClusters) worklist.push([cluster, columnEls[columnIndex]]);
        });
      }
      this.syncGroupVisibility();
    } else {
      const columnEls = createColumnShells();
      sheet.replaceChildren(...columnEls);
      const assignment = assignColumns(context.clusters, heightHint);
      assignment.forEach((columnClusters, columnIndex) => {
        for (const cluster of columnClusters) worklist.push([cluster, columnEls[columnIndex]]);
      });
    }

    this.hydratedCount = 0;
    const token = ++this.renderToken;
    const FIRST_CHUNK = 120;
    const CHUNK = 250;
    let cursor = 0;
    const materializeChunk = (limit) => {
      const end = Math.min(cursor + limit, worklist.length);
      for (; cursor < end; cursor++) {
        const [cluster, columnEl] = worklist[cursor];
        columnEl.appendChild(materialize(cluster));
      }
      refreshGlimpseObserver();
      refreshReadObserver();
      this.scheduleWindowUpdate();
    };

    materializeChunk(FIRST_CHUNK);
    if (cursor < worklist.length) {
      const step = () => {
        if (token !== this.renderToken) return; // a newer render superseded this one
        materializeChunk(CHUNK);
        if (cursor < worklist.length) requestAnimationFrame(step);
        else this.scheduleWindowUpdate();
      };
      requestAnimationFrame(step);
    }

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

    this.syncGroupVisibility();

    if (unloaded) this.finishChanges();
    else {
      refreshGlimpseObserver();
      refreshReadObserver();
    }
    this.scheduleWindowUpdate();
    updateMarkReadButton();
    return true;
  }

  syncGroupVisibility() {
    for (const details of document.querySelectorAll('.story-group')) {
      const articles = [...details.querySelectorAll('.article')];
      const visible = articles.filter(node => !node.classList.contains('hidden'));
      details.classList.toggle('hidden', !visible.length);
      const count = details.querySelector('.story-group-count');
      if (count) count.textContent = String(visible.length);
    }
  }

  // The one and only hydration driver — textbook windowed virtualization.
  // No IntersectionObserver, no event delivery to trust: every scroll/resize
  // frame recomputes the render window from geometry alone. Heights follow
  // the spec: measured real heights for anything already displayed (shells
  // re-pin at their real height on unload), estimates only for content never
  // shown. Enter/leave margins differ (overscan hysteresis) so nothing can
  // oscillate at the window edge, and all geometry is read in one pass before
  // any DOM write — reads never interleave with writes in a scroll handler.
  updateWindow() {
    if (!this.context) return;
    const enterMargin = 1200;
    const leaveMargin = 2400;
    const viewportH = window.innerHeight;

    // Phase 1: read everything.
    const entering = [];
    const leaving = [];
    for (const node of this.nodes.values()) {
      if (!node.isConnected || node.classList.contains('hidden')) continue;
      const rect = node.getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) continue; // collapsed groups etc.
      const isShell = node.classList.contains('article-lazy');
      if (isShell) {
        if (rect.bottom >= -enterMargin && rect.top <= viewportH + enterMargin) entering.push(node);
      } else if (rect.bottom < -leaveMargin || rect.top > viewportH + leaveMargin) {
        leaving.push(node);
      }
    }

    // Phase 2: write everything.
    let changed = false;
    let resized = false;
    for (const node of entering) {
      try {
        const result = this.hydrate(node);
        changed = result || changed;
        resized = result || resized;
      } catch (err) {
        console.warn('hydration failed for', node?.dataset?.clusterId, err);
      }
    }
    for (const node of leaving) {
      try {
        changed = this.unload(node) || changed;
      } catch (err) {
        console.warn('unload failed for', node?.dataset?.clusterId, err);
      }
    }
    if (changed) this.finishChanges(resized);
  }

  scheduleWindowUpdate() {
    if (this.windowFramePending) return;
    this.windowFramePending = true;
    requestAnimationFrame(() => {
      this.windowFramePending = false;
      this.updateWindow();
    });
  }

  bindDriver() {
    if (this.driverBound || typeof window === 'undefined') return;
    this.driverBound = true;
    window.addEventListener('scroll', () => this.scheduleWindowUpdate(), { passive: true });
    window.addEventListener('resize', () => this.scheduleWindowUpdate());
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
