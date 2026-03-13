import type { Browser } from "@browser-tester/browser";

const VALID_BROWSERS = new Set<string>(["chrome", "edge", "brave", "arc", "firefox", "safari"]);

export const parseBrowsers = (value: string): Browser[] =>
  value.split(",").map((browser) => {
    const trimmed = browser.trim().toLowerCase();
    if (!VALID_BROWSERS.has(trimmed)) {
      throw new Error(`Unknown browser: ${trimmed}`);
    }
    return trimmed as Browser;
  });
