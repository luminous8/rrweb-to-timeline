import * as crypto from "node:crypto";
import { Channel, Effect, Option, Stream } from "effect";
import { changesForDisplayName, type ChangesFor } from "@expect/shared/models";
import {
  DraftId,
  Executor,
  ExecutedTestPlan,
  Git,
  Planner,
  Reporter,
  TestPlanDraft,
} from "@expect/supervisor";
import { Analytics } from "@expect/shared/observability";
import type { AgentBackend } from "@expect/agent";
import figures from "figures";
import { VERSION } from "../constants";
import { layerCli } from "../layers";
import { playSound } from "./play-sound";

interface HeadlessRunOptions {
  changesFor: ChangesFor;
  instruction: string;
  agent: AgentBackend;
  verbose: boolean;
}

export const runHeadless = (options: HeadlessRunOptions) =>
  Effect.gen(function* () {
    const planner = yield* Planner;
    const git = yield* Git;
    const executor = yield* Executor;
    const reporter = yield* Reporter;
    const analytics = yield* Analytics;

    const sessionStartedAt = Date.now();
    yield* analytics.capture("session:started", {
      mode: "headless",
      skip_planning: true,
    });

    console.log(`expect v${VERSION}`);
    console.log(`Testing ${changesForDisplayName(options.changesFor)}`);
    console.log("Planning browser flow...");

    const currentBranch = yield* git.getCurrentBranch;
    const fileStats = yield* git.getFileStats(options.changesFor);
    const diffPreview = yield* git.getDiffPreview(options.changesFor);

    const draft = new TestPlanDraft({
      id: DraftId.makeUnsafe(crypto.randomUUID()),
      changesFor: options.changesFor,
      currentBranch,
      diffPreview,
      fileStats: [...fileStats],
      instruction: options.instruction,
      baseUrl: Option.none(),
      isHeadless: false,
      requiresCookies: false,
    });

    const testPlan = yield* Channel.runDrain(planner.plan(draft));
    yield* analytics.capture("plan:generated", {
      plan_id: testPlan.id,
      step_count: testPlan.steps.length,
    });
    yield* Effect.logInfo(`Plan: ${testPlan.title} (${testPlan.steps.length} steps)`);

    const runStartedAt = Date.now();
    const seenEvents = new Set<string>();
    const finalExecuted = yield* executor.executePlan(testPlan).pipe(
      Stream.tap((executed) =>
        Effect.sync(() => {
          for (const event of executed.events) {
            if (seenEvents.has(event.id)) continue;
            seenEvents.add(event.id);
            switch (event._tag) {
              case "RunStarted":
                console.log(`Starting ${event.plan.title}`);
                break;
              case "StepStarted":
                console.log(`${figures.arrowRight} ${event.stepId} ${event.title}`);
                break;
              case "StepCompleted":
                console.log(`  ${figures.tick} ${event.stepId} ${event.summary}`);
                break;
              case "StepFailed":
                console.log(`  ${figures.cross} ${event.stepId} ${event.message}`);
                break;
            }
          }
        }),
      ),
      Stream.runLast,
      Effect.map((option) =>
        option._tag === "Some" ? option.value : new ExecutedTestPlan({ ...testPlan, events: [] }),
      ),
    );

    const report = yield* reporter.report(finalExecuted);

    const passedCount = report.steps.filter(
      (step) => report.stepStatuses.get(step.id)?.status === "passed",
    ).length;
    const failedCount = report.steps.filter(
      (step) => report.stepStatuses.get(step.id)?.status === "failed",
    ).length;

    yield* analytics.capture("run:completed", {
      plan_id: testPlan.id,
      passed: passedCount,
      failed: failedCount,
      step_count: testPlan.steps.length,
      file_count: fileStats.length,
      duration_ms: Date.now() - runStartedAt,
    });

    yield* analytics.capture("session:ended", {
      session_ms: Date.now() - sessionStartedAt,
    });
    yield* analytics.flush;

    console.error(`\n${report.toPlainText}`);
    yield* Effect.promise(() => playSound());
    process.exit(report.status === "passed" ? 0 : 1);
  }).pipe(
    Effect.provide(layerCli({ verbose: options.verbose, agent: options.agent })),
    Effect.runPromise,
  );
