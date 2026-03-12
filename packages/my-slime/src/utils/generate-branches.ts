const PREFIXES = ["feature", "fix", "chore", "refactor", "docs", "test", "ci", "hotfix", "release", "deps"];

const DESCRIPTORS = [
  "auth-flow",
  "user-profile",
  "dashboard-layout",
  "api-migration",
  "websocket-handler",
  "cache-invalidation",
  "search-index",
  "rate-limiter",
  "error-boundary",
  "dark-mode",
  "onboarding-wizard",
  "payment-gateway",
  "notification-service",
  "file-upload",
  "session-management",
  "logging-pipeline",
  "ci-pipeline",
  "type-safety",
  "memory-leak",
  "perf-regression",
];

const pickRandom = <T>(array: readonly T[]): T => array[Math.floor(Math.random() * array.length)];

export const generateBranches = (count: number): string[] =>
  Array.from({ length: count }, () => `${pickRandom(PREFIXES)}/${pickRandom(DESCRIPTORS)}`);
