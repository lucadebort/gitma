/**
 * status command — show drift between Figma, code, and committed schema.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { fetchComponents } from "../../figma-adapter/client.js";
import { figmaToSchemas } from "../../figma-adapter/reader.js";
import { formatStatus } from "../formatters/status-printer.js";
import type { SchemaChange } from "../../diff-engine/types.js";

export const statusCommand = new Command("status")
  .description("Show component sync status")
  .option("--no-figma", "Skip Figma read (offline mode)")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);

    // Load committed baseline
    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    // Read current code state
    const codeComponents = readCodeComponents(
      projectRoot,
      config.componentGlobs,
    );

    // Diff code vs committed
    const codeChanges = diffSchemas(committed, codeComponents);

    // Read Figma state if configured
    let figmaChanges: SchemaChange[] = [];
    if (config.figmaFileKey && opts.figma !== false) {
      try {
        console.log(chalk.dim("  Reading Figma..."));
        const { componentSets, components } = await fetchComponents({
          fileKey: config.figmaFileKey,
        });
        const figmaSchemas = figmaToSchemas(componentSets, components);
        figmaChanges = diffSchemas(committed, figmaSchemas);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.yellow(`  Could not read Figma: ${msg}`));
        console.log(chalk.dim("  Use --no-figma to skip, or set FIGMA_ACCESS_TOKEN.\n"));
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
