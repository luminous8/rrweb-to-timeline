export { extractCookies, SUPPORTED_BROWSERS } from "./sqlite/extract.js";

export { extractAllProfileCookies, extractProfileCookies } from "./profiles/extract.js";
export { detectBrowserProfiles } from "./profiles/detector.js";

export {
  matchCookies,
  matchCookieHeader,
  toPlaywrightCookies,
  toPuppeteerCookies,
} from "./jar.js";
export { toCookieHeader } from "./utils/format-cookie-header.js";
export { detectDefaultBrowser } from "./utils/detect-default-browser.js";

export type { PlaywrightCookie, PuppeteerCookie } from "./jar.js";
export type { DetectBrowserProfilesOptions } from "./profiles/detector.js";
export type {
  Browser,
  BrowserInfo,
  BrowserProfile,
  Cookie,
  ExtractOptions,
  ExtractProfileOptions,
  ExtractResult,
  SameSitePolicy,
} from "./types.js";
