import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import Link from "ink-link";
import figures from "figures";
import { executeBrowserFlow, type BrowserRunEvent } from "@browser-tester/supervisor";
import {
  BROWSER_TOOL_PREFIX,
  TESTING_TIMER_UPDATE_INTERVAL_MS,
  TESTING_TOOL_TEXT_CHAR_LIMIT,
  TESTING_VISIBLE_LOG_COUNT,
} from "../../constants.js";
import { useColors, type Colors } from "../theme-context.js";
import { Spinner } from "../ui/spinner.js";
import { TextShimmer } from "../ui/text-shimmer.js";
import { useAppStore } from "../../store.js";
import { ScreenHeading } from "../ui/screen-heading.js";
import cliTruncate from "cli-truncate";
import { formatElapsedTime } from "../../utils/format-elapsed-time.js";
import {
  formatBrowserToolCall,
  formatBrowserToolResult,
} from "../../utils/format-browser-tool-call.js";
import { extractScreenshotPath } from "../../utils/extract-screenshot-path.js";
import { Image } from "../ui/image.js";
import { FileLink } from "../ui/file-link.js";
import { ErrorMessage } from "../ui/error-message.js";
import { Clickable } from "../ui/clickable.js";

interface TestingLine {
  text: string;
  color: string;
  filePath?: string;
  url?: string;
}

interface FormatRunEventOptions {
  traceDisplayMode: string;
}

const TOOL_CALL_DISPLAY_MODE_COMPACT = "compact";
const TOOL_CALL_DISPLAY_MODE_DETAILED = "detailed";
const TOOL_CALL_DISPLAY_MODE_HIDDEN = "hidden";
const TRACE_DISPLAY_SHORTCUT_KEY = "v";

const getNextToolCallDisplayMode = (toolCallDisplayMode: string): string => {
  switch (toolCallDisplayMode) {
    case TOOL_CALL_DISPLAY_MODE_COMPACT:
      return TOOL_CALL_DISPLAY_MODE_DETAILED;
    case TOOL_CALL_DISPLAY_MODE_DETAILED:
      return TOOL_CALL_DISPLAY_MODE_HIDDEN;
    default:
      return TOOL_CALL_DISPLAY_MODE_COMPACT;
  }
};

const isDetailedTraceDisplayMode = (traceDisplayMode: string): boolean =>
  traceDisplayMode === TOOL_CALL_DISPLAY_MODE_DETAILED;

const isHiddenTraceDisplayMode = (traceDisplayMode: string): boolean =>
  traceDisplayMode === TOOL_CALL_DISPLAY_MODE_HIDDEN;

const URL_ACTIONS = new Set(["open", "new_page", "navigate_page"]);

const extractUrlFromToolInput = (toolName: string, input: string): string | undefined => {
  if (!toolName.startsWith(BROWSER_TOOL_PREFIX)) return undefined;
  const action = toolName.slice(BROWSER_TOOL_PREFIX.length);
  if (!URL_ACTIONS.has(action)) return undefined;
  try {
    const parsed = JSON.parse(input);
    const rawUrl = parsed?.url;
    return typeof rawUrl === "string" && rawUrl.startsWith("http") ? rawUrl : undefined;
  } catch {
    return undefined;
  }
};

const ARTIFACT_ACTIONS = new Set([
  "screenshot",
  "take_screenshot",
  "annotated_screenshot",
  "save_video",
]);

const SAVED_TO_PATTERN = /saved to (.+)$/;

const extractArtifactPathFromInput = (toolName: string, input: string): string | undefined => {
  if (!toolName.startsWith(BROWSER_TOOL_PREFIX)) return undefined;
  if (!ARTIFACT_ACTIONS.has(toolName.slice(BROWSER_TOOL_PREFIX.length))) return undefined;
  try {
    const parsed = JSON.parse(input);
    const rawPath = parsed?.path ?? parsed?.filename;
    return typeof rawPath === "string" && rawPath.length > 0 ? rawPath : undefined;
  } catch {
    return undefined;
  }
};

const extractArtifactPathFromResult = (
  event: Extract<BrowserRunEvent, { type: "tool-result" }>,
): string | undefined => {
  if (event.isError) return undefined;
  if (!ARTIFACT_ACTIONS.has(event.toolName.slice(BROWSER_TOOL_PREFIX.length))) return undefined;
  return SAVED_TO_PATTERN.exec(event.result)?.[1] ?? undefined;
};

const formatTraceText = (value: string, traceDisplayMode: string): string =>
  isDetailedTraceDisplayMode(traceDisplayMode)
    ? value
    : cliTruncate(value, TESTING_TOOL_TEXT_CHAR_LIMIT);

const formatRunEvent = (
  event: BrowserRunEvent,
  colors: Colors,
  options: FormatRunEventOptions,
): TestingLine | null => {
  switch (event.type) {
    case "run-started":
      return {
        text: `Starting ${event.planTitle}`,
        color: colors.PURPLE,
      };
    case "step-started":
      return {
        text: `${figures.arrowRight} ${event.stepId} ${event.title}`,
        color: colors.SELECTION,
      };
    case "step-completed":
      return {
        text: `${figures.tick} ${event.stepId} ${cliTruncate(event.summary, TESTING_TOOL_TEXT_CHAR_LIMIT)}`,
        color: colors.GREEN,
      };
    case "assertion-failed":
      return {
        text: `${figures.cross} ${event.stepId} ${cliTruncate(event.message, TESTING_TOOL_TEXT_CHAR_LIMIT)}`,
        color: colors.RED,
      };
    case "tool-call": {
      if (isHiddenTraceDisplayMode(options.traceDisplayMode)) return null;
      const toolCallText = formatBrowserToolCall(event.toolName, event.input, {
        includeRelevantInputs: isDetailedTraceDisplayMode(options.traceDisplayMode),
      });
      if (!toolCallText) return null;
      return {
        text: `• ${formatTraceText(toolCallText, options.traceDisplayMode)}`,
        color: colors.DIM,
        filePath: extractArtifactPathFromInput(event.toolName, event.input),
        url: extractUrlFromToolInput(event.toolName, event.input),
      };
    }
    case "tool-result": {
      if (isHiddenTraceDisplayMode(options.traceDisplayMode)) return null;
      const toolResultText = formatBrowserToolResult(event, {
        includeAllResults: isDetailedTraceDisplayMode(options.traceDisplayMode),
      });
      if (!toolResultText) return null;
      return {
        text: toolResultText,
        color: event.isError ? colors.RED : colors.DIM,
        filePath: extractArtifactPathFromResult(event),
      };
    }
    case "text":
      if (!isDetailedTraceDisplayMode(options.traceDisplayMode)) return null;
      return {
        text: event.text,
        color: colors.CYAN,
      };
    case "thinking":
      if (!isDetailedTraceDisplayMode(options.traceDisplayMode)) return null;
      return {
        text: `Thinking: ${event.text}`,
        color: colors.PURPLE,
      };
    case "browser-log":
      return null;
    case "error":
      return {
        text: `Error: ${cliTruncate(event.message, TESTING_TOOL_TEXT_CHAR_LIMIT)}`,
        color: colors.RED,
      };
    case "run-completed":
      return {
        text: `Run ${event.status}: ${cliTruncate(event.summary, TESTING_TOOL_TEXT_CHAR_LIMIT)}`,
        color: event.status === "passed" ? colors.GREEN : colors.RED,
      };
    default:
      return null;
  }
};

export const TestingScreen = () => {
  const target = useAppStore((state) => state.resolvedTarget);
  const plan = useAppStore((state) => state.generatedPlan);
  const environment = useAppStore((state) => state.browserEnvironment);
  const completeTestingRun = useAppStore((state) => state.completeTestingRun);
  const exitTesting = useAppStore((state) => state.exitTesting);
  const autoSaveStatus = useAppStore((state) => state.autoSaveStatus);
  const COLORS = useColors();
  const colorsRef = useRef(COLORS);
  colorsRef.current = COLORS;
  const [events, setEvents] = useState<BrowserRunEvent[]>([]);
  const [statusLines, setStatusLines] = useState<TestingLine[]>([]);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [screenshotPaths, setScreenshotPaths] = useState<string[]>([]);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const [toolCallDisplayMode, setToolCallDisplayMode] = useState(TOOL_CALL_DISPLAY_MODE_COMPACT);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [exitRequested, setExitRequested] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lines = useMemo(
    () => [
      ...events
        .map((event) => formatRunEvent(event, COLORS, { traceDisplayMode: toolCallDisplayMode }))
        .filter((line): line is TestingLine => line !== null),
      ...statusLines,
    ],
    [COLORS, events, statusLines, toolCallDisplayMode],
  );
  const visibleLines = useMemo(() => lines.slice(-TESTING_VISIBLE_LOG_COUNT), [lines]);
  const elapsedTimeLabel = useMemo(() => formatElapsedTime(elapsedTimeMs), [elapsedTimeMs]);

  useEffect(() => {
    if (!exitRequested || running) return;
    exitTesting();
  }, [exitRequested, exitTesting, running]);

  useEffect(() => {
    if (!running || runStartedAt === null) return;

    setElapsedTimeMs(Date.now() - runStartedAt);

    const interval = setInterval(() => {
      setElapsedTimeMs(Date.now() - runStartedAt);
    }, TESTING_TIMER_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [runStartedAt, running]);

  useEffect(() => {
    if (!target || !plan || !environment) return;

    const abortController = new AbortController();
    const startedAt = Date.now();
    abortControllerRef.current = abortController;
    setEvents([]);
    setStatusLines([]);
    setRunning(true);
    setError(null);
    setVideoPath(null);
    setCurrentStep(null);
    setScreenshotPaths([]);
    setRunStartedAt(startedAt);
    setElapsedTimeMs(0);
    setShowCancelConfirmation(false);
    setExitRequested(false);

    const run = async () => {
      try {
        for await (const event of executeBrowserFlow({
          target,
          plan,
          environment,
          signal: abortController.signal,
        })) {
          if (event.type === "run-started" && event.liveViewUrl) {
            setLiveViewUrl(event.liveViewUrl);
          }
          if (event.type === "run-completed") {
            setVideoPath(event.report?.artifacts.rawVideoPath ?? event.videoPath ?? null);
            setCurrentStep(null);
            if (event.report) {
              completeTestingRun(event.report);
            }
          }
          if (event.type === "step-started") {
            setCurrentStep(`${event.stepId} ${event.title}`);
          }
          if (event.type === "tool-result") {
            const screenshotPath = extractScreenshotPath(event);
            if (screenshotPath) {
              setScreenshotPaths((previous) => [...previous, screenshotPath]);
            }
          }
          setEvents((previous) => [...previous, event]);
          if (abortController.signal.aborted) {
            break;
          }
        }
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          setStatusLines((previous) => [
            ...previous,
            { text: "Cancelled.", color: colorsRef.current.YELLOW },
          ]);
        } else {
          const errorMessage = caughtError instanceof Error ? caughtError.message : "Unknown error";
          setError(errorMessage);
        }
      } finally {
        setShowCancelConfirmation(false);
        setRunning(false);
      }
    };

    run();

    return () => {
      abortController.abort();
    };
  }, [completeTestingRun, environment, plan, target]);

  useInput((input, key) => {
    const normalizedInput = input.toLowerCase();

    if (exitRequested) {
      return;
    }

    if (showCancelConfirmation) {
      if (key.return || normalizedInput === "y") {
        setShowCancelConfirmation(false);
        setExitRequested(true);
        abortControllerRef.current?.abort();
        return;
      }

      if (key.escape || normalizedInput === "n") {
        setShowCancelConfirmation(false);
      }

      return;
    }

    if (input === TRACE_DISPLAY_SHORTCUT_KEY) {
      setToolCallDisplayMode((previous) => getNextToolCallDisplayMode(previous));
      return;
    }

    if (key.escape) {
      if (running) {
        setShowCancelConfirmation(true);
        return;
      }

      exitTesting();
    }
  });

  if (!target || !plan || !environment) return null;

  return (
    <Box flexDirection="column" width="100%" paddingX={1} paddingY={1}>
      <ScreenHeading
        title="Executing browser plan"
        subtitle={`${plan.title} · ${target.displayName}`}
      />

      {liveViewUrl ? (
        <Box marginTop={1}>
          <Text color={COLORS.DIM}>
            Live view:{" "}
            <Link url={liveViewUrl}>
              <Text color={COLORS.CYAN}>{liveViewUrl}</Text>
            </Link>
          </Text>
        </Box>
      ) : null}

      {autoSaveStatus === "saving" ? (
        <Box marginTop={1}>
          <Text color={COLORS.DIM}>Saving flow...</Text>
        </Box>
      ) : autoSaveStatus === "saved" ? (
        <Box marginTop={1}>
          <Text color={COLORS.GREEN}>{"✓ "}</Text>
          <Text color={COLORS.DIM}>Flow saved</Text>
        </Box>
      ) : autoSaveStatus === "error" ? (
        <Box marginTop={1}>
          <Text color={COLORS.RED}>{"✗ "}</Text>
          <Text color={COLORS.DIM}>Auto-save failed</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color={currentStep ? COLORS.SELECTION : COLORS.DIM}>
          {currentStep ? `Current step: ${currentStep}` : "Waiting for first step..."}
        </Text>
        <Clickable
          onClick={() => setToolCallDisplayMode((previous) => getNextToolCallDisplayMode(previous))}
        >
          <Text color={COLORS.DIM}>
            Trace: {toolCallDisplayMode}. Press {TRACE_DISPLAY_SHORTCUT_KEY} to cycle compact,
            detailed, hidden.
          </Text>
        </Clickable>
      </Box>

      {showCancelConfirmation ? (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor={COLORS.YELLOW}
          paddingX={1}
        >
          <Text color={COLORS.YELLOW} bold>
            Stop this browser run?
          </Text>
          <Text color={COLORS.DIM}>This will terminate the agent and close the browser.</Text>
          <Text color={COLORS.DIM}>
            Press <Text color={COLORS.PRIMARY}>Enter</Text> or <Text color={COLORS.PRIMARY}>y</Text>{" "}
            to stop, or <Text color={COLORS.PRIMARY}>Esc</Text> or{" "}
            <Text color={COLORS.PRIMARY}>n</Text> to keep it running.
          </Text>
        </Box>
      ) : null}

      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor={COLORS.BORDER}
        paddingX={1}
      >
        {visibleLines.map((line, index) => {
          const linkUrl = line.filePath ? pathToFileURL(resolve(line.filePath)).href : line.url;
          return linkUrl ? (
            <Link key={`${index}-${line.text}`} url={linkUrl}>
              <Text color={line.color}>{line.text}</Text>
            </Link>
          ) : (
            <Text key={`${index}-${line.text}`} color={line.color}>
              {line.text}
            </Text>
          );
        })}
        {visibleLines.length === 0 ? <Text color={COLORS.DIM}>No activity yet.</Text> : null}
      </Box>

      {running && (
        <Box marginTop={1}>
          <Spinner />
          <Text> </Text>
          <TextShimmer
            text={`${exitRequested ? "Stopping" : "Testing"}${figures.ellipsis} ${elapsedTimeLabel}`}
            baseColor={COLORS.DIM}
            highlightColor={COLORS.PRIMARY}
          />
        </Box>
      )}

      {!running && !error && (
        <Box marginTop={1}>
          <Box flexDirection="column">
            <Text color={COLORS.GREEN} bold>
              Done
            </Text>
            {videoPath ? (
              <Text color={COLORS.DIM}>
                Video saved to <FileLink path={videoPath} />
              </Text>
            ) : null}
          </Box>
        </Box>
      )}

      {screenshotPaths.map((screenshotPath) => (
        <Image key={screenshotPath} src={screenshotPath} alt={`Screenshot: ${screenshotPath}`} />
      ))}

      <ErrorMessage message={error ? `Error: ${error}` : null} />

      <Box marginTop={1}>
        <Text color={COLORS.DIM}>
          {showCancelConfirmation ? (
            "Enter or y to stop. Esc or n to keep running."
          ) : exitRequested ? (
            "Stopping run..."
          ) : (
            <>
              Esc to {running ? "cancel" : "go back"} {TRACE_DISPLAY_SHORTCUT_KEY} to cycle trace
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
};
