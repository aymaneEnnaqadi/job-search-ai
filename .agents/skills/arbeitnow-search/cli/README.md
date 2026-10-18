# arbeitnow-cli

CLI for searching jobs on Arbeitnow's public job-board JSON API — general and tech
postings, leaning EU/DACH (Germany, Austria, Switzerland) with some France/UK/other EU.

**Data source**: `arbeitnow.com/api/job-board-api` (paginated JSON dump, 250 postings/page).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Important quirk**: the API ignores every query parameter except `page` - it always
> returns the same raw page of postings regardless of any search/filter param. This CLI
> fetches one raw page and filters `--query`/`--location`/`--jobage` **client-side**. See
> `../url-reference.md` for details and how to get broader coverage via `--page`.

## Installation

```bash
cd .agents/skills/arbeitnow-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Filter one raw page of postings by query/location/jobage |
| `detail` | Fetch full detail for a single posting by slug or URL |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# DevOps-tagged postings on the first raw page
bun run src/cli.ts search -q "devops" --format table

# Internship-style postings in Paris, posted in the last 14 days
bun run src/cli.ts search -q "praktikant" -l "Paris" --jobage 14 --format table

# Broader coverage: scan a later raw page too
bun run src/cli.ts search -q "intern" --page 2 --format table

# Full detail for one posting
bun run src/cli.ts detail account-lead-influencer-marketing-brand-strategy-munich-492454 --format plain
```

See `../SKILL.md` for the full flag reference and portal notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords, matched client-side against title/company/tags/job types/description. |
| `--location` | `-l` | Location substring, matched client-side. |
| `--jobage` | | Posted within N days (based on `created_at`). |
| `--page` | | 1-indexed **raw API page** (250 postings/page, newest first). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
