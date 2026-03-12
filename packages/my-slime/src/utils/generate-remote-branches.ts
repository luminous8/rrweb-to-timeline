interface RemoteBranch {
  name: string;
  prNumber: number | null;
  prStatus: "open" | "draft" | "merged" | null;
}

const PREFIXES = ["feature", "fix", "chore", "refactor", "hotfix", "release", "deps", "experiment"];

const DESCRIPTORS = [
  "oauth-provider",
  "billing-webhook",
  "admin-dashboard",
  "graphql-schema",
  "cdn-migration",
  "k8s-deployment",
  "sentry-integration",
  "redis-cache",
  "email-templates",
  "worker-queue",
  "audit-logging",
  "i18n-support",
  "ssr-hydration",
  "db-sharding",
  "analytics-pipeline",
  "mobile-responsive",
  "docker-compose",
  "rbac-permissions",
  "rate-limiting",
  "test-coverage",
];

const PR_STATUSES: ("open" | "draft" | "merged")[] = ["open", "draft", "merged"];

const pickRandom = <T>(array: readonly T[]): T => array[Math.floor(Math.random() * array.length)];

export const generateRemoteBranches = (count: number): RemoteBranch[] =>
  Array.from({ length: count }, () => {
    const hasPr = Math.random() > 0.3;
    return {
      name: `${pickRandom(PREFIXES)}/${pickRandom(DESCRIPTORS)}`,
      prNumber: hasPr ? Math.floor(Math.random() * 500) + 1 : null,
      prStatus: hasPr ? pickRandom(PR_STATUSES) : null,
    };
  });

export type { RemoteBranch };
