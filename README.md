# The Daily Broadsheet

An automated, ad-free news digest. Fetches stories from [Currents API](https://currentsapi.services) and [BBC RSS](https://www.bbc.co.uk/news), groups related coverage into superstory clusters, and summarises each cluster via LLM. The result is a single-page broadsheet newspaper — no clickbait, no infinite scroll, no engagement metrics, just the news.

## How It Works

Three scripts run in sequence, several times daily via GitHub Actions:

1. **`fetch-news.js`** — Pulls stories from Currents API and BBC RSS feeds. Optional search plugins surface topic-specific coverage using spare API quota. Stories are deduplicated, filtered against reject rules (by title pattern or category), and stored with 30-day retention.

2. **`summarise.js`** — Groups stories into clusters using heuristic keyword analysis and trigger-word matching against existing clusters. Confident matches go straight to the LLM for headline/summary updates. Unmatched stories are grouped by keyword overlap. Singletons are sent to the LLM with existing cluster headlines for allocation. When the LLM fails (rate limits, etc.), heuristic groups still become clusters with fallback headlines — nothing is lost. Trigger words from each cluster enable fast matching of future stories without needing the LLM.

3. **`build.js`** — Vite bundles the client, then the digest and run log are copied to `docs/` for GitHub Pages.

## Reject Filters

Defined in `.env`. Stories matching these patterns are filtered out before summarisation and purged from the digest on every run:

```
REJECT_CATEGORIES=Sports
REJECT_TITLES=Trump|White House|World Cup|Football|Soccer
```

## Search Plugins

Defined in `.env` as `SEARCH_PLUGINS`. Semicolons separate plugin groups, pipes separate keywords within a group:

```
SEARCH_PLUGINS=longsight|levenshulme|gorton|manchester;xbox|dark souls|dwarf fortress|metal gear solid|game pass
```

Plugins run using spare API quota, round-robin based on last-run time so all plugins get fair coverage.

## Client Features

- **Broadsheet layout**: Masonry grid with serif typography, configurable column count
- **Night/day mode**: Auto-detects system preference, manual override in settings
- **Interest signals**: ✓/✕ buttons on each story mark it as read and signal relevance. Relevant stories rank higher; ignored stories get downranked. Stored locally, no accounts.
- **Search**: Ctrl+F or F3 opens search. Real-time filtering across headlines, summaries, and categories — non-matching stories are removed from the grid, not just hidden.
- **Settings**: Font, font size, columns, sort order, image density, theme, expand all links — all persisted locally
- **Recent Updates panel**: Dataset freshness, source list, category breakdown, interest profile, and run history
- **No dark patterns**: No unread counts, no badges, no engagement baiting

## Setup

### Prerequisites
- Node.js 22+
- A `.env` file with:
  ```
  CURRENTSAPI_SERVICES_KEY=your_key
  OPENROUTER_API_KEY=your_key         # or FEATHERLESS_API_KEY / OPENAI_API_KEY
  SEARCH_PLUGINS=longsight|levenshulme|gorton|manchester;xbox|dark souls|dwarf fortress|metal gear solid|game pass
  REJECT_CATEGORIES=Sports
  REJECT_TITLES=Trump|White House|World Cup|Football|Soccer
  ```

### Local Development
```bash
npm ci
npm run dev        # Vite dev server on port 8000
npm run pipeline   # fetch + summarise + build (full pipeline)
```

Or run individual steps:
```bash
npm run fetch-news
npm run summarise
npm run build      # Vite build + copy digest to docs/
```

### GitHub Actions Deployment
1. Push to `main`
2. Set repository secrets: `CURRENTSAPI_SERVICES_KEY`, `OPENROUTER_API_KEY` (or `FEATHERLESS_API_KEY` / `OPENAI_API_KEY`), `SEARCH_PLUGINS`
3. Enable GitHub Pages (deploy from Actions)
4. The workflow runs on push and on schedule

## Project Structure

```
scripts/
  fetch-news.js     # API fetching, RSS, plugins, reject filters, story store
  summarise.js      # Heuristic grouping + LLM summarisation
  prompts.js        # LLM prompts per tranche type (update, new, allocate)
  extract-json.js   # LLM response parsing
  build.js          # Copy digest + static assets to docs/
src/
  index.html        # Broadsheet layout, inline theme detection
  style.css         # Newspaper aesthetic, night/day themes
  app.js            # Client rendering, Masonry, search, settings
  sw.js             # Service worker (network-first for content)
vite.config.js      # Vite config, dev server, cache middleware
cache/              # Story store, digest, run state (gitignored, on cache-data branch)
docs/               # Built output for GitHub Pages
```

## License

DBAD (Do Whatever You Want, Just Don't Be A Dick)
