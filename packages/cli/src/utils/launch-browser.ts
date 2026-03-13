import { readFileSync } from "node:fs";
import { injectCookies } from "@browser-tester/browser";
import { chromium } from "playwright";
import type { SharedOptions } from "./shared-options";

export const launchBrowser = async (url: string, options: SharedOptions) => {
  const browser = await chromium.launch({
    headless: !options.headed,
    executablePath: options.executablePath,
  });
  const context = await browser.newContext();

  if (options.cookiesFile) {
    const cookiesJson = readFileSync(options.cookiesFile, "utf-8");
    const cookies = JSON.parse(cookiesJson);
    await context.addCookies(cookies);
  } else if (options.cookies) {
    await injectCookies(context, {
      url,
      browsers: options.cookieBrowsers,
    });
  }

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });

  return { browser, context, page };
};
