import { Command } from "commander";
import { render } from "ink";
import { App } from "./app.js";
import { VERSION } from "./constants.js";
import { isAutomatedEnvironment } from "./utils/is-automated-environment.js";
import { autoDetectAndTest, runTest } from "./utils/run-test.js";

const program = new Command()
  .name("testie")
  .description("AI-powered browser testing for your changes")
  .version(VERSION, "-v, --version");

program
  .command("unstaged")
  .description("Test unstaged changes")
  .action(() => runTest("test-unstaged"));

program
  .command("branch")
  .description("Test entire branch diff against main")
  .action(() => runTest("test-branch"));

program
  .command("commit")
  .description("Test a specific commit")
  .argument("[hash]", "commit hash")
  .action((hash?: string) => runTest("select-commit", hash));

program.action(() => {
  if (isAutomatedEnvironment() || !process.stdin.isTTY) {
    return autoDetectAndTest();
  }
  render(<App />);
});

program.parse();
