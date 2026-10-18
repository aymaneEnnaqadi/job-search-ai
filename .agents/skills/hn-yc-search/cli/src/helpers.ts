// Three data sources, all public and unauthenticated:
//
// 1. Hacker News "Who is hiring?" threads, via HN's own official Algolia
//    Search API (hn.algolia.com/api/v1) — not scraping, this is HN's
//    sanctioned public API. Each monthly thread is a story authored by the
//    "whoishiring" bot; job posts are its top-level comments, freeform text
//    in the loose convention "Company | Role | Location | Type | ...".
// 2. Y Combinator's public internships listing (ycombinator.com/internships),
//    a curated page (not the full workatastartup.com board) that embeds its
//    job data as JSON in a `data-page="..."` attribute on the page's root
//    <div> (a Rails/React "props" blob). Individual job detail pages
//    (ycombinator.com/companies/<slug>/jobs/<id>) embed the same pattern
//    with a fuller `description` field.
// 3. Hacker News /jobs page, via HN's official Firebase API
//    (hacker-news.firebaseio.com/v0) — `jobstories.json` lists the ids of the
//    job ads YC companies post directly (not the monthly thread), and each id
//    resolves to an item with `type: "job"`, a title like
//    "Acme (YC W25) Is Hiring ...", and usually an external `url`.

export const ALGOLIA_BASE = "https://hn.algolia.com/api/v1"
export const HN_ITEM_URL = "https://news.ycombinator.com/item?id="
export const YC_INTERNSHIPS_URL = "https://www.ycombinator.com/internships"
export const YC_BASE = "https://www.ycombinator.com"
export const HN_FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; hn-yc-search-cli/1.0)"

/** Fetch with exponential backoff on 429/5xx. Returns null on a 404. */
async function fetchWithBackoff(url: string, accept: string): Promise<string | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: accept,
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export async function jsonFetch<T = unknown>(url: string): Promise<T | null> {
  const text = await fetchWithBackoff(url, "application/json")
  if (text === null) return null
  return JSON.parse(text) as T
}

export async function htmlFetch(url: string): Promise<string | null> {
  return fetchWithBackoff(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

export function stripTags(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html)).replace(/\s+/g, " ").trim()
}

export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

// ---------------------------------------------------------------------------
// Hacker News "Who is hiring?"
// ---------------------------------------------------------------------------

interface AlgoliaSearchHit {
  objectID: string
  title: string
  created_at: string
}

interface HNItem {
  id: number
  author: string | null
  text: string | null
  created_at: string
  dead?: boolean
  deleted?: boolean
  children: HNItem[]
}

/** Find the most recent "Ask HN: Who is hiring?" thread via the whoishiring bot author filter. */
export async function findLatestWhoIsHiring(): Promise<{ id: string; title: string; created_at: string }> {
  const url = `${ALGOLIA_BASE}/search_by_date?tags=story,author_whoishiring&hitsPerPage=10`
  const data = await jsonFetch<{ hits: AlgoliaSearchHit[] }>(url)
  const hit = data?.hits.find((h) => /who is hiring/i.test(h.title))
  if (!hit) throw new Error("Could not find a current 'Who is hiring?' thread via the Algolia HN API")
  return { id: hit.objectID, title: hit.title, created_at: hit.created_at }
}

/** Fetch a thread (or comment) with all its children, via HN's official Algolia items API. */
export async function fetchHNItem(id: string): Promise<HNItem> {
  const data = await jsonFetch<HNItem>(`${ALGOLIA_BASE}/items/${id}`)
  if (!data) throw new Error(`HN item ${id} not found`)
  return data
}

/**
 * Parse one top-level "Who is hiring?" comment into a job-shaped result.
 * Posts loosely follow the convention "Company | Role | Location | Type | ...";
 * we split the first line on "|" and take a best-effort guess at which
 * segment is which. Returns null for deleted/dead/empty comments.
 */
export function parseHNJobComment(child: HNItem): JobResult | null {
  if (child.dead || child.deleted || !child.text || !child.author) return null

  const plain = clean(child.text)
  const firstLine = plain.split("\n")[0]!.trim()
  const parts = firstLine.split("|").map((p) => p.trim()).filter(Boolean)

  let company: string | null = null
  let title = firstLine
  let location: string | null = null

  if (parts.length >= 2) {
    company = parts[0]!
    title = parts.slice(1).join(" | ")
    location =
      parts.find((p) => /remote|onsite|hybrid|visa|,\s*[A-Z]{2}\b/i.test(p)) ?? null
  }

  return {
    id: String(child.id),
    title: title.slice(0, 300),
    company,
    location,
    date: child.created_at,
    url: `${HN_ITEM_URL}${child.id}`,
  }
}

/** Full plain-text body of a single comment (used by `detail`). */
export function hnCommentText(item: HNItem): string {
  return item.text ? clean(item.text) : ""
}

// ---------------------------------------------------------------------------
// Hacker News /jobs (YC company job ads)
// ---------------------------------------------------------------------------

export interface HNJobStory {
  id: number
  by?: string
  time: number // unix seconds
  title?: string
  url?: string
  text?: string
  type: string
  dead?: boolean
  deleted?: boolean
}

/** Ids of the job ads currently on news.ycombinator.com/jobs, newest first. */
export async function fetchHNJobStoryIds(): Promise<number[]> {
  const ids = await jsonFetch<number[]>(`${HN_FIREBASE_BASE}/jobstories.json`)
  if (!ids) throw new Error("Could not fetch jobstories.json from the HN Firebase API")
  return ids
}

export async function fetchHNJobStory(id: string | number): Promise<HNJobStory | null> {
  return jsonFetch<HNJobStory>(`${HN_FIREBASE_BASE}/item/${id}.json`)
}

/** Fetch many items with a small concurrency cap, keeping the input order. */
export async function fetchHNJobStories(ids: number[], concurrency = 8): Promise<(HNJobStory | null)[]> {
  const out: (HNJobStory | null)[] = new Array(ids.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const i = next++
      out[i] = await fetchHNJobStory(ids[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker))
  return out
}

/**
 * Parse one HN job ad into a job-shaped result. Titles follow the loose
 * convention "Company (YC S20) Is Hiring <role> [(<location>)]": the company
 * is whatever precedes the "(YC ...)" batch tag or "is hiring", and a
 * location is only filled in when a parenthesised remote/onsite/hybrid
 * qualifier is present. `url` is the external posting when there is one
 * (that is where you apply), else the HN item page.
 */
export function parseHNJobStory(item: HNJobStory | null): JobResult | null {
  if (!item || item.dead || item.deleted || item.type !== "job" || !item.title) return null

  const title = decodeHtmlEntities(item.title).trim()
  const company =
    title.match(/^(.+?)\s*\(YC [A-Z]+\d{2}\)/i)?.[1]?.trim() ??
    title.match(/^(.+?)\s+is hiring\b/i)?.[1]?.trim() ??
    null
  const location = title.match(/\(([^)]*\b(?:remote|onsite|on-site|hybrid)\b[^)]*)\)/i)?.[1]?.trim() ?? null

  return {
    id: String(item.id),
    title: title.slice(0, 300),
    company,
    location,
    date: new Date(item.time * 1000).toISOString(),
    url: item.url || `${HN_ITEM_URL}${item.id}`,
  }
}

// ---------------------------------------------------------------------------
// Y Combinator internships
// ---------------------------------------------------------------------------

export interface YCJob {
  id: number
  title: string
  url: string
  location: string | null
  type: string | null
  role: string | null
  roleSpecificType: string | null
  prettyRole: string | null
  salaryRange: string | null
  minSchoolYear: string | null
  visa: string | null
  skills: string[]
  companyName: string
  companyBatchName: string | null
  companyOneLiner: string | null
  companyUrl: string | null
  description?: string
}

/**
 * Extract the `data-page="..."` React/Rails props blob from a YC page.
 * The attribute value HTML-escapes every literal quote inside it (&quot;),
 * so the first unescaped `"` after the opening one is always the true
 * closing delimiter — no HTML parser needed.
 */
export function extractDataPage<T = unknown>(html: string): T {
  const m = html.match(/data-page="([^"]*)"/)
  if (!m) throw new Error("Could not find the data-page JSON blob on the page")
  return JSON.parse(decodeHtmlEntities(m[1]!)) as T
}

export function parseYCInternshipsList(html: string): YCJob[] {
  const data = extractDataPage<{ props: { jobPostings: YCJob[] } }>(html)
  return data.props.jobPostings ?? []
}

export function ycJobToResult(job: YCJob): JobResult {
  return {
    id: String(job.id),
    title: job.title,
    company: job.companyName,
    location: job.location,
    date: null, // YC only exposes relative age ("about 1 year"), not an absolute date
    url: job.url.startsWith("http") ? job.url : `${YC_BASE}${job.url}`,
  }
}

export function parseYCJobDetail(html: string): YCJob {
  const data = extractDataPage<{ props: { job: YCJob } }>(html)
  return data.props.job
}
