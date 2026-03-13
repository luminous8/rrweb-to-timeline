import { snapshot as takeSnapshot } from "@browser-tester/browser";
import type { Locator } from "playwright";
import { logger } from "./logger";
import type { SharedOptions } from "./shared-options";
import { withPage } from "./with-page";

export const withLocator = async (
  url: string,
  ref: string,
  options: SharedOptions,
  action: (locator: Locator) => Promise<void>,
) => {
  await withPage(url, options, async (page) => {
    const before = await takeSnapshot(page, { timeout: options.timeout });
    await action(before.locator(ref));

    const after = await takeSnapshot(page, { timeout: options.timeout });
    logger.log(after.tree);
  });
};
