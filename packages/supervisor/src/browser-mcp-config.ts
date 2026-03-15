import { fileURLToPath } from "node:url";
import { DEFAULT_BROWSER_MCP_SERVER_NAME } from "./constants.js";
import type { AgentProviderSettings, McpServerConfig } from "@browser-tester/agent";

export const BROWSER_TESTER_VIDEO_OUTPUT_ENV_NAME = "BROWSER_TESTER_VIDEO_OUTPUT_PATH";
export const BROWSER_TESTER_LIVE_VIEW_URL_ENV_NAME = "BROWSER_TESTER_LIVE_VIEW_URL";

export const getBrowserMcpEntrypoint = (): string =>
  fileURLToPath(import.meta.resolve("@browser-tester/mcp/start"));

export const buildBrowserMcpServerEnv = (options: {
  videoOutputPath?: string;
  liveViewUrl?: string;
}): Record<string, string> | undefined => {
  const env: Record<string, string> = {};
  if (options.videoOutputPath) {
    env[BROWSER_TESTER_VIDEO_OUTPUT_ENV_NAME] = options.videoOutputPath;
  }
  if (options.liveViewUrl) {
    env[BROWSER_TESTER_LIVE_VIEW_URL_ENV_NAME] = options.liveViewUrl;
  }
  return Object.keys(env).length > 0 ? env : undefined;
};

const buildBrowserTesterMcpServerConfig = (
  serverEnv: Record<string, string> | undefined,
): McpServerConfig => ({
  command: process.execPath,
  args: [getBrowserMcpEntrypoint()],
  ...(serverEnv ? { env: serverEnv } : {}),
});

export const buildBrowserMcpSettings = (options: {
  providerSettings?: AgentProviderSettings;
  browserMcpServerName?: string;
  videoOutputPath?: string;
  liveViewUrl?: string;
}): AgentProviderSettings => {
  const browserMcpServerName = options.browserMcpServerName ?? DEFAULT_BROWSER_MCP_SERVER_NAME;
  const serverEnv = buildBrowserMcpServerEnv({
    videoOutputPath: options.videoOutputPath,
    liveViewUrl: options.liveViewUrl,
  });
  const existingBrowserServerConfig = options.providerSettings?.mcpServers?.[browserMcpServerName];
  const resolvedBrowserServerConfig = buildBrowserTesterMcpServerConfig(serverEnv);

  return {
    ...(options.providerSettings ?? {}),
    mcpServers: {
      [browserMcpServerName]: {
        ...(existingBrowserServerConfig ?? {}),
        ...resolvedBrowserServerConfig,
        ...(existingBrowserServerConfig?.env || resolvedBrowserServerConfig.env
          ? {
              env: {
                ...(existingBrowserServerConfig?.env ?? {}),
                ...(resolvedBrowserServerConfig.env ?? {}),
              },
            }
          : {}),
      },
    },
  };
};
