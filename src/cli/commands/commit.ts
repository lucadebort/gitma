/**
 * commit command — save current code state as the new committed schema.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../shared/config.js";
import { saveSnapshot, loadSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { formatDiff } from "../formatters/diff-printer.js";

export const commitCommand = new Command("commit")
  .description("Commit current state as the new baseline")
  .option("--source <source>", "Source to commit from", "code")
  .option("-m, --message <message>", "Commit message")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);

    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    let components;
    if (opts.source === "code") {
      components = readCodeComponents(projectRoot, config.componentGlobs, undefined, config.framework);
    } else {
      console.log(chalk.red("  Figma source not yet supported."));
      process.exit(1);
    }

    const changes = diffSchemas(committed, components);

    if (changes.length === 0) {
      console.log(chalk.dim("\n  ✨ Nothing to commit — schema is up to date.\n"));
      return;
    }

    console.log(chalk.bold("\n  Changes to commit:"));
    console.log(formatDiff(changes));

    // Save as new committed baseline
    saveSnapshot(projectRoot, "committed", components, opts.source);

    const msg = opts.message ?? `${changes.length} change(s) from ${opts.source}`;
    console.log(chalk.green(`\n  ✅ Committed: ${msg}\n`));
  });
