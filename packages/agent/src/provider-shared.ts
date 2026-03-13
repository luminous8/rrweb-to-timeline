import type { LanguageModelV3CallOptions, SharedV3Warning } from "@ai-sdk/provider";

export const PROVIDER_ID = "browser-tester-agent";

export const EMPTY_USAGE = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: undefined,
    text: undefined,
    reasoning: undefined,
  },
};

export const STOP_REASON = { unified: "stop" as const, raw: undefined };

export const collectUnsupportedWarnings = (
  options: LanguageModelV3CallOptions,
  providerName: string,
): SharedV3Warning[] => {
  const warnings: SharedV3Warning[] = [];
  const unsupported = [
    "temperature",
    "topP",
    "topK",
    "presencePenalty",
    "frequencyPenalty",
    "seed",
    "stopSequences",
  ] as const;

  for (const feature of unsupported) {
    if (feature in options && (options as Record<string, unknown>)[feature] !== undefined) {
      warnings.push({ type: "unsupported", feature });
    }
  }

  if (options.tools?.length) {
    warnings.push({ type: "unsupported", feature: "tools", details: `${providerName} executes tools autonomously` });
  }

  if (options.toolChoice) {
    warnings.push({ type: "unsupported", feature: "toolChoice", details: `${providerName} executes tools autonomously` });
  }

  return warnings;
};

export const createLinkedAbortController = (signal?: AbortSignal): AbortController => {
  const controller = new AbortController();
  if (signal) signal.addEventListener("abort", () => controller.abort(signal.reason));
  return controller;
};
