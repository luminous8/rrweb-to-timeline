import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  external: ["@ai-sdk/provider", "@anthropic-ai/claude-agent-sdk", "@openai/codex-sdk", "ai"],
}));
