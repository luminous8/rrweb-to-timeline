import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";
import { prompts } from "../utils/prompts";
import { spinner } from "../utils/spinner";
import { detectNonInteractive, detectPackageManager, SKILL_COMMANDS, tryRun } from "./init-utils";

interface AddSkillOptions {
  yes?: boolean;
}

export const runAddSkill = async (options: AddSkillOptions = {}) => {
  const nonInteractive = detectNonInteractive(options.yes ?? false);
  const packageManager = detectPackageManager();

  let installSkill = nonInteractive;

  if (!nonInteractive) {
    const response = await prompts({
      type: "confirm",
      name: "installSkill",
      message: `Install the ${highlighter.info("expect")} skill for your coding agent?`,
      initial: true,
    });
    installSkill = response.installSkill;
  }

  if (installSkill) {
    const skillCommand = SKILL_COMMANDS[packageManager];
    const skillSpinner = spinner("Installing skill...").start();
    const skillSuccess = await tryRun(skillCommand);

    if (skillSuccess) {
      skillSpinner.succeed("Skill installed.");
    } else {
      skillSpinner.fail("Failed to install skill.");
      logger.dim(`  Run manually: ${highlighter.info(skillCommand)}`);
    }
  }
};
