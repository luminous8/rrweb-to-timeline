import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  BINARY_COOKIE_EXPIRATION_OFFSET,
  BINARY_COOKIE_FLAGS_OFFSET,
  BINARY_COOKIE_HTTP_ONLY_FLAG,
  BINARY_COOKIE_MIN_HEADER_BYTES,
  BINARY_COOKIE_MIN_PAGE_BYTES,
  BINARY_COOKIE_MIN_RECORD_BYTES,
  BINARY_COOKIE_NAME_OFFSET,
  BINARY_COOKIE_PAGE_HEADER,
  BINARY_COOKIE_PATH_OFFSET,
  BINARY_COOKIE_SECURE_FLAG,
  BINARY_COOKIE_URL_OFFSET,
  BINARY_COOKIE_VALUE_OFFSET,
  MAC_EPOCH_DELTA_SECONDS,
  MS_PER_SECOND,
} from "./constants.js";
import type { Cookie, ExtractResult } from "./types.js";
import { hostMatchesAny } from "./utils/host-matching.js";
import { stripLeadingDot } from "./utils/strip-leading-dot.js";

const resolveBinaryCookiesPath = (): string | null => {
  const home = homedir();
  const candidates = [
    path.join(home, "Library", "Cookies", "Cookies.binarycookies"),
    path.join(
      home,
      "Library",
      "Containers",
      "com.apple.Safari",
      "Data",
      "Library",
      "Cookies",
      "Cookies.binarycookies",
    ),
  ];

  for (const candidate of candidates) {
    try {
      readFileSync(candidate, { flag: "r" });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
};

export const parseBinaryCookies = (buffer: Buffer): Cookie[] => {
  if (buffer.length < BINARY_COOKIE_MIN_HEADER_BYTES) return [];
  if (buffer.subarray(0, 4).toString("utf8") !== "cook") return [];

  const pageCount = buffer.readUInt32BE(4);
  let cursor = 8;
  const pageSizes: number[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    pageSizes.push(buffer.readUInt32BE(cursor));
    cursor += 4;
  }

  const cookies: Cookie[] = [];
  for (const pageSize of pageSizes) {
    const page = buffer.subarray(cursor, cursor + pageSize);
    cursor += pageSize;
    cookies.push(...decodePage(page));
  }
  return cookies;
};

const decodePage = (page: Buffer): Cookie[] => {
  if (page.length < BINARY_COOKIE_MIN_PAGE_BYTES) return [];

  const header = page.readUInt32BE(0);
  if (header !== BINARY_COOKIE_PAGE_HEADER) return [];

  const cookieCount = page.readUInt32LE(4);
  const offsets: number[] = [];
  let cursor = 8;

  for (let index = 0; index < cookieCount; index += 1) {
    offsets.push(page.readUInt32LE(cursor));
    cursor += 4;
  }

  const cookies: Cookie[] = [];
  for (const offset of offsets) {
    const cookie = decodeCookieRecord(page.subarray(offset));
    if (cookie) cookies.push(cookie);
  }
  return cookies;
};

const decodeCookieRecord = (record: Buffer): Cookie | null => {
  if (record.length < BINARY_COOKIE_MIN_RECORD_BYTES) return null;

  const size = record.readUInt32LE(0);
  if (size < BINARY_COOKIE_MIN_RECORD_BYTES || size > record.length) return null;

  const flags = record.readUInt32LE(BINARY_COOKIE_FLAGS_OFFSET);
  const isSecure = (flags & BINARY_COOKIE_SECURE_FLAG) !== 0;
  const isHttpOnly = (flags & BINARY_COOKIE_HTTP_ONLY_FLAG) !== 0;

  const urlOffset = record.readUInt32LE(BINARY_COOKIE_URL_OFFSET);
  const nameOffset = record.readUInt32LE(BINARY_COOKIE_NAME_OFFSET);
  const pathOffset = record.readUInt32LE(BINARY_COOKIE_PATH_OFFSET);
  const valueOffset = record.readUInt32LE(BINARY_COOKIE_VALUE_OFFSET);

  const expiration = readDoubleLE(record, BINARY_COOKIE_EXPIRATION_OFFSET);

  const rawUrl = readCString(record, urlOffset, size);
  const name = readCString(record, nameOffset, size);
  const cookiePath = readCString(record, pathOffset, size) ?? "/";
  const value = readCString(record, valueOffset, size) ?? "";

  if (!name) return null;

  const domain = rawUrl ? safeHostname(rawUrl) : undefined;
  const expires =
    expiration && expiration > 0 ? Math.round(expiration + MAC_EPOCH_DELTA_SECONDS) : undefined;

  return {
    name,
    value,
    domain: domain ?? "",
    path: cookiePath,
    expires,
    secure: isSecure,
    httpOnly: isHttpOnly,
    browser: "safari",
  };
};

const readDoubleLE = (buffer: Buffer, offset: number): number => {
  if (offset + 8 > buffer.length) return 0;
  return buffer.subarray(offset, offset + 8).readDoubleLE(0);
};

const readCString = (buffer: Buffer, offset: number, end: number): string | null => {
  if (offset <= 0 || offset >= end) return null;

  let cursor = offset;
  while (cursor < end && buffer[cursor] !== 0) {
    cursor += 1;
  }
  if (cursor >= end) return null;
  return buffer.toString("utf8", offset, cursor);
};

const safeHostname = (raw: string): string | undefined => {
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`;
    return stripLeadingDot(new URL(url).hostname);
  } catch {
    const cleaned = raw.trim();
    if (!cleaned) return undefined;
    return stripLeadingDot(cleaned);
  }
};

export const extractSafariCookies = async (
  hosts: string[],
  options: {
    names?: string[];
    includeExpired?: boolean;
  } = {},
): Promise<ExtractResult> => {
  const warnings: string[] = [];

  if (process.platform !== "darwin") {
    return { cookies: [], warnings };
  }

  const cookieFile = resolveBinaryCookiesPath();
  if (!cookieFile) {
    warnings.push("safari: Cookies.binarycookies not found");
    return { cookies: [], warnings };
  }

  const now = Math.floor(Date.now() / MS_PER_SECOND);
  const allowlist = options.names ? new Set(options.names) : null;

  try {
    const data = readFileSync(cookieFile);
    const parsed = parseBinaryCookies(data);
    const cookies: Cookie[] = [];

    for (const cookie of parsed) {
      if (!cookie.name || !cookie.domain) continue;
      if (allowlist && !allowlist.has(cookie.name)) continue;
      if (!hostMatchesAny(hosts, cookie.domain)) continue;
      if (!options.includeExpired && cookie.expires && cookie.expires < now) continue;
      cookies.push(cookie);
    }

    return { cookies, warnings };
  } catch (error) {
    warnings.push(
      `safari: failed to read cookies: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { cookies: [], warnings };
  }
};
