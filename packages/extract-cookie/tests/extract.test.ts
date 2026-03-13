import { describe, expect, it } from "vitest";

import { toCookieHeader } from "../src/extract.js";
import type { Cookie } from "../src/types.js";

describe("toCookieHeader", () => {
  const makeCookie = (name: string, value: string): Cookie => ({
    name,
    value,
    domain: "example.com",
    path: "/",
    secure: false,
    httpOnly: false,
    browser: "chrome",
  });

  it("formats a single cookie", () => {
    expect(toCookieHeader([makeCookie("a", "1")])).toBe("a=1");
  });

  it("joins multiple cookies with semicolons", () => {
    const cookies = [makeCookie("a", "1"), makeCookie("b", "2")];
    expect(toCookieHeader(cookies)).toBe("a=1; b=2");
  });

  it("returns empty string for no cookies", () => {
    expect(toCookieHeader([])).toBe("");
  });

  it("preserves cookie values with special characters", () => {
    expect(toCookieHeader([makeCookie("token", "abc=def/ghi")])).toBe("token=abc=def/ghi");
  });
});
