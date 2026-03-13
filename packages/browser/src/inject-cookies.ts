import { CookieJar, extractCookies } from "@browser-tester/extract-cookie";
import type { BrowserContext } from "playwright";
import type { InjectCookiesOptions } from "./types";

export const injectCookies = async (
  context: BrowserContext,
  options: InjectCookiesOptions,
): Promise<void> => {
  const { cookies } = await extractCookies(options);
  const jar = new CookieJar(cookies);
  await context.addCookies(jar.toPlaywright());
};
