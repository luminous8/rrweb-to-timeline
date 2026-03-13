import {
  executeBrowserFlow,
  planBrowserFlow,
  resolveTestTarget,
  type BrowserEnvironmentHints,
  type BrowserFlowPlan,
  type BrowserRunEvent,
  type TestTarget,
} from "@browser-tester/orchestrator";
import type { Commit } from "./fetch-commits.js";

export type TestAction = "test-unstaged" | "test-branch" | "select-commit";

interface GenerateBrowserPlanOptions {
  action: TestAction;
  commit?: Commit;
  userInstruction: string;
  environmentOverrides?: BrowserEnvironmentHints;
}

interface GenerateBrowserPlanResult {
  target: TestTarget;
  plan: BrowserFlowPlan;
  environment: BrowserEnvironmentHints;
}

interface ExecuteApprovedPlanOptions {
  target: TestTarget;
  plan: BrowserFlowPlan;
  environment: BrowserEnvironmentHints;
  signal?: AbortSignal;
}

const parseBooleanEnvironmentValue = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes")
    return true;
  if (normalizedValue === "false" || normalizedValue === "0" || normalizedValue === "no")
    return false;
  return undefined;
};

const mergeBrowserEnvironment = (
  baseEnvironment: BrowserEnvironmentHints,
  environmentOverrides: BrowserEnvironmentHints | undefined,
): BrowserEnvironmentHints => ({
  ...baseEnvironment,
  ...(environmentOverrides ?? {}),
});

export const getBrowserEnvironment = (): BrowserEnvironmentHints => ({
  baseUrl: process.env.BROWSER_TESTER_BASE_URL,
  headed: parseBooleanEnvironmentValue(process.env.BROWSER_TESTER_HEADED),
  cookies: parseBooleanEnvironmentValue(process.env.BROWSER_TESTER_COOKIES),
});

const createSelection = (action: TestAction, commit?: Commit) => {
  if (action === "select-commit") {
    return {
      action,
      commitHash: commit?.hash,
      commitShortHash: commit?.shortHash,
      commitSubject: commit?.subject,
    } as const;
  }

  return { action } as const;
};

export const generateBrowserPlan = async (
  options: GenerateBrowserPlanOptions,
): Promise<GenerateBrowserPlanResult> => {
  const target = resolveTestTarget({
    selection: createSelection(options.action, options.commit),
  });
  const environment = mergeBrowserEnvironment(
    getBrowserEnvironment(),
    options.environmentOverrides,
  );
  const plan = await planBrowserFlow({
    target,
    userInstruction: options.userInstruction,
    environment,
  });

  return {
    target,
    plan,
    environment,
  };
};

export const executeApprovedPlan = async function* (
  options: ExecuteApprovedPlanOptions,
): AsyncGenerator<BrowserRunEvent> {
  for await (const event of executeBrowserFlow(options)) {
    yield event;
  }
};
