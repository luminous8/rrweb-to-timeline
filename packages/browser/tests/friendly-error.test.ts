import { describe, expect, it } from "vitest";
import { toFriendlyError } from "../src/utils/friendly-error";

describe("toFriendlyError", () => {
  it("translates strict mode violation", () => {
    const error = new Error("strict mode violation: getByRole('button') resolved to 4 elements");
    const result = toFriendlyError(error, "e1");

    expect(result.message).toBe('Ref "e1" matched 4 elements. Run snapshot to get updated refs.');
  });

  it("translates strict mode violation without count", () => {
    const error = new Error("strict mode violation");
    const result = toFriendlyError(error, "e2");

    expect(result.message).toContain("multiple elements");
  });

  it("translates pointer interception", () => {
    const error = new Error("Element intercepts pointer events");
    const result = toFriendlyError(error, "e3");

    expect(result.message).toContain("blocked by an overlay");
    expect(result.message).toContain("e3");
  });

  it("translates not visible", () => {
    const error = new Error("Element is not visible");
    const result = toFriendlyError(error, "e4");

    expect(result.message).toContain("not visible");
    expect(result.message).toContain("scrolling");
  });

  it("does not match not visible when timeout is present", () => {
    const error = new Error("Timeout exceeded: not visible");
    const result = toFriendlyError(error, "e5");

    expect(result.message).toContain("timed out");
  });

  it("translates timeout exceeded", () => {
    const error = new Error("Timeout 30000ms exceeded");
    const result = toFriendlyError(error, "e6");

    expect(result.message).toContain("timed out");
    expect(result.message).toContain("e6");
  });

  it("translates waiting for visibility", () => {
    const error = new Error("waiting for getByRole('button') to be visible");
    const result = toFriendlyError(error, "e7");

    expect(result.message).toContain("not found or not visible");
  });

  it("passes through unknown errors", () => {
    const error = new Error("Something unexpected");
    const result = toFriendlyError(error, "e8");

    expect(result).toBe(error);
  });

  it("wraps non-Error values", () => {
    const result = toFriendlyError("string error", "e9");

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("string error");
  });
});
