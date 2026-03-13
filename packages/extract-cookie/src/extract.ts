import { BROWSER_CONFIGS, extractChromiumCookies } from "./chromium.js";
import { extractFirefoxCookies } from "./firefox.js";
import { extractSafariCookies } from "./safari.js";
import type { Browser, ChromiumBrowser, ExtractOptions, ExtractResult } from "./types.js";
import { dedupeCookies } from "./utils/dedupe-cookies.js";
import { originsToHosts } from "./utils/host-matching.js";

const DEFAULT_BROWSERS: Browser[] = ["chrome", "brave", "edge", "arc", "firefox", "safari"];

const isChromiumBrowser = (browser: Browser): browser is ChromiumBrowser =>
  browser in BROWSER_CONFIGS;

export const extractCookies = async (options: ExtractOptions): Promise<ExtractResult> => {
  const browsers = options.browsers ?? DEFAULT_BROWSERS;
  const hosts = originsToHosts([options.url]);

  const tasks = browsers.map((browser) => {
    if (isChromiumBrowser(browser)) {
      return extractChromiumCookies(browser, hosts, {
        names: options.names,
        includeExpired: options.includeExpired,
        timeoutMs: options.timeoutMs,
      });
    }
    if (browser === "firefox") {
      return extractFirefoxCookies(hosts, {
        names: options.names,
        includeExpired: options.includeExpired,
      });
    }
    if (browser === "safari") {
      return extractSafariCookies(hosts, {
        names: options.names,
        includeExpired: options.includeExpired,
      });
    }
    return Promise.resolve({
      cookies: [],
      warnings: [`unsupported browser: ${browser}`],
    } satisfies ExtractResult);
  });

  const results = await Promise.all(tasks);
  const allCookies = results.flatMap((result) => result.cookies);
  const allWarnings = results.flatMap((result) => result.warnings);

  return {
    cookies: dedupeCookies(allCookies),
    warnings: allWarnings,
  };
};

export const toCookieHeader = (cookies: ExtractResult["cookies"]): string =>
  cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
