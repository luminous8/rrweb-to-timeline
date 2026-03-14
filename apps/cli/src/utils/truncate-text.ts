import cliTruncate from "cli-truncate";

export const truncateText = (value: string, limit: number): string => cliTruncate(value, limit);
