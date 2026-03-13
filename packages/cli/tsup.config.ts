import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "./src/cli.ts" },
  format: ["esm"],
  dts: false,
  splitting: false,
  target: "node18",
  platform: "node",
  treeshake: true,
  noExternal: [/@browser-tester\//],
  external: ["playwright", "commander", "bun:sqlite", "sqlite"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
