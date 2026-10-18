import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

// All cases fail validation before any network request, so the suite is
// network-free. add-portal.md's contract: a bogus flag or bad numeric value
// exits 1 with a JSON error on stderr, never a silently discarded filter.

describe("free-work-search CLI flag validation", () => {
  test("a bogus --flag exits 1 with a JSON error instead of being silently discarded", async () => {
    const result = await runCLI(["search", "--query", "devops", "--bogus-flag", "xyz"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("UNKNOWN_FLAG");
    expect(error.error).toContain("--bogus-flag");
  });

  test("an undeclared short flag exits 1 with a JSON error", async () => {
    const result = await runCLI(["search", "-z", "bogus"]);
    expect(result.exitCode).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("UNKNOWN_FLAG");
    expect(error.error).toContain("-z");
  });

  test("the declared short -q passes the guard (proven via a later validation error)", async () => {
    const result = await runCLI(["search", "-q", "devops", "--page", "0"]);
    expect(result.exitCode).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("BAD_ARG");
    expect(error.error).toContain("--page");
  });

  test("--page=0 is rejected on the 1-indexed portal", async () => {
    const result = await runCLI(["search", "--page", "0"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG");
  });

  test("--limit=1.5 is rejected as non-integer", async () => {
    const result = await runCLI(["search", "--limit", "1.5"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG");
  });

  test("--jobage=-5 is rejected", async () => {
    const result = await runCLI(["search", "--jobage", "-5"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("UNKNOWN_FLAG");
  });

  test("detail with an unparseable id exits 1 with BAD_ID", async () => {
    const result = await runCLI(["detail", "not a valid id or url"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("BAD_ID");
  });

  test("detail with no id exits 1 with NO_ID", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("NO_ID");
  });

  test("-h prints help rather than being rejected as unknown", async () => {
    const result = await runCLI(["search", "-h"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
  });
});
