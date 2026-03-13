import { snapshot as takeSnapshot } from "@browser-tester/browser";
import { Command } from "commander";
import { logger } from "../utils/logger";
import { addSharedOptions } from "../utils/shared-options";
import { withPage } from "../utils/with-page";

export const inspect = addSharedOptions(
  new Command()
    .command("inspect")
    .description("inspect an element by ref from an ARIA snapshot")
    .argument("<url>", "URL to snapshot")
    .argument("<ref>", "element ref to inspect (e.g. e1, e2)"),
).action(async (url: string, ref: string, options) => {
  await withPage(url, options, async (page) => {
    const result = await takeSnapshot(page, { timeout: options.timeout });

    logger.dim(result.tree);
    logger.log("");

    const elementInfo = await result.inspect(ref);
    logger.log(JSON.stringify(elementInfo, null, 2));
  });
});
