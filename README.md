# The Daily Broadsheet

An automated, ad-free news digest that fetches stories from the [Currents API](https://currentsapi.services), de-clickbaitifies headlines, clusters related coverage, and summarises it all via [OpenRouter](https://openrouter.ai) LLMs. The result is a single-page broadsheet newspaper — no clickbait, no infinite scroll, no engagement metrics, just the news.

## How It Works

Three scripts run in sequence, n times daily via GitHub Actions:

1. **`fetch-news.js`** — Pulls latest English-language news (general + UK-specific) from Currents API. Runs optional search plugins for topic-specific queries (local news, gaming, etc.) using spare API quota. Deduplicates and stores stories in a JSON datastore with 30-day retention.

2. **`summarise.js`** — Sends new/updated stories to a free OpenRouter LLM in chunks. The LLM de-clickbaits headlines, clusters related stories together, and writes concise summaries. Falls back through multiple free models on rate limits.

3. **`build.js`** — Reads the digest and writes static files (`index.html`, `app.js`, `style.css`, `digest.json`) to `docs/` for GitHub Pages.

## Search Plugins

Defined in `search-plugins.json`. Each plugin specifies keywords (pipe-separated, ordered by priority) and optional country/language filters. Plugins run using spare API quota after fixed calls, round-robin based on last-run time so all plugins get fair coverage.

```json
[
  {
    "name": "local-news",
    "keywords": "longsight|levenshulme|gorton|manchester",
    "country": "gb",
    "language": "en",
    "description": "Local Manchester news"
  }
]
```

Keyword order matters — stories matching the first term surface higher, last term lower.

## API Quota Management

- Currents API allows 20 queries/day
- 3 runs/day × 2 fixed calls = 6 queries reserved for general + UK news
- Remaining 14 queries spread across plugins, with budget reserved for future fixed calls each day
- Run state tracked in `cache/run-state.json` (reset daily)

## Client Features

- **Broadsheet layout**: Newspaper-style columns with serif typography
- **Mark as read**: Hover and click ✓ to dismiss stories from the feed (stored in localStorage, no accounts)
- **Show updated toggle**: Resurfaces read stories that have new information since you last saw them
- **Search**: Real-time filtering across headlines, summaries, and categories
- **Settings**: Font size, column count, sort order, source visibility, expand all links — all persisted locally
- **No dark patterns**: No unread counts, no badges, no engagement baiting

## Setup

### Prerequisites
- Node.js 18+
- A `.env` file with:
  ```
  currentsapi_services_key=your_key
  openrouter_api_key=your_key
  ```

### Local Development
```bash
npm ci
npm run dev    # fetch + summarise + build + serve
```

Or run individual steps:
```bash
npm run fetch-news
npm run summarise
npm run build
npm run watch  # serve docs/ with live reload
```

### GitHub Actions Deployment
1. Push to `main`
2. Set repository secrets: `CURRENTSAPI_SERVICES_KEY`, `OPENROUTER_API_KEY`
3. Enable GitHub Pages (deploy from Actions)
4. The workflow runs on push and on schedule (3x daily)

## Project Structure

```
scripts/
  fetch-news.js    # API fetching, plugins, story store
  summarise.js     # LLM clustering & summarisation
  build.js         # Static site generation
src/
  index.html       # Broadsheet layout
  style.css        # Newspaper aesthetic
  app.js           # Client-side rendering, read state, settings
search-plugins.json  # Plugin definitions
cache/               # Story store, digest, run state (gitignored)
docs/                # Built output for GitHub Pages (gitignored)
```

## License

DBAD (Do Whatever You Want, Just Don't Be A Dick)
