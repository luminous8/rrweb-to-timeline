import { Command } from "commander";
import { render } from "ink";
import { App } from "./app.js";
import { VERSION } from "./constants.js";
import { ThemeProvider } from "./theme-context.js";
import { loadThemeName } from "./utils/load-theme.js";
import { isAutomatedEnvironment } from "./utils/is-automated-environment.js";
import { autoDetectAndTest, runTest } from "./utils/run-test.js";
import { addLiveChromeOptions, resolveLiveChromeEnvironment } from "./utils/live-chrome-options.js";

const program = new Command()
  .name("testie")
  .description("AI-powered browser testing for your changes")
  .version(VERSION, "-v, --version");

const resolveCommandEnvironment = (command: Command) =>
  resolveLiveChromeEnvironment(command.optsWithGlobals());

addLiveChromeOptions(program);

addLiveChromeOptions(program.command("unstaged"))
  .description("Test unstaged changes")
  .action((_options, command: Command) =>
    runTest("test-unstaged", undefined, {
      environmentOverrides: resolveCommandEnvironment(command),
    }),
  );

addLiveChromeOptions(program.command("branch"))
  .description("Test entire branch diff against main")
  .action((_options, command: Command) =>
    runTest("test-branch", undefined, {
      environmentOverrides: resolveCommandEnvironment(command),
    }),
  );

addLiveChromeOptions(program.command("commit"))
  .description("Test a specific commit")
  .argument("[hash]", "commit hash")
  .action((hash: string | undefined, _options, command: Command) =>
    runTest("select-commit", hash, {
      environmentOverrides: resolveCommandEnvironment(command),
    }),
  );

program.action((_, command: Command) => {
  const environmentOverrides = resolveCommandEnvironment(command);
  if (environmentOverrides.liveChrome === true) {
    return autoDetectAndTest({ environmentOverrides });
  }

  if (isAutomatedEnvironment() || !process.stdin.isTTY) {
    return autoDetectAndTest({ environmentOverrides });
  }
  const initialTheme = loadThemeName() ?? undefined;
  render(
    <ThemeProvider initialTheme={initialTheme}>
      <App />
    </ThemeProvider>,
  );
});

program.parse();
