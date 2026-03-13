export type SameSitePolicy = "Strict" | "Lax" | "None";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: SameSitePolicy;
  browser: Browser;
}

export type Browser = "chrome" | "edge" | "brave" | "arc" | "dia" | "helium" | "firefox" | "safari";

export type ChromiumBrowser = Exclude<Browser, "firefox" | "safari">;

export interface ExtractOptions {
  url: string;
  browsers?: Browser[];
  names?: string[];
  includeExpired?: boolean;
  timeoutMs?: number;
}

export interface ExtractResult {
  cookies: Cookie[];
  warnings: string[];
}
