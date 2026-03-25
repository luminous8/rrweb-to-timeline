import { describe, expect, it } from "vite-plus/test";

import { estimateBrowserCapacity, getSystemStats } from "../src/estimate-browser-capacity";

describe("getSystemStats", () => {
  it("returns valid system stats", () => {
    const stats = getSystemStats();
    expect(stats.cpuCores).toBeGreaterThan(0);
    expect(stats.totalMemoryMb).toBeGreaterThan(0);
    expect(stats.freeMemoryMb).toBeGreaterThanOrEqual(0);
    expect(stats.freeMemoryMb).toBeLessThanOrEqual(stats.totalMemoryMb);
    expect(stats.memoryUsagePercent).toBeGreaterThanOrEqual(0);
    expect(stats.memoryUsagePercent).toBeLessThanOrEqual(100);
    expect(stats.cpuLoadPercent).toBeGreaterThanOrEqual(0);
    expect(stats.cpuLoadPercent).toBeLessThanOrEqual(100);
    expect(stats.platform).toBeTruthy();
    expect(stats.arch).toBeTruthy();
  });
});

describe("estimateBrowserCapacity", () => {
  it("returns at least 1 max browser", () => {
    const capacity = estimateBrowserCapacity();
    expect(capacity.maxBrowsers).toBeGreaterThanOrEqual(1);
  });

  it("bottleneck is memory or cpu", () => {
    const capacity = estimateBrowserCapacity();
    expect(["memory", "cpu"]).toContain(capacity.bottleneck);
  });

  it("includes system stats", () => {
    const capacity = estimateBrowserCapacity();
    expect(capacity.system.cpuCores).toBeGreaterThan(0);
    expect(capacity.system.totalMemoryMb).toBeGreaterThan(0);
  });
});
