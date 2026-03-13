import type { ElementInfo } from "../types";

// HACK: Serialized by Playwright's evaluate() — no runtime imports allowed.
// All helpers and constants must be defined inside the function body
// because evaluate() calls fn.toString() which only captures the function scope.
export const extractElementDetail = (element: Element): ElementInfo => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const readString = (value: unknown): string | null => (typeof value === "string" ? value : null);

  const readNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const MAX_SELECTOR_VALUE_LENGTH = 128;
  const MIN_DISPLAY_NAME_LENGTH = 2;

  const tagName = element.tagName.toLowerCase();

  let selector = tagName;
  const idValue = element.getAttribute("id");
  if (idValue && idValue.length <= MAX_SELECTOR_VALUE_LENGTH) {
    try {
      const candidate = `#${idValue}`;
      if (element.ownerDocument.querySelectorAll(candidate).length === 1) {
        selector = candidate;
      }
    } catch {}
  }
  if (selector === tagName) {
    const preferredAttrs = [
      "data-testid",
      "data-test-id",
      "data-test",
      "data-cy",
      "data-qa",
      "aria-label",
      "role",
      "name",
      "title",
      "alt",
    ];
    for (const attr of preferredAttrs) {
      const value = element.getAttribute(attr);
      if (!value || value.length > MAX_SELECTOR_VALUE_LENGTH) continue;
      try {
        const candidate = `[${attr}="${value}"]`;
        if (element.ownerDocument.querySelectorAll(candidate).length === 1) {
          selector = candidate;
          break;
        }
      } catch {}
    }
  }

  interface SourceFrame {
    filePath: string;
    lineNumber: number | null;
    columnNumber: number | null;
    componentName: string | null;
  }

  let componentName: string | null = null;
  let source: SourceFrame | null = null;
  const stack: SourceFrame[] = [];

  const reactInternals = new Set([
    "Fragment",
    "StrictMode",
    "Suspense",
    "Profiler",
    "SuspenseList",
  ]);

  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"),
  );
  if (fiberKey) {
    let fiber = Reflect.get(element, fiberKey);
    while (isRecord(fiber)) {
      const fiberType = fiber.type;
      if (typeof fiberType === "function" || isRecord(fiberType)) {
        const displayName =
          readString(Reflect.get(fiberType, "displayName")) ??
          readString(Reflect.get(fiberType, "name"));
        if (
          displayName &&
          displayName.length >= MIN_DISPLAY_NAME_LENGTH &&
          displayName[0] === displayName[0].toUpperCase() &&
          !reactInternals.has(displayName) &&
          !displayName.startsWith("_")
        ) {
          if (!componentName) componentName = displayName;
          const debugSource = fiber._debugSource;
          if (isRecord(debugSource) && typeof debugSource.fileName === "string") {
            const frame: SourceFrame = {
              filePath: debugSource.fileName,
              lineNumber: readNumber(debugSource.lineNumber),
              columnNumber: readNumber(debugSource.columnNumber),
              componentName: displayName,
            };
            if (!source) source = frame;
            stack.push(frame);
          }
        }
      }
      fiber = fiber.return;
    }
  }

  if (!componentName) {
    let current: Element | null = element;
    while (current) {
      const vueComponent = Reflect.get(current, "__vueParentComponent");
      if (isRecord(vueComponent)) {
        const vueType = isRecord(vueComponent.type) ? vueComponent.type : null;
        componentName = readString(vueType?.__name) ?? readString(vueType?.name);
        const inspectorValue = element
          .closest("[data-v-inspector]")
          ?.getAttribute("data-v-inspector");
        if (inspectorValue) {
          const parts = inspectorValue.split(":");
          source = {
            filePath: parts[0],
            lineNumber: parts[1] ? parseInt(parts[1], 10) : null,
            columnNumber: parts[2] ? parseInt(parts[2], 10) : null,
            componentName,
          };
          stack.push(source);
        } else if (vueType && typeof vueType.__file === "string") {
          source = {
            filePath: vueType.__file,
            lineNumber: null,
            columnNumber: null,
            componentName,
          };
          stack.push(source);
        }
        break;
      }
      current = current.parentElement;
    }
  }

  if (!componentName) {
    let current: Element | null = element;
    while (current) {
      const meta = Reflect.get(current, "__svelte_meta");
      if (isRecord(meta) && isRecord(meta.loc)) {
        const loc = meta.loc;
        const filePath = readString(loc.file);
        const lineNumber = readNumber(loc.line);
        if (filePath && lineNumber !== null) {
          const columnNumber = readNumber(loc.column);
          source = {
            filePath,
            lineNumber,
            columnNumber: columnNumber !== null ? columnNumber + 1 : null,
            componentName: null,
          };
          stack.push(source);
          let parent = meta.parent;
          while (isRecord(parent)) {
            const parentTag = readString(parent.componentTag);
            if (parentTag) {
              componentName = parentTag;
              source.componentName = componentName;
              break;
            }
            parent = parent.parent;
          }
          break;
        }
      }
      current = current.parentElement;
    }
  }

  return { tagName, selector, componentName, source, stack };
};
