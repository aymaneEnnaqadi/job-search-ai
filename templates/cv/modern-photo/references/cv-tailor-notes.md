# modern-photo: tailoring notes

Carried over from the original `cv-tailor` skill package this template was extracted
from. These are content/judgment rules specific to this template's one-page, photo-CV
format — read alongside `TEMPLATE.md`'s structural style rules and this repo's own
`03-writing-style.md` / `05-cv-templates.md` (whose tailoring philosophy still applies;
these notes only add what's specific to this template).

## Regional variants (photo / skills grid / languages)

This template's defaults (photo shown, 4-column skills grid, languages section) suit
Morocco, France, Italy, Spain, Germany, and Belgium — a photo and a languages section
are expected there, and their absence can read as an incomplete CV. For Anglo markets
(US, UK, Ireland, Canada, Netherlands, Nordics, most remote-first employers), the
convention is the opposite:

| Element | Anglo market | Morocco/France/Italy/Spain/Germany/Belgium |
|---|---|---|
| Photo | Remove it (`.photo{display:none}`, drop the header flex gap) — a photo invites discrimination-law scrutiny and some ATS reject it | Keep it |
| Skills grid | Collapse to `grid-template-columns:1fr` with inline category runs | Keep the 4-column grid |
| Languages section | Remove — reads as filler for English-first employers | Keep — a genuine differentiator, often a stated requirement |

Decide by where the employer is headquartered (for a remote posting, go by HQ location).
State which variant was produced, in one line, when presenting the PDF.

## Fitting one page (this template is 1 page, not 2)

**Education entries are never a cut target, even under one-page pressure.** All entries
in `01-candidate-profile.md`'s Education table must appear on every CV regardless of space. This was
violated once already — a drafter under one-page pressure cut it down to a single
entry. Cut bullets, chips, or project entries instead; see the order below.

In order of preference, stop as soon as it fits — never shrink the font, narrow the
margins, or drop the photo to force a fit:

1. Cut the weakest bullet from the oldest entry.
2. Drop certification chips least relevant to the offer.
3. Tighten the profile paragraph to two lines.
4. Merge the two weakest project entries into one.

## Quantified-bullet standard

Every experience bullet should carry at least one number (metric, %, count, latency,
team size, users) where the underlying fact genuinely supports one. If no figure is
available for the bullet that matters most to a given offer, leave it unquantified and
say so rather than inventing a number — this is the same non-negotiable honesty rule as
`03-writing-style.md` rule 3, just restated because it was flagged as this candidate's
biggest existing weakness (17 bullets, none quantified, in the original CV).

## Dates

Written months ("June 2021 – July 2022"), not numeric ("06/2021–07/2022"). Drop the
month once a date is more than 3-4 years old (year range only).

## Language variants

Keep each translated CV as its own file (`cv/main_<company>_<role>_fr.html`,
`..._it.html`, etc.) rather than overwriting another language's version. Translate
content only — never touch the `<style>` block. Do not translate: the candidate's name,
employer names, product/domain names (e.g. a personal project's `.com` domain),
technology names, and certification titles (official award names stay as issued).

## PFE / internship-specific framing

For a final-year/PFE internship posting: the `.role` line under the name should echo
the offer's own title and end with availability, e.g. *"Élève-ingénieur — Stage PFE
DevOps · disponible janvier 2027"*. Keep the education section positioned where it is
in the template (it earns its place for a student profile). European employers will
wonder about work-authorization paperwork — don't put it on the CV itself, but flag in
the chat that the cover letter or a follow-up email may need a *convention de stage*
mention.

## What tailoring means here

Reorder, reword, and re-emphasize what is already true — never invent an employer,
date, certification, or technology. If an offer wants a skill the candidate doesn't
have, say so in the chat rather than quietly adding it to the skills grid. Mirror the
offer's own vocabulary in bullets and skill labels (ATS and human readers both match
literal strings).
