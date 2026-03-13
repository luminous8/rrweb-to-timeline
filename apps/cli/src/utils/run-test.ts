import { VERSION } from "../constants.js";
import { fetchCommits } from "./fetch-commits.js";
import { getGitState, getRecommendedScope } from "./get-git-state.js";
import { agentStream, type TestAction } from "./mock-agent-stream.js";

const ACTION_LABELS: Record<TestAction, string> = {
  "test-unstaged": "unstaged changes",
  "test-branch": "branch",
  "select-commit": "commit",
};

export const runTest = async (action: TestAction, commitHash?: string): Promise<void> => {
  const gitState = getGitState();

  let commit;
  if (action === "select-commit") {
    if (commitHash) {
      const commits = fetchCommits();
      commit = commits.find(
        (candidate) =>
          candidate.shortHash === commitHash || candidate.hash.startsWith(commitHash),
      );
      if (!commit) {
        console.error(`Commit "${commitHash}" not found in recent history.`);
        process.exit(1);
      }
    }
  }

  console.error(`testie v${VERSION}`);
  console.error(`Testing ${ACTION_LABELS[action]} on ${gitState.currentBranch}\n`);

  const stream = agentStream({ action, gitState, commit });
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }
  process.stdout.write("\n");
};

export const autoDetectAndTest = async (): Promise<void> => {
  const gitState = getGitState();
  const scope = getRecommendedScope(gitState);
  const action: TestAction = scope === "unstaged-changes" ? "test-unstaged" : "test-branch";
  await runTest(action);
};
