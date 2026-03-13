import { EXCLUDED_ARIA_ROLE } from "../constants";
import type { AriaRole, ParsedAriaLine } from "../types";

const ARIA_LINE_REGEX = /- (\w+)\s*(?:"([^"]*)")?/;

export const parseAriaLine = (line: string): ParsedAriaLine | null => {
  const match = ARIA_LINE_REGEX.exec(line);
  if (!match) return null;

  const role = match[1];
  if (role === EXCLUDED_ARIA_ROLE) return null;

  return { role: role as AriaRole, name: match[2] ?? "" };
};
