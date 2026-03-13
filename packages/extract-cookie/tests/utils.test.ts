import { describe, expect, it } from "vitest";

import type { Cookie } from "../src/types.js";
import { dedupeCookies } from "../src/utils/dedupe-cookies.js";
import { expandHostCandidates } from "../src/utils/expand-host-candidates.js";
import { formatWarning } from "../src/utils/format-warning.js";
import {
  hostMatchesCookieDomain,
  hostMatchesAny,
  originsToHosts,
} from "../src/utils/host-matching.js";
import { normalizeExpiration } from "../src/utils/normalize-expiration.js";
import { normalizeSameSite } from "../src/utils/normalize-same-site.js";
import { buildHostWhereClause, sqlLiteral, sqliteBool } from "../src/utils/sql.js";
import { stripLeadingDot } from "../src/utils/strip-leading-dot.js";

describe("stripLeadingDot", () => {
  it("strips leading dot", () => {
    expect(stripLeadingDot(".example.com")).toBe("example.com");
  });

  it("leaves clean domain alone", () => {
    expect(stripLeadingDot("example.com")).toBe("example.com");
  });

  it("handles empty string", () => {
    expect(stripLeadingDot("")).toBe("");
  });

  it("strips only the first dot", () => {
    expect(stripLeadingDot("..example.com")).toBe(".example.com");
  });

  it("handles dot-only string", () => {
    expect(stripLeadingDot(".")).toBe("");
  });
});

describe("hostMatchesCookieDomain", () => {
  it("matches exact domain", () => {
    expect(hostMatchesCookieDomain("example.com", "example.com")).toBe(true);
  });

  it("matches subdomain against parent domain", () => {
    expect(hostMatchesCookieDomain("sub.example.com", "example.com")).toBe(true);
  });

  it("matches with leading dot", () => {
    expect(hostMatchesCookieDomain("sub.example.com", ".example.com")).toBe(true);
  });

  it("does not match unrelated domain", () => {
    expect(hostMatchesCookieDomain("other.com", "example.com")).toBe(false);
  });

  it("does not match partial suffix", () => {
    expect(hostMatchesCookieDomain("notexample.com", "example.com")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(hostMatchesCookieDomain("Sub.Example.COM", "example.com")).toBe(true);
  });

  it("matches deeply nested subdomain", () => {
    expect(hostMatchesCookieDomain("a.b.c.example.com", "example.com")).toBe(true);
  });

  it("does not match parent against child", () => {
    expect(hostMatchesCookieDomain("example.com", "sub.example.com")).toBe(false);
  });

  it("handles empty cookie domain", () => {
    expect(hostMatchesCookieDomain("example.com", "")).toBe(false);
  });
});

describe("hostMatchesAny", () => {
  it("returns true when any host matches", () => {
    expect(hostMatchesAny(["example.com", "other.com"], ".example.com")).toBe(true);
  });

  it("returns false when no host matches", () => {
    expect(hostMatchesAny(["other.com"], "example.com")).toBe(false);
  });

  it("returns false for empty hosts array", () => {
    expect(hostMatchesAny([], "example.com")).toBe(false);
  });

  it("matches subdomain host against parent cookie domain", () => {
    expect(hostMatchesAny(["sub.example.com"], "example.com")).toBe(true);
  });
});

describe("originsToHosts", () => {
  it("extracts hostnames from URLs", () => {
    expect(originsToHosts(["https://example.com/path"])).toEqual(["example.com"]);
  });

  it("handles multiple URLs", () => {
    expect(originsToHosts(["https://a.com", "https://b.com"])).toEqual(["a.com", "b.com"]);
  });

  it("strips port numbers", () => {
    expect(originsToHosts(["https://example.com:8080/path"])).toEqual(["example.com"]);
  });

  it("handles empty array", () => {
    expect(originsToHosts([])).toEqual([]);
  });

  it("throws on invalid URL", () => {
    expect(() => originsToHosts(["not-a-url"])).toThrow();
  });
});

describe("expandHostCandidates", () => {
  it("returns single-label hosts as-is", () => {
    expect(expandHostCandidates("localhost")).toEqual(["localhost"]);
  });

  it("expands two-label host", () => {
    expect(expandHostCandidates("example.com")).toEqual(["example.com"]);
  });

  it("expands three-label host to include parent", () => {
    const candidates = expandHostCandidates("sub.example.com");
    expect(candidates).toContain("sub.example.com");
    expect(candidates).toContain("example.com");
    expect(candidates).toHaveLength(2);
  });

  it("expands four-label host", () => {
    const candidates = expandHostCandidates("a.b.example.com");
    expect(candidates).toContain("a.b.example.com");
    expect(candidates).toContain("b.example.com");
    expect(candidates).toContain("example.com");
    expect(candidates).toHaveLength(3);
  });

  it("does not produce duplicates", () => {
    const candidates = expandHostCandidates("sub.example.com");
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("handles empty string", () => {
    expect(expandHostCandidates("")).toEqual([""]);
  });
});

describe("sqlLiteral", () => {
  it("wraps value in single quotes", () => {
    expect(sqlLiteral("hello")).toBe("'hello'");
  });

  it("escapes single quotes", () => {
    expect(sqlLiteral("it's")).toBe("'it''s'");
  });

  it("handles empty string", () => {
    expect(sqlLiteral("")).toBe("''");
  });

  it("escapes multiple single quotes", () => {
    expect(sqlLiteral("it''s")).toBe("'it''''s'");
  });

  it("handles strings with no special chars", () => {
    expect(sqlLiteral("example.com")).toBe("'example.com'");
  });
});

describe("buildHostWhereClause", () => {
  it("builds clauses for exact, dot-prefix, and like patterns", () => {
    const clause = buildHostWhereClause(["example.com"], "host_key");
    expect(clause).toContain("host_key = 'example.com'");
    expect(clause).toContain("host_key = '.example.com'");
    expect(clause).toContain("host_key LIKE '%.example.com'");
  });

  it("returns 1=0 for empty hosts", () => {
    expect(buildHostWhereClause([], "host")).toBe("1=0");
  });

  it("handles multiple hosts", () => {
    const clause = buildHostWhereClause(["a.com", "b.com"], "host_key");
    expect(clause).toContain("host_key = 'a.com'");
    expect(clause).toContain("host_key = 'b.com'");
  });

  it("escapes SQL injection in host names", () => {
    const clause = buildHostWhereClause(["evil'; DROP TABLE--"], "host");
    expect(clause).toContain("evil''; DROP TABLE--");
    expect(clause).not.toContain("evil'; DROP");
  });

  it("expands subdomains into parent candidates", () => {
    const clause = buildHostWhereClause(["sub.example.com"], "host_key");
    expect(clause).toContain("host_key = 'example.com'");
    expect(clause).toContain("host_key = 'sub.example.com'");
  });
});

describe("normalizeExpiration", () => {
  it("returns undefined for undefined", () => {
    expect(normalizeExpiration(undefined)).toBeUndefined();
  });

  it("returns undefined for zero", () => {
    expect(normalizeExpiration(0)).toBeUndefined();
  });

  it("returns undefined for negative", () => {
    expect(normalizeExpiration(-1)).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(normalizeExpiration(NaN)).toBeUndefined();
  });

  it("passes through unix seconds", () => {
    expect(normalizeExpiration(1700000000)).toBe(1700000000);
  });

  it("converts milliseconds to seconds", () => {
    expect(normalizeExpiration(1700000000000)).toBe(1700000000);
  });

  it("converts chrome microseconds (since 1601) to unix seconds", () => {
    const chromeMicro = 13_350_000_000_000_000;
    const result = normalizeExpiration(chromeMicro);
    expect(result).toBeDefined();
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThan(253_402_300_799);
  });

  it("handles bigint unix seconds", () => {
    expect(normalizeExpiration(1700000000n)).toBe(1700000000);
  });

  it("handles bigint chrome microseconds", () => {
    const result = normalizeExpiration(13_350_000_000_000_000n);
    expect(result).toBeDefined();
    expect(result!).toBeGreaterThan(0);
  });

  it("returns undefined for bigint zero", () => {
    expect(normalizeExpiration(0n)).toBeUndefined();
  });

  it("returns undefined for negative bigint", () => {
    expect(normalizeExpiration(-100n)).toBeUndefined();
  });

  it("converts bigint milliseconds to seconds", () => {
    expect(normalizeExpiration(1700000000000n)).toBe(1700000000);
  });

  it("handles boundary between seconds and milliseconds", () => {
    expect(normalizeExpiration(9_999_999_999)).toBe(9_999_999_999);
    expect(normalizeExpiration(10_000_000_001)).toBe(10_000_000);
  });

  it("handles values just above chrome threshold", () => {
    const chromeMicro = 13_300_000_000_000_000;
    const result = normalizeExpiration(chromeMicro);
    expect(result).toBeDefined();
    expect(result!).toBeGreaterThan(0);
  });

  it("precise chrome epoch roundtrip", () => {
    const chromeMicros = (11_644_473_600 + 1_700_000_000) * 1_000_000;
    expect(normalizeExpiration(chromeMicros)).toBe(1_700_000_000);
  });

  it("precise chrome epoch roundtrip with bigint", () => {
    const chromeMicros = (11_644_473_600n + 1_700_000_000n) * 1_000_000n;
    expect(normalizeExpiration(chromeMicros)).toBe(1_700_000_000);
  });

  it("converts string unix seconds", () => {
    expect(normalizeExpiration("1700000000")).toBe(1_700_000_000);
  });

  it("converts string milliseconds", () => {
    expect(normalizeExpiration("1700000000000")).toBe(1_700_000_000);
  });

  it("converts string chrome microseconds", () => {
    expect(normalizeExpiration("13446467996267834")).toBe(1_801_994_396);
  });

  it("treats 253B as milliseconds (not seconds)", () => {
    expect(normalizeExpiration(253_402_300_800)).toBe(253_402_301);
    expect(normalizeExpiration("253402300800")).toBe(253_402_301);
  });

  it("accepts values in seconds range up to threshold", () => {
    expect(normalizeExpiration(9_999_999_999)).toBe(9_999_999_999);
  });

  it("clamps via bigint chrome epoch for far-future", () => {
    const farFuture = (253_402_300_800n + 11_644_473_600n) * 1_000_000n;
    expect(normalizeExpiration(farFuture)).toBeUndefined();
  });

  it("returns undefined for non-finite string", () => {
    expect(normalizeExpiration("not-a-number")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeExpiration("")).toBeUndefined();
  });

  it("returns undefined for string zero", () => {
    expect(normalizeExpiration("0")).toBeUndefined();
  });

  it("returns undefined for string negative", () => {
    expect(normalizeExpiration("-1")).toBeUndefined();
  });

  it("returns undefined for Infinity string", () => {
    expect(normalizeExpiration("Infinity")).toBeUndefined();
  });
});

describe("normalizeSameSite", () => {
  it("maps 0 to None", () => {
    expect(normalizeSameSite(0)).toBe("None");
  });

  it("maps 1 to Lax", () => {
    expect(normalizeSameSite(1)).toBe("Lax");
  });

  it("maps 2 to Strict", () => {
    expect(normalizeSameSite(2)).toBe("Strict");
  });

  it("handles string numbers", () => {
    expect(normalizeSameSite("0")).toBe("None");
    expect(normalizeSameSite("1")).toBe("Lax");
    expect(normalizeSameSite("2")).toBe("Strict");
  });

  it("handles string names case-insensitively", () => {
    expect(normalizeSameSite("strict")).toBe("Strict");
    expect(normalizeSameSite("LAX")).toBe("Lax");
    expect(normalizeSameSite("none")).toBe("None");
  });

  it("handles no_restriction", () => {
    expect(normalizeSameSite("no_restriction")).toBe("None");
  });

  it("returns undefined for unknown number", () => {
    expect(normalizeSameSite(99)).toBeUndefined();
    expect(normalizeSameSite(-1)).toBeUndefined();
    expect(normalizeSameSite(3)).toBeUndefined();
  });

  it("returns undefined for unknown string", () => {
    expect(normalizeSameSite("unknown")).toBeUndefined();
    expect(normalizeSameSite("")).toBeUndefined();
  });

  it("handles bigint", () => {
    expect(normalizeSameSite(0n)).toBe("None");
    expect(normalizeSameSite(1n)).toBe("Lax");
    expect(normalizeSameSite(2n)).toBe("Strict");
  });

  it("returns undefined for null and undefined", () => {
    expect(normalizeSameSite(null)).toBeUndefined();
    expect(normalizeSameSite(undefined)).toBeUndefined();
  });

  it("returns undefined for boolean", () => {
    expect(normalizeSameSite(true)).toBeUndefined();
    expect(normalizeSameSite(false)).toBeUndefined();
  });
});

describe("sqliteBool", () => {
  it("returns true for 1", () => {
    expect(sqliteBool(1)).toBe(true);
  });

  it("returns true for 1n", () => {
    expect(sqliteBool(1n)).toBe(true);
  });

  it("returns false for 0", () => {
    expect(sqliteBool(0)).toBe(false);
  });

  it("returns false for 0n", () => {
    expect(sqliteBool(0n)).toBe(false);
  });

  it("returns false for null", () => {
    expect(sqliteBool(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(sqliteBool(undefined)).toBe(false);
  });

  it("returns false for truthy non-1 values", () => {
    expect(sqliteBool(2)).toBe(false);
    expect(sqliteBool("1")).toBe(false);
    expect(sqliteBool(true)).toBe(false);
  });
});

describe("formatWarning", () => {
  it("formats error objects", () => {
    expect(formatWarning("chrome", "failed", new Error("boom"))).toBe("chrome: failed: boom");
  });

  it("formats string errors", () => {
    expect(formatWarning("firefox", "oops", "bad")).toBe("firefox: oops: bad");
  });

  it("formats number errors", () => {
    expect(formatWarning("safari", "code", 42)).toBe("safari: code: 42");
  });

  it("formats null errors", () => {
    expect(formatWarning("chrome", "fail", null)).toBe("chrome: fail: null");
  });
});

describe("dedupeCookies", () => {
  const makeCookie = (name: string, domain: string, cookiePath: string, value: string): Cookie => ({
    name,
    value,
    domain,
    path: cookiePath,
    secure: false,
    httpOnly: false,
    browser: "chrome",
  });

  it("removes duplicates by name|domain|path", () => {
    const cookies = [
      makeCookie("session", "example.com", "/", "abc"),
      makeCookie("session", "example.com", "/", "def"),
    ];
    const result = dedupeCookies(cookies);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("abc");
  });

  it("keeps cookies with different paths", () => {
    const cookies = [
      makeCookie("session", "example.com", "/", "abc"),
      makeCookie("session", "example.com", "/api", "def"),
    ];
    expect(dedupeCookies(cookies)).toHaveLength(2);
  });

  it("keeps cookies with different domains", () => {
    const cookies = [
      makeCookie("session", "a.com", "/", "abc"),
      makeCookie("session", "b.com", "/", "def"),
    ];
    expect(dedupeCookies(cookies)).toHaveLength(2);
  });

  it("keeps cookies with different names", () => {
    const cookies = [
      makeCookie("a", "example.com", "/", "1"),
      makeCookie("b", "example.com", "/", "2"),
    ];
    expect(dedupeCookies(cookies)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(dedupeCookies([])).toEqual([]);
  });

  it("preserves first occurrence order", () => {
    const cookies = [
      makeCookie("a", "x.com", "/", "first"),
      makeCookie("b", "x.com", "/", "second"),
      makeCookie("a", "x.com", "/", "duplicate"),
    ];
    const result = dedupeCookies(cookies);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("a");
    expect(result[0].value).toBe("first");
    expect(result[1].name).toBe("b");
  });

  it("handles triple duplicates", () => {
    const cookies = [
      makeCookie("x", "d.com", "/", "1"),
      makeCookie("x", "d.com", "/", "2"),
      makeCookie("x", "d.com", "/", "3"),
    ];
    const result = dedupeCookies(cookies);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("1");
  });
});
