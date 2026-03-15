import { useState } from "react";
import { Box, Text, useInput } from "ink";
import Link from "ink-link";
import { postPullRequestComment, type BrowserRunReport } from "@browser-tester/supervisor";
import { useAppStore } from "../../store.js";
import { copyToClipboard } from "../../utils/copy-to-clipboard.js";
import { useColors } from "../theme-context.js";
import { ScreenHeading } from "../ui/screen-heading.js";
import { FileLink } from "../ui/file-link.js";
import { Image } from "../ui/image.js";
import { ErrorMessage } from "../ui/error-message.js";
import { Clickable } from "../ui/clickable.js";

const isRemoteUrl = (value: string | undefined): boolean =>
  typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"));

const buildResultsClipboardText = (report: BrowserRunReport): string => {
  const screenshotPaths =
    report.artifacts.redactedScreenshotPaths.length > 0
      ? report.artifacts.redactedScreenshotPaths
      : report.artifacts.screenshotPaths;
  const clipboardLines = [
    `Title: ${report.title}`,
    `Status: ${report.status}`,
    `Summary: ${report.summary}`,
  ];

  if (report.pullRequest) {
    clipboardLines.push(`Open PR: #${report.pullRequest.number} ${report.pullRequest.url}`);
  }

  if (report.artifacts.highlightVideoPath) {
    clipboardLines.push(`Highlight reel: ${report.artifacts.highlightVideoPath}`);
  }

  if (report.artifacts.redactedVideoPath) {
    clipboardLines.push(`Redacted video: ${report.artifacts.redactedVideoPath}`);
  } else if (report.artifacts.rawVideoPath) {
    clipboardLines.push(`Raw video: ${report.artifacts.rawVideoPath}`);
  }

  if (report.artifacts.shareSummaryPath) {
    clipboardLines.push(`Share summary: ${report.artifacts.shareSummaryPath}`);
  }

  if (report.artifacts.shareBundlePath) {
    clipboardLines.push(`Share bundle: ${report.artifacts.shareBundlePath}`);
  }

  if (report.artifacts.shareUrl) {
    clipboardLines.push(
      `${isRemoteUrl(report.artifacts.shareUrl) ? "Share URL" : "Local report"}: ${report.artifacts.shareUrl}`,
    );
  }

  screenshotPaths.forEach((screenshotPath, index) => {
    clipboardLines.push(`Screenshot ${index + 1}: ${screenshotPath}`);
  });

  return clipboardLines.join("\n");
};

export const ResultsScreen = () => {
  const COLORS = useColors();
  const latestRunReport = useAppStore((state) => state.latestRunReport);
  const resolvedTarget = useAppStore((state) => state.resolvedTarget);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [clipboardStatusMessage, setClipboardStatusMessage] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [commentStatusMessage, setCommentStatusMessage] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);

  const handleCopyToClipboard = () => {
    if (!latestRunReport) {
      return;
    }

    setClipboardError(null);
    setClipboardStatusMessage(null);

    const didCopy = copyToClipboard(buildResultsClipboardText(latestRunReport));
    if (didCopy) {
      setClipboardStatusMessage("Copied share details to the clipboard.");
      return;
    }

    setClipboardError("Failed to copy share details to the clipboard.");
  };

  const handlePostPullRequestComment = () => {
    if (!latestRunReport || !latestRunReport.pullRequest || !resolvedTarget || isPostingComment) {
      return;
    }

    setIsPostingComment(true);
    setCommentError(null);
    setCommentStatusMessage(null);

    void Promise.resolve()
      .then(() =>
        postPullRequestComment({
          cwd: resolvedTarget.cwd,
          report: latestRunReport,
        }),
      )
      .then((result) => {
        setCommentStatusMessage(
          `Posted a comment on PR #${result.pullRequest.number} (${result.pullRequest.title}).`,
        );
      })
      .catch((caughtError) => {
        setCommentError(
          caughtError instanceof Error ? caughtError.message : "Failed to post PR comment.",
        );
      })
      .finally(() => {
        setIsPostingComment(false);
      });
  };

  useInput((input) => {
    const normalizedInput = input.toLowerCase();

    if (normalizedInput === "y") {
      handleCopyToClipboard();
      return;
    }

    if (normalizedInput === "p") {
      handlePostPullRequestComment();
    }
  });

  if (!latestRunReport) return null;

  const screenshotPaths =
    latestRunReport.artifacts.redactedScreenshotPaths.length > 0
      ? latestRunReport.artifacts.redactedScreenshotPaths
      : latestRunReport.artifacts.screenshotPaths;
  const shareUrl = latestRunReport.artifacts.shareUrl;

  return (
    <Box flexDirection="column" width="100%" paddingX={1} paddingY={1}>
      <ScreenHeading
        title="Browser run results"
        subtitle={`${latestRunReport.title} · ${latestRunReport.status}`}
      />

      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor={latestRunReport.status === "passed" ? COLORS.GREEN : COLORS.RED}
        paddingX={1}
      >
        <Text color={latestRunReport.status === "passed" ? COLORS.GREEN : COLORS.RED} bold>
          {latestRunReport.status === "passed" ? "Plan completed" : "Issues found"}
        </Text>
        <Text color={COLORS.TEXT}>{latestRunReport.summary}</Text>
        {latestRunReport.pullRequest ? (
          <Text color={COLORS.DIM}>
            Open PR:{" "}
            <Link url={latestRunReport.pullRequest.url}>
              <Text>{`#${latestRunReport.pullRequest.number} ${latestRunReport.pullRequest.title}`}</Text>
            </Link>
          </Text>
        ) : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={COLORS.DIM} bold>
          Findings
        </Text>
        {latestRunReport.findings.length > 0 ? (
          latestRunReport.findings.map((finding) => (
            <Text
              key={finding.id}
              color={finding.severity === "error" ? COLORS.RED : COLORS.YELLOW}
            >
              • {finding.title}: <Text color={COLORS.TEXT}>{finding.detail}</Text>
            </Text>
          ))
        ) : (
          <Text color={COLORS.GREEN}>No blocking findings detected.</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={COLORS.DIM} bold>
          Step summary
        </Text>
        {latestRunReport.stepResults.map((stepResult) => (
          <Text
            key={stepResult.stepId}
            color={
              stepResult.status === "passed"
                ? COLORS.GREEN
                : stepResult.status === "failed"
                  ? COLORS.RED
                  : COLORS.YELLOW
            }
          >
            • {stepResult.title}: <Text color={COLORS.TEXT}>{stepResult.summary}</Text>
          </Text>
        ))}
      </Box>

      {latestRunReport.confirmedRiskAreas.length > 0 ||
      latestRunReport.clearedRiskAreas.length > 0 ||
      latestRunReport.unresolvedRiskAreas.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={COLORS.DIM} bold>
            Risk areas
          </Text>
          {latestRunReport.confirmedRiskAreas.map((riskArea) => (
            <Text key={`confirmed-${riskArea}`} color={COLORS.RED}>
              • Confirmed risk: <Text color={COLORS.TEXT}>{riskArea}</Text>
            </Text>
          ))}
          {latestRunReport.clearedRiskAreas.map((riskArea) => (
            <Text key={`cleared-${riskArea}`} color={COLORS.GREEN}>
              • Cleared: <Text color={COLORS.TEXT}>{riskArea}</Text>
            </Text>
          ))}
          {latestRunReport.unresolvedRiskAreas.map((riskArea) => (
            <Text key={`unresolved-${riskArea}`} color={COLORS.YELLOW}>
              • Needs follow-up: <Text color={COLORS.TEXT}>{riskArea}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color={COLORS.DIM} bold>
          Artifacts
        </Text>
        {latestRunReport.artifacts.highlightVideoPath ? (
          <Text color={COLORS.DIM}>
            Highlight reel: <FileLink path={latestRunReport.artifacts.highlightVideoPath} />
          </Text>
        ) : null}
        {latestRunReport.artifacts.redactedVideoPath ? (
          <Text color={COLORS.DIM}>
            Redacted video: <FileLink path={latestRunReport.artifacts.redactedVideoPath} />
          </Text>
        ) : latestRunReport.artifacts.rawVideoPath ? (
          <Text color={COLORS.DIM}>
            Raw video: <FileLink path={latestRunReport.artifacts.rawVideoPath} />
          </Text>
        ) : null}
        {shareUrl ? (
          isRemoteUrl(shareUrl) ? (
            <Text color={COLORS.DIM}>
              Share URL:{" "}
              <Link url={shareUrl}>
                <Text>{shareUrl}</Text>
              </Link>
            </Text>
          ) : (
            <Text color={COLORS.DIM}>
              Local report: <FileLink path={shareUrl} />
            </Text>
          )
        ) : null}
      </Box>

      {latestRunReport.warnings.length > 0 ? (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor={COLORS.YELLOW}
          paddingX={1}
        >
          <Text color={COLORS.YELLOW} bold>
            Artifact warnings
          </Text>
          {latestRunReport.warnings.map((warning) => (
            <Text key={warning} color={COLORS.DIM}>
              • {warning}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Clickable onClick={handleCopyToClipboard}>
          <Text color={COLORS.DIM}>
            Press <Text color={COLORS.PRIMARY}>y</Text> to copy share details to the clipboard.
          </Text>
        </Clickable>
        {clipboardStatusMessage ? <Text color={COLORS.GREEN}>{clipboardStatusMessage}</Text> : null}
      </Box>

      {latestRunReport.pullRequest ? (
        <Box flexDirection="column">
          <Clickable onClick={handlePostPullRequestComment}>
            <Text color={COLORS.DIM}>
              Press <Text color={COLORS.PRIMARY}>p</Text> to post this summary to the PR.
            </Text>
          </Clickable>
          {isPostingComment ? <Text color={COLORS.DIM}>Posting PR comment...</Text> : null}
          {commentStatusMessage ? <Text color={COLORS.GREEN}>{commentStatusMessage}</Text> : null}
        </Box>
      ) : null}

      <ErrorMessage message={clipboardError} />
      <ErrorMessage message={commentError} />

      {screenshotPaths.map((screenshotPath) => (
        <Image key={screenshotPath} src={screenshotPath} alt={`Screenshot: ${screenshotPath}`} />
      ))}
    </Box>
  );
};
