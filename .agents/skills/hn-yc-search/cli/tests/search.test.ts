import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"
import { parseHNJobStory } from "../src/helpers.js"

interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}
interface SearchResponse {
  meta: { count: number; page: number }
  results: JobResult[]
}

describe("search --source hn (live)", () => {
  test("returns real results from the current Who is hiring thread", async () => {
    const result = await runCLI(["search", "--source", "hn", "-q", "engineer", "--limit", "5"])
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const r of data.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.url).toContain("news.ycombinator.com/item?id=")
    }
  })
})

describe("search --source hn-jobs (live)", () => {
  test("returns real results from the HN /jobs page", async () => {
    const result = await runCLI(["search", "--source", "hn-jobs", "--limit", "5"])
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const r of data.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.date).toBeTruthy()
      expect(r.url).toMatch(/^https?:\/\//)
    }
  })
})

describe("parseHNJobStory", () => {
  const base = { id: 1, time: 1791720068, type: "job" }

  test("takes the company from the YC batch tag and a remote location from parentheses", () => {
    const r = parseHNJobStory({
      ...base,
      title: "Jiga (YC W21) Is Hiring Product Engineer (Remote/US)",
      url: "https://jiga.io/careers",
    })
    expect(r?.company).toBe("Jiga")
    expect(r?.location).toBe("Remote/US")
    expect(r?.url).toBe("https://jiga.io/careers")
    expect(r?.date).toBe("2026-10-11T12:01:08.000Z")
  })

  test("falls back to the text before 'is hiring' and to the HN item url", () => {
    const r = parseHNJobStory({ ...base, title: "Acme Corp is hiring SREs" })
    expect(r?.company).toBe("Acme Corp")
    expect(r?.location).toBeNull()
    expect(r?.url).toBe("https://news.ycombinator.com/item?id=1")
  })

  test("drops deleted, dead, untitled and non-job items", () => {
    expect(parseHNJobStory(null)).toBeNull()
    expect(parseHNJobStory({ ...base, title: "X is hiring", deleted: true })).toBeNull()
    expect(parseHNJobStory({ ...base, title: "X is hiring", dead: true })).toBeNull()
    expect(parseHNJobStory({ ...base })).toBeNull()
    expect(parseHNJobStory({ ...base, title: "Show HN: X", type: "story" })).toBeNull()
  })
})

describe("search --source yc-internships (live)", () => {
  test("returns real results from the internships listing", async () => {
    const result = await runCLI(["search", "--source", "yc-internships", "--limit", "5"])
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const r of data.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.company).toBeTruthy()
      expect(r.url).toContain("ycombinator.com")
    }
  })
})

describe("cli flag validation", () => {
  test("unknown flag exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--bogus", "x"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("--jobage with --source yc-internships is rejected, not silently ignored", async () => {
    const result = await runCLI(["search", "--source", "yc-internships", "--jobage", "7"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("UNSUPPORTED_FLAG")
  })

  test("detail with no id exits 1", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NO_ID")
  })
})
