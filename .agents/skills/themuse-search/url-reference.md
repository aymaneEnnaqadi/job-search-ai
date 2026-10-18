# The Muse Public Jobs API Reference

Public, unauthenticated JSON API. `robots.txt` (`themuse.com/robots.txt`) allows `/api/*`
except `/api/users*` — `/api/public/jobs` is unrestricted.

## Search / listing

```
GET https://www.themuse.com/api/public/jobs?category=<...>&level=<...>&location=<...>&page=<n>
```

Verified live (2026-09):

| Param | Works server-side? | Notes |
|-------|---------------------|-------|
| `category` | **Yes** | e.g. `Software Engineering`. Real filter — `total` shrinks correctly and results match. |
| `level` | **Yes** | e.g. `Internship`, `Entry Level`, `Mid Level`, `Senior Level`. Combines with `category`. |
| `location` | **Partial** | Narrows `total`, but results still include unrelated remote/other-city postings (tested with `London, United Kingdom`, `Paris, France`, `Morocco`, `Casablanca, Morocco` — all returned a mix, including jobs with neither the queried location nor "Remote"). Treat as a soft pre-filter only; this CLI re-verifies client-side against each job's actual `locations` array. |
| `query` / `q` / `keyword` / `search` / `name` | **No** | All five tested; `total` stayed at the full unfiltered count (412,300) every time. No free-text keyword search exists on this endpoint. |
| `page` | **Yes, capped** | 1-indexed. **Page 100 returns `400 {"code":400,"error":"Value \`page\` is too high"}`.** Page 99 succeeds. This cap applies regardless of the filtered `total` - a query reporting `total: 412300` is still only browsable through page 99 (≈1,980 results) via this endpoint. |

Response shape:

```json
{
  "page": 1,
  "page_count": 20615,
  "items_per_page": 20,
  "total": 412300,
  "results": [
    {
      "id": 17780767,
      "name": "Nurse Care Manager (RN)",
      "contents": "<p>...</p>",
      "company": { "id": 15000558, "short_name": "hartfordhealthcare", "name": "Hartford HealthCare" },
      "locations": [{ "name": "Ledyard, CT" }],
      "levels": [{ "name": "Senior Level", "short_name": "senior" }],
      "categories": [],
      "publication_date": "2025-03-09T10:29:29Z",
      "refs": { "landing_page": "https://www.themuse.com/jobs/hartfordhealthcare/nurse-care-manager-rn-ed8155" },
      "short_name": "nurse-care-manager-rn-ed8155",
      "type": "external"
    }
  ]
}
```

- `aggregations` is present in every response but was empty (`[]` / `{}`) in all live
  testing — no facet/valid-value listing is exposed through the API itself. Valid
  `category`/`level` strings have to be learned from the values seen in `results`
  (e.g. `Software Engineering`, `Data Science`, `IT`, `Internship`, `Entry Level`,
  `Mid Level`, `Senior Level`).
- `locations` can contain multiple entries per job (e.g. `["Flexible / Remote", "New
  York, NY"]`) when a role is remote-eligible from a specific hub.

## Detail

```
GET https://www.themuse.com/api/public/jobs/<id>
```

`<id>` is the numeric `id` field from a search result. Returns the same job-object shape
as a single search result (not wrapped in `{results: [...]}`). Confirmed live: `id`
17780767 returned a full 200 response with the same `contents`/`company`/etc. fields.
There is no way to resolve a landing-page URL back to this numeric ID - only IDs
obtained from `search` results work.

## Notes

- No authentication required.
- `robots.txt` places no restriction on `/api/public/jobs`.
- Response is JSON; `contents` is HTML and needs stripping for plain-text display.
- Keep request volume reasonable.
