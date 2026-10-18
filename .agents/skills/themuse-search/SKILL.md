---
name: themuse-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search The Muse's public job board —
  general and tech postings, US-heavy with global/remote coverage, including
  internships and entry-level roles. Invoke for open positions, internships, and
  hiring across sectors (software engineering, data science, IT, business, etc.),
  with real category and experience-level filters. Trigger phrases: the muse,
  themuse, internship search, entry level jobs, "jobs in the USA", software
  engineering internship.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/themuse-search/cli/src/cli.ts *)
---

# The Muse Search Skill

Search live job listings from The Muse's public jobs JSON API. No authentication, no
API key, and **zero runtime dependencies** — it runs with just `bun`. Coverage is
US-heavy (including many "Flexible / Remote" postings) with real international listings
mixed in (confirmed live: UK, Italy, France, Brazil, Singapore, etc.) — it does **not**
specifically target Morocco; use `linkedin-search` and the WebSearch fallback for that.

## Quirks confirmed live (important)

- **`category` and `level` are real, working server-side filters** (e.g.
  `category=Software Engineering&level=Internship` genuinely narrows results to real
  internship postings). Use these first.
- **`location` is a soft filter, not a strict one.** Passing `location=London, United
  Kingdom` or `location=Paris, France` narrows the reported total, but the response
  still mixes in unrelated remote and other-city postings. This CLI always
  re-verifies `--location` client-side against each job's actual location list, so
  CLI output is accurate even though the raw API isn't.
- **There is no free-text keyword search.** `query`, `q`, `keyword`, `search`, and
  `name` were all tested live and none changed the result count — the API silently
  ignores unrecognized parameters. `--query` in this CLI is a client-side filter
  applied after fetching a `category`/`level`/`location`-narrowed page.
- **Pagination is capped at page 99** (confirmed live: page 100 returns a `400
  {"error": "Value \`page\` is too high"}`). With 20 results/page that's at most
  ~1,980 reachable results per filtered query, however large the reported `total`
  is — narrow with `category`/`level`/`location` rather than trying to page deeper.

## When to use this skill

- Search internships or entry-level tech/business roles (real `level=Internship` filter)
- Search by function/category (Software Engineering, Data Science, IT, etc.)
- Get the full description of a specific posting by its numeric ID

## Commands

### Search job listings

```bash
bun run .agents/skills/themuse-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords, matched client-side (no server-side keyword search exists).
- `--location <text>` / `-l <text>` — e.g. `"Paris, France"`, `"New York, NY"`. Server pre-filter + client-side re-verification.
- `--category <text>` — real server-side filter, e.g. `"Software Engineering"`, `"Data Science"`, `"IT"`.
- `--level <text>` — real server-side filter, e.g. `"Internship"`, `"Entry Level"`, `"Mid Level"`, `"Senior Level"`.
- `--jobage <days>` — posted within N days (based on `publication_date`).
- `--page <n>` — 1-indexed page (20 results/page). **Max 99.**
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full posting detail

```bash
bun run .agents/skills/themuse-search/cli/src/cli.ts detail <numeric-id> [--format json|plain]
```

`<numeric-id>` is the `id` field from `search` results. The Muse's detail endpoint only
accepts this numeric ID (not the landing-page URL, which doesn't carry it).

## Usage examples

```bash
# Software Engineering internships anywhere
bun run .agents/skills/themuse-search/cli/src/cli.ts search --category "Software Engineering" --level "Internship" --format table

# Java roles in New York
bun run .agents/skills/themuse-search/cli/src/cli.ts search -q "java" --category "Software Engineering" -l "New York, NY" --format table

# Full detail for a specific posting
bun run .agents/skills/themuse-search/cli/src/cli.ts detail 17780767 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single posting's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from The Muse's public `api/public/jobs` — no credentials required, `robots.txt` fully permissive for this path.
- 20 postings per page; combine `--category`/`--level`/`--location` to keep the filtered set within the 99-page cap.
- Best used for USA-market DevOps/Cloud/AI-automation/fullstack internship searches; not a Morocco-specific source.
