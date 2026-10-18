// Data source: The Muse's public jobs JSON API. No authentication required.
// Verified live (2026-09): `category` and `level` are real server-side
// filters. `location` narrows the result count but the response still mixes
// in unrelated remote/other-city postings (verified: location=London and
// location=Paris both return several jobs with neither location) - so
// `location` is a soft server-side pre-filter here, and this CLI always
// re-verifies it client-side against each job's actual `locations` array.
// There is NO free-text keyword search param - `query`, `q`, `keyword`,
// `search`, and `name` were all tested live and every one left `total`
// unchanged at the full unfiltered count. `--query` is therefore a
// client-side filter only.

export const BASE_URL = "https://www.themuse.com/api/public/jobs"

// Verified live: page=99 succeeds, page=100 returns
// {"code":400,"error":"Value `page` is too high"}. With 20 results/page this
// caps any single filtered query at ~1980 reachable results regardless of
// how large `total` reports.
export const MAX_PAGE = 99

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; themuse-search-cli/1.0)"

export interface RawJob {
  id: number
  name: string
  contents: string | null
  company: { id: number; short_name: string; name: string } | null
  locations: Array<{ name: string }> | null
  levels: Array<{ name: string; short_name: string }> | null
  categories: Array<{ name: string }> | null
  tags?: Array<{ name: string }> | null
  publication_date: string | null
  refs: { landing_page: string } | null
  short_name: string | null
}

interface SearchResponse {
  page: number
  page_count: number
  items_per_page: number
  total: number
  results: RawJob[]
}

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on 404. Throws
 * a dedicated error for the API's documented page-too-high 400 response. */
export async function jsonFetch(url: string): Promise<SearchResponse | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
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
    if (response.status === 400) {
      const body = await response.json().catch(() => ({}) as { error?: string })
      throw new Error(body?.error === "Value `page` is too high" ? "PAGE_TOO_HIGH" : `Request failed: 400 ${body?.error ?? ""}`)
    }
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as SearchResponse
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  levels: string[]
  categories: string[]
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

export function cleanDescription(html: string | null): string | null {
  if (!html) return null
  const withBreaks = html.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim()
  return text || null
}

export function toCard(raw: RawJob): JobCard {
  return {
    id: String(raw.id),
    title: raw.name,
    company: raw.company?.name ?? null,
    location: (raw.locations ?? []).map((l) => l.name).join(", ") || null,
    date: raw.publication_date,
    url: raw.refs?.landing_page ?? `https://www.themuse.com/jobs/${raw.company?.short_name ?? ""}/${raw.short_name ?? raw.id}`,
    levels: (raw.levels ?? []).map((l) => l.name),
    categories: (raw.categories ?? []).map((c) => c.name),
  }
}

function haystack(raw: RawJob): string {
  return [
    raw.name,
    raw.company?.name,
    cleanDescription(raw.contents),
    ...(raw.levels ?? []).map((l) => l.name),
    ...(raw.categories ?? []).map((c) => c.name),
    ...(raw.tags ?? []).map((t) => t.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function matchesQuery(raw: RawJob, query: string | undefined): boolean {
  if (!query) return true
  return haystack(raw).includes(query.toLowerCase())
}

/** Re-verify location client-side: the API's own `location` param narrows the
 * count but still mixes in unrelated remote/other-city postings (verified
 * live), so a caller who passed --location gets only genuinely matching jobs. */
export function matchesLocation(raw: RawJob, location: string | undefined): boolean {
  if (!location) return true
  const needle = location.toLowerCase()
  return (raw.locations ?? []).some((l) => l.name.toLowerCase().includes(needle))
}

export function matchesJobAge(raw: RawJob, days: number | undefined): boolean {
  if (days === undefined) return true
  if (!raw.publication_date) return false
  const ageDays = (Date.now() - new Date(raw.publication_date).getTime()) / 86_400_000
  return ageDays <= days
}

export function buildSearchUrl(opts: {
  category?: string
  level?: string
  location?: string
  page: number
}): string {
  const params = new URLSearchParams()
  if (opts.category) params.set("category", opts.category)
  if (opts.level) params.set("level", opts.level)
  if (opts.location) params.set("location", opts.location)
  params.set("page", String(opts.page))
  return `${BASE_URL}?${params.toString()}`
}
