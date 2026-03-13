import { Command } from "commander";
import { logger } from "../utils/logger";
import { addSharedOptions } from "../utils/shared-options";
import { withPage } from "../utils/with-page";

export const screenshot = addSharedOptions(
  new Command()
    .command("screenshot")
    .description("take a screenshot of a URL")
    .argument("<url>", "URL to screenshot")
    .argument("<path>", "file path to save the screenshot"),
).action(async (url: string, path: string, options) => {
  await withPage(url, options, async (page) => {
    await page.screenshot({ path, fullPage: true });
    logger.success(`Screenshot saved to ${path}`);
  });
});
