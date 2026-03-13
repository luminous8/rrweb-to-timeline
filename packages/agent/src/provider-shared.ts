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

export const createLinkedAbortController = (signal?: AbortSignal): AbortController => {
  const controller = new AbortController();
  if (signal) signal.addEventListener("abort", () => controller.abort(signal.reason));
  return controller;
};
