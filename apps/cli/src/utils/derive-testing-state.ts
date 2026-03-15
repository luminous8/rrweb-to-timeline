import type { BrowserFlowPlan, BrowserRunEvent } from "@browser-tester/supervisor";
import { formatBrowserToolCall } from "./format-browser-tool-call.js";

const TOOL_CALL_HIDDEN = "hidden";
const TOOL_CALL_DETAILED = "detailed";

export interface StepDisplayState {
  stepId: string;
  status: "pending" | "active" | "passed" | "failed";
  label: string;
}

export interface DerivedTestingState {
  steps: StepDisplayState[];
  currentToolCallText: string | null;
  activeStepStartedAt: number | null;
  completedCount: number;
  totalCount: number;
}

export const deriveTestingState = (
  plan: BrowserFlowPlan,
  events: BrowserRunEvent[],
  toolCallDisplayMode: string,
  isRunning: boolean,
): DerivedTestingState => {
  const stepStateById = new Map<string, StepDisplayState>();

  for (const step of plan.steps) {
    stepStateById.set(step.id, {
      stepId: step.id,
      status: "pending",
      label: step.title,
    });
  }

  let activeStepId: string | null = null;
  let activeStepStartedAt: number | null = null;
  let currentToolCallText: string | null = null;

  for (const event of events) {
    switch (event.type) {
      case "step-started": {
        const stepState = stepStateById.get(event.stepId);
        if (stepState) {
          stepState.status = "active";
          activeStepId = event.stepId;
          activeStepStartedAt = event.timestamp;
          currentToolCallText = null;
        }
        break;
      }
      case "step-completed": {
        const stepState = stepStateById.get(event.stepId);
        if (stepState) {
          stepState.status = "passed";
          stepState.label = event.summary;
          if (activeStepId === event.stepId) {
            activeStepId = null;
            activeStepStartedAt = event.timestamp;
            currentToolCallText = null;
          }
        }
        break;
      }
      case "assertion-failed": {
        const stepState = stepStateById.get(event.stepId);
        if (stepState) {
          stepState.status = "failed";
          stepState.label = event.message;
          if (activeStepId === event.stepId) {
            activeStepId = null;
            activeStepStartedAt = event.timestamp;
            currentToolCallText = null;
          }
        }
        break;
      }
      case "tool-call": {
        if (activeStepId && toolCallDisplayMode !== TOOL_CALL_HIDDEN) {
          const formatted = formatBrowserToolCall(event.toolName, event.input, {
            includeRelevantInputs: toolCallDisplayMode === TOOL_CALL_DETAILED,
          });
          if (formatted) {
            currentToolCallText = formatted;
          }
        }
        break;
      }
    }
  }

  const steps = plan.steps.map(
    (planStep): StepDisplayState =>
      stepStateById.get(planStep.id) ?? {
        stepId: planStep.id,
        status: "pending",
        label: planStep.title,
      },
  );

  if (isRunning && !activeStepId) {
    const firstPending = steps.find((step) => step.status === "pending");
    if (firstPending) {
      firstPending.status = "active";
    }
  }

  const completedCount = steps.filter(
    (step) => step.status === "passed" || step.status === "failed",
  ).length;

  return {
    steps,
    currentToolCallText,
    activeStepStartedAt,
    completedCount,
    totalCount: steps.length,
  };
};
