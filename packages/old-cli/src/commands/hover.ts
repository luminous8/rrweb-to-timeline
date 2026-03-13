import { Command } from "commander";
import { addSharedOptions } from "../utils/shared-options";
import { withLocator } from "../utils/with-locator";

export const hover = addSharedOptions(
  new Command()
    .command("hover")
    .description("hover over an element by ref")
    .argument("<url>", "URL to navigate to")
    .argument("<ref>", "element ref to hover (e.g. e1, e2)"),
).action(async (url: string, ref: string, options) => {
  await withLocator(url, ref, options, (locator) => locator.hover());
});
