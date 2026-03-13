import { generateText, streamText } from "ai";
import { createClaudeModel } from "../src/claude.js";
import { createCodexModel } from "../src/codex.js";

const SEPARATOR = "=".repeat(60);

const testGenerate = async (name: string, model: ReturnType<typeof createClaudeModel>) => {
  console.log(`\n${SEPARATOR}`);
  console.log(`generateText: ${name}`);
  console.log(SEPARATOR);

  const startTime = Date.now();
  try {
    const result = await generateText({
      model,
      prompt: "List the files in the current directory",
    });

    console.log(`  text: ${result.text.slice(0, 300)}${result.text.length > 300 ? "..." : ""}`);
    console.log(`  toolCalls: ${result.toolCalls.length}`);
    console.log(`  toolResults: ${result.toolResults.length}`);
    console.log(`  finishReason: ${result.finishReason}`);
    console.log(`  completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`  failed after ${Date.now() - startTime}ms: ${error}`);
  }
};

const testStream = async (name: string, model: ReturnType<typeof createClaudeModel>) => {
  console.log(`\n${SEPARATOR}`);
  console.log(`streamText: ${name}`);
  console.log(SEPARATOR);

  const startTime = Date.now();
  try {
    const result = streamText({
      model,
      prompt: "What is 2 + 2?",
    });

    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log();
    console.log(`  completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`  failed after ${Date.now() - startTime}ms: ${error}`);
  }
};

const main = async () => {
  const claudeModel = createClaudeModel({ cwd: process.cwd() });
  const codexModel = createCodexModel({ cwd: process.cwd() });

  await testGenerate("Claude", claudeModel);
  await testStream("Claude", claudeModel);
  await testGenerate("Codex", codexModel);
  await testStream("Codex", codexModel);

  console.log("\nDone.");
};

main();
