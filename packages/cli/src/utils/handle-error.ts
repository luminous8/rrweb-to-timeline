import { logger } from "./logger";

export const handleError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  process.exit(1);
};
