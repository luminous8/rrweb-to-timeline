import type { Cookie } from "../types.js";

export const dedupeCookies = (cookies: Cookie[]): Cookie[] => {
  const merged = new Map<string, Cookie>();
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
    if (!merged.has(key)) merged.set(key, cookie);
  }
  return Array.from(merged.values());
};
