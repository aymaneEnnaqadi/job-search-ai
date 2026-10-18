#!/usr/bin/env bun
// Self-contained CLI for searching jobs on The Muse's public jobs JSON API
// (general + tech, US-heavy with global coverage). No external CLI
// framework, so it runs anywhere `bun` is available with zero install
// beyond the repo clone.
//
// `category` and `level` are real server-side filters; `location` narrows
// results but the API still mixes in unrelated remote/other-city postings,
// so this CLI re-verifies --location client-side. There is no free-text
// keyword search param - --query filters client-side. The API caps
// pagination at page 99 (page 100 returns a documented 400 error). See
// ../url-reference.md for details.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `themuse-cli — search jobs on The Muse (general + tech, US-heavy with global coverage)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <numeric-id> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords. Matched CLIENT-SIDE (the API has no keyword search) against
                          title, company, description, levels, categories, tags.
  --location, -l <text>   Location, e.g. "Paris, France", "London, United Kingdom", "New York, NY".
                          Sent to the API as a soft pre-filter AND re-verified client-side (the API
                          alone still mixes in unrelated remote/other-city jobs).
  --category <text>       Real server-side filter, e.g. "Software Engineering", "Data Science", "IT".
  --level <text>          Real server-side filter, e.g. "Internship", "Entry Level", "Mid Level", "Senior Level".
  --jobage <days>         Posted within N days (based on publication_date). Default: all.
  --page <n>              1-indexed page (20 results/page). Max 99 (API's own hard limit). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search --category "Software Engineering" --level "Internship" --format table
  bun run src/cli.ts search -q "java" --category "Software Engineering" -l "New York, NY" --format table
  bun run src/cli.ts detail 17780767 --format plain

No authentication required. Combine --category/--level to narrow before paging - the API
caps pagination at page 99 regardless of how large the reported total is.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "category", "level", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
    const val = typeof raw === "string" ? Number(raw.trim()) : NaN
    if (!Number.isInteger(val) || val < 1) {
      process.stderr.write(
        JSON.stringify({ error: `--${name} must be a whole number of at least 1, got "${raw}"`, code: "BAD_ARG" }) + "\n",
      )
      return null
    }
    return val
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      category: typeof flags.category === "string" ? flags.category : undefined,
      level: typeof flags.level === "string" ? flags.level : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires a numeric <id>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"] }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
