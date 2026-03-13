import {
  detectBrowserProfiles,
  detectDefaultBrowser,
  extractAllProfileCookies,
  extractCookies,
} from "@browser-tester/cookies";
import { tmpdir } from "node:os";
import type { Browser as BrowserKey, Cookie } from "@browser-tester/cookies";
import { chromium } from "playwright";
import { HEADLESS_CHROMIUM_ARGS, LIVE_CHROME_REMOTE_DEBUGGING_HELP_URL } from "./constants";
import { injectCookies } from "./inject-cookies";
import type { CreatePageOptions, CreatePageResult, VideoOptions } from "./types";
import { resolveLiveChromeCdpEndpoint } from "./utils/resolve-live-chrome-cdp-endpoint";

const extractDefaultBrowserCookies = async (
  url: string,
  defaultBrowser: BrowserKey | null,
): Promise<Cookie[]> => {
  if (defaultBrowser) {
    const profiles = detectBrowserProfiles({ browser: defaultBrowser });

    if (profiles.length > 0) {
      const result = await extractAllProfileCookies(profiles);
      if (result.cookies.length > 0) return result.cookies;
    }
  }

  const browsers = defaultBrowser ? [defaultBrowser] : undefined;
  const result = await extractCookies({ url, browsers });
  return result.cookies;
};

const resolveVideoOptions = (
  video: boolean | VideoOptions | undefined,
): VideoOptions | undefined => {
  if (!video) return undefined;
  if (video === true) return { dir: tmpdir() };
  return video;
};

const navigatePage = async (
  page: CreatePageResult["page"],
  url: string | undefined,
  waitUntil: CreatePageOptions["waitUntil"],
) => {
  if (!url) return;
  await page.goto(url, { waitUntil: waitUntil ?? "load" });
};

const matchesTabUrl = (pageUrl: string, tabUrlMatch: string | undefined): boolean => {
  if (!tabUrlMatch) return true;
  return pageUrl.includes(tabUrlMatch);
};

const matchesTabTitle = (pageTitle: string, tabTitleMatch: string | undefined): boolean => {
  if (!tabTitleMatch) return true;
  return pageTitle.toLowerCase().includes(tabTitleMatch.toLowerCase());
};

const formatTabSelection = (options: CreatePageOptions): string => {
  if (typeof options.tabIndex === "number") return `index ${options.tabIndex}`;

  const filters = [
    options.tabUrlMatch ? `URL containing "${options.tabUrlMatch}"` : null,
    options.tabTitleMatch ? `title containing "${options.tabTitleMatch}"` : null,
  ].filter((value): value is string => value !== null);

  if (filters.length === 0) return "the most recent tab";
  return filters.join(" and ");
};

const selectExistingLiveChromePage = async (
  options: CreatePageOptions,
  browser: CreatePageResult["browser"],
): Promise<CreatePageResult> => {
  const [context] = browser.contexts();
  if (!context) {
    throw new Error("Connected to Chrome, but no browser context was available to attach to.");
  }

  const pages = context.pages();
  if (pages.length === 0) {
    throw new Error(
      "No tabs are open in the live Chrome session. Open a Chrome tab first or use new-tab mode.",
    );
  }

  if (typeof options.tabIndex === "number") {
    if (options.tabIndex < 0 || options.tabIndex >= pages.length) {
      throw new Error(
        `Tab index ${options.tabIndex} is out of range. Chrome currently has ${pages.length} tab(s).`,
      );
    }

    return {
      browser,
      context,
      page: pages[options.tabIndex],
      ownsBrowser: false,
      ownsPage: false,
    };
  }

  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index];
    const pageTitle = await page.title().catch(() => "");
    if (
      matchesTabUrl(page.url(), options.tabUrlMatch) &&
      matchesTabTitle(pageTitle, options.tabTitleMatch)
    ) {
      return {
        browser,
        context,
        page,
        ownsBrowser: false,
        ownsPage: false,
      };
    }
  }

  throw new Error(`No live Chrome tab matched ${formatTabSelection(options)}.`);
};

const connectToLiveChrome = async (cdpEndpoint: string): Promise<CreatePageResult["browser"]> => {
  try {
    return await chromium.connectOverCDP(cdpEndpoint);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not connect to live Chrome at ${cdpEndpoint}. Enable remote debugging in ${LIVE_CHROME_REMOTE_DEBUGGING_HELP_URL} and make sure Chrome is listening on that endpoint. Original error: ${errorMessage}`,
    );
  }
};

const createLiveChromePage = async (
  url: string | undefined,
  options: CreatePageOptions,
): Promise<CreatePageResult> => {
  const liveChromeCdpEndpoint = await resolveLiveChromeCdpEndpoint(options.cdpEndpoint);
  const browser = await connectToLiveChrome(liveChromeCdpEndpoint);

  try {
    const [context] = browser.contexts();
    if (!context) {
      throw new Error("Connected to Chrome, but no browser context was available to reuse.");
    }

    if (options.tabMode === "attach") {
      const attachedPage = await selectExistingLiveChromePage(options, browser);
      await navigatePage(attachedPage.page, url, options.waitUntil);
      return attachedPage;
    }

    const page = await context.newPage();
    await navigatePage(page, url, options.waitUntil);

    return {
      browser,
      context,
      page,
      ownsBrowser: false,
      ownsPage: true,
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
};

const createLaunchedPage = async (
  url: string | undefined,
  options: CreatePageOptions,
): Promise<CreatePageResult> => {
  const browser = await chromium.launch({
    headless: !options.headed,
    executablePath: options.executablePath,
    args: HEADLESS_CHROMIUM_ARGS,
  });

  try {
    const recordVideo = resolveVideoOptions(options.video);
    const context = await browser.newContext(recordVideo ? { recordVideo } : undefined);

    if (options.cookies) {
      const cookies = Array.isArray(options.cookies)
        ? options.cookies
        : await extractDefaultBrowserCookies(url ?? "", await detectDefaultBrowser());
      await injectCookies(context, cookies);
    }

    const page = await context.newPage();
    await navigatePage(page, url, options.waitUntil);

    return {
      browser,
      context,
      page,
      ownsBrowser: true,
      ownsPage: true,
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
};

export const createPage = async (
  url: string | undefined,
  options: CreatePageOptions = {},
): Promise<CreatePageResult> => {
  if (options.liveChrome) {
    return createLiveChromePage(url, {
      ...options,
      tabMode: options.tabMode ?? "new",
    });
  }

  return createLaunchedPage(url, options);
};
