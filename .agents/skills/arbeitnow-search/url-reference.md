# Arbeitnow Job-Board API Reference

Public, unauthenticated JSON API. `robots.txt` is fully permissive (`User-agent: *` /
`Disallow:` empty, aside from one unrelated HubSpot tracking-param rule).

## Search / listing feed

```
GET https://www.arbeitnow.com/api/job-board-api?page=<n>
```

**Verified live (2026-09): every query parameter other than `page` is ignored.**
`?search=devops`, `?q=devops`, `?tags=DevOps`, and `?location=Paris` all returned the
identical raw page as a bare request — confirmed by comparing response sizes and job
counts across all four. This is a static paginated dump, not a search endpoint.

| Param | Meaning | Notes |
|-------|---------|-------|
| `page` | 1-indexed page number | Only parameter that has any effect. 250 postings/page. |

Response shape:

```json
{
  "data": [
    {
      "slug": "account-lead-influencer-marketing-brand-strategy-munich-492454",
      "company_name": "Ykone GmbH",
      "title": "Account Lead Influencer Marketing & Brand Strategy (m/w/d)",
      "description": "<p>...</p>",
      "remote": false,
      "url": "https://www.arbeitnow.com/jobs/companies/ykone-gmbh/account-lead-influencer-marketing-brand-strategy-munich-492454",
      "tags": ["Data Engineer", "Cloud", "AWS", "..."],
      "job_types": ["Entry", "Intern", "Part time"],
      "location": "Munich",
      "created_at": 1789302625
    }
  ],
  "links": { "first": "...", "last": null, "prev": "...", "next": "..." },
  "meta": { "current_page": 1, "per_page": 250, "...": "..." }
}
```

- `links.last` is consistently `null` in practice — there is no reliable "total pages"
  signal; treat `data.length === 0` on a given page as end-of-feed instead.
- Observed live: page 50 returned `data: []` (feed exhausted somewhere between page 1
  and 50 at the time of testing). Page count grows over time as new postings are added.
- `slug` is unique and is also the final path segment of `url` — used as the CLI's `id`.
- Postings observed: mostly Germany (Munich, Berlin, Hamburg, Frankfurt), with some
  Paris/France, London, and other EU/international listings mixed in. No Morocco, Spain,
  Italy, or USA postings observed in initial sampling.
- `job_types` values seen include `Entry`, `Intern`, `Student`, `Trainee`, `Experienced`,
  `Permanent`, `Freelance`, `Full time`, `Part time` — useful signal for filtering
  internship-level postings via `--query` keyword matching (this CLI does not expose a
  dedicated `--job-type` flag; match on tags/job_types text via `--query` instead).
- `created_at` is a unix-seconds timestamp. At least one live-sampled posting carried a
  value clearly in the future relative to fetch time — treat with caution for precise
  age filtering; the CLI clamps negative ages to 0 rather than excluding such postings.

## Detail

No by-id lookup endpoint exists. The full `description` (and every other field) is
already present in the search/listing response — "detail" is resolved by scanning
listing pages for a matching `slug`, not by a separate request type.

## Notes

- No authentication required.
- `robots.txt` places no restriction on this endpoint.
- Response is JSON; `description` is HTML and needs stripping for plain-text display
  (the CLI's `cleanDescription` helper handles this).
- Keep request volume reasonable — this is a small free public API with a terms note
  embedded in `meta.terms` asking not to abuse it.
