import { MOCK_STREAM_MIN_DELAY_MS, MOCK_STREAM_MAX_DELAY_MS } from "../constants.js";
import type { Commit } from "./fetch-commits.js";
import type { GitState } from "./get-git-state.js";

export type TestAction = "test-unstaged" | "test-branch" | "select-commit";

interface MockStreamOptions {
  action: TestAction;
  gitState: GitState;
  commit?: Commit;
  signal?: AbortSignal;
}

const delay = (signal?: AbortSignal): Promise<void> => {
  const duration =
    MOCK_STREAM_MIN_DELAY_MS +
    Math.random() * (MOCK_STREAM_MAX_DELAY_MS - MOCK_STREAM_MIN_DELAY_MS);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, duration);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
};

const buildMessages = (options: MockStreamOptions): string[] => {
  const { action, gitState, commit } = options;

  let analyzeMessage: string;
  switch (action) {
    case "test-unstaged":
      analyzeMessage = `Analyzing unstaged changes (${gitState.diffStats?.filesChanged ?? 0} files)...`;
      break;
    case "test-branch":
      analyzeMessage = `Analyzing branch ${gitState.currentBranch}...`;
      break;
    case "select-commit":
      analyzeMessage = commit
        ? `Analyzing commit ${commit.shortHash} (${commit.subject})...`
        : "Analyzing selected commit...";
      break;
  }

  return [
    analyzeMessage,
    "Reading repository structure...",
    "Creating test plan...",
    "",
    "Test plan:",
    "  1. Verify page loads correctly",
    "  2. Test interactive elements",
    "  3. Check responsive layout",
    "",
    "Running test 1/3: page load...",
    "  ✓ Test 1/3 passed",
    "Running test 2/3: interactive elements...",
    "  ✓ Test 2/3 passed",
    "Running test 3/3: responsive layout...",
    "  ✓ Test 3/3 passed",
    "",
    "All tests passed (3/3)",
  ];
};

export async function* mockAgentStream(options: MockStreamOptions): AsyncGenerator<string> {
  const messages = buildMessages(options);
  for (const message of messages) {
    await delay(options.signal);
    yield message;
  }
}
