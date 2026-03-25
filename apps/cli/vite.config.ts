import { createRequire } from "node:module";
import { defineConfig } from "vite-plus";
import { reactCompilerPlugin } from "./react-compiler-plugin";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default defineConfig({
  pack: {
    entry: ["src/index.tsx"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: "node",
    fixedExtension: false,
    banner: "#!/usr/bin/env node",
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
    deps: {
      alwaysBundle: [/^@expect\//],
      neverBundle: ["playwright", "playwright-core", "chromium-bidi", "libsql", "ws", "undici"],
    },
    minify: true,
    plugins: [reactCompilerPlugin()],
  },
});
