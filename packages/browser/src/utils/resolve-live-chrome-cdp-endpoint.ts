import { readFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
  LIVE_CHROME_MACOS_USER_DATA_DIR_SEGMENTS,
  LIVE_CHROME_REMOTE_DEBUGGING_HELP_URL,
} from "../constants";

interface DevToolsActivePortEntry {
  port: number;
  websocketPath: string;
}

const parseDevToolsActivePortEntry = (fileContent: string): DevToolsActivePortEntry => {
  const [rawPort, rawWebsocketPath] = fileContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!rawPort || !rawWebsocketPath) {
    throw new Error(`Invalid DevToolsActivePort contents: ${JSON.stringify(fileContent)}`);
  }

  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid DevToolsActivePort port: ${rawPort}`);
  }

  return {
    port,
    websocketPath: rawWebsocketPath,
  };
};

const getMacOsChromeUserDataDirectory = (): string => {
  if (platform() !== "darwin") {
    throw new Error(
      "Live Chrome auto-connect currently supports macOS Chrome only. Pass an explicit CDP endpoint with --cdp-endpoint on other platforms.",
    );
  }

  return join(homedir(), ...LIVE_CHROME_MACOS_USER_DATA_DIR_SEGMENTS);
};

export const resolveLiveChromeCdpEndpoint = async (
  cdpEndpoint: string | undefined,
): Promise<string> => {
  if (cdpEndpoint) return cdpEndpoint;

  const chromeUserDataDirectory = getMacOsChromeUserDataDirectory();
  const devToolsActivePortPath = join(chromeUserDataDirectory, "DevToolsActivePort");

  try {
    const fileContent = await readFile(devToolsActivePortPath, "utf8");
    const devToolsActivePortEntry = parseDevToolsActivePortEntry(fileContent);
    return `ws://127.0.0.1:${devToolsActivePortEntry.port}${devToolsActivePortEntry.websocketPath}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not auto-connect to live Chrome from ${chromeUserDataDirectory}. Enable remote debugging in ${LIVE_CHROME_REMOTE_DEBUGGING_HELP_URL}. If you launched Chrome with a manual remote debugging port instead, pass --cdp-endpoint. Original error: ${errorMessage}`,
    );
  }
};
