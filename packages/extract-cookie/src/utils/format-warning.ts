export const formatWarning = (source: string, action: string, error: unknown): string =>
  `${source}: ${action}: ${error instanceof Error ? error.message : String(error)}`;
