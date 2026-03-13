import { SAME_SITE_LAX, SAME_SITE_NONE, SAME_SITE_STRICT } from "../constants.js";
import type { SameSitePolicy } from "../types.js";

const SAME_SITE_BY_NAME: Readonly<Record<string, SameSitePolicy>> = {
  strict: "Strict",
  lax: "Lax",
  none: "None",
  no_restriction: "None",
};

export const normalizeSameSite = (value: unknown): SameSitePolicy | undefined => {
  if (typeof value === "bigint") {
    return normalizeSameSite(Number(value));
  }
  if (typeof value === "number") {
    switch (value) {
      case SAME_SITE_STRICT:
        return "Strict";
      case SAME_SITE_LAX:
        return "Lax";
      case SAME_SITE_NONE:
        return "None";
      default:
        return undefined;
    }
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return normalizeSameSite(parsed);
    return SAME_SITE_BY_NAME[value.toLowerCase()];
  }
  return undefined;
};
