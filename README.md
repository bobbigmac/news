# The Daily Broadsheet

An automated, ad-free news digest that fetches stories from the [Currents API](https://currentsapi.services), de-clickbaitifies headlines, clusters related coverage, and summarises it all via LLM (OpenRouter, Featherless, or OpenAI — whichever key you have). The result is a single-page broadsheet newspaper — no clickbait, no infinite scroll, no engagement metrics, just the news.

## How It Works

Three scripts run in sequence, n times daily via GitHub Actions:

1. **`fetch-news.js`** — Pulls latest English-language news (general + UK-specific) from Currents API. Runs optional search plugins for topic-specific queries (local news, gaming, etc.) using spare API quota. Deduplicates and stores stories in a JSON datastore with 30-day retention.

2. **`summarise.js`** — Sends new/updated stories to an LLM in chunks. The LLM de-clickbaits headlines, clusters related stories together, and writes concise summaries. Auto-detects the cheapest available provider (OpenRouter > Featherless > OpenAI) from env vars. Prompts are in `scripts/prompts.js` for easy tweaking.

3. **`build.js`** — Reads the digest and writes static files (`index.html`, `app.js`, `style.css`, `digest.json`) to `docs/` for GitHub Pages.

## Search Plugins

Defined in `.env` as a single `SEARCH_PLUGINS` string. Semicolons separate plugin groups, pipes separate keywords within a group (ordered by priority — first term surfaces highest, last term lowest).

```
SEARCH_PLUGINS=longsight|levenshulme|gorton|manchester;xbox|dark souls|dwarf fortress|metal gear solid|game pass
```

Plugins run using spare API quota after fixed calls, round-robin based on last-run time so all plugins get fair coverage.

## API Quota Management

- Currents API allows 20 queries/day
- 3 runs/day × 2 fixed calls = 6 queries reserved for general + UK news
- Remaining 14 queries spread across plugins, with budget reserved for future fixed calls each day
- Run state tracked in `cache/run-state.json` (reset daily)

## Client Features

- **Broadsheet layout**: Newspaper-style columns with serif typography
- **Interest signals**: 👍/👎 buttons on each story mark it as read and signal your interest. Interested stories rank higher in the feed; not-interested stories get strongly downranked. Signals are stored locally (no accounts) and visible in the Recent Updates panel as your interest profile.
- **Show updated toggle**: Resurfaces read stories that have new information since you last saw them
- **Search**: Real-time filtering across headlines, summaries, and categories
- **Settings**: Font size, column count, sort order, source visibility, expand all links — all persisted locally
- **Recent Updates panel**: Dataset freshness, source list, category breakdown, interest profile, and run history — full transparency without polluting the main page
- **No dark patterns**: No unread counts, no badges, no engagement baiting

> **TODO**: The 👍/👎 icons are placeholders. They are not "like/dislike" buttons — they are algorithmic interest signals telling the system what the user finds important vs. not worth their time. Replace with more appropriate icons (e.g. bookmark/hide, or a custom "more like this"/"less like this" pair) that don't carry social-media connotations.

## Setup

### Prerequisites
- Node.js 18+
- A `.env` file with:
  ```
  CURRENTSAPI_SERVICES_KEY=your_key
  OPENROUTER_API_KEY=your_key         # or FEATHERLESS_API_KEY / OPENAI_API_KEY
  SEARCH_PLUGINS=longsight|levenshulme|gorton|manchester;xbox|dark souls|dwarf fortress|metal gear solid|game pass
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
2. Set repository secrets: `CURRENTSAPI_SERVICES_KEY`, `OPENROUTER_API_KEY` (or `FEATHERLESS_API_KEY` / `OPENAI_API_KEY`), `SEARCH_PLUGINS`
3. Enable GitHub Pages (deploy from Actions)
4. The workflow runs on push and on schedule (3x daily)

## Project Structure

```
scripts/
  fetch-news.js    # API fetching, plugins, story store
  summarise.js     # LLM clustering & summarisation
  build.js         # Static site generation
  prompts.js       # LLM system & user prompts (tweakable)
src/
  index.html       # Broadsheet layout
  style.css        # Newspaper aesthetic
  app.js           # Client-side rendering, read state, settings
cache/               # Story store, digest, run state (gitignored)
docs/                # Built output for GitHub Pages (gitignored)
```

## License

DBAD (Do Whatever You Want, Just Don't Be A Dick)
