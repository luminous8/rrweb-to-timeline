import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/start.ts"],
    format: ["esm"],
    dts: false,
    sourcemap: true,
    platform: "node",
  },
});
