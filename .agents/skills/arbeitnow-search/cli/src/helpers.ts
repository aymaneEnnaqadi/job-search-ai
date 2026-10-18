// Data source: Arbeitnow's public job-board JSON API. No authentication
// required. The API ignores every query parameter except `page` (verified
// live 2026-09) - it always returns the same raw 250-job page regardless of
// any search/query/location param passed. All filtering here is therefore
// done client-side after fetching one raw page.

export const BASE_URL = "https://www.arbeitnow.com/api/job-board-api"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; arbeitnow-search-cli/1.0)"

export interface RawJob {
  slug: string
  company_name: string | null
  title: string
  description: string | null
  remote: boolean | null
  url: string
  tags: string[] | null
  job_types: string[] | null
  location: string | null
  created_at: number | null
}

interface RawResponse {
  data: RawJob[]
  links?: { first?: string | null; last?: string | null; prev?: string | null; next?: string | null }
  meta?: Record<string, unknown>
}

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch(url: string): Promise<RawResponse | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
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
    return (await response.json()) as RawResponse
  }
  throw new Error("Request failed after max retries")
}

/** Fetch one raw page (1-indexed) of the job-board API. */
export async function fetchPage(page: number): Promise<RawResponse> {
  const result = await jsonFetch(`${BASE_URL}?page=${page}`)
  return result ?? { data: [] }
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  remote: boolean | null
  tags: string[]
  jobTypes: string[]
}

export interface JobDetail extends JobCard {
  description: string | null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Convert the API's HTML description into readable plain text with paragraph breaks. */
export function cleanDescription(html: string | null): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim()
  return text || null
}

/** created_at is unix seconds. A handful of live postings carry a value in
 * the future relative to fetch time (observed 2026-09) - treat those as
 * "fresh" (age 0) rather than excluding them from a --jobage window. */
function ageDays(createdAt: number | null): number {
  if (createdAt === null) return Number.POSITIVE_INFINITY
  const days = (Date.now() / 1000 - createdAt) / 86400
  return days < 0 ? 0 : days
}

export function toCard(raw: RawJob): JobCard {
  return {
    id: raw.slug,
    title: raw.title,
    company: raw.company_name || null,
    location: raw.location || null,
    date: raw.created_at ? new Date(raw.created_at * 1000).toISOString() : null,
    url: raw.url,
    remote: raw.remote ?? null,
    tags: raw.tags ?? [],
    jobTypes: raw.job_types ?? [],
  }
}

function haystack(raw: RawJob): string {
  return [raw.title, raw.company_name, ...(raw.tags ?? []), ...(raw.job_types ?? []), cleanDescription(raw.description)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function matchesQuery(raw: RawJob, query: string | undefined): boolean {
  if (!query) return true
  return haystack(raw).includes(query.toLowerCase())
}

export function matchesLocation(raw: RawJob, location: string | undefined): boolean {
  if (!location) return true
  return (raw.location || "").toLowerCase().includes(location.toLowerCase())
}

export function matchesJobAge(raw: RawJob, days: number | undefined): boolean {
  if (days === undefined) return true
  return ageDays(raw.created_at) <= days
}

/** Accept a bare slug or a full arbeitnow.com job URL and return the slug. */
export function slugFromInput(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "")
  const segments = trimmed.split("/")
  return segments[segments.length - 1] || trimmed
}
