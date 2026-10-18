# Template: modern-photo

- **Type:** CV
- **Source extension:** .html
- **Engine/toolchain:** WeasyPrint (Python library, HTML+CSS to PDF)
- **Page limit:** 1 page(s)
- **Fonts:** Source Sans Pro (bundled in `fonts/` as woff2: 400 normal, 400 italic, 600 normal, 700 normal) — loaded via `@font-face` with paths relative to the HTML file
- **Class/packages:** none (plain HTML/CSS). Requires the `weasyprint` Python package at build time: `python3 -m pip install --user --break-system-packages weasyprint` (macOS/Homebrew Python; drop the extra flags on a non-PEP-668 Python)

## Compile command

    cd cv && python3 ../templates/cv/modern-photo/build.py <file>.html <file>.pdf

`build.py` prints the rendered page count on every run — check it against the page limit above before presenting the PDF.

## Style rules

- Single-column, **exactly 1 page** (this is a dense one-page CV design, not the framework's usual 2-page format — do not add a second page's worth of content; cut instead).
- Accent color `#0E374E` (navy) used for name, subtitle, section-heading rules, and certification chip backgrounds. Body text is pure black.
- Header: circular photo (97.5pt) via `border-radius:50%` + `object-fit:cover`, name at 23.5pt bold, italic subtitle/headline at 15.9pt, both in the accent color. Three contact rows below with inline SVG icons (envelope, phone, map-marker on row 1; LinkedIn, GitHub on row 2) — icons are inlined `<svg>` paths in the HTML, not an icon font, so no extra dependency.
- Section headings: `<h2>`, 10pt bold uppercase, 0.35pt letter-spacing, thin 0.7pt accent-colored bottom border. Must match the CV's declared language (translate `<h2>` text, never leave stock English headers under a non-English body — same rule as the stock moderncv template in `05-cv-templates.md`).
- Entries (experience/projects/education): `.entry > .head` is a flexbox with `.left` (bold org name + italic role/stack, wraps to a second line via `<br>` if the org name is long) and `.right` (dates + location, right-aligned, `white-space:nowrap`). Bullets in a plain `<ul>` below, CSS-drawn `•` markers (`li::before`), no native list styling.
- Skills: `.skills` is a CSS grid, `repeat(4, 1fr)`, that auto-wraps — add or remove `<div><div class="cat">…</div>…</div>` cells freely without touching the grid definition (unlike a hand-built table, no manual row math needed).
- Certifications: `.chips` is `display:flex; flex-wrap:wrap` — add or remove `<span class="chip">` freely; it reflows on its own.
- Languages: `.langs` is a 3-column CSS grid — adjust `grid-template-columns` if the count of languages changes materially.
- Dates: written months ("June 2021 – July 2022"), not numeric ("06/21–07/22"). Drop the month on anything older than ~4 years (year range only).
- Every experience bullet should carry a quantified outcome where the underlying fact supports one (metric, %, count) — do not fabricate a number that isn't grounded in the profile; leave the bullet unquantified rather than inventing one.
- No self-rated skill bars/stars, no "references available on request" line, no raw unstyled URLs (contact links render as plain text here by design — this template's own convention, not a CSS bug).
- **Photo and skills-grid/languages-section inclusion are market-dependent, not universal** — see `references/cv-tailor-notes.md` (copied from the original skill package) for the exact regional table: Anglo markets (US/UK/Ireland/Canada/Netherlands/Nordics) expect no photo and a collapsed 1-column skills list and no languages section; Morocco/France/Italy/Spain/Germany/Belgium expect the photo, the 4-column grid, and the languages section kept. Decide per-application by where the employer is headquartered, and state which variant was produced when presenting the PDF.

## Known pitfalls

- `weasyprint` must be installed for whichever `python3` the compile command actually invokes — this machine had two Python installs (3.12 default, 3.13 via a separate pip) where installing under one left the other without the package. Verify with `python3 -c "import weasyprint"` before relying on the compile command; if it fails, reinstall with `python3 -m pip install --user --break-system-packages weasyprint` using that exact `python3`.
- Font paths in `@font-face` are relative to the HTML file's own directory (`fonts/...`), not the working directory the compile command is run from — WeasyPrint resolves them via `base_url`, which `build.py` sets to the source file's parent directory. Keep the `fonts/` folder next to whichever `.html` file is being compiled (copy it alongside each tailored `cv/main_<company>_<role>.html`, the same way the stock LaTeX template's `OpenFonts/` gets copied for cover letters).
- `[YOUR_PHOTO_PATH]` must resolve relative to the HTML file's directory too, for the same `base_url` reason. Keep the real photo file next to the compiled HTML (or use a relative path like `../assets/photo.jpg` and keep the referenced file in a stable location).
- This template is **1 page**, not the framework's default 2 — a drafter used to the stock CV must not apply the 2-page page-budget guidance from `05-cv-templates.md` when this template is active; fit everything into 1 page per the "Fitting one page" priority order in `references/cv-tailor-notes.md` (cut the weakest bullet from the oldest entry first, then low-relevance certification chips, then tighten the profile, then merge weak project entries — never shrink the font or margins to force a fit).
- **Never cut Education entries to fit the one-page limit.** A drafter under page pressure once cut the Education section down to a single entry, dropping the others. All entries in `01-candidate-profile.md`'s Education table must always appear, regardless of page budget — see `references/cv-tailor-notes.md`'s "Fitting one page" section, which now states this explicitly. If content must be cut to fit, take it from bullets, certification chips, or project entries instead.
- **Do not draw bullet markers with `position:absolute` on `li::before`.** The original CSS (`li{position:relative} li::before{content:'•';position:absolute;left:0.5pt}`) renders correctly on the page but breaks the PDF's text layer: `position:relative`/`absolute` content forms its own stacking context, which WeasyPrint paints — and streams into the PDF's text operators — in a separate pass *after* all normal-flow content. The visible effect only shows up in an ATS-style text extraction (`tools/verify_pdf.py --dump-text`), never in a visual read: every `<li>` across the entire document gets pushed to the very end of the extracted text, after Languages, completely disconnected from the job/project entry it belongs to. Fixed by using a non-positioned hanging-indent bullet instead: `li{padding-left:8pt;text-indent:-8pt} li::before{content:'•  '}`. Confirmed the fix with a real extraction (`pypdf`) showing bullets immediately following their parent entry. Always re-run the ATS dump-text check after touching this CSS block, not just a visual page read.
- **Keep `font-kerning: none` on `body`.** With kerning on, WeasyPrint shifts kerned glyph pairs (Source Sans Pro `P.`, bold `P,`) and the PDF text layer reads the gap as a word break: `ASP.NET` was extracted as `ASP .NET` and `ACME,` as `ACME ,`. An ATS keyword search for `ASP.NET` would miss it, though the page looked perfect. Disabling kerning (and ligatures, so `fi`/`fl` never extract as single glyphs) fixed both with no visible change and no page-count change. In the ATS dump-text check, grep the extraction for every dotted/punctuated keyword the posting uses (`ASP.NET`, `Node.js`, `Next.js`, `CI/CD`) - a visual read cannot catch this.
