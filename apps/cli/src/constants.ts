export const VERSION = "0.0.1";

export const AUTOMATED_ENVIRONMENT_VARIABLES = [
  "CI",
  "CLAUDECODE",
  "CURSOR_AGENT",
  "CODEX_CI",
  "OPENCODE",
  "AMP_HOME",
  "AMI",
];

export const SELECTED_INDICATOR = "➤";

export const SEARCH_PLACEHOLDER = "Search ...";

export const GIT_TIMEOUT_MS = 5000;
export const GH_TIMEOUT_MS = 15000;
export const SWITCH_BRANCH_TIMEOUT_MS = 10000;
export const COMMIT_LIMIT = 50;
export const PR_LIMIT = 100;
export const COLUMN_PADDING = 2;
export const VISIBLE_COMMIT_COUNT = 15;
export const SPINNER_INTERVAL_MS = 80;

export const COLORS = {
  TEXT: "#cccccc",
  DIM: "#666666",
  GREEN: "#34d058",
  SELECTION: "#a0aeef",
  RED: "#ff3b30",
  BORDER: "#555555",
  DIVIDER: "#444444",
  YELLOW: "#e5c07b",
  PURPLE: "#c678dd",
} as const;
