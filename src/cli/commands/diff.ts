/**
 * diff command — show detailed changes between schema states.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { readFigmaSchemas } from "../../figma-adapter/read-and-resolve.js";
import { formatDiff } from "../formatters/diff-printer.js";

export const diffCommand = new Command("diff")
  .description("Show detailed component diff")
  .option("--code", "Show code vs committed diff")
  .option("--figma", "Show Figma vs committed diff")
  .option("--component <name>", "Filter by component name")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    if (opts.code || (!opts.code && !opts.figma)) {
      const codeComponents = readCodeComponents(
        projectRoot,
        config.componentGlobs,
      );
      let changes = diffSchemas(committed, codeComponents);

      if (opts.component) {
        changes = changes.filter((c) => c.componentName === opts.component);
      }

      console.log(chalk.bold("\n  Code → Schema diff:"));
      console.log(formatDiff(changes));
    }

    if (opts.figma) {
      if (!config.figmaFileKey) {
        console.log(chalk.red("\n  No Figma file key configured."));
      } else {
        try {
          console.log(chalk.dim("  Reading Figma..."));
          const figmaSchemas = await readFigmaSchemas(
            { fileKey: config.figmaFileKey },
            { nameMap: config.componentNameMap },
          );
          let changes = diffSchemas(committed, figmaSchemas);

          if (opts.component) {
            changes = changes.filter((c) => c.componentName === opts.component);
          }

          console.log(chalk.bold("\n  Figma → Schema diff:"));
          console.log(formatDiff(changes));
        } catch (err) {
          console.log(chalk.red(`\n  Could not read Figma: ${err instanceof Error ? err.message : String(err)}`));
        }
      }
    }

    console.log();
  });
