import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DOMElement } from "ink";
import type { ElementInfo } from "element-source";
import { resolveElementInfo } from "element-source";
import { hitTest } from "./hit-test.js";
import { copyToClipboard } from "./copy-to-clipboard.js";
import { SourcePanel } from "./source-panel.js";
import { COPIED_FLASH_DURATION_MS } from "./constants.js";
import type { ReactNode } from "react";

type InspectorMode = "idle" | "picking";

interface SourceInspectorProps {
  children: ReactNode;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const SourceInspector = ({ children }: SourceInspectorProps) => {
  if (IS_PRODUCTION) return <>{children}</>;

  const rootRef = useRef<DOMElement>(null);
  const [mode, setMode] = useState<InspectorMode>("idle");
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), COPIED_FLASH_DURATION_MS);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  useEffect(() => {
    if (mode !== "picking") return;

    let cancelled = false;
    interface MouseInstance {
      start: () => void;
      stop: () => void;
      on: (event: string, handler: (event: { x: number; y: number }) => void) => void;
      removeListener: (event: string, handler: (event: { x: number; y: number }) => void) => void;
    }
    let mouseInstance: MouseInstance | null = null;

    const handleClick = (event: { x: number; y: number }) => {
      if (!rootRef.current) return;
      const element = hitTest(rootRef.current, event.x - 1, event.y - 1);
      if (!element) return;
      void resolveElementInfo(element).then((info) => {
        if (!cancelled) setElementInfo(info);
      });
    };

    void import("term-mouse").then((mod) => {
      if (cancelled) return;
      const createMouse = (mod.default ?? mod) as () => MouseInstance;
      mouseInstance = createMouse();
      mouseInstance.start();
      mouseInstance.on("click", handleClick);
    });

    return () => {
      cancelled = true;
      if (mouseInstance) {
        mouseInstance.stop();
        mouseInstance.removeListener("click", handleClick);
      }
    };
  }, [mode]);

  const handleToggle = useCallback(() => {
    setMode((current) => {
      if (current === "idle") {
        setElementInfo(null);
        setCopied(false);
        return "picking";
      }
      return "idle";
    });
  }, []);

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
        setElementInfo(null);
        return;
      }
      if (input === "c" && elementInfo) {
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
          <Text dimColor>Click an element to inspect · esc exit</Text>
          {elementInfo ? (
            <Box marginTop={1}>
              <SourcePanel info={elementInfo} copied={copied} />
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};
