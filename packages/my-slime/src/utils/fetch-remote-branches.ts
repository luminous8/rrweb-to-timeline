import { execSync } from "child_process";

export interface RemoteBranch {
  name: string;
  author: string;
  prNumber: number | null;
  prStatus: "open" | "draft" | "merged" | null;
}

const GH_TIMEOUT_MS = 15000;

const normalizePrStatus = (
  state: string,
  isDraft: boolean,
): "open" | "draft" | "merged" => {
  if (state === "MERGED") return "merged";
  if (isDraft) return "draft";
  return "open";
};

interface GhPr {
  headRefName: string;
  author: { login: string };
  number: number;
  state: string;
  isDraft: boolean;
}

const fetchPrs = (state: string): GhPr[] => {
  try {
    const output = execSync(
      `gh pr list --state ${state} --limit 100 --json headRefName,author,number,state,isDraft`,
      { encoding: "utf-8", timeout: GH_TIMEOUT_MS },
    );
    return JSON.parse(output);
  } catch {
    return [];
  }
};

export const fetchRemoteBranches = (): RemoteBranch[] => {
  const openPrs = fetchPrs("open");
  const mergedPrs = fetchPrs("merged");
  const allPrs = [...openPrs, ...mergedPrs];

  const prByBranch = new Map<string, GhPr>();
  for (const pr of allPrs) {
    if (!prByBranch.has(pr.headRefName)) {
      prByBranch.set(pr.headRefName, pr);
    }
  }

  try {
    const refOutput = execSync(
      "git branch -r --format='%(refname:short)' | grep -v HEAD",
      { encoding: "utf-8", timeout: 5000 },
    ).trim();

    if (!refOutput) return [];

    const remoteBranches = refOutput
      .split("\n")
      .filter(Boolean)
      .map((ref) => ref.replace(/^origin\//, ""));

    return remoteBranches.map((name) => {
      const pr = prByBranch.get(name);
      return {
        name,
        author: pr?.author.login ?? "",
        prNumber: pr?.number ?? null,
        prStatus: pr ? normalizePrStatus(pr.state, pr.isDraft) : null,
      };
    });
  } catch {
    return Array.from(prByBranch.values()).map((pr) => ({
      name: pr.headRefName,
      author: pr.author.login,
      prNumber: pr.number,
      prStatus: normalizePrStatus(pr.state, pr.isDraft),
    }));
  }
};
