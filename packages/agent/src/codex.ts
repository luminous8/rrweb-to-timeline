import { Codex } from "@openai/codex-sdk";
import type { ThreadItem, UserInput } from "@openai/codex-sdk";
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider";
import { convertPrompt } from "./convert-prompt.js";
import {
  EMPTY_USAGE,
  PROVIDER_ID,
  STOP_REASON,
  collectUnsupportedWarnings,
} from "./provider-shared.js";
import type { AgentProviderSettings } from "./types.js";

export const createCodexModel = (settings: AgentProviderSettings = {}): LanguageModelV3 => ({
  specificationVersion: "v3",
  provider: PROVIDER_ID,
  modelId: "codex",
  supportedUrls: {},

  async doGenerate(options: LanguageModelV3CallOptions) {
    const { userPrompt, systemPrompt } = convertPrompt(options.prompt);
    const warnings = collectUnsupportedWarnings(options, "Codex SDK");
    const thread = createThread(settings);
    const input = buildInput(userPrompt, systemPrompt);

    const result = await thread.run(input, { signal: options.abortSignal });
    const content = result.items.flatMap(convertItem);

    const usage = result.usage
      ? {
          inputTokens: { total: result.usage.input_tokens, noCache: undefined, cacheRead: result.usage.cached_input_tokens, cacheWrite: undefined },
          outputTokens: { total: result.usage.output_tokens, text: undefined, reasoning: undefined },
        }
      : EMPTY_USAGE;

    return {
      content,
      finishReason: STOP_REASON,
      usage,
      warnings,
      request: { body: userPrompt },
      response: { id: thread.id ?? crypto.randomUUID(), timestamp: new Date(), modelId: "codex" },
      providerMetadata: thread.id ? { [PROVIDER_ID]: { sessionId: thread.id } } : undefined,
    };
  },

  async doStream(options: LanguageModelV3CallOptions) {
    const { userPrompt, systemPrompt } = convertPrompt(options.prompt);
    const warnings = collectUnsupportedWarnings(options, "Codex SDK");
    const thread = createThread(settings);
    const input = buildInput(userPrompt, systemPrompt);
    let sessionId: string | undefined;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        try {
          controller.enqueue({ type: "stream-start", warnings });
          const { events } = await thread.runStreamed(input, { signal: options.abortSignal });

          for await (const event of events) {
            if (event.type === "thread.started") {
              sessionId = event.thread_id;
              controller.enqueue({ type: "response-metadata", id: sessionId, timestamp: new Date(), modelId: "codex" });
            }
            if (event.type === "item.completed") emitItemParts(event.item, controller);
          }

          if (!sessionId && thread.id) sessionId = thread.id;
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

const createThread = (settings: AgentProviderSettings) => {
  const codex = new Codex();
  return settings.sessionId
    ? codex.resumeThread(settings.sessionId, { workingDirectory: settings.cwd })
    : codex.startThread({ workingDirectory: settings.cwd });
};

const buildInput = (userPrompt: string, systemPrompt: string): UserInput[] => {
  const inputs: UserInput[] = [];
  if (systemPrompt) inputs.push({ type: "text", text: systemPrompt });
  inputs.push({ type: "text", text: userPrompt });
  return inputs;
};

const convertItem = (item: ThreadItem): LanguageModelV3Content[] => {
  if (item.type === "agent_message") return [{ type: "text", text: item.text }];
  if (item.type === "reasoning") return [{ type: "reasoning", text: item.text }];

  if (item.type === "command_execution") {
    return toolPair(item.id, "exec", { command: item.command }, {
      command: item.command, aggregatedOutput: item.aggregated_output, exitCode: item.exit_code, status: item.status,
    }, item.status === "failed" || (item.exit_code !== undefined && item.exit_code !== 0));
  }

  if (item.type === "file_change") {
    return toolPair(item.id, "patch", { changes: item.changes }, { changes: item.changes, status: item.status }, item.status === "failed");
  }

  if (item.type === "mcp_tool_call") {
    return toolPair(item.id, `mcp__${item.server}__${item.tool}`, {
      server: item.server, tool: item.tool, arguments: item.arguments,
    }, {
      server: item.server, tool: item.tool, status: item.status,
      ...(item.result ? { result: item.result } : {}),
      ...(item.error ? { error: item.error } : {}),
    }, item.status === "failed");
  }

  if (item.type === "web_search") {
    return toolPair(item.id, "web_search", { query: item.query }, { query: item.query }, false);
  }

  return [];
};

const toolPair = (
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>,
  isError: boolean,
): LanguageModelV3Content[] => [
  { type: "tool-call", toolCallId, toolName, input: JSON.stringify(input), providerExecuted: true },
  { type: "tool-result", toolCallId, toolName, result: JSON.stringify(result), isError },
];

const emitItemParts = (
  item: ThreadItem,
  controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>,
): void => {
  if (item.type === "agent_message") {
    controller.enqueue({ type: "text-start", id: item.id });
    controller.enqueue({ type: "text-delta", id: item.id, delta: item.text });
    controller.enqueue({ type: "text-end", id: item.id });
    return;
  }

  if (item.type === "reasoning") {
    controller.enqueue({ type: "reasoning-start", id: item.id });
    controller.enqueue({ type: "reasoning-delta", id: item.id, delta: item.text });
    controller.enqueue({ type: "reasoning-end", id: item.id });
    return;
  }

  for (const part of convertItem(item)) {
    if (part.type === "tool-call") {
      controller.enqueue({ type: "tool-input-start", id: part.toolCallId, toolName: part.toolName, providerExecuted: true });
      controller.enqueue({ type: "tool-input-delta", id: part.toolCallId, delta: part.input });
      controller.enqueue({ type: "tool-input-end", id: part.toolCallId });
      controller.enqueue(part);
    }
    if (part.type === "tool-result") controller.enqueue(part);
  }
};
