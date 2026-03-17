/**
 * stage command — selectively stage changes for commit.
 *
 * gitma stage --all          → stage everything
 * gitma stage Button         → stage all changes for Button
 * gitma stage Button.props.size → stage a specific change
 * gitma stage --clear        → unstage everything
 * gitma stage --list         → show staged changes
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import {
  stageChanges,
  getStagedChanges,
  clearStaging,
} from "../../diff-engine/staging.js";
import { formatDiff, formatChange } from "../formatters/diff-printer.js";

export const stageCommand = new Command("stage")
  .description("Stage specific changes for commit")
  .argument("[target]", "Component name or component.field path")
  .option("--all", "Stage all detected changes")
  .option("--clear", "Clear all staged changes")
  .option("--list", "Show currently staged changes")
  .option("--source <source>", "Source to detect changes from", "code")
  .action(async (target: string | undefined, opts) => {
    const projectRoot = process.cwd();

    // --list: show staged changes
    if (opts.list) {
      const staged = getStagedChanges(projectRoot);
      if (staged.length === 0) {
        console.log(chalk.dim("\n  No staged changes.\n"));
        return;
      }
      console.log(chalk.bold(`\n  ${staged.length} staged change(s):`));
      console.log(formatDiff(staged));
      console.log();
      return;
    }

    // --clear: unstage everything
    if (opts.clear) {
      clearStaging(projectRoot);
      console.log(chalk.green("\n  Staging area cleared.\n"));
      return;
    }

    // Detect changes
    const config = loadConfig(projectRoot);
    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    let allChanges;
    if (opts.source === "code") {
      const codeComponents = readCodeComponents(projectRoot, config.componentGlobs, undefined, config.framework);
      allChanges = diffSchemas(committed, codeComponents);
    } else {
      console.log(chalk.red("  Figma source for staging not yet implemented."));
      process.exit(1);
    }

    if (allChanges.length === 0) {
      console.log(chalk.dim("\n  No changes to stage.\n"));
      return;
    }

    // --all: stage everything
    if (opts.all) {
      stageChanges(projectRoot, allChanges);
      console.log(chalk.green(`\n  Staged ${allChanges.length} change(s).\n`));
      return;
    }

    // Stage by target
    if (!target) {
      console.log(chalk.yellow("\n  Specify a target or use --all. Available changes:"));
      console.log(formatDiff(allChanges));
      console.log();
      return;
    }

    // Filter by component name or component.fieldPath
    let toStage;
    if (target.includes(".")) {
      // Specific field: "Button.props.size"
      const [componentName, ...fieldParts] = target.split(".");
      const fieldPath = fieldParts.join(".");
      toStage = allChanges.filter(
        (c) => c.componentName === componentName && c.fieldPath.startsWith(fieldPath),
      );
    } else {
      // Entire component: "Button"
      toStage = allChanges.filter((c) => c.componentName === target);
    }

    if (toStage.length === 0) {
      console.log(chalk.yellow(`\n  No changes found matching "${target}".\n`));
      return;
    }

    stageChanges(projectRoot, toStage);
    console.log(chalk.green(`\n  Staged ${toStage.length} change(s) for ${target}:`));
    for (const change of toStage) {
      console.log(formatChange(change));
    }
    console.log();
  });
