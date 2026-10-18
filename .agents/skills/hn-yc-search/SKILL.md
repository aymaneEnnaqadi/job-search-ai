---
name: hn-yc-search
version: 1.0.0
description: >
  Use this skill to search Hacker News's monthly "Ask HN: Who is hiring?" thread,
  the HN /jobs page (job ads YC companies post directly), and Y Combinator's
  public internships listing — startup-focused hiring sources,
  global/remote-friendly (HN threads are US-heavy but list remote and worldwide
  roles; YC's page skews US but lists relocation/remote options). Invoke for
  startup jobs, YC internships, HN hiring thread, "who is hiring this month",
  hacker news jobs, HN jobs page, YC company is hiring, y combinator internship, startup internship.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/hn-yc-search/cli/src/cli.ts *)
---

# HN + YC Search Skill

Search three startup-focused hiring sources with one CLI:

- **`--source hn`** (default) — the current month's Hacker News "Ask HN: Who is
  hiring?" thread, via **HN's own official Algolia Search API**. Not scraping — this
  is the same public API HN Search itself uses. Job posts are freeform top-level
  comments in the loose convention `Company | Role | Location | Type | ...`.
- **`--source hn-jobs`** — the job ads on `news.ycombinator.com/jobs`, which YC
  companies post directly ("Acme (YC W25) Is Hiring ..."), via **HN's official
  Firebase API** (`jobstories.json`). About 30 ads at a time; `url` is the external
  posting (where you apply) when there is one, else the HN item page.
- **`--source yc-internships`** — Y Combinator's public curated internships page.
  Structured data embedded directly in the page, no scraping heuristics needed.

Zero runtime dependencies — runs with just `bun`.

## When to use this skill

- Find what startups are hiring for this month via HN's "Who is hiring?" thread
- See which YC companies are currently advertising on HN's /jobs page
- Search Y Combinator's internship listings by role/company/location keyword
- Get the full text of a specific HN hiring post, or a specific YC internship's
  full description

## Commands

### Search

```bash
bun run .agents/skills/hn-yc-search/cli/src/cli.ts search [--source hn|hn-jobs|yc-internships] [flags]
```

Key flags:
- `--source <hn|hn-jobs|yc-internships>` — which source. Default: `hn`.
- `--query <text>` / `-q <text>` — keywords matched against title/company/location.
- `--jobage <days>` — `hn` and `hn-jobs` only: only posts from the last N days (for
  `hn`, within the current thread — this never spans multiple months). **Not supported** for
  `yc-internships` (that page exposes no absolute post dates); passing it there is a
  hard error rather than a silently-ignored filter.
- `--page <n>` — 1-indexed page (20 results/page, sliced client-side).
- `--limit <n>` / `-n <n>` — cap total results emitted.
- `--format json|table|plain` — default `json`.

### Detail

```bash
bun run .agents/skills/hn-yc-search/cli/src/cli.ts detail <id|url> [--source hn|hn-jobs|yc-internships] [--format json|plain]
```

- `--source hn`: `<id>` is the HN comment id from search results. Returns the full
  comment text.
- `--source hn-jobs`: `<id>` is the HN item id from search results. Returns the title,
  company, external posting `url`, `hnUrl`, and the ad's body text when it has one
  (most ads only link out).
- `--source yc-internships`: `<id>` is the numeric job id from search results
  (only resolvable while that job is still on the current `/internships` listing),
  or a full job URL/path (always works, including for a job that has since rotated
  off the listing). Returns the full job description, salary range, visa policy, and
  required skills.

## Usage examples

```bash
# What's hiring for DevOps this month on HN
bun run .agents/skills/hn-yc-search/cli/src/cli.ts search -q "devops" --source hn --format table

# HN posts from just the last week of the current thread
bun run .agents/skills/hn-yc-search/cli/src/cli.ts search -q "cloud" --source hn --jobage 7 --format table

# Every job ad currently on news.ycombinator.com/jobs
bun run .agents/skills/hn-yc-search/cli/src/cli.ts search --source hn-jobs --format table

# YC internships matching "fullstack"
bun run .agents/skills/hn-yc-search/cli/src/cli.ts search -q "fullstack" --source yc-internships --format table

# Full text of a specific HN hiring post
bun run .agents/skills/hn-yc-search/cli/src/cli.ts detail 49522903 --source hn --format plain

# Full description of a specific YC internship
bun run .agents/skills/hn-yc-search/cli/src/cli.ts detail 80508 --source yc-internships --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single post/job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- **HN parsing is a heuristic, not a guarantee.** The "Company \| Role \| Location \|
  Type" convention is a community norm the whoishiring bot's own instructions
  encourage, not an enforced format — many posts deviate. When a post doesn't contain
  `|` separators, the whole first line becomes `title` with `company`/`location` left
  `null` rather than guessed at.
- **HN thread scope is one month at a time.** `search --source hn` always resolves to
  the *current* thread (found via HN's `author_whoishiring` tag) — there's no flag to
  pick an older month; that would need a separate lookup via
  `search_by_date?tags=story,author_whoishiring`.
- **`hn-jobs` titles are parsed heuristically.** `company` is the text before the
  "(YC ...)" batch tag or "is hiring"; `location` is only filled from a parenthesised
  remote/onsite/hybrid qualifier, so most ads have `location: null` — read the
  external posting for that.
- **YC internships is a curated subset**, not the full `workatastartup.com` board —
  that larger board requires a logged-in candidate account and is out of scope here.
- **YC internships has no absolute post dates** — only relative "last active" text —
  so recency filtering isn't possible for that source (`--jobage` is rejected, not
  silently ignored).
- All sources are fetched with a documented User-Agent and backed off on 429/5xx like
  every other portal skill in this repo. Keep volume reasonable.
