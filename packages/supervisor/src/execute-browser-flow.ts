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
    "provider" | "providerSettings" | "target" | "browserMcpServerName" | "videoOutputPath"
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
    "If a step is blocked, explain why and emit the failure marker.",
    "A browser video recording is enabled for this run.",
    "",
    "Before and after each step, emit these exact status lines on their own lines:",
    "STEP_START|<step-id>|<step-title>",
    "STEP_DONE|<step-id>|<short-summary>",
    "ASSERTION_FAILED|<step-id>|<why-it-failed>",
    "RUN_COMPLETED|passed|<final-summary>",
    "RUN_COMPLETED|failed|<final-summary>",
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
  const model = createExecutionModel({
    model: options.model,
    provider: options.provider,
    providerSettings: options.providerSettings,
    target: options.target,
    browserMcpServerName,
    videoOutputPath,
  });
  const prompt = buildExecutionPrompt({
    ...options,
    browserMcpServerName,
    videoOutputPath,
  });

  yield {
    type: "run-started",
    timestamp: Date.now(),
    planTitle: options.plan.title,
  };

  const streamResult = await model.doStream({
    abortSignal: options.signal,
    prompt: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const reader = streamResult.stream.getReader();
  let streamState: ExecutionStreamState = { bufferedText: "" };
  let completedEventEmitted = false;
  let screenshotOutputDirectoryPath: string | undefined;
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
          completedEventEmitted = true;
          yield {
            ...event,
            sessionId: streamState.sessionId,
            videoPath: videoOutputPath,
          };
        } else {
          yield event;
        }
      }
      continue;
    }

    if (part.type === "reasoning-delta") {
      yield {
        type: "thinking",
        timestamp: Date.now(),
        text: part.delta,
      };
      continue;
    }

    if (part.type === "tool-call") {
      yield {
        type: "tool-call",
        timestamp: Date.now(),
        toolName: part.toolName,
        input: part.input,
      };

      const browserAction = parseBrowserToolName(part.toolName, browserMcpServerName);
      if (browserAction) {
        yield {
          type: "browser-log",
          timestamp: Date.now(),
          action: browserAction,
          message: `Called ${browserAction}`,
        };
      }
      continue;
    }

    if (part.type === "tool-result") {
      const browserAction = parseBrowserToolName(part.toolName, browserMcpServerName);
      let result = String(part.result);
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
          result = savedBrowserImageResult.resultText;
        }
      }

      yield {
        type: "tool-result",
        timestamp: Date.now(),
        toolName: part.toolName,
        result,
        isError: Boolean(part.isError),
      };

      if (browserAction) {
        yield {
          type: "browser-log",
          timestamp: Date.now(),
          action: browserAction,
          message: result,
        };
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
        for (const event of trailingEvent) yield event;
      } else {
        if (trailingEvent.type === "run-completed") {
          completedEventEmitted = true;
          yield {
            ...trailingEvent,
            sessionId: streamState.sessionId,
            videoPath: videoOutputPath,
          };
          return;
        }
        yield trailingEvent;
      }
    }
  }

  if (completedEventEmitted) return;

  yield {
    type: "run-completed",
    timestamp: Date.now(),
    status: "passed",
    summary: "Run completed.",
    sessionId: streamState.sessionId,
    videoPath: videoOutputPath,
  };
};
