import type { Page } from "playwright";
import { snapshot } from "./snapshot";
import type { SnapshotOptions } from "./types";

export interface AnnotatedScreenshotOptions extends SnapshotOptions {
  fullPage?: boolean;
}

export interface Annotation {
  label: number;
  ref: string;
  role: string;
  name: string;
}

export interface AnnotatedScreenshotResult {
  screenshot: Buffer;
  annotations: Annotation[];
}

const OVERLAY_CONTAINER_ID = "__browser_tester_annotation_overlay__";

const injectOverlayLabels = async (
  page: Page,
  labels: Array<{ label: number; x: number; y: number }>,
): Promise<void> => {
  await page.evaluate(
    ({
      containerId,
      items,
    }: {
      containerId: string;
      items: Array<{ label: number; x: number; y: number }>;
    }) => {
      const container = document.createElement("div");
      container.id = containerId;
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.zIndex = "2147483647";
      container.style.pointerEvents = "none";

      for (const item of items) {
        const badge = document.createElement("div");
        badge.textContent = `[${item.label}]`;
        badge.style.position = "absolute";
        badge.style.left = `${item.x}px`;
        badge.style.top = `${item.y}px`;
        badge.style.background = "rgba(255, 0, 0, 0.85)";
        badge.style.color = "white";
        badge.style.fontSize = "11px";
        badge.style.fontFamily = "monospace";
        badge.style.fontWeight = "bold";
        badge.style.padding = "1px 3px";
        badge.style.borderRadius = "3px";
        badge.style.lineHeight = "1.2";
        badge.style.whiteSpace = "nowrap";
        container.appendChild(badge);
      }

      document.body.appendChild(container);
    },
    { containerId: OVERLAY_CONTAINER_ID, items: labels },
  );
};

const removeOverlay = async (page: Page): Promise<void> => {
  await page.evaluate((containerId: string) => {
    document.getElementById(containerId)?.remove();
  }, OVERLAY_CONTAINER_ID);
};

export const annotatedScreenshot = async (
  page: Page,
  options: AnnotatedScreenshotOptions = {},
): Promise<AnnotatedScreenshotResult> => {
  const snapshotResult = await snapshot(page, options);
  const annotations: Annotation[] = [];
  const labelPositions: Array<{ label: number; x: number; y: number }> = [];

  let labelCounter = 0;

  for (const [ref, entry] of Object.entries(snapshotResult.refs)) {
    const locator = snapshotResult.locator(ref);
    const box = await locator.boundingBox().catch(() => null);
    if (!box) continue;

    labelCounter++;
    annotations.push({
      label: labelCounter,
      ref,
      role: entry.role,
      name: entry.name,
    });
    labelPositions.push({
      label: labelCounter,
      x: box.x,
      y: box.y,
    });
  }

  try {
    await injectOverlayLabels(page, labelPositions);
    const screenshot = await page.screenshot({ fullPage: options.fullPage });
    return { screenshot, annotations };
  } finally {
    await removeOverlay(page);
  }
};
