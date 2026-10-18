# Spec: `/linkedin-post`: draft and publish LinkedIn posts and carousels

**Status:** Draft · **Date:** 2026-10-10 · **Owner:** manox96

## 1. Goal

Turn things the candidate has already done (a project, an internship, a certification, a topic they know) into LinkedIn content that makes their profile readable at a glance. The command drafts:

- a **text post**, and optionally
- a **carousel**, which is a PDF document post where each page is one swipeable slide,

and publishes them to the candidate's personal LinkedIn profile **only after explicit approval**.

### Non-goals (v1)
- Posting as a Company Page, scheduling, comments, likes, DMs, or reading the feed.
- Browser automation of linkedin.com. It breaks LinkedIn's terms of service and risks the account. The official API is the only publishing path.
- Analytics. Reading post statistics needs extra API access that isn't available to personal apps.

## 2. User flow

```
/linkedin-post <topic | project path | "<company>"> [--carousel] [--lang fr|en] [--dry-run]
  1. Collect sources   → CLAUDE.md profile, 01-*.md, project README/repo, user notes
  2. Draft post        → linkedin_posts/<date>_<slug>/post.md
  3. Draft slides      → slides.json → carousel.html → carousel.pdf   (if --carousel)
  4. Verify            → grounding, length, style, PDF page size and count
  5. Preview           → full text + slide-by-slide render shown to the user
  6. Approval gate 1   → user types an explicit "publish" for THIS post
  7. Approval gate 2   → Claude Code permission prompt on `linkedin_post.py publish`
  8. Publish + log     → post URL written to linkedin_posts/log.csv
```

`--dry-run` stops after step 5.

## 3. Architecture

Follows existing repo conventions: prose workflow in a command, with real code only where prose is error-prone. `/submit` + `tools/send_email.py` is the reference pattern for anything that sends content to a third party.

| Component | Path | Role |
|---|---|---|
| Command | `.claude/commands/linkedin-post.md` | Orchestration, drafting rules, approval gates |
| Auth tool | `tools/linkedin_auth.py` | One-time OAuth 2.0 login, token storage, status |
| Publish tool | `tools/linkedin_post.py` | `preview` (offline) and `publish` (network) |
| Carousel template | `templates/linkedin/carousel/` (`carousel.html`, `build.py`, `TEMPLATE.md`) | slides.json → HTML → PDF via WeasyPrint, the same as `templates/cv/modern-photo/build.py` |
| Output | `linkedin_posts/<YYYY-MM-DD>_<slug>/` | `post.md`, `slides.json`, `carousel.pdf`, `published.json` |
| Log | `linkedin_posts/log.csv` | date, slug, lang, type, post URN, URL |
| Tests | `tests/test_linkedin_post.py`, `tests/test_linkedin_auth.py` | Network-free, HTTP mocked |

`linkedin_posts/` is personal data and is gitignored.

### LinkedIn API surface

| Purpose | Call |
|---|---|
| Authorize | `GET https://www.linkedin.com/oauth/v2/authorization` (scopes `openid profile w_member_social`, `state` param required) |
| Token | `POST https://www.linkedin.com/oauth/v2/accessToken` (authorization_code grant) |
| Author ID | `GET https://api.linkedin.com/v2/userinfo` → `sub` → `urn:li:person:<sub>` |
| Text post | `POST https://api.linkedin.com/rest/posts` |
| Document upload | `POST /rest/documents?action=initializeUpload` → `PUT <uploadUrl>` (PDF bytes) |
| Document post | `POST /rest/posts` with `content.media.id = urn:li:document:...` |

Required headers on `/rest/*`: `Authorization: Bearer`, `LinkedIn-Version: <YYYYMM>`, `X-Restli-Protocol-Version: 2.0.0`. LinkedIn retires API versions after about a year, so the version lives in one constant (`LINKEDIN_API_VERSION`) that `.env` can override.

### Secrets
- `.env` (already gitignored) holds `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`. Values come only from the environment, never CLI flags, as in `send_email.py`.
- The token is saved to `.linkedin_token.json` with access token, expiry and person URN, file mode `0600`, and gitignored.
- Tokens last about 60 days. Personal apps get no refresh token, so `status` reports the days left and `publish` refuses an expired token with a "re-run auth" message.

## 4. Content rules (in the command prose)

- **Grounding:** every fact (numbers, stack, employer, dates) must trace to CLAUDE.md, `01-candidate-profile.md`, or a source file the user pointed at. This is the same standard as the CV Verification Checklist. No invented metrics.
- **Confidentiality:** never name an employer's internal data, clients or unreleased products beyond what the profile already states publicly. Flag anything that comes from a private repo.
- **Style:** follow `03-writing-style.md`. No em-dashes, no clichés, a hook in the first 2 lines (LinkedIn truncates around 210 characters before "voir plus"), short paragraphs, 3–6 hashtags at the end, and **Claude Code** named when AI tooling comes up.
- **Length:** post ≤ 3,000 characters (API limit). Target 900–1,500.
- **Language:** `--lang`, defaulting to the CV-language rule in CLAUDE.md (French by default).
- **Carousel:** 6–10 slides. Order: cover (title and name), problem, approach, architecture, result in numbers, what I learned, call to action. At most about 40 words per slide. 1080×1350 portrait pages. PDF under 100 MB and under 300 pages (LinkedIn limits).

## 5. Milestones

Each milestone ends in something runnable and has its own acceptance criteria. Don't start M2 until M0's decision gate is answered.

### M0: LinkedIn app and API spike (decision gate) · ~0.5 day
**Work**
- The user creates the developer app, links a Company Page (LinkedIn requires one), adds the "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" products, and sets the redirect URL `http://localhost:8765/callback`.
- A throwaway script in the scratchpad gets a token by hand and calls `userinfo`.
- Test a **document upload with a personal `urn:li:person` owner** using a visibility of `CONNECTIONS`, then delete the test post.

**Acceptance**
- [ ] `userinfo` returns `sub`
- [ ] Text post created and deleted
- [ ] Documents API answer recorded: **works** → M3 publishes carousels; **403** → M3 still renders the PDF, and the user uploads it by hand with "Add a document"

### M1: Auth tool · ~0.5 day
**Work:** `tools/linkedin_auth.py` with these subcommands:
- `login`: opens the browser, runs a one-shot local server on 127.0.0.1:8765, checks `state`, exchanges the code, calls `userinfo` and writes the token file with mode 0600
- `status`: prints the person URN and days until expiry, offline
- `logout`: deletes the token file

**Acceptance**
- [ ] `.gitignore` covers `.linkedin_token.json` and `linkedin_posts/`
- [ ] Wrong or missing `state` aborts with no token written
- [ ] Missing client ID or secret produces a clear error plus `.env.example` entries
- [ ] Unit tests mock the token endpoint, `userinfo` and the expiry maths

### M2: Text post publishing · ~1 day
**Work:** `tools/linkedin_post.py`:
- `preview --post post.md`: offline. Shows the character count, the first 210 characters (above the fold), hashtags and target visibility.
- `publish --post post.md [--visibility PUBLIC|CONNECTIONS]`: network. Returns the post URN and URL and writes `published.json`.
- Backoff on 429 and 5xx, matching the portal CLI contract. JSON errors on stderr and exit 1.
- **Idempotency:** refuses to publish if `published.json` already exists in the folder, unless `--force`.

**Permissions:** pre-approve only `linkedin_post.py preview` and `linkedin_auth.py status` in `.claude/settings.json`. `publish` and `login` must prompt every time.

**Acceptance**
- [ ] A real post goes out with `CONNECTIONS` visibility for the smoke test
- [ ] A second publish of the same folder is refused
- [ ] Commentary with special characters (`(`, `)`, `@`, `#`, `*`) survives. These are reserved characters in LinkedIn's "little text" format and must be escaped, so test them.
- [ ] Unit tests cover request body shape, headers, escaping, expired token and the 429 retry

### M3: Carousel rendering (+ upload if M0 passed) · ~1.5 days
**Work**
- `templates/linkedin/carousel/carousel.html`: a Jinja-free HTML template filled from `slides.json`, with a cover, content and CTA layouts. It reuses the brand colours and fonts of `templates/cv/modern-photo` so the CV and LinkedIn look consistent.
- `build.py slides.json out.pdf`: WeasyPrint render, prints the page count.
- `linkedin_post.py publish --carousel carousel.pdf --title "..."`: initialize upload, PUT, then a post with `content.media`.

**Acceptance**
- [ ] `verify_pdf.py` confirms the page count equals the slide count. Page size is 1080×1350 px (810×1012.5 pt).
- [ ] No text overflow on a 40-word slide (checked visually and with `verify_layout.py`)
- [ ] Fonts embedded, so the PDF looks the same on LinkedIn mobile
- [ ] Carousel posted with `CONNECTIONS` visibility for the smoke test (or the manual-upload fallback is documented)

### M4: `/linkedin-post` command · ~1 day
**Work:** `.claude/commands/linkedin-post.md`, which implements §2 and §4:
- Source collection and the grounding checklist
- Drafting the post and slides
- A pass/fail verification checklist reported to the user, in the same format as `/apply`
- A preview of the post text and **each slide read back from the PDF**
- Both approval gates
- Logging to `linkedin_posts/log.csv`

Wording for the approval gate copies `/submit`: "Never publish on a general 'yes' to an earlier, different question."

**Acceptance**
- [ ] `/linkedin-post <company> --carousel --dry-run` produces a grounded post and an 8-slide PDF, and nothing is published
- [ ] Without `--dry-run`, nothing is published until the user explicitly says "publish"
- [ ] Every number in the output can be found in the profile (e.g. 155s → 94s, −40%)
- [ ] `python3 tools/lint_skills.py` passes

### M5: Hardening and docs · ~0.5 day
**Work**
- `tools/security_guards.py` gains three checks:
  - the token file and `linkedin_posts/` are gitignored
  - `linkedin_post.py publish` and `linkedin_auth.py login` are **not** pre-approved
  - nothing under `linkedin_posts/` is tracked
- README section, `SETUP.md` steps for the developer app, `.env.example` entries, CHANGELOG entry, `framework_version` bump.

**Acceptance**
- [ ] Full unit test suite and `security_guards.py` pass
- [ ] Following SETUP.md from scratch takes a new user to a first preview in under 15 minutes

### Later (not v1)
- **M6, series mode:** `/linkedin-post --plan 4` proposes a month of posts, one per project or certification from the candidate profile, and saves drafts only.
- **M7, scheduling:** hand drafts to n8n or Buffer. The API has no native scheduling for members.
- **M8, English mirror:** produce FR and EN versions of the same post.

**Total v1 estimate: about 5 days.**

## 6. Risks

| Risk | Mitigation |
|---|---|
| Documents API refused for personal apps | Found out in M0. Fallback is a rendered PDF plus manual upload. |
| API version retired | One constant, overridable from `.env`. The error message names the header. |
| Token expires mid-campaign | `status` warns at 7 days or fewer left. `publish` fails early, before upload. |
| Accidental or duplicate post | Two approval gates, `published.json` idempotency, `CONNECTIONS` visibility for smoke tests |
| Overclaiming or leaking employer info | Grounding and confidentiality checklist in M4. Profile is the only source of facts. |
| Account restrictions | API only, no browser automation, human-paced posting (no bulk) |

## 7. Open questions
1. Visibility default: `PUBLIC` (better reach) or `CONNECTIONS` until the user trusts the flow?
2. Should every published post be appended to the profile, e.g. a "Publications / Posts" line for `/expand`?
3. Upstream or fork-only? The feature is market- and person-agnostic, so it can go upstream if all personal data stays in gitignored paths.
