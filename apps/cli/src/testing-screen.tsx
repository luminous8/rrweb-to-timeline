import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { COLORS } from "./constants.js";
import { Spinner } from "./spinner.js";
import { mockAgentStream, type TestAction } from "./utils/mock-agent-stream.js";
import type { Commit } from "./utils/fetch-commits.js";
import type { GitState } from "./utils/get-git-state.js";

interface TestingScreenProps {
  action: TestAction;
  commit?: Commit;
  gitState: GitState;
  onExit: () => void;
}

const ACTION_LABELS: Record<TestAction, string> = {
  "test-unstaged": "unstaged changes",
  "test-branch": "branch",
  "select-commit": "commit",
};

export const TestingScreen = ({ action, commit, gitState, onExit }: TestingScreenProps) => {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const run = async () => {
      try {
        const stream = mockAgentStream({
          action,
          gitState,
          commit,
          signal: abortController.signal,
        });
        for await (const message of stream) {
          setLines((previous) => [...previous, message]);
        }
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          setLines((previous) => [...previous, "Cancelled."]);
        } else {
          const errorMessage = caughtError instanceof Error ? caughtError.message : "Unknown error";
          setError(errorMessage);
        }
      } finally {
        setRunning(false);
      }
    };

    run();

    return () => {
      abortController.abort();
    };
  }, [action, gitState, commit]);

  useInput((_input, key) => {
    if (key.escape) {
      abortControllerRef.current?.abort();
      onExit();
    }
  });

  return (
    <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
      <Text bold color={COLORS.TEXT}>
        Testing {ACTION_LABELS[action]}
      </Text>

      <Box
        marginTop={1}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor={COLORS.DIVIDER}
      />

      <Box flexDirection="column" marginTop={1}>
        {lines.map((line, index) => (
          <Text key={index} color={line.startsWith("  ✓") ? COLORS.GREEN : COLORS.TEXT}>
            {line}
          </Text>
        ))}
      </Box>

      {running && (
        <Box marginTop={1}>
          <Spinner message="Agent is working..." />
        </Box>
      )}

      {!running && !error && (
        <Box marginTop={1}>
          <Text color={COLORS.GREEN} bold>
            Done
          </Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={COLORS.RED}>Error: {error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.DIM}>Esc to {running ? "cancel" : "go back"}</Text>
      </Box>
    </Box>
  );
};
