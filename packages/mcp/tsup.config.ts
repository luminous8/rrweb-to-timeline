import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts", "src/start.ts"],
  format: ["esm"],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  external: ["playwright", "@browser-tester/browser", "@modelcontextprotocol/sdk", "zod"],
}));
