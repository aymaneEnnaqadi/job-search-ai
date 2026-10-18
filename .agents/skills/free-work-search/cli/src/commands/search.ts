import { BASE_URL, SEARCH_PATH, htmlFetch, parseJobCards, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("query", opts.query)
  if (opts.page > 1) params.set("page", String(opts.page))
  return `${BASE_URL}${SEARCH_PATH}?${params.toString()}`
}

/** Client-side jobage filter: the portal exposes no server-side recency
 * parameter (confirmed live - only `query` and `page` change the response),
 * so this filters on each card's own parsed <time> date after fetching. */
function withinJobage(card: JobCard, days: number): boolean {
  if (!card.date) return true // unknown date: never excluded, per repo convention
  const posted = new Date(card.date).getTime()
  if (Number.isNaN(posted)) return true
  const cutoff = Date.now() - days * 86400 * 1000
  return posted >= cutoff
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 26).padEnd(26)
    const date = c.date || "—"
    return `${c.id.slice(0, 30).padEnd(30)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(30) + " " + "TITLE".padEnd(40) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(26) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    let cards = parseJobCards(html)
    if (opts.jobage !== undefined) cards = cards.filter((c) => withinJobage(c, opts.jobage!))
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: cards.length, page: opts.page }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
