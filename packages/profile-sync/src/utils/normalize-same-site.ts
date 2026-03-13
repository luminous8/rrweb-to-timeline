import type { SameSitePolicy } from "../types.js";

const VALID_SAME_SITE_POLICIES = new Set<string>(["Strict", "Lax", "None"]);

export const normalizeSameSite = (value: string): SameSitePolicy | undefined =>
  VALID_SAME_SITE_POLICIES.has(value) ? (value as SameSitePolicy) : undefined;
