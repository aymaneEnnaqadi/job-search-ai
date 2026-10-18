# /submit - Send a Drafted Application by Email

You are sending an already-drafted job application (CV + cover letter, both already compiled to PDF by `/apply`) as an email to the employer, using `tools/send_email.py` over SMTP. This is the one command in the framework that actually sends something to a third party - everything else (`/apply`, `/outcome`'s follow-up branch) only drafts text for the user to send themselves. Because of that, this command carries two independent safety gates and neither may be skipped:

1. **In-conversation approval.** Render a full preview (recipient, subject, body, attachments) and wait for the user to explicitly confirm before sending anything.
2. **Tool-permission approval.** `tools/send_email.py send` is deliberately not pre-approved in `.claude/settings.json` (only its network-free `preview` subcommand is), so Claude Code will prompt for a live permission grant on the actual send, independent of step 1.

Never attempt to bypass either gate. Never send on a general "yes" to an earlier, different question - the user must confirm this specific send.

Follow these steps **in order**.

---

## Step 0: Prerequisites

Confirm `.env` exists at the repo root with `SMTP_USER` and `SMTP_PASSWORD` set (check with the `preview` subcommand first - it does not need credentials, but `send` will fail loudly if they're missing). If `.env` does not exist, tell the user to copy `.env.example` to `.env` and fill in their SMTP credentials (see that file's comments for how to generate an app password), and stop.

---

## Step 1: Parse Input and Find the Application

`$ARGUMENTS` is a company name, e.g. `/submit cenit`.

1. Read `job_search_tracker.csv`. If it does not exist, tell the user there is nothing to send yet (suggest `/apply` first) and stop.
2. Match rows case-insensitively on company where `status` is `drafted` (the same status vocabulary `/outcome` defines - only a `drafted` row has something ready to send that hasn't been sent).
   - No argument, or no match → list all `drafted` rows (company, role, cv_file, cover_letter_file) and ask which one.
   - One match → proceed.
   - Several matches → list them and ask which.
   - A match whose status is not `drafted` (already `applied` or later) → tell the user this application was already sent (per the tracker) and ask if they want to proceed anyway; do not silently resend.

---

## Step 2: Locate the Files

Use the matched row's own `cv_file` and `cover_letter_file` columns - `/apply` already wrote these and verified them (page count, ATS text layer) before archiving. Swap each path's source extension for `.pdf` (`/apply` always compiles a PDF alongside the source file, in the same directory). If either PDF does not exist on disk, tell the user and stop rather than guessing at a path - do not try to reconstruct a filename from the `MyGenCv/[entreprise-domaine-langueCv]/` convenience folder, which uses a different, non-reversible naming scheme.

---

## Step 3: Auto-Parse Recipient and Subject

Derive the archive path `documents/applications/<company>_<role>/` via the **Subfolder naming** rule in `documents/README.md`, and read `job_posting.md` there if present.

- Search the posting text for an email address (a plain regex match is enough) and for an explicit subject-line instruction (phrases like "subject line", "objet", "sujet" followed by a quoted or colon-delimited string).
- Confident match on an explicit subject instruction → use it **verbatim, unmodified**. An employer who states an exact subject line (e.g. CENIT's `"Stage IA"`) is filtering or routing on it - changing or padding it, even to make the email stand out, reads as not following instructions and risks the email being missed by whatever rule sorts it.
- No explicit subject instruction found → draft one instead of leaving it generic: `Candidature Stage PFE 2027 - <role> - <Your Name>` (adjust the year/wording if the profile's availability date changes), so the subject line itself signals what the recruiter is looking at rather than a bare "Application" or the role title alone.
- Confident match on a recipient email → carry it into Step 4 as the default.
- No `job_posting.md`, or no confident recipient match → leave the field blank and ask the user to supply it in Step 4's confirmation instead of guessing.

Never invent a recipient address that isn't in the posting text. Never override an employer's explicit subject-line instruction, even at the user's request to make the email "stand out" - flag the conflict to the user instead of silently complying, since it is the kind of instruction-following signal recruiters and their filters actually check.

---

## Step 4: Draft a Short Body

Write one to two sentences in the CV's language (the `CV language` line in CLAUDE.md's Identity section) pointing at the attached CV and cover letter - the actual pitch lives in those documents, not the email body. Example (French): "Bonjour, Veuillez trouver ci-joint ma candidature (CV et lettre de motivation) pour le poste de [role] chez [company]. Cordialement, [name]."

---

## Step 5: Preview and Get Explicit Approval

Run (this subcommand is pre-approved, no network call):

```bash
python3 tools/send_email.py preview --to "<recipient>" --subject "<subject>" --body "<body>" --attach "<cv.pdf>" --attach "<cover_letter.pdf>"
```

Show its output to the user verbatim, followed by:

> "Type **send** to confirm, or tell me what to change (recipient, subject, body)."

**Stop and wait.** Do not proceed to Step 6 on anything other than an explicit affirmative reply to this exact prompt. If the user asks for edits, revise and re-render the preview, then ask again.

---

## Step 6: Send (Only on Explicit Confirmation)

Run the same command with `send` instead of `preview`:

```bash
python3 tools/send_email.py send --to "<recipient>" --subject "<subject>" --body "<body>" --attach "<cv.pdf>" --attach "<cover_letter.pdf>"
```

This invocation is not pre-approved, so the user will see a Claude Code permission prompt here even after their chat confirmation - that is intentional, not a bug to route around. Report the tool's own success or failure message verbatim. **If it fails, stop here** - do not update the tracker or archive as if it succeeded.

---

## Step 7: Record the Send

Only after Step 6 reports success:

1. **`job_search_tracker.csv`** - narrow diff on the matched row only, same rule `/outcome` Step 4 follows (never restructure the CSV, reorder rows, or touch other rows):
   - `status`: `drafted` -> `applied`
   - `date`: today (replaces the drafting date - the row was never marked submitted until now)
   - `notes`: append `<date> /submit: sent to <recipient> ("<subject>")`
2. **`documents/applications/<company>_<role>/outcome.md`** - create it if it doesn't exist yet, using the exact format in `documents/README.md` (`Status: in_progress`, empty stage checkboxes). Append to `## Notes` (create the section if creating the file fresh, never overwrite existing Notes history):
   ```
   YYYY-MM-DD (via /submit): sent to <recipient>, subject "<subject>".
   ```

---

## Important Rules

1. **Two independent gates, both mandatory.** The in-conversation "type send" confirmation and the tool-permission prompt on `send` both exist on purpose - never suggest adding `send` to the pre-approved allowlist, and never send without the user's explicit confirmation this run.
2. **Never guess a recipient.** An email address not found in the archived posting text must be supplied by the user, not invented.
3. **Never resend silently.** A tracker row already past `drafted` means something was already sent (by this command or by hand) - confirm with the user before sending again.
4. **State is written only after a confirmed successful send**, never speculatively before it and never on a failed send.
5. **Narrow tracker diff.** Touch only `status`, `date`, and `notes` on the matched row - identical to `/outcome`'s own rule.
