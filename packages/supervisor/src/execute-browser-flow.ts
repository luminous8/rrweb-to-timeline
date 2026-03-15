import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { AgentProviderSettings } from "@browser-tester/agent";
import {
  BROWSER_TEST_MODEL,
  DEFAULT_AGENT_PROVIDER,
  DEFAULT_BROWSER_MCP_SERVER_NAME,
  EXECUTION_MODEL_EFFORT,
  VIDEO_DIRECTORY_PREFIX,
  VIDEO_FILE_NAME,
} from "./constants.js";
import { buildBrowserMcpSettings } from "./browser-mcp-config.js";
import { createBrowserRunReport } from "./create-browser-run-report.js";
import { createAgentModel } from "./create-agent-model.js";
import type { BrowserRunEvent } from "./events.js";
import {
  buildStepMap,
  extractStreamSessionId,
  parseBrowserToolName,
  parseMarkerLine,
  parseTextDelta,
} from "./parse-execution-stream.js";
import type { ExecutionStreamContext, ExecutionStreamState } from "./parse-execution-stream.js";
import type { ExecuteBrowserFlowOptions, PlanStep } from "./types.js";
import { saveBrowserImageResult } from "./utils/save-browser-image-result.js";
import { serializeToolResult } from "./utils/serialize-tool-result.js";
import { resolveLiveViewUrl } from "./utils/resolve-live-view-url.js";

const BROWSER_EXECUTION_TOOL_NAMES = [
  "open",
  "snapshot",
  "click",
  "fill",
  "type",
  "select",
  "hover",
  "screenshot",
  "annotated_screenshot",
  "diff",
  "save_video",
  "navigate",
  "get_page_text",
  "javascript",
  "read_console_messages",
  "read_network_requests",
  "scroll",
  "drag",
  "upload",
  "resize_window",
  "tab_list",
  "tab_create",
  "tab_switch",
  "tab_close",
  "find",
  "wait",
  "press_key",
  "close",
];

const buildExecutionToolAllowlist = (browserMcpServerName: string): string[] =>
  BROWSER_EXECUTION_TOOL_NAMES.map((toolName) => `mcp__${browserMcpServerName}__${toolName}`);

export const buildExecutionModelSettings = (
  options: Pick<
    ExecuteBrowserFlowOptions,
    | "provider"
    | "providerSettings"
    | "target"
    | "browserMcpServerName"
    | "videoOutputPath"
    | "liveViewUrl"
  >,
): AgentProviderSettings => {
  const provider = options.provider ?? DEFAULT_AGENT_PROVIDER;
  const browserMcpServerName = options.browserMcpServerName ?? DEFAULT_BROWSER_MCP_SERVER_NAME;

  return buildBrowserMcpSettings({
    providerSettings: {
      cwd: options.target.cwd,
      ...(provider === "claude" ? { model: BROWSER_TEST_MODEL } : {}),
      ...(options.providerSettings ?? {}),
      effort: EXECUTION_MODEL_EFFORT,
      tools: buildExecutionToolAllowlist(browserMcpServerName),
    },
    browserMcpServerName,
    videoOutputPath: options.videoOutputPath,
    liveViewUrl: options.liveViewUrl,
  });
};

const createExecutionModel = (
  options: Pick<
    ExecuteBrowserFlowOptions,
    | "model"
    | "provider"
    | "providerSettings"
    | "target"
    | "browserMcpServerName"
    | "videoOutputPath"
    | "liveViewUrl"
  >,
): LanguageModelV3 => {
  if (options.model) return options.model;

  const provider = options.provider ?? DEFAULT_AGENT_PROVIDER;
  const settings = buildExecutionModelSettings(options);

  return createAgentModel(provider, settings);
};

const formatPlanSteps = (steps: PlanStep[]): string =>
  steps
    .map((step) =>
      [
        `- ${step.id}: ${step.title}`,
        `  instruction: ${step.instruction}`,
        `  expected outcome: ${step.expectedOutcome}`,
        `  route hint: ${step.routeHint ?? "none"}`,
        `  changed file evidence: ${
          step.changedFileEvidence && step.changedFileEvidence.length > 0
            ? step.changedFileEvidence.join(", ")
            : "none"
        }`,
      ].join("\n"),
    )
    .join("\n");

const buildExecutionPrompt = (options: ExecuteBrowserFlowOptions): string => {
  const { plan, target, environment, browserMcpServerName, videoOutputPath } = options;

  return [
    "You are executing an approved browser test plan.",
    `You have access to browser tools through the MCP server named "${browserMcpServerName ?? DEFAULT_BROWSER_MCP_SERVER_NAME}".`,
    "Follow the approved steps in order. You may adapt to UI details, but do not invent a different goal.",
    "Execution style: assertion-first. For each step, think in loops: navigate, act, validate, recover, then fail if still blocked.",
    "A browser video recording is enabled for this run.",
    "",
    "Before and after each step, emit these exact status lines on their own lines:",
    "STEP_START|<step-id>|<step-title>",
    "STEP_DONE|<step-id>|<short-summary>",
    "ASSERTION_FAILED|<step-id>|<why-it-failed>",
    "RUN_COMPLETED|passed|<final-summary>",
    "RUN_COMPLETED|failed|<final-summary>",
    "",
    "Allowed failure categories: app-bug, env-issue, auth-blocked, missing-test-data, selector-drift, agent-misread.",
    "When a step fails, gather structured evidence before emitting ASSERTION_FAILED:",
    "- Call screenshot.",
    "- Call tab_list to capture the active tab and current URL.",
    "- Call read_console_messages.",
    "- Call read_network_requests.",
    "- Call get_page_text for a visible text excerpt.",
    "- Summarize the failure category and the most important evidence inside <why-it-failed>.",
    "",
    "Stability heuristics are first-class requirements:",
    "- After navigation or major UI changes, wait for the page to settle before acting again.",
    "- Inspect the latest snapshot before every interaction that depends on the current UI state.",
    "- Avoid clicking or typing while the UI is visibly loading or transitioning.",
    "- Confirm you reached the expected page, route, or visible surface before continuing.",
    "",
    "Recovery policy for each blocked step:",
    "- Re-snapshot the page.",
    "- Scroll the target into view when needed.",
    "- Retry the intended interaction at most once.",
    "- Re-check the URL, network, and console state.",
    "- If the step is still blocked, classify the blocker with one allowed failure category and include that classification in ASSERTION_FAILED.",
    "",
    "Before emitting RUN_COMPLETED, call the close tool exactly once so the browser session flushes the video to disk.",
    "Use the browser tools to open pages, inspect the accessibility tree, interact with the UI, wait when needed, and check browser logs or network requests when helpful.",
    "When this run launches its own browser, the close tool should shut that browser down cleanly.",
    "",
    "Environment:",
    `- Base URL: ${environment?.baseUrl ?? "not provided"}`,
    `- Headed mode preference: ${environment?.headed === true ? "headed" : "headless or not specified"}`,
    `- Reuse browser cookies: ${environment?.cookies === true ? "yes" : "no or not specified"}`,
    `- Video output path: ${videoOutputPath ?? "not configured"}`,
    "",
    "Testing target context:",
    `- Scope: ${target.scope}`,
    `- Display name: ${target.displayName}`,
    `- Current branch: ${target.branch.current}`,
    `- Main branch: ${target.branch.main ?? "unknown"}`,
    "",
    "Approved plan:",
    `Title: ${plan.title}`,
    `Rationale: ${plan.rationale}`,
    `Target summary: ${plan.targetSummary}`,
    `User instruction: ${plan.userInstruction}`,
    `Assumptions: ${plan.assumptions.length > 0 ? plan.assumptions.join("; ") : "none"}`,
    `Risk areas: ${plan.riskAreas.length > 0 ? plan.riskAreas.join("; ") : "none"}`,
    `Target URLs: ${plan.targetUrls.length > 0 ? plan.targetUrls.join(", ") : "none"}`,
    "",
    formatPlanSteps(plan.steps),
  ].join("\n");
};

const createVideoOutputPath = (): string => {
  const videoDirectory = mkdtempSync(join(tmpdir(), VIDEO_DIRECTORY_PREFIX));
  return join(videoDirectory, VIDEO_FILE_NAME);
};

export const executeBrowserFlow = async function* (
  options: ExecuteBrowserFlowOptions,
): AsyncGenerator<BrowserRunEvent> {
  const browserMcpServerName = options.browserMcpServerName ?? DEFAULT_BROWSER_MCP_SERVER_NAME;
  const videoOutputPath = options.videoOutputPath ?? createVideoOutputPath();
  const liveViewUrl = options.liveViewUrl ?? (await resolveLiveViewUrl().catch(() => undefined));
  const model = createExecutionModel({
    model: options.model,
    provider: options.provider,
    providerSettings: options.providerSettings,
    target: options.target,
    browserMcpServerName,
    videoOutputPath,
    liveViewUrl,
  });
  const prompt = buildExecutionPrompt({
    ...options,
    browserMcpServerName,
    videoOutputPath,
  });

  const emittedEvents: BrowserRunEvent[] = [];
  const runStartedEvent: BrowserRunEvent = {
    type: "run-started",
    timestamp: Date.now(),
    planTitle: options.plan.title,
    liveViewUrl,
  };
  emittedEvents.push(runStartedEvent);
  yield runStartedEvent;

  const streamResult = await model.doStream({
    abortSignal: options.signal,
    prompt: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const reader = streamResult.stream.getReader();
  let streamState: ExecutionStreamState = { bufferedText: "" };
  let completionEvent: Extract<BrowserRunEvent, { type: "run-completed" }> | null = null;
  let screenshotOutputDirectoryPath: string | undefined;
  const screenshotPaths: string[] = [];
  const streamContext: ExecutionStreamContext = {
    browserMcpServerName,
    stepsById: buildStepMap(options.plan.steps),
  };

  for (;;) {
    const nextChunk = await reader.read();
    if (nextChunk.done) break;

    const part = nextChunk.value;

    if (part.type === "text-delta") {
      const parsedText = parseTextDelta(part.delta, streamState, streamContext);
      streamState = parsedText.nextState;
      for (const event of parsedText.events) {
        if (event.type === "run-completed") {
          completionEvent = {
            ...event,
            sessionId: streamState.sessionId,
            videoPath: videoOutputPath,
          };
        } else {
          emittedEvents.push(event);
          yield event;
        }
      }
      continue;
    }

    if (part.type === "reasoning-delta") {
      const event: BrowserRunEvent = {
        type: "thinking",
        timestamp: Date.now(),
        text: part.delta,
      };
      emittedEvents.push(event);
      yield event;
      continue;
    }

    if (part.type === "tool-call") {
      const toolCallEvent: BrowserRunEvent = {
        type: "tool-call",
        timestamp: Date.now(),
        toolName: part.toolName,
        input: part.input,
      };
      emittedEvents.push(toolCallEvent);
      yield toolCallEvent;

      const browserAction = parseBrowserToolName(part.toolName, browserMcpServerName);
      if (browserAction) {
        const browserLogEvent: BrowserRunEvent = {
          type: "browser-log",
          timestamp: Date.now(),
          action: browserAction,
          message: `Called ${browserAction}`,
        };
        emittedEvents.push(browserLogEvent);
        yield browserLogEvent;
      }
      continue;
    }

    if (part.type === "tool-result") {
      const browserAction = parseBrowserToolName(part.toolName, browserMcpServerName);
      let result = serializeToolResult(part.result);
      if (
        browserAction === "screenshot" ||
        browserAction === "take_screenshot" ||
        browserAction === "annotated_screenshot"
      ) {
        const savedBrowserImageResult = saveBrowserImageResult({
          browserAction,
          outputDirectoryPath: screenshotOutputDirectoryPath,
          result,
        });

        if (savedBrowserImageResult) {
          screenshotOutputDirectoryPath = savedBrowserImageResult.outputDirectoryPath;
          screenshotPaths.push(savedBrowserImageResult.outputPath);
          result = savedBrowserImageResult.resultText;
        }
      }

      const toolResultEvent: BrowserRunEvent = {
        type: "tool-result",
        timestamp: Date.now(),
        toolName: part.toolName,
        result,
        isError: Boolean(part.isError),
      };
      emittedEvents.push(toolResultEvent);
      yield toolResultEvent;

      if (browserAction) {
        const browserLogEvent: BrowserRunEvent = {
          type: "browser-log",
          timestamp: Date.now(),
          action: browserAction,
          message: result,
        };
        emittedEvents.push(browserLogEvent);
        yield browserLogEvent;
      }
      continue;
    }

    const sessionId = extractStreamSessionId(part);
    if (sessionId) {
      streamState = {
        ...streamState,
        sessionId,
      };
    }
  }

  if (streamState.bufferedText.trim()) {
    const trailingEvent = parseMarkerLine(streamState.bufferedText.trim(), streamContext);
    if (trailingEvent) {
      if (Array.isArray(trailingEvent)) {
        for (const event of trailingEvent) {
          if (event.type === "run-completed") {
            completionEvent = {
              ...event,
              sessionId: streamState.sessionId,
              videoPath: videoOutputPath,
            };
          } else {
            emittedEvents.push(event);
            yield event;
          }
        }
      } else {
        if (trailingEvent.type === "run-completed") {
          completionEvent = {
            ...trailingEvent,
            sessionId: streamState.sessionId,
            videoPath: videoOutputPath,
          };
        } else {
          emittedEvents.push(trailingEvent);
          yield trailingEvent;
        }
      }
    }
  }

  const resolvedCompletionEvent =
    completionEvent ??
    ({
      type: "run-completed",
      timestamp: Date.now(),
      status: "passed",
      summary: "Run completed.",
      sessionId: streamState.sessionId,
      videoPath: videoOutputPath,
    } satisfies Extract<BrowserRunEvent, { type: "run-completed" }>);

  const preparingResultsEvent: BrowserRunEvent = {
    type: "text",
    timestamp: Date.now(),
    text: "Preparing results report...",
  };
  yield preparingResultsEvent;

  yield {
    ...resolvedCompletionEvent,
    report: createBrowserRunReport({
      target: options.target,
      plan: options.plan,
      events: emittedEvents,
      completionEvent: resolvedCompletionEvent,
      rawVideoPath: videoOutputPath,
      screenshotPaths,
    }),
  };
};
