# hn-yc-cli

CLI for two startup-focused hiring sources:

- **`--source hn`** — Hacker News "Ask HN: Who is hiring?" monthly thread, via HN's own
  official Algolia Search API (`hn.algolia.com/api/v1`). Not scraping: this is HN's
  sanctioned public API for its own content. Job posts are freeform top-level comments,
  loosely following the convention `Company | Role | Location | Type | ...`.
- **`--source yc-internships`** — Y Combinator's public curated internships page
  (`ycombinator.com/internships`). Structured JSON is embedded directly in the page's
  initial HTML (a `data-page="..."` attribute), no separate API call needed.

Zero runtime dependencies — just `bun` + `fetch` + regex/JSON parsing.

## Usage

```bash
bun install
bun run src/cli.ts search --source hn -q "devops" --format table
bun run src/cli.ts search --source yc-internships -q "fullstack" --format table
bun run src/cli.ts detail 49522903 --source hn --format plain
bun run src/cli.ts detail 80508 --source yc-internships --format plain
```

## Tests

```bash
bun test --timeout 30000   # live smoke tests, network required
bun run typecheck
```
