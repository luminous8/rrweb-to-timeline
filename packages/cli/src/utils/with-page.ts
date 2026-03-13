import type { Page } from "playwright";
import { handleError } from "./handle-error";
import { launchBrowser } from "./launch-browser";
import type { SharedOptions } from "./shared-options";

export const withPage = async (
  url: string,
  options: SharedOptions,
  action: (page: Page) => Promise<void>,
) => {
  const { browser, page } = await launchBrowser(url, options);
  try {
    await action(page);
  } catch (error) {
    handleError(error);
  }
  await browser.close();
};
