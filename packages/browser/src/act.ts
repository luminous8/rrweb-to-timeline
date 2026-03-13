import type { Locator, Page } from "playwright";
import { snapshot } from "./snapshot";
import type { SnapshotOptions, SnapshotResult } from "./types";
import { toFriendlyError } from "./utils/friendly-error";

export const act = async (
  page: Page,
  ref: string,
  action: (locator: Locator) => Promise<void>,
  options?: SnapshotOptions,
): Promise<SnapshotResult> => {
  const before = await snapshot(page, options);
  try {
    await action(before.locator(ref));
  } catch (error) {
    throw toFriendlyError(error, ref);
  }
  return snapshot(page, options);
};
