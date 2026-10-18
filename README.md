<p align="center">
  <img src="assets/mascot/pip_flight_loop.gif" alt="Pip, the courier bird" width="160">
</p>

# Job Search AI

Your job search, run by [Claude Code](https://claude.com/claude-code) on your own machine. Fill in your profile once, then Claude finds jobs, scores them against you, writes a tailored CV and cover letter, and preps you for the interview.

---

## Where this comes from

This is built on **[ai-job-search](https://github.com/MadsLorentzen/ai-job-search)** by Mads Lorentzen (MIT license). That project gives you:

- `/setup`: builds your profile from your CV, LinkedIn export or a short interview
- `/scrape` and `/rank`: search job boards and rank the results by fit
- `/apply`: evaluates a posting, then drafts and reviews a tailored CV and cover letter in LaTeX
- `/interview` and `/outcome`: interview prep, plus tracking what happened to each application
- `/upskill`, `/expand`, `/html-report`, `/notion-sync`, `/gmail-sync`: skill gaps, profile enrichment, dashboards

The full original guide is in **[GUIDE.md](GUIDE.md)**.

## What I added

| Added | What it does |
|---|---|
| **`/submit`** | Sends a finished application (CV + cover letter PDFs) to the employer by email. It always shows you a preview and asks before sending. Setup: copy `.env.example` to `.env` and add your SMTP app password. |
| **Modern photo CV template** | A one-page HTML CV with a photo, built to PDF with WeasyPrint. To use it, run `/add-template` and point it at `templates/cv/modern-photo/`. |
| **4 new job boards** | `arbeitnow` (Europe, mostly Germany/Austria/Switzerland), `free-work` (France), `hn-yc` (Hacker News "Who is hiring" + YC startups), `themuse` (USA + remote). |
| **Codex support** | A research agent for Codex in `.codex/agents/` and mirrored skills in `.agents/skills/`. |
| **LinkedIn post spec** | A design doc for a future `/linkedin-post` command, in `docs/specs/`. |

---

## Quick start

**You need:** Claude Code, Python 3.10+, [Bun](https://bun.sh), and a LaTeX install ([MacTeX](https://tug.org/mactex/) or [TeX Live](https://tug.org/texlive/)).

### 1. Fork and clone

```bash
gh repo fork aymaneEnnaqadi/job-search-ai --clone
cd job-search-ai
```

> [!IMPORTANT]
> **A fork is always public**, and `/setup` writes your personal data (name, phone, email, work history) into tracked files. If you only want this for your own job search, use a **private repository** instead. The two-minute recipe is in [SETUP.md section 8](SETUP.md#8-pulling-upstream-updates-into-your-fork).

### 2. Install the job board tools

```bash
for tool in .agents/skills/*-search; do (cd "$tool/cli" && bun install); done
```

### 3. Create your profile

```bash
claude
```

Then inside Claude Code:

```
/setup
```

Drop your CV into `documents/cv/` first and `/setup` will read it.

### 4. Find and apply

```
/scrape                                  # find jobs
/rank                                    # score them against your profile
/apply https://example.com/job/123       # tailored CV + cover letter
/submit                                  # send it by email (asks first)
```

If a job link won't load, paste the job description after `/apply` instead.

---

## Good to know

- Your personal files (CVs, cover letters, tracker, `.env`) are gitignored and stay on your machine.
- Start over any time with `/reset`.
- Everything else (custom templates, adding job boards, all commands) is in [GUIDE.md](GUIDE.md).

## License

MIT. Original work © 2026 Mads Lorentzen. See [LICENSE](LICENSE).
