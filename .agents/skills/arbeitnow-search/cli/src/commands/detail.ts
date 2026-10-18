import { fetchPage, toCard, cleanDescription, slugFromInput, writeError, type JobDetail } from "../helpers.js"

export interface DetailOpts {
  id: string
  page?: number
  format: "json" | "plain"
}

// There is no by-slug lookup endpoint - the API only serves raw paginated
// dumps. Postings are ordered newest-first, so a scan starting near where
// `search` found the job (pass --page with the same value search reported
// in meta.page) resolves in a single request. Without a hint we scan
// forward from page 1 up to this cap before giving up.
const MAX_SCAN_PAGES = 20

export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = slugFromInput(opts.id)
  const startPage = opts.page ?? 1

  try {
    for (let page = startPage; page < startPage + MAX_SCAN_PAGES; page++) {
      const raw = await fetchPage(page)
      if (raw.data.length === 0) break // reached the end of the feed
      const match = raw.data.find((job) => job.slug === slug)
      if (match) {
        const job: JobDetail = { ...toCard(match), description: cleanDescription(match.description) }
        if (opts.format === "plain") {
          const lines = [
            job.title,
            `${job.company || "—"} · ${job.location || "—"} · ${job.remote ? "remote" : "on-site"}`,
            job.tags.length ? `Tags: ${job.tags.join(", ")}` : "",
            job.jobTypes.length ? `Type: ${job.jobTypes.join(", ")}` : "",
            "",
            job.description || "(no description)",
            "",
            `URL: ${job.url}`,
          ].filter((l) => l !== "")
          process.stdout.write(lines.join("\n") + "\n")
        } else {
          process.stdout.write(JSON.stringify(job, null, 2) + "\n")
        }
        return 0
      }
    }
    writeError(
      `Job "${slug}" not found within ${MAX_SCAN_PAGES} pages starting at page ${startPage}. Pass --page <n> with the page number 'search' reported in meta.page to narrow the scan.`,
      "NOT_FOUND",
    )
    return 1
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
