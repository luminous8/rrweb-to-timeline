import { Command } from "commander";
import { addSharedOptions } from "../utils/shared-options";
import { withLocator } from "../utils/with-locator";

export const select = addSharedOptions(
  new Command()
    .command("select")
    .description("select an option from a dropdown by ref")
    .argument("<url>", "URL to navigate to")
    .argument("<ref>", "element ref to select from (e.g. e1, e2)")
    .argument("<value>", "option value to select"),
).action(async (url: string, ref: string, value: string, options) => {
  await withLocator(url, ref, options, async (locator) => {
    await locator.selectOption(value);
  });
});
