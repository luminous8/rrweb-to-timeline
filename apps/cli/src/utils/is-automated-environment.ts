import { AUTOMATED_ENVIRONMENT_VARIABLES } from "../constants.js";

export const isAutomatedEnvironment = (): boolean =>
  AUTOMATED_ENVIRONMENT_VARIABLES.some((envVariable) => Boolean(process.env[envVariable]));
