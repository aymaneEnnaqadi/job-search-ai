import { BASE_URL, DETAIL_PREFIX, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a bare "category-slug/job-slug" id or a full free-work detail URL. */
export function normalizeId(input: string): string | null {
  const urlMatch = input.match(/\/job-mission\/([^"?#]+)/)
  if (urlMatch) return urlMatch[1].replace(/\/$/, "")
  const bare = input.match(/^[a-z0-9-]+\/[a-z0-9-]+$/i)
  if (bare) return input
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(
      `Could not parse a job id from "${opts.id}" - expected "category-slug/job-slug" (from a search result's id) or a full free-work.com/.../job-mission/... URL`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(`${BASE_URL}${DETAIL_PREFIX}${id}`)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.experienceLevel ? `Experience: ${job.experienceLevel}` : "",
        job.remote ? `Remote: ${job.remote}` : "",
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
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
