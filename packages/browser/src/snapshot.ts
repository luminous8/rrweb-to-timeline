import type { Page } from "playwright";
import { CONTENT_ROLES, INTERACTIVE_ROLES, REF_PREFIX, SNAPSHOT_TIMEOUT_MS } from "./constants";
import type { AriaRole, RefMap, SnapshotOptions, SnapshotResult } from "./types";
import { compactTree } from "./utils/compact-tree";
import { createLocator } from "./utils/create-locator";
import { findCursorInteractive } from "./utils/find-cursor-interactive";
import { getIndentLevel } from "./utils/get-indent-level";
import { parseAriaLine } from "./utils/parse-aria-line";
import { resolveNthDuplicates } from "./utils/resolve-nth-duplicates";
import { computeSnapshotStats } from "./utils/snapshot-stats";

const NO_INTERACTIVE_ELEMENTS = "(no interactive elements)";
const CURSOR_INTERACTIVE_HEADER = "# Cursor-interactive elements:";

const isTooDeep = (line: string, maxDepth?: number): boolean =>
  maxDepth !== undefined && getIndentLevel(line) > maxDepth;

const shouldAssignRef = (role: string, name: string, interactive?: boolean): boolean => {
  if (INTERACTIVE_ROLES.has(role)) return true;
  if (interactive) return false;
  return CONTENT_ROLES.has(role) && name.length > 0;
};

const appendCursorInteractiveElements = async (
  page: Page,
  filteredLines: string[],
  refs: RefMap,
  refCount: number,
  options: SnapshotOptions,
): Promise<number> => {
  const cursorElements = await findCursorInteractive(page, options.selector);
  if (cursorElements.length === 0) return refCount;

  const existingNames = new Set(Object.values(refs).map((entry) => entry.name.toLowerCase()));

  const newLines: string[] = [];

  for (const element of cursorElements) {
    if (existingNames.has(element.text.toLowerCase())) continue;
    existingNames.add(element.text.toLowerCase());

    const ref = `${REF_PREFIX}${++refCount}`;
    refs[ref] = {
      role: "generic" as AriaRole,
      name: element.text,
      selector: element.selector,
    };
    newLines.push(`- clickable "${element.text}" [ref=${ref}] [${element.reason}]`);
  }

  if (newLines.length > 0) {
    filteredLines.push(CURSOR_INTERACTIVE_HEADER);
    filteredLines.push(...newLines);
  }

  return refCount;
};

export const snapshot = async (
  page: Page,
  options: SnapshotOptions = {},
): Promise<SnapshotResult> => {
  const timeout = options.timeout ?? SNAPSHOT_TIMEOUT_MS;
  const root = options.selector ? page.locator(options.selector) : page.locator("body");
  const rawTree = await root.ariaSnapshot({ timeout });

  const refs: RefMap = {};
  const filteredLines: string[] = [];
  let refCount = 0;

  for (const line of rawTree.split("\n")) {
    if (isTooDeep(line, options.maxDepth)) continue;

    const parsed = parseAriaLine(line);
    if (!parsed) {
      if (!options.interactive) filteredLines.push(line);
      continue;
    }

    if (Boolean(options.interactive) && !INTERACTIVE_ROLES.has(parsed.role)) continue;

    if (shouldAssignRef(parsed.role, parsed.name, options.interactive)) {
      const ref = `${REF_PREFIX}${++refCount}`;
      refs[ref] = { role: parsed.role, name: parsed.name };
      filteredLines.push(`${line} [ref=${ref}]`);
    } else {
      filteredLines.push(line);
    }
  }

  if (options.cursor) {
    refCount = await appendCursorInteractiveElements(page, filteredLines, refs, refCount, options);
  }

  resolveNthDuplicates(refs);

  let tree = filteredLines.join("\n");
  if (options.interactive && refCount === 0) tree = NO_INTERACTIVE_ELEMENTS;
  if (options.compact) tree = compactTree(tree);

  const stats = computeSnapshotStats(tree, refs);

  return { tree, refs, stats, locator: createLocator(page, refs) };
};
