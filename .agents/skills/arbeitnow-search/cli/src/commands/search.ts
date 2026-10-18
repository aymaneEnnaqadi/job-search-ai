import { fetchPage, toCard, matchesQuery, matchesLocation, matchesJobAge, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
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
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const remote = c.remote === null ? "—" : c.remote ? "remote" : "on-site"
    return `${title} ${company} ${loc} ${remote}`
  })
  const header =
    "TITLE".padEnd(42) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(22) + " TYPE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const raw = await fetchPage(opts.page)
    const filtered = raw.data.filter(
      (job) => matchesQuery(job, opts.query) && matchesLocation(job, opts.location) && matchesJobAge(job, opts.jobage),
    )
    let cards = filtered.map(toCard)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.remote ? "remote" : "on-site"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              page: opts.page,
              scannedRaw: raw.data.length,
              hasMorePages: Boolean(raw.links?.next),
            },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
