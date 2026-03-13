import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

import {
  CHROMIUM_META_VERSION_HASH_PREFIX,
  MS_PER_SECOND,
  PBKDF2_ITERATIONS_DARWIN,
  PBKDF2_ITERATIONS_LINUX,
} from "./constants.js";
import { decryptAes128Cbc, decryptAes256Gcm, deriveKey } from "./crypto.js";
import { querySqlite } from "./sqlite.js";
import type { ChromiumBrowser, Cookie, ExtractResult } from "./types.js";
import { copyDatabaseToTemp } from "./utils/copy-database.js";
import { execCommand } from "./utils/exec-command.js";
import { formatWarning } from "./utils/format-warning.js";
import { normalizeExpiration } from "./utils/normalize-expiration.js";
import { normalizeSameSite } from "./utils/normalize-same-site.js";
import { buildHostWhereClause, sqliteBool } from "./utils/sql.js";
import { stripLeadingDot } from "./utils/strip-leading-dot.js";

interface BrowserConfig {
  cookiePaths: Record<string, string>;
  keychainService: string;
  linuxSecretLabel: string;
  localStatePath: string;
}

export const BROWSER_CONFIGS: Record<ChromiumBrowser, BrowserConfig> = {
  chrome: {
    cookiePaths: {
      darwin: "Library/Application Support/Google/Chrome/Default",
      win32: "AppData/Local/Google/Chrome/User Data/Default",
      linux: ".config/google-chrome/Default",
    },
    keychainService: "Chrome Safe Storage",
    linuxSecretLabel: "chrome",
    localStatePath: "AppData/Local/Google/Chrome/User Data/Local State",
  },
  edge: {
    cookiePaths: {
      darwin: "Library/Application Support/Microsoft Edge/Default",
      win32: "AppData/Local/Microsoft/Edge/User Data/Default",
      linux: ".config/microsoft-edge/Default",
    },
    keychainService: "Microsoft Edge Safe Storage",
    linuxSecretLabel: "microsoft-edge",
    localStatePath: "AppData/Local/Microsoft/Edge/User Data/Local State",
  },
  brave: {
    cookiePaths: {
      darwin: "Library/Application Support/BraveSoftware/Brave-Browser/Default",
      win32: "AppData/Local/BraveSoftware/Brave-Browser/User Data/Default",
      linux: ".config/BraveSoftware/Brave-Browser/Default",
    },
    keychainService: "Brave Safe Storage",
    linuxSecretLabel: "brave",
    localStatePath: "AppData/Local/BraveSoftware/Brave-Browser/User Data/Local State",
  },
  arc: {
    cookiePaths: {
      darwin: "Library/Application Support/Arc/User Data/Default",
      win32: "AppData/Local/Arc/User Data/Default",
      linux: ".config/arc/Default",
    },
    keychainService: "Arc Safe Storage",
    linuxSecretLabel: "arc",
    localStatePath: "AppData/Local/Arc/User Data/Local State",
  },
  dia: {
    cookiePaths: {
      darwin: "Library/Application Support/Dia/User Data/Default",
      win32: "AppData/Local/Dia/User Data/Default",
      linux: ".config/dia/Default",
    },
    keychainService: "Dia Safe Storage",
    linuxSecretLabel: "dia",
    localStatePath: "AppData/Local/Dia/User Data/Local State",
  },
  helium: {
    cookiePaths: {
      darwin: "Library/Application Support/net.imput.helium/Default",
      win32: "AppData/Local/Helium/User Data/Default",
      linux: ".config/helium/Default",
    },
    keychainService: "Helium Storage Key",
    linuxSecretLabel: "helium",
    localStatePath: "AppData/Local/Helium/User Data/Local State",
  },
};

const resolveCookieDbPath = (browser: ChromiumBrowser): string | null => {
  const config = BROWSER_CONFIGS[browser];
  const relativePath = config.cookiePaths[platform()];
  if (!relativePath) return null;

  const profileDir = path.join(homedir(), relativePath);
  const networkPath = path.join(profileDir, "Network", "Cookies");
  if (existsSync(networkPath)) return networkPath;

  const legacyPath = path.join(profileDir, "Cookies");
  if (existsSync(legacyPath)) return legacyPath;

  return null;
};

const getKeychainPassword = (browser: ChromiumBrowser, timeoutMs?: number): string | null => {
  const config = BROWSER_CONFIGS[browser];
  return execCommand(`security find-generic-password -w -s "${config.keychainService}"`, timeoutMs);
};

const getLinuxPassword = (browser: ChromiumBrowser, timeoutMs?: number): string => {
  const config = BROWSER_CONFIGS[browser];
  const lookups = [
    `secret-tool lookup application ${config.linuxSecretLabel}`,
    "secret-tool lookup xdg:schema chrome_libsecret_os_crypt_password_v2",
    "secret-tool lookup xdg:schema chrome_libsecret_os_crypt_password_v1",
  ];

  for (const command of lookups) {
    const result = execCommand(command, timeoutMs);
    if (result) return result;
  }

  return "peanuts";
};

const getWindowsMasterKey = (browser: ChromiumBrowser, timeoutMs?: number): Buffer | null => {
  const config = BROWSER_CONFIGS[browser];
  const localStatePath = path.join(homedir(), config.localStatePath);

  try {
    const localState = JSON.parse(readFileSync(localStatePath, "utf-8"));
    const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, "base64");
    const base64Key = encryptedKey.subarray(5).toString("base64");

    const psCommand = `Add-Type -AssemblyName System.Security; $encrypted = [Convert]::FromBase64String('${base64Key}'); $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, 'CurrentUser'); [Convert]::ToBase64String($decrypted)`;
    const result = execCommand(`powershell -Command "${psCommand}"`, timeoutMs);
    if (!result) return null;

    return Buffer.from(result, "base64");
  } catch {
    return null;
  }
};

const readMetaVersion = async (databasePath: string): Promise<number> => {
  try {
    const rows = await querySqlite(databasePath, "SELECT value FROM meta WHERE key = 'version'");
    const value = rows[0]?.value;
    if (typeof value === "number") return Math.floor(value);
    if (typeof value === "bigint") return Math.floor(Number(value));
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  } catch {
    return 0;
  }
};

export const extractChromiumCookies = async (
  browser: ChromiumBrowser,
  hosts: string[],
  options: {
    names?: string[];
    includeExpired?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<ExtractResult> => {
  const warnings: string[] = [];
  const databasePath = resolveCookieDbPath(browser);

  if (!databasePath) {
    warnings.push(`${browser}: cookie database not found`);
    return { cookies: [], warnings };
  }

  let tempDir: string;
  let tempDatabasePath: string;
  try {
    ({ tempDir, tempDatabasePath } = copyDatabaseToTemp(
      databasePath,
      `extract-cookie-${browser}-`,
      "Cookies",
    ));
  } catch (error) {
    warnings.push(formatWarning(browser, "failed to copy cookie database", error));
    return { cookies: [], warnings };
  }

  try {
    const whereClause = buildHostWhereClause(hosts, "host_key");
    const metaVersion = await readMetaVersion(tempDatabasePath);
    const stripHashPrefix = metaVersion >= CHROMIUM_META_VERSION_HASH_PREFIX;

    const decryptValue = buildDecryptor(browser, stripHashPrefix, options.timeoutMs, warnings);
    if (!decryptValue) return { cookies: [], warnings };

    const sql =
      `SELECT name, value, host_key, path, expires_utc, samesite, ` +
      `encrypted_value, is_secure, is_httponly ` +
      `FROM cookies WHERE (${whereClause}) ORDER BY expires_utc DESC`;

    const rows = await querySqlite(tempDatabasePath, sql);
    const allowlist = options.names ? new Set(options.names) : null;
    const now = Math.floor(Date.now() / MS_PER_SECOND);
    const cookies: Cookie[] = [];

    for (const row of rows) {
      const name = typeof row.name === "string" ? row.name : null;
      if (!name) continue;
      if (allowlist && !allowlist.has(name)) continue;

      const hostKey = typeof row.host_key === "string" ? row.host_key : null;
      if (!hostKey) continue;

      let value = typeof row.value === "string" ? row.value : null;
      if (!value || value.length === 0) {
        const encrypted = row.encrypted_value instanceof Uint8Array ? row.encrypted_value : null;
        if (!encrypted) continue;
        value = decryptValue(encrypted);
      }
      if (value === null) continue;

      const expires = normalizeExpiration(
        typeof row.expires_utc === "number" ||
          typeof row.expires_utc === "bigint" ||
          typeof row.expires_utc === "string"
          ? row.expires_utc
          : undefined,
      );

      if (!options.includeExpired && expires && expires < now) continue;

      cookies.push({
        name,
        value,
        domain: stripLeadingDot(hostKey),
        path: (typeof row.path === "string" ? row.path : "") || "/",
        expires,
        secure: sqliteBool(row.is_secure),
        httpOnly: sqliteBool(row.is_httponly),
        sameSite: normalizeSameSite(row.samesite),
        browser,
      });
    }

    return { cookies, warnings };
  } catch (error) {
    warnings.push(formatWarning(browser, "failed to read cookies", error));
    return { cookies: [], warnings };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

const buildDecryptor = (
  browser: ChromiumBrowser,
  stripHashPrefix: boolean,
  timeoutMs: number | undefined,
  warnings: string[],
): ((encrypted: Uint8Array) => string | null) | null => {
  const currentPlatform = platform();

  if (currentPlatform === "darwin") {
    const password = getKeychainPassword(browser, timeoutMs);
    if (!password) {
      warnings.push(`${browser}: keychain password not found`);
      return null;
    }
    const key = deriveKey(password, PBKDF2_ITERATIONS_DARWIN);
    return (encrypted) => decryptAes128Cbc(encrypted, [key], stripHashPrefix);
  }

  if (currentPlatform === "linux") {
    const password = getLinuxPassword(browser, timeoutMs);
    const keys = new Set<string>([password, "peanuts", ""]);
    const candidates = Array.from(keys).map((key) => deriveKey(key, PBKDF2_ITERATIONS_LINUX));
    return (encrypted) => decryptAes128Cbc(encrypted, candidates, stripHashPrefix);
  }

  if (currentPlatform === "win32") {
    const masterKey = getWindowsMasterKey(browser, timeoutMs);
    if (!masterKey) {
      warnings.push(`${browser}: DPAPI master key not found`);
      return null;
    }
    return (encrypted) => decryptAes256Gcm(encrypted, masterKey, stripHashPrefix);
  }

  warnings.push(`${browser}: unsupported platform ${currentPlatform}`);
  return null;
};
