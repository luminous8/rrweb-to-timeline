import { fileURLToPath } from "node:url";
import { streamText } from "ai";
import { createClaudeModel } from "@browser-tester/agent";
import type { Commit } from "./fetch-commits.js";
import type { GitState } from "./get-git-state.js";

export type TestAction = "test-unstaged" | "test-branch" | "select-commit";

interface AgentStreamOptions {
  action: TestAction;
  gitState: GitState;
  commit?: Commit;
  signal?: AbortSignal;
}

const BROWSER_TESTING_SYSTEM_PROMPT = `You are a browser testing agent. Your job is to verify code changes work correctly by driving a real Chromium browser via the "browser-tester" MCP server.

## Workflow

1. Read the git diff to understand what changed.
2. Find the affected pages, routes, or components in the codebase.
3. Start the dev server if one isn't already running (check package.json for scripts — common ports: 3000, 5173, 8080, 4321).
4. Open the target URL with \`open\`, then \`snapshot\` the accessibility tree to get element refs (e1, e2, ...).
5. Interact with elements via refs using \`click\`, \`fill\`, \`type\`, \`select\`, \`hover\`.
6. Snapshot after every interaction to verify the page updated correctly.
7. Check \`read_console_messages\` for JS errors and \`read_network_requests\` for failed API calls after each step.

## Testing strategy

- Happy path first — does the core flow work end to end?
- Then edge cases tied to the diff: empty inputs, missing data, boundary values, rapid interactions.
- If the change fixes a bug, reproduce the original bug scenario to prove it's resolved.
- If it's a UI change, use \`annotated_screenshot\` for visual verification.
- Use \`snapshot\` with \`interactive: true\` or a \`selector\` to focus on relevant parts of large pages.
- Use \`find\` to search by text content, CSS selector (prefix \`css:\`), or ARIA role (prefix \`role:\`).
- Use \`wait\` for pages that load content asynchronously before interacting.

## Reporting

For each test scenario, report pass or fail. On failure, explain expected vs actual behavior and include evidence — console errors, failed requests, or screenshots. Always \`close\` the browser when done.`;

const buildPrompt = (options: AgentStreamOptions): string => {
  const { action, gitState, commit } = options;
  const branch = gitState.currentBranch;

  switch (action) {
    case "test-unstaged": {
      const fileCount = gitState.diffStats?.filesChanged ?? 0;
      const additions = gitState.diffStats?.additions ?? 0;
      const deletions = gitState.diffStats?.deletions ?? 0;
      return [
        `There are unstaged changes on branch "${branch}": ${fileCount} files changed (+${additions} -${deletions}).`,
        "",
        "Run `git diff` to see exactly what changed, then open the affected pages in the browser and test that the changes work correctly. Focus your testing on the specific areas that were modified.",
      ].join("\n");
    }
    case "test-branch": {
      const stats = gitState.branchDiffStats;
      const statsLine = stats
        ? ` (${stats.filesChanged} files, +${stats.additions} -${stats.deletions} vs main)`
        : "";
      return [
        `Test all changes on branch "${branch}"${statsLine}.`,
        "",
        "Run `git diff main...HEAD` to see the full branch diff, then systematically test every user-facing change in the browser. Verify nothing is broken and all new behavior works as intended.",
      ].join("\n");
    }
    case "select-commit":
      return commit
        ? [
            `Test the changes in commit ${commit.shortHash} ("${commit.subject}") on branch "${branch}".`,
            "",
            `Run \`git show ${commit.shortHash}\` to see the exact diff, then open the affected pages and verify the commit's changes work correctly in the browser.`,
          ].join("\n")
        : [
            `Test the most recent commit on branch "${branch}".`,
            "",
            "Run `git log -1 --stat` to identify the commit, then `git show` to see the diff, and test the changes in the browser.",
          ].join("\n");
  }
};

export const agentStream = async function* (options: AgentStreamOptions): AsyncGenerator<string> {
  const mcpServerPath = fileURLToPath(
    import.meta.resolve("@browser-tester/browser/mcp-start"),
  );

  const model = createClaudeModel({
    cwd: process.cwd(),
    mcpServers: {
      "browser-tester": {
        command: "node",
        args: [mcpServerPath],
      },
    },
  });

  const prompt = buildPrompt(options);

  const result = streamText({
    model,
    system: BROWSER_TESTING_SYSTEM_PROMPT,
    prompt,
    abortSignal: options.signal,
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
};
