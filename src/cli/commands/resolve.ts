/**
 * resolve command — interactive conflict resolution.
 *
 * Shows conflicts from three-way merge and lets the user pick a resolution.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot, saveSnapshot } from "../../diff-engine/snapshot.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { mergeSchemas } from "../../diff-engine/merge.js";
import { formatConflicts } from "../formatters/diff-printer.js";
import type { ComponentSchema } from "../../schema/types.js";
import type { Conflict } from "../../diff-engine/types.js";

export const resolveCommand = new Command("resolve")
  .description("Show and resolve merge conflicts")
  .option("--take <side>", "Auto-resolve all conflicts: 'figma' or 'code'")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);

    const committed = loadSnapshot(projectRoot, "committed") ?? [];
    const figmaSnapshot = loadSnapshot(projectRoot, "figma");
    const codeComponents = readCodeComponents(projectRoot, config.componentGlobs);

    if (!figmaSnapshot) {
      console.log(chalk.dim("\n  No Figma snapshot found. Run `gitma pull figma` first.\n"));
      return;
    }

    const { merged, conflicts } = mergeSchemas(committed, figmaSnapshot, codeComponents);

    if (conflicts.length === 0) {
      console.log(chalk.green("\n  ✨ No conflicts. All changes can be merged cleanly.\n"));

      if (merged.length > 0) {
        console.log(chalk.dim(`  ${merged.length} non-conflicting change(s) ready to commit.`));
        console.log(chalk.dim("  Run `gitma commit` to apply.\n"));
      }
      return;
    }

    console.log(chalk.bold(`\n  ⚠️  ${conflicts.length} conflict(s) found:\n`));
    console.log(formatConflicts(conflicts));

    if (opts.take) {
      if (opts.take !== "figma" && opts.take !== "code") {
        console.log(chalk.red(`  Invalid side: ${opts.take}. Use 'figma' or 'code'.\n`));
        return;
      }

      console.log(chalk.bold(`\n  Auto-resolving: taking ${opts.take} for all conflicts.\n`));

      // Build the resolved schema by taking the chosen side
      const resolvedComponents = opts.take === "figma"
        ? figmaSnapshot
        : codeComponents;

      saveSnapshot(projectRoot, "committed", resolvedComponents, opts.take as "figma" | "code");
      console.log(chalk.green(`  ✅ Resolved ${conflicts.length} conflict(s). Schema updated from ${opts.take}.\n`));
    } else {
      console.log(chalk.dim("\n  To auto-resolve, run:"));
      console.log(chalk.dim("    gitma resolve --take figma   (take all Figma versions)"));
      console.log(chalk.dim("    gitma resolve --take code    (take all code versions)\n"));
    }
  });
