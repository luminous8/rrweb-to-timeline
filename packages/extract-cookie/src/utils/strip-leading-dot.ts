export const stripLeadingDot = (domain: string): string =>
  domain.startsWith(".") ? domain.slice(1) : domain;
