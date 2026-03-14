import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DOMElement } from "ink";
import type { ElementInfo } from "element-source";
import { resolveElementInfo, getTagName } from "element-source";
import { collectNodes } from "./collect-nodes.js";
import { copyToClipboard } from "./copy-to-clipboard.js";
import { SourcePanel } from "./source-panel.js";
import { COPIED_FLASH_DURATION_MS } from "./constants.js";
import type { ReactNode } from "react";

type InspectorMode = "idle" | "picking" | "viewing";

interface SourceInspectorProps {
  children: ReactNode;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const SourceInspector = ({ children }: SourceInspectorProps) => {
  if (IS_PRODUCTION) return <>{children}</>;

  const rootRef = useRef<DOMElement>(null);
  const [mode, setMode] = useState<InspectorMode>("idle");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const nodes = useMemo(
    () => (mode !== "idle" && rootRef.current ? collectNodes(rootRef.current) : []),
    [mode],
  );

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), COPIED_FLASH_DURATION_MS);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleToggle = useCallback(() => {
    setMode((current) => {
      if (current === "idle") {
        setCursorIndex(0);
        setElementInfo(null);
        return "picking";
      }
      return "idle";
    });
  }, []);

  const handleSelect = useCallback(async () => {
    const selected = nodes[cursorIndex];
    if (!selected) return;
    const info = await resolveElementInfo(selected.node);
    setElementInfo(info);
    setMode("viewing");
  }, [nodes, cursorIndex]);

  const handleCopy = useCallback(() => {
    if (!elementInfo?.source) return;
    const parts = [elementInfo.source.filePath];
    if (elementInfo.source.lineNumber !== null) parts.push(String(elementInfo.source.lineNumber));
    if (elementInfo.source.columnNumber !== null)
      parts.push(String(elementInfo.source.columnNumber));
    const success = copyToClipboard(parts.join(":"));
    if (success) setCopied(true);
  }, [elementInfo]);

  useInput((input, key) => {
    // HACK: Option+C sends ç on macOS when terminal has "Option as Meta" disabled
    const isOptC = input === "c" && key.meta;
    const isOptCFallback = input === "ç";

    if (isOptC || isOptCFallback) {
      handleToggle();
      return;
    }

    if (mode === "picking") {
      if (key.escape) {
        setMode("idle");
        return;
      }
      if (key.upArrow) {
        setCursorIndex((previous) => (previous > 0 ? previous - 1 : nodes.length - 1));
        return;
      }
      if (key.downArrow) {
        setCursorIndex((previous) => (previous < nodes.length - 1 ? previous + 1 : 0));
        return;
      }
      if (key.return) {
        void handleSelect();
        return;
      }
    }

    if (mode === "viewing") {
      if (key.escape || key.return) {
        setMode("idle");
        return;
      }
      if (input === "c") {
        handleCopy();
        return;
      }
    }
  });

  return (
    <Box flexDirection="column" ref={rootRef}>
      {children}

      {mode === "idle" ? (
        <Box justifyContent="flex-end" paddingX={1}>
          <Text dimColor>⌥C inspect</Text>
        </Box>
      ) : null}

      {mode === "picking" ? (
        <Box flexDirection="column" paddingX={1}>
          {nodes.map((entry, index) => {
            const isSelected = index === cursorIndex;
            const indent = "  ".repeat(entry.depth);
            const componentName = entry.tagName !== "ink-text" ? getTagName(entry.node) : null;

            return (
              <Text key={`${entry.depth}-${entry.tagName}-${index}`} dimColor={!isSelected}>
                {isSelected ? "> " : "  "}
                {indent}
                <Text bold={isSelected}>{entry.tagName}</Text>
                {componentName && componentName !== entry.tagName ? (
                  <Text dimColor> {componentName}</Text>
                ) : null}
              </Text>
            );
          })}
          <Text dimColor>↑↓ nav · ↵ select · esc exit</Text>
        </Box>
      ) : null}

      {mode === "viewing" && elementInfo ? (
        <Box paddingX={1}>
          <SourcePanel info={elementInfo} copied={copied} />
        </Box>
      ) : null}
    </Box>
  );
};
