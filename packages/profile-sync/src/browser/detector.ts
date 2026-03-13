import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import { BROWSER_CONFIGS } from "../constants.js";
import type { BrowserInfo, BrowserProfile, LocalStateProfile } from "../types.js";
import { naturalCompare } from "../utils/natural-sort.js";

const loadProfileNamesFromLocalState = (userDataDir: string): Record<string, LocalStateProfile> => {
  const localStatePath = path.join(userDataDir, "Local State");
  try {
    const content = readFileSync(localStatePath, "utf-8");
    const localState = JSON.parse(content);
    const infoCache = localState?.profile?.info_cache;
    if (!infoCache || typeof infoCache !== "object") {
      return {};
    }
    const profiles: Record<string, LocalStateProfile> = {};
    for (const [key, value] of Object.entries(infoCache)) {
      const entry = value as Record<string, unknown>;
      if (entry?.name && typeof entry.name === "string") {
        profiles[key] = { name: entry.name };
      }
    }
    return profiles;
  } catch {
    return {};
  }
};

const isValidProfile = (profilePath: string): boolean => {
  try {
    const stats = statSync(profilePath);
    if (!stats.isDirectory()) return false;

    const preferencesPath = path.join(profilePath, "Preferences");
    return existsSync(preferencesPath);
  } catch {
    return false;
  }
};

const getUserDataDirDarwin = (darwinPath: string): string =>
  path.join(homedir(), "Library", "Application Support", darwinPath);

const getUserDataDirLinux = (linuxPath: string): string =>
  path.join(process.env["XDG_CONFIG_HOME"] ?? path.join(homedir(), ".config"), linuxPath);

const getUserDataDirWin32 = (win32Path: string): string => {
  const localAppData = process.env["LOCALAPPDATA"] ?? path.join(homedir(), "AppData", "Local");
  return path.join(localAppData, win32Path);
};

const getUserDataDir = (config: {
  darwinUserDataPath: string;
  linuxUserDataPath: string;
  win32UserDataPath: string;
}): string | null => {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case "darwin":
      return getUserDataDirDarwin(config.darwinUserDataPath);
    case "linux":
      return getUserDataDirLinux(config.linuxUserDataPath);
    case "win32":
      return getUserDataDirWin32(config.win32UserDataPath);
    default:
      return null;
  }
};

const detectProfilesForBrowser = (browser: BrowserInfo, userDataDir: string): BrowserProfile[] => {
  if (!existsSync(userDataDir)) return [];

  const profileNames = loadProfileNamesFromLocalState(userDataDir);
  const profiles: BrowserProfile[] = [];

  try {
    const entries = readdirSync(userDataDir);

    for (const entry of entries) {
      const profilePath = path.join(userDataDir, entry);
      if (!isValidProfile(profilePath)) continue;

      const localStateProfile = profileNames[entry];
      const displayName = localStateProfile?.name ?? entry;

      profiles.push({
        profileName: entry,
        profilePath,
        displayName,
        browser,
      });
    }
  } catch {
    return [];
  }

  profiles.sort((left, right) => naturalCompare(left.profileName, right.profileName));
  return profiles;
};

const detectBrowsersDarwin = (): BrowserInfo[] =>
  BROWSER_CONFIGS.filter((config) => existsSync(config.info.executablePath)).map(
    (config) => config.info,
  );

const detectBrowsersLinux = (): BrowserInfo[] => {
  const browsers: BrowserInfo[] = [];
  for (const config of BROWSER_CONFIGS) {
    const binaryName = config.linuxUserDataPath.split("/").pop() ?? config.linuxUserDataPath;
    const searchPaths = [
      `/usr/bin/${binaryName}`,
      `/usr/local/bin/${binaryName}`,
      `/snap/bin/${binaryName}`,
    ];
    for (const executablePath of searchPaths) {
      if (existsSync(executablePath)) {
        browsers.push({ name: config.info.name, executablePath });
        break;
      }
    }
  }
  return browsers;
};

export const detectBrowserProfiles = (): BrowserProfile[] => {
  const currentPlatform = platform();
  const allProfiles: BrowserProfile[] = [];

  const installedBrowsers =
    currentPlatform === "darwin"
      ? detectBrowsersDarwin()
      : currentPlatform === "linux"
        ? detectBrowsersLinux()
        : [];

  for (const browser of installedBrowsers) {
    const config = BROWSER_CONFIGS.find(
      (browserConfig) => browserConfig.info.name === browser.name,
    );
    if (!config) continue;

    const userDataDir = getUserDataDir(config);
    if (!userDataDir) continue;

    const profiles = detectProfilesForBrowser(browser, userDataDir);
    allProfiles.push(...profiles);
  }

  return allProfiles;
};
