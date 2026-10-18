---
name: free-work-search
version: 1.0.0
description: >
  Use this skill to search tech jobs and freelance missions on free-work.com's
  public tech-it vertical — France and Francophone Europe. Invoke for open
  positions, missions freelance, offres d'emploi, stages, and alternances in
  software/data/DevOps/IT roles. Trigger phrases: free-work, freework, mission
  freelance informatique, offre d'emploi tech, stage devops, alternance
  developpeur, recherche emploi IT France.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/free-work-search/cli/src/cli.ts *)
---

# free-work-search Skill

Search live job and freelance-mission listings from
[free-work.com](https://www.free-work.com/fr/tech-it)'s public `tech-it` vertical
(France / Francophone Europe). No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`. The search-results and detail pages are
both server-rendered HTML; this CLI parses that markup directly (no JSON API backs
the site — see `url-reference.md`).

## When to use this skill

- Search for tech job openings or freelance missions in France/Francophone Europe
  (software, data, DevOps, IT roles), including stages and alternances
- Filter by keyword (title, skill, city — include the city in `--query`, since the
  portal has no separate location parameter)
- Get the full description of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/free-work-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords, matched server-side. **Include the city
  here too** — there is no `--location` flag; free-work's search endpoint only
  changes its response for `query` and `page` (confirmed live).
- `--jobage <days>` — posted within N days. **Client-side only** — the portal exposes
  no server-side recency parameter, so this filters on each result's own parsed date
  after fetching. A result with no parseable date is never excluded.
- `--page <n>` — 1-indexed page. Default 1.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full posting detail

```bash
bun run .agents/skills/free-work-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`<id>` is the `id` field from `search` results (a `<category-slug>/<job-slug>` path,
e.g. `ingenieur-devops-cloud/devops-h-f-723`). You may also pass a full
`free-work.com/.../job-mission/...` URL. Returns the full description (all sections —
missions, profil recherché, environnement de travail — concatenated), plus experience
level and remote-work mode where the posting states them.

## Usage examples

```bash
# DevOps internships, table view
bun run .agents/skills/free-work-search/cli/src/cli.ts search -q "devops alternance" --format table

# Fullstack developer roles, posted in the last 14 days
bun run .agents/skills/free-work-search/cli/src/cli.ts search -q "developpeur fullstack Paris" --jobage 14 --format table

# Second page, capped at 10 results
bun run .agents/skills/free-work-search/cli/src/cli.ts search -q "alternance developpeur" --page 2 --limit 10 --format json

# Full detail for a specific posting
bun run .agents/skills/free-work-search/cli/src/cli.ts detail ingenieur-devops-cloud/devops-h-f-723 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single posting's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from free-work.com's public `tech-it` pages — no credentials required.
  `robots.txt` allows a generic user agent on the search/detail paths used here
  (checked live 2026-09-18; only `/login`, `/logout`, `/fw-deals` are disallowed).
- No server-side location, remote-mode, or recency filter exists — only `query` and
  `page` change the search response. Fold a city or "télétravail" into `--query` text
  if you want to bias results, and treat any match as approximate.
- Dates on search results are US-format (`MM/DD/YYYY`) despite the French UI —
  confirmed live, handled by the CLI's date parser.
- `id` is the `<category-slug>/<job-slug>` URL path, not a numeric ID — free-work's
  rendered markup exposes no separate numeric identifier.
- The site may rate-limit; the CLI retries 429/5xx with exponential backoff, same as
  every other portal skill in this repo.
