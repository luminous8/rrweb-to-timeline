import { describe, expect, it } from "vitest";

import { CookieJar } from "../src/jar.js";
import type { Cookie } from "../src/types.js";

const cookie = (overrides: Partial<Cookie> = {}): Cookie => ({
  name: "session",
  value: "abc123",
  domain: "example.com",
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "Lax",
  browser: "chrome",
  ...overrides,
});

describe("CookieJar", () => {
  describe("match", () => {
    it("matches cookie by domain", () => {
      const jar = new CookieJar([cookie()]);
      expect(jar.match("https://example.com/")).toHaveLength(1);
    });

    it("matches subdomain against parent domain", () => {
      const jar = new CookieJar([cookie()]);
      expect(jar.match("https://sub.example.com/")).toHaveLength(1);
    });

    it("rejects unrelated domain", () => {
      const jar = new CookieJar([cookie()]);
      expect(jar.match("https://other.com/")).toHaveLength(0);
    });

    it("rejects path mismatch", () => {
      const jar = new CookieJar([cookie({ path: "/api" })]);
      expect(jar.match("https://example.com/")).toHaveLength(0);
    });

    it("matches path prefix", () => {
      const jar = new CookieJar([cookie({ path: "/api" })]);
      expect(jar.match("https://example.com/api/users")).toHaveLength(1);
    });

    it("rejects secure cookie on http", () => {
      const jar = new CookieJar([cookie({ secure: true })]);
      expect(jar.match("http://example.com/")).toHaveLength(0);
    });

    it("allows non-secure cookie on http", () => {
      const jar = new CookieJar([cookie({ secure: false })]);
      expect(jar.match("http://example.com/")).toHaveLength(1);
    });

    it("excludes expired cookies", () => {
      const jar = new CookieJar([cookie({ expires: 1 })]);
      expect(jar.match("https://example.com/")).toHaveLength(0);
    });

    it("includes session cookies (no expires)", () => {
      const jar = new CookieJar([cookie({ expires: undefined })]);
      expect(jar.match("https://example.com/")).toHaveLength(1);
    });
  });

  describe("toCookieHeader", () => {
    it("formats matching cookies as header", () => {
      const jar = new CookieJar([
        cookie({ name: "a", value: "1" }),
        cookie({ name: "b", value: "2" }),
      ]);
      expect(jar.toCookieHeader("https://example.com/")).toBe("a=1; b=2");
    });

    it("returns empty string for no matches", () => {
      const jar = new CookieJar([cookie()]);
      expect(jar.toCookieHeader("https://other.com/")).toBe("");
    });
  });

  describe("toPlaywright", () => {
    it("maps all fields", () => {
      const jar = new CookieJar([cookie({ expires: 1700000000 })]);
      const [pw] = jar.toPlaywright();
      expect(pw.name).toBe("session");
      expect(pw.value).toBe("abc123");
      expect(pw.domain).toBe(".example.com");
      expect(pw.path).toBe("/");
      expect(pw.expires).toBe(1700000000);
      expect(pw.secure).toBe(true);
      expect(pw.httpOnly).toBe(true);
      expect(pw.sameSite).toBe("Lax");
    });

    it("defaults sameSite to Lax", () => {
      const jar = new CookieJar([cookie({ sameSite: undefined })]);
      expect(jar.toPlaywright()[0].sameSite).toBe("Lax");
    });

    it("uses -1 for session cookies", () => {
      const jar = new CookieJar([cookie({ expires: undefined })]);
      expect(jar.toPlaywright()[0].expires).toBe(-1);
    });

    it("prefixes domain with dot", () => {
      const jar = new CookieJar([cookie({ domain: "example.com" })]);
      expect(jar.toPlaywright()[0].domain).toBe(".example.com");
    });

    it("does not double-dot domain", () => {
      const jar = new CookieJar([cookie({ domain: ".example.com" })]);
      expect(jar.toPlaywright()[0].domain).toBe(".example.com");
    });
  });

  describe("toPuppeteer", () => {
    it("maps all fields", () => {
      const jar = new CookieJar([cookie({ expires: 1700000000, sameSite: "Strict" })]);
      const [pp] = jar.toPuppeteer();
      expect(pp.name).toBe("session");
      expect(pp.expires).toBe(1700000000);
      expect(pp.sameSite).toBe("Strict");
    });

    it("preserves undefined sameSite", () => {
      const jar = new CookieJar([cookie({ sameSite: undefined })]);
      expect(jar.toPuppeteer()[0].sameSite).toBeUndefined();
    });
  });

  describe("toJSON / fromJSON", () => {
    it("round-trips cookies", () => {
      const original = [cookie({ name: "x", value: "y" })];
      const jar = new CookieJar(original);
      const restored = CookieJar.fromJSON(jar.toJSON());
      expect(restored.cookies).toEqual(original);
    });

    it("round-trips empty jar", () => {
      const jar = new CookieJar([]);
      const restored = CookieJar.fromJSON(jar.toJSON());
      expect(restored.cookies).toEqual([]);
    });
  });
});
