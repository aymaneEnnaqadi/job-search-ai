# free-work.com Tech-IT URL Reference

Public, unauthenticated pages used by this skill. Market-specific to the `/fr/tech-it`
vertical (France/Francophone Europe tech jobs and freelance missions). `robots.txt`
(checked live, 2026-09-18) disallows only `/login`, `/logout`, `/fw-deals` for a generic
user agent - the search and detail paths this skill uses are unrestricted.

## No JSON API

The site is a Nuxt (Vue) SSR app. It embeds a `__NUXT_DATA__` hydration payload (a
devalue-flattened array) in every page, but the same job data is also present as plain
server-rendered HTML - and the HTML is far cheaper to parse reliably than reverse
engineering devalue's index-reference format, so this skill parses the rendered markup
instead of the hydration payload. No `/api/` XHR endpoint was found backing the search
page (checked live: page source has no `apiBase`, `algolia`, or similar service
reference).

## Search

```
GET https://www.free-work.com/fr/tech-it/jobs
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `query` | Free-text query, matched server-side | `devops`, `developpeur fullstack` |
| `page` | 1-indexed pagination | `2` (confirmed live via `<link rel="next" href="...&page=2">`) |

No other query parameter was found to change the response (`location`, `remote`,
`contract`, and a plain `sort` value were not confirmed as functioning filters during
investigation - only `query` and `page` were verified live). **There is no server-side
recency/posted-date filter** - the CLI's `--jobage` is client-side only, filtering on
each result's own `<time>` value after fetching, the same honest-limitation pattern
`jobdanmark-search` documents for its portal.

Each search-results page renders **two markup variants per job** (a desktop card and a
mobile card with identical data), keyed by the shared marker text
`rounded-lg max-w-full min-w-0 bg-white overflow-hidden cursor-pointer shadow hover:shadow-md`
on the desktop card only. The CLI splits on that desktop-only marker to get exactly one
chunk per job (never double-counting).

Per-card fields (all server-rendered, confirmed live on a `query=devops` search):

| Field | Anchor |
|-------|--------|
| Title + URL | `<h2 class="font-semibold text-xl mb-4"><a href="/fr/tech-it/job-mission/<category-slug>/<job-slug>">...</a></h2>` |
| Company | `<div class="font-bold">Company Name</div>` |
| Date | `<time class="text-sm">MM/DD/YYYY</time>` (US-format month/day/year, despite the French UI) |
| Contract type | first `<span class="tag ... bg-worker...">` or `<span class="tag ... bg-contractor...">` (e.g. `CDI`, `Freelance`) |
| Location | side-panel field labeled `Lieu` |
| Salary | side-panel field labeled `Salaire` |
| Remote | side-panel field labeled `Télétravail` |
| Start date | side-panel field labeled `Démarrage` (not currently parsed by this CLI) |

The `id` this skill uses is the `<category-slug>/<job-slug>` path segment (e.g.
`ingenieur-devops-cloud/devops-h-f-723`) - free-work exposes no separate numeric job ID
in the rendered markup, so the URL slug pair is the closest stable identifier.

## Detail

```
GET https://www.free-work.com/fr/tech-it/job-mission/<category-slug>/<job-slug>
```

Unlike the search page, the detail page's full description **is** server-rendered
(confirmed live) inside one or more:

```html
<h2 class="font-semibold text-xl mb-4">Section title</h2>
<div class="html-renderer prose-content">...</div>
```

pairs - typically "Vos missions" (unlabeled first section), "Profil recherché", and
"Environnement de travail". The CLI concatenates every such pair it finds, in document
order.

Other detail-page anchors:

| Field | Anchor |
|-------|--------|
| Title | `<h1><em class="block text-xs md:text-sm">Offre d'emploi</em>Title</h1>` |
| Location | `<h2>City (postcode)</h2>` immediately following the `</h1>` |
| Company | `<p class="font-semibold text-sm">Company</p>` |
| Experience level | side-panel `<span class="w-full text-sm line-clamp-2">N à M ans d'expérience</span>` |
| Remote | side-panel `<span class="w-full text-sm line-clamp-2">Télétravail ...</span>` |

## Notes

- No authentication required.
- Respect rate limits - the CLI backs off on 429/5xx with the same exponential-backoff
  pattern every other portal skill in this repo uses.
- Dates on the search page are US-format (`MM/DD/YYYY`) even though the site's UI
  language is French - verified live, not a formatting bug in this CLI.
- If free-work changes its Tailwind class names or card markup, the anchors above are
  what to re-check first; re-run the live investigation in `/add-portal` Step 2 against
  a fresh `curl` of the search page to find the new ones.
