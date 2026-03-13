import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { DEFAULT_BROWSER_MCP_SERVER_NAME } from "./constants.js";
import type { AgentProviderSettings } from "@browser-tester/agent";
import type { BrowserEnvironmentHints } from "./types.js";

const require = createRequire(join(process.cwd(), "package.json"));

export const BROWSER_TESTER_VIDEO_OUTPUT_ENV_NAME = "BROWSER_TESTER_VIDEO_OUTPUT_PATH";
export const BROWSER_TESTER_LIVE_CHROME_ENV_NAME = "BROWSER_TESTER_LIVE_CHROME";
export const BROWSER_TESTER_LIVE_CHROME_CDP_ENDPOINT_ENV_NAME =
  "BROWSER_TESTER_LIVE_CHROME_CDP_ENDPOINT";
export const BROWSER_TESTER_LIVE_CHROME_TAB_MODE_ENV_NAME = "BROWSER_TESTER_LIVE_CHROME_TAB_MODE";
export const BROWSER_TESTER_LIVE_CHROME_TAB_URL_MATCH_ENV_NAME =
  "BROWSER_TESTER_LIVE_CHROME_TAB_URL_MATCH";
export const BROWSER_TESTER_LIVE_CHROME_TAB_TITLE_MATCH_ENV_NAME =
  "BROWSER_TESTER_LIVE_CHROME_TAB_TITLE_MATCH";
export const BROWSER_TESTER_LIVE_CHROME_TAB_INDEX_ENV_NAME = "BROWSER_TESTER_LIVE_CHROME_TAB_INDEX";

export const getBrowserMcpEntrypoint = (): string => {
  const mcpPackageEntrypoint = require.resolve("@browser-tester/mcp");
  return join(dirname(mcpPackageEntrypoint), "start.js");
};

const addEnvValue = (
  serverEnv: Record<string, string>,
  key: string,
  value: string | number | undefined,
) => {
  if (value === undefined) return;
  serverEnv[key] = String(value);
};

export const buildBrowserMcpServerEnv = (options: {
  environment?: BrowserEnvironmentHints;
  videoOutputPath?: string;
}): Record<string, string> | undefined => {
  const serverEnv: Record<string, string> = {};

  addEnvValue(serverEnv, BROWSER_TESTER_VIDEO_OUTPUT_ENV_NAME, options.videoOutputPath);

  if (options.environment?.liveChrome === true) {
    serverEnv[BROWSER_TESTER_LIVE_CHROME_ENV_NAME] = "true";
    addEnvValue(
      serverEnv,
      BROWSER_TESTER_LIVE_CHROME_CDP_ENDPOINT_ENV_NAME,
      options.environment.liveChromeCdpEndpoint,
    );
    addEnvValue(
      serverEnv,
      BROWSER_TESTER_LIVE_CHROME_TAB_MODE_ENV_NAME,
      options.environment.liveChromeTabMode,
    );
    addEnvValue(
      serverEnv,
      BROWSER_TESTER_LIVE_CHROME_TAB_URL_MATCH_ENV_NAME,
      options.environment.liveChromeTabUrlMatch,
    );
    addEnvValue(
      serverEnv,
      BROWSER_TESTER_LIVE_CHROME_TAB_TITLE_MATCH_ENV_NAME,
      options.environment.liveChromeTabTitleMatch,
    );
    addEnvValue(
      serverEnv,
      BROWSER_TESTER_LIVE_CHROME_TAB_INDEX_ENV_NAME,
      options.environment.liveChromeTabIndex,
    );
  }

  return Object.keys(serverEnv).length > 0 ? serverEnv : undefined;
};

export const buildBrowserMcpSettings = (
  providerSettings: AgentProviderSettings | undefined,
  browserMcpServerName: string = DEFAULT_BROWSER_MCP_SERVER_NAME,
  serverEnv?: Record<string, string>,
): AgentProviderSettings => ({
  ...(providerSettings ?? {}),
  mcpServers: {
    ...(providerSettings?.mcpServers ?? {}),
    [browserMcpServerName]: {
      ...(providerSettings?.mcpServers?.[browserMcpServerName] ?? {}),
      command: process.execPath,
      args: [getBrowserMcpEntrypoint()],
      ...(providerSettings?.mcpServers?.[browserMcpServerName]?.env || serverEnv
        ? {
            env: {
              ...(providerSettings?.mcpServers?.[browserMcpServerName]?.env ?? {}),
              ...(serverEnv ?? {}),
            },
          }
        : {}),
    },
  },
});
