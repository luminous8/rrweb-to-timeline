import { Box, Text } from "ink";
import { useStdoutDimensions } from "../hooks/use-stdout-dimensions.js";
import stringWidth from "string-width";
import { useColors, useThemeContext } from "./theme-context.js";
import { STATUSBAR_TRAILING_PADDING } from "../constants.js";
import { HintBar, HINT_SEPARATOR, type HintSegment } from "./ui/hint-bar.js";
import { useAppStore, type Screen } from "../store.js";

const useHintSegments = (screen: Screen): HintSegment[] => {
  const COLORS = useColors();
  const navigateTo = useAppStore((state) => state.navigateTo);
  const goBack = useAppStore((state) => state.goBack);
  const approvePlan = useAppStore((state) => state.approvePlan);
  const generatedPlan = useAppStore((state) => state.generatedPlan);
  const savedFlowSummaries = useAppStore((state) => state.savedFlowSummaries);

  switch (screen) {
    case "main": {
      const hints: HintSegment[] = [
        { key: "t", label: "theme", onClick: () => navigateTo("theme") },
        {
          key: "b",
          label: "branch",
          onClick: () => navigateTo("switch-branch"),
        },
      ];
      if (savedFlowSummaries.length > 0) {
        hints.push({
          key: "r",
          label: "reuse flow",
          onClick: () => navigateTo("saved-flow-picker"),
        });
      }
      hints.push({ key: "↑↓", label: "nav" });
      return hints;
    }
    case "switch-branch":
      return [
        { key: "↑↓", label: "nav" },
        { key: "tab", label: "local/remote" },
        { key: "/", label: "search" },
        { key: "enter", label: "select", cta: true },
        { key: "esc", label: "back", cta: true, onClick: goBack },
      ];
    case "select-commit":
      return [
        { key: "↑↓", label: "nav" },
        { key: "/", label: "search" },
        { key: "enter", label: "select", cta: true },
        { key: "esc", label: "back", cta: true, onClick: goBack },
      ];
    case "saved-flow-picker":
      return [
        { key: "↑↓", label: "nav" },
        { key: "enter", label: "select", cta: true },
        { key: "esc", label: "back", cta: true, onClick: goBack },
      ];
    case "flow-input":
      return [
        { key: "enter", label: "submit", cta: true },
        { key: "esc", label: "back", cta: true, onClick: goBack },
      ];
    case "planning":
      return [{ key: "esc", label: "cancel", cta: true, onClick: goBack }];
    case "review-plan":
      return [
        { key: "↑↓", label: "nav" },
        { key: "tab", label: "fold" },
        { key: "e", label: "edit" },
        { key: "s", label: "save" },
        {
          key: "a",
          label: "approve",
          color: COLORS.GREEN,
          cta: true,
          onClick: () => {
            if (generatedPlan) approvePlan(generatedPlan);
          },
        },
        { key: "esc", label: "back", color: COLORS.RED, cta: true, onClick: goBack },
      ];
    case "testing":
      return [];
    case "theme":
      return [
        { key: "↑↓", label: "nav" },
        { key: "tab", label: "light/dark" },
        { key: "enter", label: "select", cta: true },
        { key: "esc", label: "cancel", cta: true, onClick: goBack },
      ];
    default:
      return [];
  }
};

const getHintText = (segments: HintSegment[]): string =>
  segments.length > 0
    ? ` ${segments
        .map((segment) => `${segment.key} ${segment.label}`)
        .join(HINT_SEPARATOR)}`
    : "";

export const Modeline = () => {
  const [columns] = useStdoutDimensions();
  const { theme } = useThemeContext();
  const gitState = useAppStore((state) => state.gitState);
  const screen = useAppStore((state) => state.screen);
  const segments = useHintSegments(screen);

  if (!gitState) return null;

  const keybinds = segments.filter((segment) => !segment.cta);
  const actions = segments.filter((segment) => segment.cta);

  const branchLabel = ` ${gitState.currentBranch} `;
  const keybindText = getHintText(keybinds);
  const actionPills = actions
    .map((action) => `[${action.key} ${action.label}]`)
    .join("  ");
  const actionWidth = actions.length > 0 ? stringWidth(actionPills) + 2 : 0;
  const leftWidth = stringWidth(branchLabel) + stringWidth(keybindText);
  const totalUsed = leftWidth + actionWidth + STATUSBAR_TRAILING_PADDING;
  const remainingSpace = Math.max(0, columns - totalUsed);
  const leftGap = Math.ceil(remainingSpace / 2);
  const rightGap = remainingSpace - leftGap;

  return (
    <Box flexDirection="column">
      <Text color={theme.border}>{"─".repeat(columns)}</Text>
      <Box paddingX={1}>
        <Text color={theme.textMuted}>{branchLabel}</Text>
        {keybinds.length > 0 ? (
          <HintBar
            segments={keybinds}
            color={theme.primary}
            mutedColor={theme.textMuted}
          />
        ) : null}
        <Text>{" ".repeat(leftGap)}</Text>
        {actions.map((action, index) => (
          <Text key={action.key + action.label}>
            {index > 0 ? "  " : ""}
            <Text color={action.color ?? theme.border}>{"["}</Text>
            <Text color={action.color ?? theme.primary} bold>
              {action.key}
            </Text>
            <Text color={action.color ?? theme.textMuted}> {action.label}</Text>
            <Text color={action.color ?? theme.border}>{"]"}</Text>
          </Text>
        ))}
        <Text>{" ".repeat(rightGap)}</Text>
      </Box>
    </Box>
  );
};
