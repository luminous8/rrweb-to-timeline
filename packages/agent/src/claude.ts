import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider";
import { isRecord } from "@browser-tester/utils";
import { convertPrompt } from "./convert-prompt.js";
import {
  EMPTY_USAGE,
  PROVIDER_ID,
  STOP_REASON,
  createLinkedAbortController,
} from "./provider-shared.js";
import type { AgentProviderSettings } from "./types.js";

const CLAUDE_MAX_TURNS = 200;

export const createClaudeModel = (settings: AgentProviderSettings = {}): LanguageModelV3 => ({
  specificationVersion: "v3",
  provider: PROVIDER_ID,
  modelId: "claude",
  supportedUrls: {},

  async doGenerate(options: LanguageModelV3CallOptions) {
    const { userPrompt, systemPrompt } = convertPrompt(options.prompt);
    const abortController = createLinkedAbortController(options.abortSignal);
    const content: LanguageModelV3Content[] = [];
    let sessionId: string | undefined;

    for await (const event of query({ prompt: userPrompt, options: buildQueryOptions(settings, abortController, systemPrompt) })) {
      sessionId = extractSessionId(event) ?? sessionId;
      if (event.type === "assistant") content.push(...convertAssistantBlocks(event.message.content));
      if (event.type === "user" && Array.isArray(event.message.content)) content.push(...convertToolResultBlocks(event.message.content));
    }

    return {
      content,
      finishReason: STOP_REASON,
      usage: EMPTY_USAGE,
      warnings: [],
      request: { body: userPrompt },
      response: { id: sessionId ?? crypto.randomUUID(), timestamp: new Date(), modelId: "claude-opus-4-6" },
      providerMetadata: sessionId ? { [PROVIDER_ID]: { sessionId } } : undefined,
    };
  },

  async doStream(options: LanguageModelV3CallOptions) {
    const { userPrompt, systemPrompt } = convertPrompt(options.prompt);
    const abortController = createLinkedAbortController(options.abortSignal);
    let sessionId: string | undefined;
    let blockCounter = 0;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        try {
          controller.enqueue({ type: "stream-start", warnings: [] });

          for await (const event of query({ prompt: userPrompt, options: buildQueryOptions(settings, abortController, systemPrompt) })) {
            const eventSessionId = extractSessionId(event);
            if (eventSessionId && !sessionId) {
              sessionId = eventSessionId;
              controller.enqueue({ type: "response-metadata", id: sessionId, timestamp: new Date(), modelId: "claude-opus-4-6" });
            }
            if (eventSessionId) sessionId = eventSessionId;

            if (event.type === "assistant") blockCounter = emitAssistantParts(event.message.content, controller, blockCounter);
            if (event.type === "user" && Array.isArray(event.message.content)) emitToolResultParts(event.message.content, controller);
          }

          controller.enqueue({ type: "finish", finishReason: STOP_REASON, usage: EMPTY_USAGE, providerMetadata: sessionId ? { [PROVIDER_ID]: { sessionId } } : undefined });
        } catch (error) {
          controller.enqueue({ type: "error", error });
        } finally {
          controller.close();
        }
      },
    });

    return { stream, request: { body: userPrompt } };
  },
});

const buildQueryOptions = (settings: AgentProviderSettings, abortController: AbortController, systemPrompt: string) => ({
  model: "claude-opus-4-6",
  effort: "max" as const,
  maxTurns: CLAUDE_MAX_TURNS,
  cwd: settings.cwd ?? process.cwd(),
  allowDangerouslySkipPermissions: true,
  permissionMode: "bypassPermissions" as const,
  abortController,
  ...(systemPrompt ? { appendSystemPrompt: systemPrompt } : {}),
  ...(settings.sessionId ? { resume: settings.sessionId } : {}),
  ...(settings.env ? { env: settings.env } : {}),
});

const extractSessionId = (event: Record<string, unknown>): string | undefined =>
  "session_id" in event && typeof event.session_id === "string" ? event.session_id : undefined;

const stringField = (record: Record<string, unknown>, key: string, fallback: string): string => {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
};

const convertAssistantBlocks = (content: unknown[]): LanguageModelV3Content[] =>
  content.filter(isRecord).flatMap((block): LanguageModelV3Content[] => {
    if (block.type === "text" && typeof block.text === "string") return [{ type: "text", text: block.text }];
    if (block.type === "thinking" && typeof block.thinking === "string") return [{ type: "reasoning", text: block.thinking }];
    if (block.type === "tool_use") {
      return [{
        type: "tool-call",
        toolCallId: stringField(block, "id", `tool_${Date.now()}`),
        toolName: stringField(block, "name", "unknown"),
        input: JSON.stringify(block.input ?? {}),
        providerExecuted: true,
      }];
    }
    return [];
  });

const convertToolResultBlocks = (content: unknown[]): LanguageModelV3Content[] =>
  content.filter(isRecord).filter((block) => block.type === "tool_result" || block.type === "tool_error").map((block) => ({
    type: "tool-result" as const,
    toolCallId: stringField(block, "tool_use_id", "unknown"),
    toolName: stringField(block, "name", "unknown"),
    result: block.type === "tool_error" ? String(block.error ?? "") : String(block.content ?? ""),
    isError: block.type === "tool_error" || block.is_error === true,
  }));

const emitAssistantParts = (
  content: unknown[],
  controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>,
  blockCounter: number,
): number => {
  for (const block of content) {
    if (!isRecord(block)) continue;
    const blockId = `block-${blockCounter++}`;

    if (block.type === "text" && typeof block.text === "string") {
      controller.enqueue({ type: "text-start", id: blockId });
      controller.enqueue({ type: "text-delta", id: blockId, delta: block.text });
      controller.enqueue({ type: "text-end", id: blockId });
    } else if (block.type === "thinking" && typeof block.thinking === "string") {
      controller.enqueue({ type: "reasoning-start", id: blockId });
      controller.enqueue({ type: "reasoning-delta", id: blockId, delta: block.thinking });
      controller.enqueue({ type: "reasoning-end", id: blockId });
    } else if (block.type === "tool_use") {
      const toolCallId = stringField(block, "id", `tool_${blockCounter}`);
      const toolName = stringField(block, "name", "unknown");
      const inputStr = JSON.stringify(block.input ?? {});
      controller.enqueue({ type: "tool-input-start", id: toolCallId, toolName, providerExecuted: true });
      controller.enqueue({ type: "tool-input-delta", id: toolCallId, delta: inputStr });
      controller.enqueue({ type: "tool-input-end", id: toolCallId });
      controller.enqueue({ type: "tool-call", toolCallId, toolName, input: inputStr, providerExecuted: true });
    }
  }
  return blockCounter;
};

const emitToolResultParts = (
  content: unknown[],
  controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>,
): void => {
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type !== "tool_result" && block.type !== "tool_error") continue;
    controller.enqueue({
      type: "tool-result",
      toolCallId: stringField(block, "tool_use_id", "unknown"),
      toolName: stringField(block, "name", "unknown"),
      result: block.type === "tool_error" ? String(block.error ?? "") : String(block.content ?? ""),
      isError: block.type === "tool_error" || block.is_error === true,
    });
  }
};
