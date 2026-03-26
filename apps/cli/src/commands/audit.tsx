import { useState } from "react";
import { Box, Text, render } from "ink";
import InkSpinner from "ink-spinner";
import pc from "picocolors";
import figures from "figures";
import { isRunningInAgent } from "../utils/is-running-in-agent";
import { isHeadless } from "../utils/is-headless";
import { runAudit, type PackageAuditResult, type ScriptResult } from "../utils/audit";
import { COLORS } from "../components/theme-context";

interface PackageStatus {
  scripts: string[];
  completed: ScriptResult[];
  done: boolean;
}

const AuditDisplay = ({ statusMap }: { statusMap: Map<string, PackageStatus> }) => {
  const entries = Array.from(statusMap.entries());

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>expect audit</Text>
      <Text> </Text>
      {entries.map(([packageName, status]) => (
        <Box key={packageName} flexDirection="column">
          <Box>
            {status.done && (
              <Text>
                {status.completed.every((result) => result.passed) ? (
                  <Text color={COLORS.GREEN}>{figures.tick}</Text>
                ) : (
                  <Text color={COLORS.RED}>{figures.cross}</Text>
                )}
              </Text>
            )}
            {!status.done && (
              <Text color="white">
                <InkSpinner type="dots" />
              </Text>
            )}
            <Text bold> {packageName}</Text>
          </Box>
          {status.completed.map((result) => (
            <Box key={result.script} flexDirection="column">
              <Text>
                {"  "}
                {result.passed ? (
                  <Text color={COLORS.GREEN}>{figures.tick}</Text>
                ) : (
                  <Text color={COLORS.RED}>{figures.cross}</Text>
                )}{" "}
                {result.script}
              </Text>
              {!result.passed && (
                <Text color="gray">
                  {"    "}
                  {result.output.split("\n").slice(-3).join("\n    ")}
                </Text>
              )}
            </Box>
          ))}
          {!status.done &&
            status.scripts
              .filter(
                (script) => !status.completed.some((completed) => completed.script === script),
              )
              .slice(0, 1)
              .map((script) => (
                <Text key={script} color="gray">
                  {"  "}
                  <InkSpinner type="dots" /> {script}
                </Text>
              ))}
        </Box>
      ))}
    </Box>
  );
};

const AuditSummary = ({ results }: { results: PackageAuditResult[] }) => {
  let totalPassed = 0;
  let totalFailed = 0;
  for (const packageResult of results) {
    for (const scriptResult of packageResult.results) {
      if (scriptResult.passed) totalPassed++;
      else totalFailed++;
    }
  }

  const summary = `${totalPassed} passed, ${totalFailed} failed`;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={totalFailed > 0 ? COLORS.RED : COLORS.GREEN}>
        {summary}
      </Text>
      {totalFailed > 0 && (
        <Text color={COLORS.YELLOW}>
          Run <Text bold>expect</Text> to test your changes in a real browser and catch issues
          before they ship.
        </Text>
      )}
      {totalFailed === 0 && (
        <Text color={COLORS.GREEN}>
          Looking good! Run <Text bold>expect</Text> to verify your changes work end-to-end in the
          browser.
        </Text>
      )}
    </Box>
  );
};

const runInteractive = async () => {
  const rootDir = process.cwd();
  const statusMapRef: { current: Map<string, PackageStatus> } = {
    current: new Map(),
  };
  let setStatusMap: ((map: Map<string, PackageStatus>) => void) | undefined;
  let setFinalResults: ((results: PackageAuditResult[]) => void) | undefined;

  const AuditApp = () => {
    const [statusMap, _setStatusMap] = useState<Map<string, PackageStatus>>(new Map());
    const [finalResults, _setFinalResults] = useState<PackageAuditResult[] | undefined>();
    setStatusMap = (map) => _setStatusMap(new Map(map));
    setFinalResults = _setFinalResults;

    return (
      <Box flexDirection="column">
        <AuditDisplay statusMap={statusMap} />
        {finalResults && <AuditSummary results={finalResults} />}
      </Box>
    );
  };

  const instance = render(<AuditApp />);

  const results = await runAudit(rootDir, {
    onPackageStart: (packageName, scripts) => {
      statusMapRef.current.set(packageName, { scripts, completed: [], done: false });
      setStatusMap?.(statusMapRef.current);
    },
    onScriptDone: (packageName, result) => {
      const status = statusMapRef.current.get(packageName);
      if (status) {
        status.completed.push(result);
        status.done = status.completed.length === status.scripts.length;
      }
      setStatusMap?.(statusMapRef.current);
    },
  });

  setFinalResults?.(results);

  setTimeout(() => {
    instance.unmount();
    const totalFailed = results.reduce(
      (count, packageResult) =>
        count + packageResult.results.filter((result) => !result.passed).length,
      0,
    );
    if (totalFailed > 0) process.exit(1);
  }, 100);
};

const runPlain = async () => {
  const rootDir = process.cwd();

  console.log("");
  console.log(pc.bold("expect audit"));
  console.log("");

  const results = await runAudit(rootDir, {
    onPackageStart: (packageName, scripts) => {
      console.log(`${figures.arrowRight} ${pc.bold(packageName)} (${scripts.join(", ")})`);
    },
    onScriptDone: (_packageName, result) => {
      const icon = result.passed ? pc.green(figures.tick) : pc.red(figures.cross);
      console.log(`  ${icon} ${result.script}`);
      if (!result.passed) {
        const lastLines = result.output.split("\n").slice(-3).join("\n");
        console.log(pc.dim(`    ${lastLines.split("\n").join("\n    ")}`));
      }
    },
  });

  let totalPassed = 0;
  let totalFailed = 0;
  for (const packageResult of results) {
    for (const scriptResult of packageResult.results) {
      if (scriptResult.passed) totalPassed++;
      else totalFailed++;
    }
  }

  console.log("");
  const summary = `${totalPassed} passed, ${totalFailed} failed`;
  const summaryColor = totalFailed > 0 ? pc.red : pc.green;
  console.log(summaryColor(pc.bold(summary)));

  if (totalFailed > 0) {
    console.log("");
    console.log(
      pc.yellow(
        `Run ${pc.bold("expect")} to test your changes in a real browser and catch issues before they ship.`,
      ),
    );
  } else {
    console.log("");
    console.log(
      pc.green(
        `Looking good! Run ${pc.bold("expect")} to verify your changes work end-to-end in the browser.`,
      ),
    );
  }

  console.log("");

  if (totalFailed > 0) process.exit(1);
};

export const runAuditCommand = async () => {
  if (isRunningInAgent() || isHeadless()) {
    await runPlain();
  } else {
    await runInteractive();
  }
};
