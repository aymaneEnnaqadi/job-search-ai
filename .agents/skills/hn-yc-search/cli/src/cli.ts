#!/usr/bin/env bun
// Self-contained CLI for two startup-focused hiring sources:
//   --source hn             Hacker News "Ask HN: Who is hiring?" monthly thread,
//                            via HN's own official Algolia Search API — not
//                            scraping, this is HN's sanctioned public API.
//   --source hn-jobs        Hacker News /jobs page (YC company job ads), via
//                            HN's official Firebase API.
//   --source yc-internships Y Combinator's public curated internships page.
// No external CLI framework, zero runtime dependencies beyond `bun`.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
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

const HELP = `hn-yc-cli — search Hacker News "Who is hiring?", HN /jobs, and Y Combinator internships

USAGE
  bun run src/cli.ts search [--source hn|hn-jobs|yc-internships] [flags]
  bun run src/cli.ts detail <id|url> [--source hn|hn-jobs|yc-internships] [--format json|plain]

SEARCH FLAGS
  --source <hn|hn-jobs|yc-internships>
                                Which source to search. Default: hn.
                                  hn       monthly "Who is hiring?" thread
                                  hn-jobs  news.ycombinator.com/jobs (YC ads)
  --query, -q <text>            Keywords (title, company, location, skill).
  --jobage <days>                hn / hn-jobs: only posts from the last N days.
                                  Not supported for yc-internships (no absolute
                                  post dates are exposed by that page) — passing
                                  it with --source yc-internships is an error
                                  rather than a silently-ignored filter.
  --page <n>                    1-indexed page (20 results/page). Default 1.
  --limit, -n <n>                Cap results emitted (client-side).
  --format <fmt>                 json (default) | table | plain.

DETAIL
  <id|url> for --source hn is the HN comment id from search results.
  <id> for --source hn-jobs is the HN item id from search results.
  <id|url> for --source yc-internships is the numeric job id from search
  results (only resolvable while it's still on the current /internships
  listing) or a full job URL/path, which always works.

EXAMPLES
  bun run src/cli.ts search -q "devops" --source hn --format table
  bun run src/cli.ts search -q "devops" --source hn --jobage 7 --format table
  bun run src/cli.ts search --source hn-jobs --format table
  bun run src/cli.ts search -q "fullstack" --source yc-internships --format table
  bun run src/cli.ts detail 49522903 --source hn --format plain
  bun run src/cli.ts detail 80508 --source yc-internships --format plain

Data sources: HN's official Algolia Search API (hn.algolia.com), HN's official
Firebase API (hacker-news.firebaseio.com), and Y Combinator's
public internships page (ycombinator.com/internships). Keep volume low and reasonable.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["source", "query", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["source", "format", "help", "h"]),
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
      writeErr(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
        "UNKNOWN_FLAG",
      )
      return 1
    }
  }

  const source = typeof flags.source === "string" ? flags.source : "hn"
  if (source !== "hn" && source !== "hn-jobs" && source !== "yc-internships") {
    writeErr(`--source must be "hn", "hn-jobs" or "yc-internships", got "${source}"`, "BAD_SOURCE")
    return 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = typeof raw === "string" ? Number(raw.trim()) : NaN
      if (!Number.isInteger(val) || val < 1) {
        writeErr(`--${name} must be a whole number of at least 1, got "${raw}"`, "BAD_ARG")
        return null
      }
      return val
    }

    let jobage: number | undefined
    if (flags.jobage !== undefined) {
      if (source === "yc-internships") {
        writeErr(
          "--jobage is not supported for --source yc-internships (that page exposes no absolute post dates) - omit it rather than have it silently ignored",
          "UNSUPPORTED_FLAG",
        )
        return 1
      }
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      jobage = v
    }

    let page = 1
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      page = v
    }

    let limit: number | undefined
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      limit = v
    }

    const opts: SearchOpts = {
      source,
      query: typeof flags.query === "string" ? flags.query : undefined,
      jobage,
      page,
      limit,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      writeErr("detail requires an <id|url>", "NO_ID")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      source,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  writeErr(`Unknown command "${cmd}"`, "BAD_CMD")
  return 1
}

function writeErr(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    writeErr(e instanceof Error ? e.message : String(e), "INTERNAL_ERROR")
    process.exit(1)
  })
