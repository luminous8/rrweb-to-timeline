import type { Locator, Page } from "playwright";
import type { RefEntry } from "../types";

export const resolveLocator = (page: Page, entry: RefEntry): Locator => {
  const locator = page.getByRole(entry.role, { name: entry.name, exact: true });
  return entry.nth !== undefined ? locator.nth(entry.nth) : locator;
};
