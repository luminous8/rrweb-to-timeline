import {
  executeBrowserFlow,
  getCommitSummary,
  type BrowserRunEvent,
  type BrowserRunReport,
  type CommitSummary,
} from "@browser-tester/supervisor";
import figures from "figures";
import { VERSION } from "../constants.js";
import { getGitState, getRecommendedScope } from "./get-git-state.js";
import {
  generateBrowserPlan,
  getBrowserEnvironment,
  resolveBrowserTarget,
  type GenerateBrowserPlanResult,
  type TestAction,
} from "./browser-agent.js";
import type { TestRunConfig } from "./test-run-config.js";
import { loadSavedFlowBySlug } from "./load-saved-flow.js";

const ACTION_LABELS: Record<TestAction, string> = {
  "test-unstaged": "unstaged changes",
  "test-branch": "branch",
  "select-commit": "commit",
};

const DEFAULT_INSTRUCTIONS: Record<TestAction, string> = {
  "test-unstaged": "Test all unstaged changes in the browser and verify they work correctly.",
  "test-branch": "Test all branch changes in the browser and verify they work correctly.",
  "select-commit":
    "Test the selected commit's changes in the browser and verify they work correctly.",
};

const formatRunEvent = (event: BrowserRunEvent): string | null => {
  switch (event.type) {
    case "run-started":
      return `Starting ${event.planTitle}`;
    case "step-started":
      return `${figures.arrowRight} ${event.stepId} ${event.title}`;
    case "step-completed":
      return `  ${figures.tick} ${event.stepId} ${event.summary}`;
    case "assertion-failed":
      return `  ${figures.cross} ${event.stepId} ${event.message}`;
    case "browser-log":
      return `    browser:${event.action} ${event.message}`;
    case "text":
      return event.text;
    case "error":
      return `Error: ${event.message}`;
    case "run-completed":
      return `Run ${event.status}: ${event.summary}`;
    default:
      return null;
  }
};

const resolvePlan = async (
  config: TestRunConfig,
  selectedCommit?: CommitSummary,
): Promise<GenerateBrowserPlanResult> => {
  const { action, environmentOverrides } = config;

  if (config.flowSlug) {
    const savedFlow = await loadSavedFlowBySlug(config.flowSlug);
    if (!savedFlow) {
      console.error(`Saved flow "${config.flowSlug}" not found.`);
      process.exit(1);
    }
    const target = resolveBrowserTarget({ action, commit: selectedCommit });
    const environment = {
      ...getBrowserEnvironment(environmentOverrides),
      ...savedFlow.environment,
    };
    console.error(`Using saved flow: ${savedFlow.title} (${savedFlow.plan.steps.length} steps)\n`);
    return { target, plan: savedFlow.plan, environment };
  }

  const userInstruction = config.message ?? DEFAULT_INSTRUCTIONS[action];
  console.error("Planning browser flow...");
  const result = await generateBrowserPlan({
    action,
    commit: selectedCommit,
    userInstruction,
    environmentOverrides,
  });
  console.error(`Plan: ${result.plan.title} (${result.plan.steps.length} steps)\n`);
  return result;
};

export const runTest = async (config: TestRunConfig): Promise<void> => {
  const { action } = config;
  const gitState = getGitState();

  let resolvedCommit;
  if (action === "select-commit" && config.commitHash) {
    resolvedCommit = getCommitSummary(process.cwd(), config.commitHash) ?? undefined;
    if (!resolvedCommit) {
      console.error(`Commit "${config.commitHash}" not found in recent history.`);
      process.exit(1);
    }
  }

  console.error(`testie v${VERSION}`);
  if (gitState.isGitRepo) {
    console.error(`Testing ${ACTION_LABELS[action]} on ${gitState.currentBranch}\n`);
  } else {
    console.error(`Testing ${ACTION_LABELS[action]} (no git repository detected)\n`);
  }

  try {
    const { target, plan, environment } = await resolvePlan(config, resolvedCommit);
    let latestRunReport: BrowserRunReport | null = null;

    for await (const event of executeBrowserFlow({ target, plan, environment })) {
      if (event.type === "run-started" && event.liveViewUrl) {
        process.stdout.write(`Live view: ${event.liveViewUrl}\n`);
      }
      if (event.type === "run-completed" && event.report) {
        latestRunReport = event.report;
      }
      const line = formatRunEvent(event);
      if (line) {
        process.stdout.write(line + "\n");
      }
    }

    if (latestRunReport?.artifacts.highlightVideoPath) {
      process.stdout.write(`Highlight reel: ${latestRunReport.artifacts.highlightVideoPath}\n`);
    }
    if (latestRunReport?.artifacts.shareUrl) {
      process.stdout.write(`Report: ${latestRunReport.artifacts.shareUrl}\n`);
    }
    if (latestRunReport?.pullRequest) {
      process.stdout.write(
        `Open PR: #${latestRunReport.pullRequest.number} ${latestRunReport.pullRequest.url}\n`,
      );
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export const autoDetectAndTest = async (config?: Partial<TestRunConfig>): Promise<void> => {
  const gitState = getGitState();
  if (!gitState.isGitRepo) {
    await runTest({ action: "test-unstaged", ...config });
    return;
  }
  const scope = getRecommendedScope(gitState);
  const action: TestAction = scope === "unstaged-changes" ? "test-unstaged" : "test-branch";
  await runTest({ action, ...config });
};
