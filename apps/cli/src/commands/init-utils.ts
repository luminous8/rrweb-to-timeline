import { exec } from "node:child_process";
import { isRunningInAgent } from "../utils/is-running-in-agent";
import { isHeadless } from "../utils/is-headless";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "vp";

export const SKILL_COMMANDS: Record<PackageManager, string> = {
  npm: "npx -y skills add https://github.com/millionco/expect --skill expect -y",
  pnpm: "pnpm dlx skills add https://github.com/millionco/expect --skill expect -y",
  yarn: "npx -y skills add https://github.com/millionco/expect --skill expect -y",
  bun: "bunx skills add https://github.com/millionco/expect --skill expect -y",
  vp: "npx -y skills add https://github.com/millionco/expect --skill expect -y",
};

export const detectPackageManager = (): PackageManager => {
  if (process.env.VITE_PLUS_CLI_BIN) return "vp";

  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    if (userAgent.startsWith("pnpm")) return "pnpm";
    if (userAgent.startsWith("yarn")) return "yarn";
    if (userAgent.startsWith("bun")) return "bun";
    if (userAgent.startsWith("npm")) return "npm";
  }
  return "npm";
};

export const detectNonInteractive = (yesFlag: boolean): boolean =>
  yesFlag || isRunningInAgent() || isHeadless();

const INSTALL_TIMEOUT_MS = 10_000;

export const tryRun = (command: string): Promise<boolean> =>
  new Promise((resolve) => {
    const child = exec(command, { timeout: INSTALL_TIMEOUT_MS }, (error) => {
      resolve(Boolean(!error));
    });
    child.stdin?.end();
  });
