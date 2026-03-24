import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CONFIG_DIRECTORY = path.join(os.homedir(), ".config", "expect");
const THEME_FILE_PATH = path.join(CONFIG_DIRECTORY, "theme");

export const loadThemeName = (): string | null => {
  try {
    return fs.readFileSync(THEME_FILE_PATH, "utf-8").trim() || null;
  } catch {
    return null;
  }
};

export const saveThemeName = (name: string): void => {
  fs.mkdirSync(CONFIG_DIRECTORY, { recursive: true });
  fs.writeFileSync(THEME_FILE_PATH, name, "utf-8");
};
