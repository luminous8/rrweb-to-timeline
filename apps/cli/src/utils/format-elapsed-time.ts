import prettyMs from "pretty-ms";

export const formatElapsedTime = (elapsedTimeMs: number): string =>
  prettyMs(Math.max(0, elapsedTimeMs), { secondsDecimalDigits: 0 });
