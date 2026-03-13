import { stripLeadingDot } from "./strip-leading-dot.js";

export const hostMatchesCookieDomain = (host: string, cookieDomain: string): boolean => {
  const normalizedHost = host.toLowerCase();
  const domainLower = stripLeadingDot(cookieDomain).toLowerCase();
  return normalizedHost === domainLower || normalizedHost.endsWith(`.${domainLower}`);
};

export const hostMatchesAny = (hosts: string[], cookieDomain: string): boolean =>
  hosts.some((host) => hostMatchesCookieDomain(host, cookieDomain));

export const originsToHosts = (origins: string[]): string[] =>
  origins.map((origin) => new URL(origin).hostname);
