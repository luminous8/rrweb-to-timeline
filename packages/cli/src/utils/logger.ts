import pc from "picocolors";

export const logger = {
  success: (message: string) => console.log(pc.green(message)),
  error: (message: string) => console.error(pc.red(message)),
  dim: (message: string) => console.log(pc.dim(message)),
  log: (message: string) => console.log(message),
};
