---
name: arbeitnow-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search Arbeitnow's public job board —
  general and tech postings leaning EU/DACH (Germany, Austria, Switzerland), with
  some France/UK/other EU coverage. Invoke for open positions, internships,
  Werkstudent/Praktikant roles, and general hiring across sectors in that region.
  Trigger phrases: arbeitnow, DACH jobs, Germany jobs, Stellenangebote, Jobsuche,
  Praktikum, Werkstudent, Ausbildung, "jobs in Germany/Austria/Switzerland".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/arbeitnow-search/cli/src/cli.ts *)
---

# Arbeitnow Search Skill

Search live job listings from Arbeitnow's public job-board JSON API. No authentication,
no API key, and **zero runtime dependencies** — it runs with just `bun`. Coverage leans
EU/DACH (Germany, Austria, Switzerland) with some France, UK, and other EU postings; it
does **not** cover Morocco, Spain, Italy, or the USA — use `linkedin-search` and the
WebSearch fallback in `job-scraper/search-queries.md` for those markets.

## Important quirk: no server-side search

Arbeitnow's API **ignores every query parameter except `page`** — verified live: passing
`search=`, `q=`, `tags=`, or `location=` all return the identical raw 250-job page. This
CLI fetches one raw page per call and filters `--query`/`--location`/`--jobage`
**client-side**. A single call only inspects the postings on that one page — pass
increasing `--page` values (jobs are newest-first) for broader coverage, and don't expect
one call to search the entire board.

## When to use this skill

- Search for job/internship openings in Germany, Austria, Switzerland (and to a lesser
  extent France/UK/EU), including Werkstudent/Praktikant (working-student/intern) roles
- Filter by keyword, location substring, or posting recency
- Get the full description of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords, matched client-side against title, company, tags, job types, and description.
- `--location <text>` / `-l <text>` — location substring (e.g. `"Paris"`, `"Munich"`), matched client-side.
- `--jobage <days>` — posted within N days (based on `created_at`). Omit for all postings on the fetched page.
- `--page <n>` — 1-indexed **raw API page** (250 postings/page, newest first). Default 1. Increase this to see older/more postings, since there is no real search to narrow the feed server-side.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full posting detail

```bash
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts detail <slug|url> [--page <n>] [--format json|plain]
```

`<slug|url>` is the `id` from `search` results, or a full `arbeitnow.com/jobs/...` URL.
There is no by-id lookup endpoint, so `detail` scans raw pages for a matching slug —
pass `--page <n>` with the same page number `search`'s `meta.page` reported to resolve
in a single request; without it, `detail` scans forward from page 1 (up to 20 pages).

## Usage examples

```bash
# DevOps-tagged postings on the first raw page
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts search -q "devops" --format table

# Internship-style postings in Paris, posted in the last 14 days
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts search -q "praktikant" -l "Paris" --jobage 14 --format table

# Broader coverage: scan a later raw page
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts search -q "intern" --page 2 --format table

# Full detail for a specific posting
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts detail account-lead-influencer-marketing-brand-strategy-munich-492454 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing slugs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single posting's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from Arbeitnow's public `job-board-api` — no credentials required, `robots.txt` fully permissive.
- 250 postings per raw page; postings are ordered newest-first by `created_at`.
- `remote: false` in a result means the posting is on-site — useful for an on-site-only
  candidate, but note the board is general-purpose, not internship-specific, so filter by
  `job_types` (`Intern`, `Student`, `Trainee`) via `--query` keywords like "praktikant",
  "werkstudent", or "intern" for internship-focused results.
- A small number of postings carry a `created_at` timestamp in the future relative to
  fetch time (observed live) — the CLI treats those as freshly posted rather than
  excluding them from `--jobage` filtering.
