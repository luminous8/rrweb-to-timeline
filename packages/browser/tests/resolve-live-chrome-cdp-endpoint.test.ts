import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock, homedirMock, platformMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  homedirMock: vi.fn(),
  platformMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

vi.mock("node:os", () => ({
  homedir: homedirMock,
  platform: platformMock,
}));

import { resolveLiveChromeCdpEndpoint } from "../src/utils/resolve-live-chrome-cdp-endpoint";

describe("resolveLiveChromeCdpEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homedirMock.mockReturnValue("/Users/tester");
    platformMock.mockReturnValue("darwin");
  });

  it("returns the explicit endpoint when provided", async () => {
    await expect(resolveLiveChromeCdpEndpoint("http://127.0.0.1:9222")).resolves.toBe(
      "http://127.0.0.1:9222",
    );
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("resolves a websocket endpoint from DevToolsActivePort", async () => {
    readFileMock.mockResolvedValue("50449\n/devtools/browser/browser-id\n");

    await expect(resolveLiveChromeCdpEndpoint(undefined)).resolves.toBe(
      "ws://127.0.0.1:50449/devtools/browser/browser-id",
    );
    expect(readFileMock).toHaveBeenCalledWith(
      "/Users/tester/Library/Application Support/Google/Chrome/DevToolsActivePort",
      "utf8",
    );
  });

  it("throws a macOS-only guidance error on other platforms", async () => {
    platformMock.mockReturnValue("linux");

    await expect(resolveLiveChromeCdpEndpoint(undefined)).rejects.toThrow("macOS Chrome only");
  });
});
