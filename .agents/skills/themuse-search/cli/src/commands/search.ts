import {
  jsonFetch,
  buildSearchUrl,
  toCard,
  matchesQuery,
  matchesLocation,
  matchesJobAge,
  writeError,
  MAX_PAGE,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  category?: string
  level?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 26).padEnd(26)
    const level = (c.levels[0] || "—").slice(0, 14)
    return `${title} ${company} ${loc} ${level}`
  })
  const header = "TITLE".padEnd(42) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(26) + " LEVEL"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  if (opts.page > MAX_PAGE) {
    writeError(
      `--page ${opts.page} exceeds The Muse API's own limit of ${MAX_PAGE} (confirmed live: page ${MAX_PAGE + 1} returns a 400 "page too high" error). Narrow with --category/--level/--location instead of paging further.`,
      "PAGE_TOO_HIGH",
    )
    return 1
  }
  try {
    const url = buildSearchUrl({ category: opts.category, level: opts.level, location: opts.location, page: opts.page })
    const raw = await jsonFetch(url)
    const results = raw?.results ?? []
    const filtered = results.filter(
      (job) => matchesQuery(job, opts.query) && matchesLocation(job, opts.location) && matchesJobAge(job, opts.jobage),
    )
    let cards = filtered.map(toCard)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map((c) => `${c.title}\n  ${c.company || "—"} · ${c.location || "—"}\n  id: ${c.id}\n  ${c.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: cards.length, page: opts.page, apiTotal: raw?.total ?? 0, scannedRaw: results.length },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "PAGE_TOO_HIGH") {
      writeError(`--page ${opts.page} exceeds The Muse API's own limit of ${MAX_PAGE}.`, "PAGE_TOO_HIGH")
      return 1
    }
    writeError(msg, "SEARCH_FAILED")
    return 1
  }
}
