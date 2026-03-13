import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getCookiesFromBrowser } from "./cdp/cdp.js";
import {
  BROWSER_KILL_DELAY_MS,
  BROWSER_STARTUP_DELAY_MS,
  CDP_LOCAL_PORT,
  HEADLESS_CHROME_ARGS,
  TEMP_DIR_CLEANUP_RETRIES,
  TEMP_DIR_RETRY_DELAY_MS,
} from "./constants.js";
import type {
  BrowserProfile,
  CdpRawCookie,
  ExtractProfileOptions,
  ExtractProfileResult,
  ProfileCookie,
} from "./types.js";
import { copyDir } from "./utils/copy-dir.js";
import { normalizeSameSite } from "./utils/normalize-same-site.js";
import { sleep } from "./utils/sleep.js";

const startHeadlessBrowser = (
  executablePath: string,
  userDataDir: string,
  port: number,
): ChildProcess => {
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    ...HEADLESS_CHROME_ARGS,
  ];

  const childProcess = spawn(executablePath, args, {
    stdio: "ignore",
    detached: true,
  });

  childProcess.unref();
  return childProcess;
};

const SINGLETON_LOCK_FILES = ["SingletonLock", "SingletonSocket", "SingletonCookie"];

const removeSingletonLocks = (profileDir: string): void => {
  for (const lockFile of SINGLETON_LOCK_FILES) {
    const lockPath = path.join(profileDir, lockFile);
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  }
};

const toProfileCookie = (raw: CdpRawCookie): ProfileCookie => ({
  name: raw.name,
  value: raw.value,
  domain: raw.domain,
  path: raw.path,
  expires: raw.expires > 0 ? raw.expires : undefined,
  secure: raw.secure,
  httpOnly: raw.httpOnly,
  sameSite: normalizeSameSite(raw.sameSite),
});

export const extractProfileCookies = async (
  options: ExtractProfileOptions,
): Promise<ExtractProfileResult> => {
  const { profile } = options;
  const port = options.port ?? CDP_LOCAL_PORT;
  const warnings: string[] = [];

  const tempDir = mkdtempSync(path.join(tmpdir(), "profile-sync-"));
  let browser: ChildProcess | null = null;

  try {
    const profileCopyPath = path.join(tempDir, "profile");
    copyDir(profile.profilePath, profileCopyPath);
    removeSingletonLocks(profileCopyPath);

    browser = startHeadlessBrowser(profile.browser.executablePath, profileCopyPath, port);
    await sleep(BROWSER_STARTUP_DELAY_MS);

    const rawCookies = await getCookiesFromBrowser(port);

    if (rawCookies.length === 0) {
      warnings.push(`no cookies found in profile: ${profile.displayName}`);
      return { cookies: [], warnings };
    }

    return { cookies: rawCookies.map(toProfileCookie), warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`failed to extract cookies from ${profile.displayName}: ${message}`);
    return { cookies: [], warnings };
  } finally {
    if (browser) {
      try {
        browser.kill();
      } catch {
        // HACK: process may have already exited
      }
      await sleep(BROWSER_KILL_DELAY_MS);
    }

    try {
      rmSync(tempDir, {
        recursive: true,
        force: true,
        maxRetries: TEMP_DIR_CLEANUP_RETRIES,
        retryDelay: TEMP_DIR_RETRY_DELAY_MS,
      });
    } catch {
      // HACK: temp dir cleanup failure is non-fatal
    }
  }
};

export const extractAllProfileCookies = async (
  profiles: BrowserProfile[],
): Promise<ExtractProfileResult> => {
  const allCookies: ProfileCookie[] = [];
  const allWarnings: string[] = [];

  for (const profile of profiles) {
    const result = await extractProfileCookies({ profile });
    allCookies.push(...result.cookies);
    allWarnings.push(...result.warnings);
  }

  return { cookies: allCookies, warnings: allWarnings };
};
