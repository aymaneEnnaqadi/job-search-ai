# free-work-search CLI

Zero-runtime-dependency CLI for searching France/Francophone-Europe tech jobs and
freelance missions on [free-work.com](https://www.free-work.com/fr/tech-it)'s public
`tech-it` vertical. No authentication, no API key - the search-results page and the
detail page are both server-rendered HTML, parsed with regex.

## Install

```bash
bun install
```

## Usage

```bash
bun run src/cli.ts search -q "devops alternance" --format table
bun run src/cli.ts detail ingenieur-devops-cloud/devops-h-f-723 --format plain
```

See the skill's `SKILL.md` for the full flag reference and `url-reference.md` for the
parsing anchors this CLI depends on.

## Development

```bash
bun run typecheck
bun run test
```

`tests/cli-flag-validation.test.ts` is network-free. `tests/search.test.ts` is a live
smoke test against the real portal - keep it to the existing one search + one detail
call rather than adding more live cases.
