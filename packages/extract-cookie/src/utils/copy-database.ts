import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const copySidecar = (sourcePath: string, targetPath: string, suffix: string): void => {
  try {
    copyFileSync(`${sourcePath}${suffix}`, targetPath);
  } catch {
    // HACK: sidecar may be missing or locked
  }
};

export const copyDatabaseToTemp = (
  databasePath: string,
  prefix: string,
  filename: string,
): { tempDir: string; tempDatabasePath: string } => {
  const tempDir = mkdtempSync(path.join(tmpdir(), prefix));
  const tempDatabasePath = path.join(tempDir, filename);

  try {
    copyFileSync(databasePath, tempDatabasePath);
    copySidecar(databasePath, `${tempDatabasePath}-wal`, "-wal");
    copySidecar(databasePath, `${tempDatabasePath}-shm`, "-shm");
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }

  return { tempDir, tempDatabasePath };
};
