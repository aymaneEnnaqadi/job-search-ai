// Data source: free-work.com's public "tech-it" jobs vertical (France/Francophone
// Europe tech & freelance-mission board). No authentication required. The search
// results page and the detail page are both server-side rendered by Nuxt straight
// into the HTML response (confirmed live: no XHR/JSON API backs the listings, and
// the __NUXT_DATA__ hydration payload is a devalue-flattened array that is not
// worth decoding when the same data already sits in plain, parseable HTML). We
// parse both pages with regex against that server-rendered markup.

export const BASE_URL = "https://www.free-work.com"
export const SEARCH_PATH = "/fr/tech-it/jobs"
export const DETAIL_PREFIX = "/fr/tech-it/job-mission/"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; free-work-search-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
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
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
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
  contractType: string | null
  remote: string | null
  salary: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  experienceLevel: string | null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Find a labeled field in a desktop job card's side panel: markup is
 * `>LABEL</span>` followed (after an icon svg) by `<span class="text-sm...">VALUE</span>`.
 * Bounded lookahead window avoids bleeding into the next label's value.
 */
function extractLabeledField(chunk: string, label: string): string | null {
  const labelIdx = chunk.indexOf(`>${label}</span>`)
  if (labelIdx === -1) return null
  const window = chunk.slice(labelIdx, labelIdx + 1200)
  const valMatch = window.match(/<span class="text-sm[^"]*"[^>]*>([\s\S]*?)<\/span>/)
  return valMatch ? clean(valMatch[1]) || null : null
}

/** Parse a US-format MM/DD/YYYY <time> value into an ISO date string. */
function parseCardDate(raw: string | undefined): string | null {
  if (!raw) return null
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

/** Extract the job path segment ("category-slug/job-slug") from a detail href. */
function idFromHref(href: string): string | null {
  const m = href.match(/\/job-mission\/([^"?#]+)/)
  return m ? m[1] : null
}

/**
 * Parse the search-results page: one card per posting, marked by the
 * desktop-layout card's distinctive class combination. Split on that marker
 * and parse each chunk independently so one malformed card cannot break the
 * rest. (The page also renders a duplicate mobile-layout card per posting;
 * splitting on the desktop-only marker avoids double-counting jobs.)
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const marker =
    "rounded-lg max-w-full min-w-0 bg-white overflow-hidden cursor-pointer shadow hover:shadow-md"
  const chunks = html.split(marker).slice(1)

  for (const chunk of chunks) {
    const hrefMatch = chunk.match(/<h2[^>]*>[\s\S]*?<a href="([^"]+)"/)
    if (!hrefMatch) continue
    const href = decodeHtmlEntities(hrefMatch[1])
    const id = idFromHref(href)
    if (!id) continue
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`

    const titleBlock = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)
    const title = titleBlock ? clean(titleBlock[1]) : null
    if (!title) continue

    const companyMatch = chunk.match(/<div class="font-bold"[^>]*>([\s\S]*?)<\/div>/)
    const company = companyMatch ? clean(companyMatch[1]) || null : null

    const dateMatch = chunk.match(/<time[^>]*>([\s\S]*?)<\/time>/)
    const date = parseCardDate(dateMatch ? clean(dateMatch[1]) : undefined)

    const contractMatch = chunk.match(
      /class="tag relative inline-flex items-center rounded-full font-medium text-xs leading-tight whitespace-nowrap max-w-full py-1 px-2 min-h-\[24px\] bg-(?:worker|contractor)[^"]*"[^>]*>[\s\S]*?<div class="truncate py-\[2px\]"[^>]*>([\s\S]*?)<\/div>/,
    )
    const contractType = contractMatch ? clean(contractMatch[1]) || null : null

    results.push({
      id,
      title,
      company,
      location: extractLabeledField(chunk, "Lieu"),
      date,
      url,
      contractType,
      remote: extractLabeledField(chunk, "Télétravail"),
      salary: extractLabeledField(chunk, "Salaire"),
    })
  }

  return results
}

/** Parse a single job-detail page. */
export function parseJobDetail(html: string, id: string): JobDetail {
  const titleMatch = html.match(/<h1>(?:<em[^>]*>[\s\S]*?<\/em>)?([\s\S]*?)<\/h1>/)
  const title = titleMatch ? clean(titleMatch[1]) || "(untitled)" : "(untitled)"

  const locMatch = html.match(/<\/h1><h2>([\s\S]*?)<\/h2>/)
  const location = locMatch ? clean(locMatch[1]) || null : null

  const companyMatch = html.match(/<p class="font-semibold text-sm">([\s\S]*?)<\/p>/)
  const company = companyMatch ? clean(companyMatch[1]) || null : null

  // Description: every `<div class="html-renderer prose-content">...</div>` is a
  // description section body (mission, profil recherché, environnement de
  // travail, etc). Only some are preceded by their own
  // `<h2 class="font-semibold text-xl mb-4">Section title</h2>` - the first
  // ("mission") section renders with no such heading. Capture the optional
  // heading when present and concatenate every body in document order.
  const sectionRe =
    /(?:<h2 class="font-semibold text-xl mb-4">(?:<!--\[-->)?([\s\S]*?)(?:<!--\]-->)?<\/h2>\s*)?<div class="html-renderer prose-content">([\s\S]*?)<\/div>/g
  const sections: string[] = []
  let sm: RegExpExecArray | null
  while ((sm = sectionRe.exec(html)) !== null) {
    const heading = sm[1] ? clean(sm[1]) : ""
    const bodyHtml = sm[2]
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|h\d)>/gi, "\n")
    const bodyText = decodeHtmlEntities(stripTags(bodyHtml)).replace(/\n{3,}/g, "\n\n").trim()
    if (bodyText) sections.push(heading ? `${heading}\n${bodyText}` : bodyText)
  }
  const description = sections.length ? sections.join("\n\n") : null

  const experienceMatch = html.match(
    /<span class="w-full text-sm line-clamp-2">([^<]*(?:ans? d.exp[eé]rience|d[eé]butant)[^<]*)<\/span>/i,
  )
  const experienceLevel = experienceMatch ? clean(experienceMatch[1]) || null : null

  const remoteMatch = html.match(
    /<span class="w-full text-sm line-clamp-2">(T[eé]l[eé]travail[^<]*)<\/span>/i,
  )
  const remote = remoteMatch ? clean(remoteMatch[1]) || null : null

  return {
    id,
    title,
    company,
    location,
    date: null,
    url: `${BASE_URL}${DETAIL_PREFIX}${id}`,
    contractType: null,
    remote,
    salary: null,
    description,
    experienceLevel,
  }
}
