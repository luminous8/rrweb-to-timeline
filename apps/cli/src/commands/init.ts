import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import pc from "picocolors";

const SKILL_COMMAND = "npx skills add https://github.com/millionco/expect --skill expect-cli";

const log = (message: string) => console.log(message);
const step = (message: string) => log(`${pc.green(">")} ${message}`);

const confirm = (question: string): Promise<boolean> => {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    readline.question(`${question} ${pc.dim("(y/n)")} `, (answer) => {
      readline.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
};

const run = (command: string) => {
  execSync(command, { stdio: "inherit" });
};

export const runInit = async () => {
  log("");
  log(pc.bold("expect init"));
  log("");

  step("Installing expect-cli globally...");
  log("");
  run("npm install -g expect-cli@latest");
  log("");
  step(`Installed! You can now run ${pc.cyan("expect")} from anywhere.`);
  log("");

  const installSkill = await confirm("Install the expect skill for your coding agent?");

  if (installSkill) {
    log("");
    step("Installing skill...");
    log("");
    run(SKILL_COMMAND);
    log("");
    step("Skill installed!");
  }

  log("");
  step(pc.bold("You're all set!"));
  log(`  Run ${pc.cyan("expect")} in any project to start testing.`);
  log("");
};
