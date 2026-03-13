import { snapshot as takeSnapshot } from "@browser-tester/browser";
import { Command } from "commander";
import { logger } from "../utils/logger";
import { addSharedOptions } from "../utils/shared-options";
import { withPage } from "../utils/with-page";

export const snapshot = addSharedOptions(
  new Command()
    .command("snapshot")
    .description("take an ARIA snapshot of a URL")
    .argument("<url>", "URL to snapshot")
    .option("--json", "output as JSON"),
).action(async (url: string, options) => {
  await withPage(url, options, async (page) => {
    const result = await takeSnapshot(page, { timeout: options.timeout });

    if (options.json) {
      logger.log(JSON.stringify({ tree: result.tree, refs: result.refs }, null, 2));
    } else {
      logger.log(result.tree);
    }
  });
});
