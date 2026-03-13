import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const copyDir = (source: string, destination: string): void => {
  mkdirSync(destination, { recursive: true });

  const entries = readdirSync(source);

  for (const entry of entries) {
    const sourcePath = path.join(source, entry);
    const destinationPath = path.join(destination, entry);

    try {
      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        copyDir(sourcePath, destinationPath);
      } else {
        copyFileSync(sourcePath, destinationPath);
      }
    } catch {
      // HACK: some files may be locked or inaccessible while Chrome is running, skip them
    }
  }
};
