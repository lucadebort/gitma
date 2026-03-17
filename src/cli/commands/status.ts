/**
 * status command — show drift between Figma, code, and committed schema.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { formatStatus } from "../formatters/status-printer.js";
import type { SchemaChange } from "../../diff-engine/types.js";

export const statusCommand = new Command("status")
  .description("Show component sync status")
  .option("--no-figma", "Skip Figma snapshot comparison")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);

    // Load committed baseline
    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    // Read current code state
    const codeComponents = readCodeComponents(
      projectRoot,
      config.componentGlobs,
      undefined,
      config.framework,
    );

    // Diff code vs committed
    const codeChanges = diffSchemas(committed, codeComponents);

    // Read Figma snapshot (populated by `gitma figma refresh` via Claude Code)
    let figmaChanges: SchemaChange[] = [];
    if (opts.figma !== false) {
      const figmaSnapshot = loadSnapshot(projectRoot, "figma");
      if (figmaSnapshot && figmaSnapshot.length > 0) {
        figmaChanges = diffSchemas(committed, figmaSnapshot);
      } else {
        console.log(chalk.dim("  No Figma snapshot. Use /gitma in Claude Code to refresh.\n"));
      }
    }

    // Find synced components
    const committedNames = new Set(committed.map((c) => c.name));
    const codeNames = new Set(codeComponents.map((c) => c.name));
    const changedNames = new Set([
      ...codeChanges.map((c) => c.componentName),
      ...figmaChanges.map((c) => c.componentName),
    ]);
    const allNames = new Set([...committedNames, ...codeNames]);
    const synced = [...allNames].filter((n) => !changedNames.has(n));

    console.log(formatStatus({
      figmaChanges,
      codeChanges,
      synced,
    }));
  });
