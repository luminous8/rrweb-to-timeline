import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

import { MAX_UNIX_EPOCH_SECONDS, MS_PER_SECOND } from "./constants.js";
import { querySqlite } from "./sqlite.js";
import type { Cookie, ExtractResult } from "./types.js";
import { copyDatabaseToTemp } from "./utils/copy-database.js";
import { formatWarning } from "./utils/format-warning.js";
import { normalizeSameSite } from "./utils/normalize-same-site.js";
import { buildHostWhereClause, sqliteBool } from "./utils/sql.js";
import { stripLeadingDot } from "./utils/strip-leading-dot.js";

const parseFirefoxExpiry = (value: unknown): number | undefined => {
  let num: number;
  if (typeof value === "bigint") {
    num = Number(value);
  } else if (typeof value === "string") {
    num = Number(value);
    if (!Number.isFinite(num)) return undefined;
  } else if (typeof value === "number") {
    num = value;
  } else {
    return undefined;
  }
  if (Number.isNaN(num) || num <= 0 || num > MAX_UNIX_EPOCH_SECONDS) return undefined;
  return Math.round(num);
};

const resolveCookieDbPath = (): string | null => {
  const home = homedir();
  const currentPlatform = platform();

  const roots =
    currentPlatform === "darwin"
      ? [path.join(home, "Library", "Application Support", "Firefox", "Profiles")]
      : currentPlatform === "linux"
        ? [path.join(home, ".mozilla", "firefox")]
        : currentPlatform === "win32"
          ? [path.join(home, "AppData", "Roaming", "Mozilla", "Firefox", "Profiles")]
          : [];

  for (const root of roots) {
    try {
      const entries = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      const picked = entries.find((entry) => entry.includes("default-release")) ?? entries[0];
      if (!picked) continue;

      const candidate = path.join(root, picked, "cookies.sqlite");
      if (existsSync(candidate)) return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

export const extractFirefoxCookies = async (
  hosts: string[],
  options: {
    names?: string[];
    includeExpired?: boolean;
  } = {},
): Promise<ExtractResult> => {
  const warnings: string[] = [];
  const databasePath = resolveCookieDbPath();

  if (!databasePath) {
    warnings.push("firefox: cookie database not found");
    return { cookies: [], warnings };
  }

  let tempDir: string;
  let tempDatabasePath: string;
  try {
    ({ tempDir, tempDatabasePath } = copyDatabaseToTemp(
      databasePath,
      "extract-cookie-firefox-",
      "cookies.sqlite",
    ));
  } catch (error) {
    warnings.push(formatWarning("firefox", "failed to copy cookie database", error));
    return { cookies: [], warnings };
  }

  try {
    const whereClause = buildHostWhereClause(hosts, "host");
    const now = Math.floor(Date.now() / MS_PER_SECOND);
    const expiryClause = options.includeExpired ? "" : ` AND (expiry = 0 OR expiry > ${now})`;

    const sql =
      `SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite ` +
      `FROM moz_cookies WHERE (${whereClause})${expiryClause} ORDER BY expiry DESC`;

    const rows = await querySqlite(tempDatabasePath, sql);
    const allowlist = options.names ? new Set(options.names) : null;
    const cookies: Cookie[] = [];

    for (const row of rows) {
      const name = typeof row.name === "string" ? row.name : null;
      const value = typeof row.value === "string" ? row.value : null;
      const host = typeof row.host === "string" ? row.host : null;

      if (!name || value === null || !host) continue;
      if (allowlist && !allowlist.has(name)) continue;

      const expires = parseFirefoxExpiry(row.expiry);

      if (!options.includeExpired && expires && expires < now) continue;

      cookies.push({
        name,
        value,
        domain: stripLeadingDot(host),
        path: (typeof row.path === "string" ? row.path : "") || "/",
        expires,
        secure: sqliteBool(row.isSecure),
        httpOnly: sqliteBool(row.isHttpOnly),
        sameSite: normalizeSameSite(row.sameSite),
        browser: "firefox",
      });
    }

    return { cookies, warnings };
  } catch (error) {
    warnings.push(formatWarning("firefox", "failed to read cookies", error));
    return { cookies: [], warnings };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};
