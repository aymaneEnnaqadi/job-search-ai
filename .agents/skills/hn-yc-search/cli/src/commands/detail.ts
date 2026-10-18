import {
  fetchHNItem,
  hnCommentText,
  HN_ITEM_URL,
  fetchHNJobStory,
  parseHNJobStory,
  stripTags,
  decodeHtmlEntities,
  htmlFetch,
  YC_INTERNSHIPS_URL,
  YC_BASE,
  parseYCInternshipsList,
  parseYCJobDetail,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  source: "hn" | "hn-jobs" | "yc-internships"
  format: "json" | "plain"
}

async function detailHN(id: string) {
  const item = await fetchHNItem(id)
  return {
    id: String(item.id),
    author: item.author,
    date: item.created_at,
    url: `${HN_ITEM_URL}${item.id}`,
    text: hnCommentText(item),
  }
}

/** `id` is the HN item id of a job ad from `search --source hn-jobs`. */
async function detailHNJob(id: string) {
  const item = await fetchHNJobStory(id)
  const job = parseHNJobStory(item)
  if (!item || !job) throw new Error(`HN item ${id} is not a live job ad`)
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    author: item.by ?? null,
    date: job.date,
    url: job.url,
    hnUrl: `${HN_ITEM_URL}${item.id}`,
    text: item.text ? decodeHtmlEntities(stripTags(item.text)) : null,
  }
}

/**
 * `id` may be a numeric YC job id (looked up against the current
 * /internships listing to find its URL) or a full job-detail URL/path
 * directly. Numeric-id lookup only works for jobs currently listed on the
 * curated /internships page — a job that has rotated off is unresolvable by
 * bare id, which is a real limitation of this source, not a bug.
 */
async function detailYC(id: string) {
  let jobUrl: string
  if (/^https?:\/\//.test(id) || id.startsWith("/companies/")) {
    jobUrl = id.startsWith("http") ? id : `${YC_BASE}${id}`
  } else {
    const listHtml = await htmlFetch(YC_INTERNSHIPS_URL)
    if (!listHtml) throw new Error("Could not fetch the YC internships listing to resolve this id")
    const jobs = parseYCInternshipsList(listHtml)
    const match = jobs.find((j) => String(j.id) === id)
    if (!match) {
      throw new Error(
        `Job id ${id} is not on the current /internships listing (only currently-listed jobs are resolvable by id — pass the full job URL instead for one that has rotated off)`,
      )
    }
    jobUrl = match.url.startsWith("http") ? match.url : `${YC_BASE}${match.url}`
  }

  const html = await htmlFetch(jobUrl)
  if (!html) throw new Error(`Could not fetch job detail page: ${jobUrl}`)
  const job = parseYCJobDetail(html)
  return {
    id: String(job.id),
    title: job.title,
    company: job.companyName,
    companyOneLiner: job.companyOneLiner ?? null,
    location: job.location,
    type: job.type,
    salaryRange: job.salaryRange ?? null,
    visa: job.visa ?? null,
    skills: job.skills ?? [],
    url: jobUrl,
    description: job.description ?? null,
  }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const result =
      opts.source === "hn"
        ? await detailHN(opts.id)
        : opts.source === "hn-jobs"
          ? await detailHNJob(opts.id)
          : await detailYC(opts.id)

    if (opts.format === "plain") {
      if ("hnUrl" in result) {
        process.stdout.write(
          `${result.title}\n${result.company || "—"} · ${result.location || "—"} · ${result.date}\n${result.url}\n${result.hnUrl}\n\n${result.text || ""}\n`,
        )
      } else if ("text" in result) {
        process.stdout.write(`${result.url}\n${result.author || "—"} · ${result.date}\n\n${result.text}\n`)
      } else {
        process.stdout.write(
          `${result.title}\n${result.company} · ${result.location || "—"}\n${result.url}\n\n${result.description || ""}\n`,
        )
      }
    } else {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
