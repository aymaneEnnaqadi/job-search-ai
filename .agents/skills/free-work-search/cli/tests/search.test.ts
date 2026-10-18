import { describe, expect, test } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke test against the real portal (per add-portal.md Step 4/3). Keep
// volume low: one search call, one detail call.

interface SearchResult {
  meta: { count: number; page: number };
  results: Array<{ id: string; title: string; company: string | null; url: string }>;
}

describe("free-work-search live smoke test", () => {
  test("search returns real results with non-null id/title/url", async () => {
    const result = await runCLI(["search", "-q", "devops", "--limit", "5", "--format", "json"]);
    expect(result.exitCode).toBe(0);
    const data = parseJSON<SearchResult>(result);
    expect(data.results.length).toBeGreaterThan(0);
    for (const job of data.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toContain("free-work.com");
    }
  }, 30000);

  test("detail returns readable description text for a result from search", async () => {
    const searchResult = await runCLI(["search", "-q", "devops", "--limit", "1", "--format", "json"]);
    const data = parseJSON<SearchResult>(searchResult);
    expect(data.results.length).toBeGreaterThan(0);
    const [job] = data.results;

    const detailResult = await runCLI(["detail", job.id, "--format", "plain"]);
    expect(detailResult.exitCode).toBe(0);
    expect(detailResult.stdout.length).toBeGreaterThan(0);
    expect(detailResult.stdout).not.toContain("<p>");
    expect(detailResult.stdout).not.toContain("&#039;");
  }, 30000);
});
