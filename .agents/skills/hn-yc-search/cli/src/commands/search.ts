import {
  findLatestWhoIsHiring,
  fetchHNItem,
  parseHNJobComment,
  htmlFetch,
  YC_INTERNSHIPS_URL,
  parseYCInternshipsList,
  ycJobToResult,
  fetchHNJobStoryIds,
  fetchHNJobStories,
  parseHNJobStory,
  writeError,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  source: "hn" | "hn-jobs" | "yc-internships"
  query?: string
  jobage?: number // days; hn and hn-jobs only
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PAGE_SIZE = 20

function matchesQuery(r: JobResult, query: string | undefined): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    r.title.toLowerCase().includes(q) ||
    (r.company ?? "").toLowerCase().includes(q) ||
    (r.location ?? "").toLowerCase().includes(q)
  )
}

async function searchHN(opts: SearchOpts): Promise<JobResult[]> {
  const thread = await findLatestWhoIsHiring()
  const item = await fetchHNItem(thread.id)
  const results = item.children
    .map(parseHNJobComment)
    .filter((r): r is JobResult => r !== null)

  return filterByAge(results, opts.jobage).filter((r) => matchesQuery(r, opts.query))
}

function filterByAge(results: JobResult[], jobage: number | undefined): JobResult[] {
  if (jobage === undefined) return results
  const cutoff = Date.now() - jobage * 86400_000
  return results.filter((r) => (r.date ? new Date(r.date).getTime() >= cutoff : false))
}

async function searchHNJobs(opts: SearchOpts): Promise<JobResult[]> {
  const ids = await fetchHNJobStoryIds()
  const results = (await fetchHNJobStories(ids))
    .map(parseHNJobStory)
    .filter((r): r is JobResult => r !== null)
  return filterByAge(results, opts.jobage).filter((r) => matchesQuery(r, opts.query))
}

async function searchYC(opts: SearchOpts): Promise<JobResult[]> {
  const html = await htmlFetch(YC_INTERNSHIPS_URL)
  if (!html) return []
  const jobs = parseYCInternshipsList(html).map(ycJobToResult)
  return jobs.filter((r) => matchesQuery(r, opts.query))
}

function renderTable(results: JobResult[]): string {
  if (results.length === 0) return "No results."
  const rows = results.map((r) => {
    const title = r.title.slice(0, 42).padEnd(42)
    const company = (r.company || "—").slice(0, 26).padEnd(26)
    const loc = (r.location || "—").slice(0, 24).padEnd(24)
    const date = (r.date || "—").slice(0, 10)
    return `${r.id.padEnd(10)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(10) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(24) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const all =
      opts.source === "hn"
        ? await searchHN(opts)
        : opts.source === "hn-jobs"
          ? await searchHNJobs(opts)
          : await searchYC(opts)

    const start = (opts.page - 1) * PAGE_SIZE
    let page = all.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) page = page.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(page) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        page
          .map(
            (r) =>
              `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"}\n  id: ${r.id}\n  ${r.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: page.length, page: opts.page }, results: page }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
