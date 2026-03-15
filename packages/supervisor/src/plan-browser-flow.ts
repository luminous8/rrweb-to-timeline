import type { LanguageModelV3 } from "@ai-sdk/provider";
import { z } from "zod";
import {
  BROWSER_TEST_MODEL,
  DEFAULT_AGENT_PROVIDER,
  PLANNER_CHANGED_FILE_LIMIT,
  PLANNER_MAX_STEP_COUNT,
  PLANNER_MODEL_EFFORT,
  PLANNER_MAX_TURNS,
  PLANNER_RECENT_COMMIT_LIMIT,
  STEP_ID_PAD_LENGTH,
} from "./constants.js";
import { createAgentModel } from "./create-agent-model.js";
import { extractJsonObject } from "./json.js";
import type { BrowserFlowPlan, PlanBrowserFlowOptions, PlanStep, TestTarget } from "./types.js";
import { formatDiffStats } from "./utils/format-diff-stats.js";
import { buildPlanningDiffPreview } from "./utils/build-planning-diff-preview.js";
import { prioritizePlanningFiles } from "./utils/prioritize-planning-files.js";

const nullableOptionalString = z
  .string()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

const planStepSchema = z.object({
  id: nullableOptionalString,
  title: z.string().min(1),
  instruction: z.string().min(1),
  expectedOutcome: z.string().min(1),
  routeHint: nullableOptionalString,
  changedFileEvidence: z.array(z.string().min(1)).default([]),
});

const cookieSyncSchema = z.object({
  required: z.boolean(),
  reason: z.string().min(1),
});

const browserFlowPlanSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  targetSummary: z.string().min(1),
  assumptions: z.array(z.string().min(1)).default([]),
  riskAreas: z.array(z.string().min(1)).default([]),
  targetUrls: z.array(z.string().min(1)).default([]),
  cookieSync: cookieSyncSchema,
  steps: z.array(planStepSchema).min(1).max(PLANNER_MAX_STEP_COUNT),
});

const createPlannerModel = (
  options: Pick<PlanBrowserFlowOptions, "model" | "provider" | "providerSettings" | "target">,
): LanguageModelV3 => {
  if (options.model) return options.model;

  const provider = options.provider ?? DEFAULT_AGENT_PROVIDER;
  const claudeOnlySettings =
    provider === "claude"
      ? { model: BROWSER_TEST_MODEL, permissionMode: "plan" as const, tools: [] }
      : {};

  return createAgentModel(provider, {
    cwd: options.target.cwd,
    effort: PLANNER_MODEL_EFFORT,
    maxTurns: PLANNER_MAX_TURNS,
    ...claudeOnlySettings,
    ...(options.providerSettings ?? {}),
  });
};

const formatChangedFiles = (changedFiles: TestTarget["changedFiles"]): string =>
  changedFiles.length > 0
    ? changedFiles.map((file) => `- [${file.status}] ${file.path}`).join("\n")
    : "- No changed files detected";

const formatRecentCommits = (target: TestTarget): string =>
  target.recentCommits.length > 0
    ? target.recentCommits
        .slice(0, PLANNER_RECENT_COMMIT_LIMIT)
        .map((commit) => `- ${commit.shortHash} ${commit.subject}`)
        .join("\n")
    : "- No recent commits available";

const formatScopePlanningStrategy = (target: TestTarget): string => {
  if (target.scope === "unstaged") {
    return [
      "- Target mode: unstaged",
      "- Bias toward fast smoke coverage of the touched surfaces.",
      "- Prefer the smallest set of steps that still checks each changed user-facing surface.",
      "- Cover the direct change and only the most obvious adjacent flow if it materially de-risks the diff.",
      "- Avoid broad regression sweeps unless the diff preview clearly suggests a cross-cutting change.",
    ].join("\n");
  }

  if (target.scope === "commit") {
    return [
      "- Target mode: commit",
      "- Bias toward narrow validation of the specific change in the selected commit.",
      `- Selected commit: ${target.selectedCommit?.shortHash ?? "unknown"} ${target.selectedCommit?.subject ?? ""}`.trim(),
      "- Treat the commit subject and diff as the primary testing hypothesis.",
      "- Prefer a focused before/after validation instead of a broad end-to-end tour.",
    ].join("\n");
  }

  return [
    "- Target mode: branch",
    "- Bias toward broader regression around neighboring flows touched by the branch diff.",
    "- Cover the direct journey plus adjacent entry points or follow-up screens that could regress together.",
    "- Include a wider sanity pass when multiple related product files changed.",
    "- Still prioritize the highest-risk browser journeys over exhaustive coverage.",
  ].join("\n");
};

const buildPlanningPrompt = (options: PlanBrowserFlowOptions): string => {
  const { target, userInstruction, environment } = options;
  const prioritizedFiles = prioritizePlanningFiles(target.changedFiles);
  const displayedFiles = prioritizedFiles.slice(0, PLANNER_CHANGED_FILE_LIMIT);

  return [
    "You are planning a browser-based regression test flow for a developer.",
    "Return JSON only and make the plan directly editable by a human reviewer.",
    "",
    "Testing target:",
    `- Scope: ${target.scope}`,
    `- Display name: ${target.displayName}`,
    `- Current branch: ${target.branch.current}`,
    `- Main branch: ${target.branch.main ?? "unknown"}`,
    `- Diff stats: ${formatDiffStats(target.diffStats)}`,
    target.selectedCommit
      ? `- Selected commit: ${target.selectedCommit.shortHash} ${target.selectedCommit.subject}`
      : null,
    "",
    "Changed files:",
    formatChangedFiles(displayedFiles),
    "",
    "Recent commits:",
    formatRecentCommits(target),
    "",
    "Diff preview:",
    buildPlanningDiffPreview(target.diffPreview, displayedFiles),
    "",
    "User-requested browser journey:",
    userInstruction,
    "",
    "Environment hints:",
    `- Base URL: ${environment?.baseUrl ?? "not provided"}`,
    `- Headed mode: ${environment?.headed === true ? "yes" : "no or not specified"}`,
    `- Reuse browser cookies: ${environment?.cookies === true ? "yes" : "no or not specified"}`,
    "",
    "Scope strategy:",
    formatScopePlanningStrategy(target),
    "",
    "Requirements:",
    "- Make the plan meaningfully different depending on whether the target is unstaged, branch, or commit.",
    "- Blend the requested journey with code-change-derived risk areas.",
    "- Focus on realistic browser steps that a browser agent can execute.",
    "- Use each step's expectedOutcome as a concrete browser assertion target, not just a vague goal.",
    "- Include assumptions when the journey depends on unknown data or authentication.",
    "- Decide whether syncing browser cookies is required to execute the flow reliably.",
    "- Set cookieSync.required to true when the flow likely needs an authenticated user session, account state, org access, or non-public app data.",
    "- Set cookieSync.required to false for public or clearly unauthenticated flows, and explain the decision in cookieSync.reason.",
    "- Before returning, self-check the plan by asking: Which risk area is not covered by any step? Which step is likely to fail due to auth or missing data?",
    "- Use that self-check to strengthen the steps, assumptions, riskAreas, and cookieSync decision before you return the final JSON.",
    "- Keep the plan concise and high signal.",
    `- Use a maximum of ${PLANNER_MAX_STEP_COUNT} steps.`,
    "",
    "Return a JSON object with this exact shape:",
    '{"title":"string","rationale":"string","targetSummary":"string","assumptions":["string"],"riskAreas":["string"],"targetUrls":["string"],"cookieSync":{"required":true,"reason":"string"},"steps":[{"id":"optional string","title":"string","instruction":"string","expectedOutcome":"string","routeHint":"optional string","changedFileEvidence":["string"]}]}',
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
};

const normalizeSteps = (steps: z.infer<typeof planStepSchema>[]): PlanStep[] =>
  steps.map((step, index) => ({
    ...step,
    id: step.id || `step-${String(index + 1).padStart(STEP_ID_PAD_LENGTH, "0")}`,
  }));

const parsePlanJson = (parsedJson: unknown): z.infer<typeof browserFlowPlanSchema> => {
  const directResult = browserFlowPlanSchema.safeParse(parsedJson);
  if (directResult.success) return directResult.data;

  if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
    for (const value of Object.values(parsedJson)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const nestedResult = browserFlowPlanSchema.safeParse(value);
      if (nestedResult.success) return nestedResult.data;
    }
  }

  return browserFlowPlanSchema.parse(parsedJson);
};

export const planBrowserFlow = async (
  options: PlanBrowserFlowOptions,
): Promise<BrowserFlowPlan> => {
  const prompt = buildPlanningPrompt(options);
  const model = createPlannerModel(options);
  const response = await model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const text = response.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const parsedPlan = parsePlanJson(JSON.parse(extractJsonObject(text)));

  return {
    ...parsedPlan,
    userInstruction: options.userInstruction,
    steps: normalizeSteps(parsedPlan.steps),
  };
};
