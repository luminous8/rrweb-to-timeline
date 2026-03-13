import { MS_PER_SECOND, SESSION_EXPIRES } from "./constants.js";
import type { Cookie, SameSitePolicy } from "./types.js";
import { hostMatchesCookieDomain } from "./utils/host-matching.js";

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSitePolicy;
}

export interface PuppeteerCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: SameSitePolicy;
}

const ensureDotPrefix = (domain: string): string =>
  domain.startsWith(".") ? domain : `.${domain}`;

const toBaseCookie = (cookie: Cookie) => ({
  name: cookie.name,
  value: cookie.value,
  domain: ensureDotPrefix(cookie.domain),
  path: cookie.path,
  expires: cookie.expires ?? SESSION_EXPIRES,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
});

export class CookieJar {
  readonly cookies: Cookie[];

  constructor(cookies: Cookie[]) {
    this.cookies = cookies;
  }

  match(url: string): Cookie[] {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const pathname = parsed.pathname || "/";
    const nowSeconds = Math.floor(Date.now() / MS_PER_SECOND);

    return this.cookies.filter((cookie) => {
      if (!hostMatchesCookieDomain(host, cookie.domain)) return false;
      if (!pathname.startsWith(cookie.path)) return false;
      if (cookie.secure && parsed.protocol !== "https:") return false;
      if (cookie.expires && cookie.expires < nowSeconds) return false;
      return true;
    });
  }

  toCookieHeader(url: string): string {
    return this.match(url)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  toPlaywright(): PlaywrightCookie[] {
    return this.cookies.map((cookie) => ({
      ...toBaseCookie(cookie),
      sameSite: cookie.sameSite ?? "Lax",
    }));
  }

  toPuppeteer(): PuppeteerCookie[] {
    return this.cookies.map((cookie) => ({
      ...toBaseCookie(cookie),
      sameSite: cookie.sameSite,
    }));
  }

  toJSON(): string {
    return JSON.stringify(this.cookies);
  }

  static fromJSON(json: string): CookieJar {
    return new CookieJar(JSON.parse(json) as Cookie[]);
  }
}
