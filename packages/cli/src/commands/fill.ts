import { Command } from "commander";
import { addSharedOptions } from "../utils/shared-options";
import { withLocator } from "../utils/with-locator";

export const fill = addSharedOptions(
  new Command()
    .command("fill")
    .description("fill an input element by ref")
    .argument("<url>", "URL to navigate to")
    .argument("<ref>", "element ref to fill (e.g. e1, e2)")
    .argument("<value>", "value to fill"),
).action(async (url: string, ref: string, value: string, options) => {
  await withLocator(url, ref, options, (locator) => locator.fill(value));
});
