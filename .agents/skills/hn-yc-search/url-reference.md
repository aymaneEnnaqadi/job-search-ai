# URL Reference: hn-yc-search

Three independent data sources, documented separately.

## 1. Hacker News "Who is hiring?" — HN's official Algolia Search API

Base: `https://hn.algolia.com/api/v1`

This is HN's own sanctioned public API for its content (used by HN Search itself),
not scraping. No auth, no key, generous rate limits observed in testing.

### Find the current thread

```
GET /search_by_date?tags=story,author_whoishiring&hitsPerPage=10
```

Every monthly thread (both "Who is hiring?" and its sibling "Who wants to be hired?")
is authored by the `whoishiring` bot account, so `tags=story,author_whoishiring` finds
both; filter `hits` client-side on `title` matching `/who is hiring/i`. Response shape:

```json
{ "hits": [{ "objectID": "49522897", "title": "Ask HN: Who is hiring? (September 2026)", "created_at": "2026-09-01T15:01:17Z" }, ...] }
```

### Fetch the thread with all comments

```
GET /items/<objectID>
```

Returns the story plus a fully nested `children` array (one entry per top-level
comment = one job post, each with its own nested `children` for replies — job posts
themselves are always top-level, so only `children` at depth 1 matter). Each comment:

```json
{
  "id": 49522903,
  "author": "thelastofthelas",
  "created_at": "2026-09-01T15:01:54.000Z",
  "text": "Modash.io | Senior Product Engineer | Remote (Europe) | Full-time | ...(HTML, entity-escaped)...",
  "children": [ ... ]
}
```

- `text` is `null` and `author` is `null` for deleted comments; `dead`/`deleted` booleans
  mark flagged/removed ones. All three must be checked before treating a child as a post.
- `text` is escaped HTML (`&#x2F;`, `<p>`, `<a href="...">`, etc.) — strip tags and decode
  entities before parsing.
- There is no structured company/role/location — parsing the pipe-delimited convention
  in the first line is a best-effort heuristic, not guaranteed. Many posts don't follow
  it at all; those fall back to the whole first line as `title` with `company`/`location`
  left `null`.
- Only one thread is fetched per search (the current month's) — `--jobage` filters
  *within* that thread by each comment's own `created_at`, it does not span multiple
  months. There is no way to fetch a past thread's ID directly by date without first
  discovering it via `search_by_date`.

### Single comment (used by `detail --source hn`)

```
GET /items/<comment_id>
```

Same shape as above; `detail` reads just `text`/`author`/`created_at` off the top level
(ignores `children` — replies to a job post are discussion, not job data).

## 2. Y Combinator internships — embedded page JSON

Base: `https://www.ycombinator.com`

`/robots.txt` allows `/` generally (a few unrelated paths under `/companies?*` and
`/library?*` are disallowed — query strings, not the paths this skill fetches).

### Listing page

```
GET /internships
```

This is a **curated** page (currently on the order of a handful to a few dozen
postings), not the full `workatastartup.com` job board — there is no login-free access
to that larger board. The response is server-rendered HTML with a Rails/React "props"
blob embedded as an attribute on the page's root `<div>`:

```html
<div data-page="{&quot;component&quot;:&quot;InternshipsPage&quot;,&quot;props&quot;:{...,&quot;jobPostings&quot;:[...]}}">
```

**Parsing rule:** the attribute value HTML-escapes every literal `"` inside it as
`&quot;`, so the regex `data-page="([^"]*)"` always finds the true closing quote — no
HTML parser needed, and no need to hunt for a specific `id="..."` sibling attribute
(an earlier, more fragile approach that broke because multiple similarly-named
attributes/components can appear later in the same document). Decode HTML entities on
the captured group, then `JSON.parse`.

Each entry in `props.jobPostings`:

```json
{
  "id": 80508,
  "title": "Full Stack Software Engineering Intern",
  "url": "/companies/retailready/jobs/KfkyR7c-full-stack-software-engineering-intern",
  "applyUrl": "https://account.ycombinator.com/authenticate?...",
  "location": "San Francisco, CA, US",
  "type": "Internship",
  "role": "eng",
  "roleSpecificType": "Full stack",
  "prettyRole": "Engineering",
  "salaryRange": "$6K - $10K / monthly",
  "minSchoolYear": "Junior and above",
  "visa": "US citizen/visa only",
  "skills": [],
  "companyName": "RetailReady",
  "companyBatchName": "W24",
  "companyOneLiner": "An AI-powered supply chain compliance engine",
  "companyUrl": "/companies/retailready"
}
```

- No absolute post date anywhere on this page — only relative text (`createdAt: "about
  1 year"`, meaning last-updated, not posted). `--jobage` is therefore unsupported for
  this source and the CLI rejects it explicitly rather than silently ignoring it.
- No pagination parameter was found on `/internships` itself; the page returns its full
  curated set in one response. `search`'s `--page`/`--limit` still work — they slice
  client-side over whatever the page returned.

### Job detail page

```
GET /companies/<company-slug>/jobs/<job-slug>
```

(the `url` field above, resolved against the base). Same `data-page` embedding pattern,
component name `WaasShowJobPage`, with `props.job` carrying every field from the listing
plus a full Markdown-ish `description` string and `interview_process`. `detail
--source yc-internships` accepts either this full URL/path directly, or a bare numeric
job id — the id form re-fetches `/internships` and looks the id up in the current
listing, so it only resolves for jobs still on that page (documented limitation, not
a bug: a job that has rotated off is unresolvable by bare id and needs its full URL).

## 3. Hacker News /jobs — HN's official Firebase API

Base: `https://hacker-news.firebaseio.com/v0` (docs: github.com/HackerNews/API).
Read-only, no auth, no documented rate limit.

### List current job ads

```
GET /jobstories.json
```

Returns up to ~200 item ids (in practice ~30), newest first — the ads shown on
`news.ycombinator.com/jobs`. These are YC company ads, separate from the monthly
"Who is hiring?" thread.

### Fetch one ad

```
GET /item/<id>.json
```

```json
{ "by": "adchurch", "id": 50042330, "score": 1, "time": 1791720068,
  "title": "Weave (YC W25) is hiring ML, AI, product, & design engineers",
  "type": "job", "url": "https://jobs.ashbyhq.com/weave-os" }
```

- `time` is unix seconds. `url` is the external posting; a few ads have an HTML `text`
  body instead of (or as well as) a `url`.
- One request per id — the CLI fetches them 8 at a time.
- `dead`/`deleted` items and anything whose `type` is not `"job"` are skipped.
