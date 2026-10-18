import { describe, expect, test } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

describe("themuse-cli live smoke test", () => {
  test("search returns internship results with non-null id/title/url", async () => {
    const result = await runCLI([
      "search",
      "--category",
      "Software Engineering",
      "--level",
      "Internship",
      "--format",
      "json",
    ]);
    const parsed = parseJSON<{ meta: { count: number }; results: Array<Record<string, unknown>> }>(result);

    expect(result.exitCode).toBe(0);
    expect(parsed.results.length).toBeGreaterThan(0);
    for (const job of parsed.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toBeTruthy();
    }
  });

  test("--page 100 is rejected before hitting the API's own hard limit", async () => {
    const result = await runCLI(["search", "--page", "100"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("PAGE_TOO_HIGH");
  });

  test("a bogus flag exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--bogus-flag", "xyz"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("UNKNOWN_FLAG");
  });

  test("detail without an id fails before making a request", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("NO_ID");
  });

  test("detail with a non-numeric id fails before making a request", async () => {
    const result = await runCLI(["detail", "not-a-number"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("BAD_ID");
  });
});
