import { BASE_URL, jsonFetch, toCard, cleanDescription, writeError, type JobDetail, type RawJob } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a bare numeric job ID or a themuse.com job landing-page URL (the ID
 * is not present in the URL slug, so a URL cannot be resolved to detail -
 * only a bare ID works against the /jobs/<id> endpoint). */
function normalizeId(input: string): string | null {
  const bare = input.trim().match(/^\d+$/)
  return bare ? bare[0] : null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(
      `Could not parse a numeric job ID from "${opts.id}". The Muse's detail endpoint only accepts the numeric "id" field from search results (landing-page URLs don't carry it) - copy the "id" value from a search result.`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const raw = (await jsonFetch(`${BASE_URL}/${id}`)) as unknown as RawJob | null
    if (!raw) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job: JobDetail = { ...toCard(raw), description: cleanDescription(raw.contents) }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        job.levels.length ? `Level: ${job.levels.join(", ")}` : "",
        job.categories.length ? `Category: ${job.categories.join(", ")}` : "",
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
