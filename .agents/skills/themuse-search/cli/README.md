# themuse-cli

CLI for searching jobs on The Muse's public jobs JSON API — general and tech postings,
US-heavy with global coverage (internships, entry-level through senior).

**Data source**: `themuse.com/api/public/jobs` (paginated JSON, 20 postings/page).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Quirks confirmed live**:
> - `category` and `level` are real server-side filters.
> - `location` narrows the count but the API still mixes in unrelated remote/other-city
>   jobs, so this CLI re-verifies `--location` client-side against each job's actual
>   locations.
> - There is **no free-text keyword search** param — `--query` is a client-side filter only.
> - Pagination is capped at **page 99** — page 100 returns a documented `400 "Value page is too high"`.
>   Narrow with `--category`/`--level`/`--location` rather than paging deep.

## Installation

```bash
cd .agents/skills/themuse-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Filter postings by category/level/location (server) plus query/jobage (client) |
| `detail` | Fetch full detail for a single posting by its numeric ID |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Software Engineering internships
bun run src/cli.ts search --category "Software Engineering" --level "Internship" --format table

# Java roles in New York
bun run src/cli.ts search -q "java" --category "Software Engineering" -l "New York, NY" --format table

# Full detail for one posting
bun run src/cli.ts detail 17780767 --format plain
```

See `../SKILL.md` for the full flag reference and portal notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords, matched client-side (no server-side keyword search exists). |
| `--location` | `-l` | Location string; server pre-filter + client-side re-verification. |
| `--category` | | Real server-side filter (e.g. `"Software Engineering"`). |
| `--level` | | Real server-side filter (e.g. `"Internship"`, `"Entry Level"`). |
| `--jobage` | | Posted within N days (based on `publication_date`). |
| `--page` | | 1-indexed page (20 results/page). **Max 99** — the API's own hard limit. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
