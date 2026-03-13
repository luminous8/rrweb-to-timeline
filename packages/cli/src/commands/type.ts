import { Command } from "commander";
import { addSharedOptions } from "../utils/shared-options";
import { withLocator } from "../utils/with-locator";

export const type = addSharedOptions(
  new Command()
    .command("type")
    .description("type text into an element by ref")
    .argument("<url>", "URL to navigate to")
    .argument("<ref>", "element ref to type into (e.g. e1, e2)")
    .argument("<text>", "text to type"),
).action(async (url: string, ref: string, text: string, options) => {
  await withLocator(url, ref, options, (locator) => locator.pressSequentially(text));
});
