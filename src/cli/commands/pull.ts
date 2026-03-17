/**
 * pull command — apply committed schema changes to code or Figma.
 *
 * gitma pull figma  → read Figma snapshot, diff against committed, show changes
 * gitma pull code   → apply committed schema to code files
 */

import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot, saveSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { applyAndSave } from "../../code-adapter/writer.js";
import { formatDiff } from "../formatters/diff-printer.js";
import type { ComponentSchema } from "../../schema/types.js";

export const pullCommand = new Command("pull")
  .description("Pull changes from a source into the schema or code")
  .argument("<source>", "Source to pull from: 'figma' or 'code'")
  .option("--apply", "Apply changes (default is dry-run)")
  .option("--component <name>", "Only pull changes for a specific component")
  .action(async (source: string, opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    if (source === "figma") {
      await pullFromFigma(projectRoot, config, committed, opts);
    } else if (source === "code") {
      await pullFromCode(projectRoot, config, committed, opts);
    } else {
      console.log(chalk.red(`  Unknown source: ${source}. Use 'figma' or 'code'.`));
      process.exit(1);
    }
  });

async function pullFromFigma(
  projectRoot: string,
  config: ReturnType<typeof loadConfig>,
  committed: ComponentSchema[],
  opts: { apply?: boolean; component?: string },
) {
  const figmaSchemas = loadSnapshot(projectRoot, "figma");

  if (!figmaSchemas || figmaSchemas.length === 0) {
    console.log(chalk.red("  No Figma snapshot. Use /gitma in Claude Code to refresh."));
    process.exit(1);
  }

  let changes = diffSchemas(committed, figmaSchemas);

  if (opts.component) {
    changes = changes.filter((c) => c.componentName === opts.component);
  }

  if (changes.length === 0) {
    console.log(chalk.green("\n  ✨ Figma is in sync with committed schema.\n"));
    return;
  }

  console.log(chalk.bold("\n  Figma → Schema diff:"));
  console.log(formatDiff(changes));

  if (opts.apply) {
    saveSnapshot(projectRoot, "committed", figmaSchemas, "figma");
    console.log(chalk.green(`\n  ✅ Pulled ${changes.length} change(s) from Figma into committed schema.\n`));
  } else {
    console.log(chalk.dim("\n  Dry run. Use --apply to commit these changes.\n"));
  }
}

async function pullFromCode(
  projectRoot: string,
  config: ReturnType<typeof loadConfig>,
  committed: ComponentSchema[],
  opts: { apply?: boolean; component?: string },
) {
  const codeComponents = readCodeComponents(projectRoot, config.componentGlobs);

  let changes = diffSchemas(codeComponents, committed);

  if (opts.component) {
    changes = changes.filter((c) => c.componentName === opts.component);
  }

  if (changes.length === 0) {
    console.log(chalk.green("\n  ✨ Code is in sync with committed schema.\n"));
    return;
  }

  console.log(chalk.bold("\n  Schema → Code changes to apply:"));
  console.log(formatDiff(changes));

  if (!opts.apply) {
    console.log(chalk.dim("\n  Dry run. Use --apply to write changes to files.\n"));
    return;
  }

  const byComponent = new Map<string, typeof changes>();
  for (const change of changes) {
    const group = byComponent.get(change.componentName) ?? [];
    group.push(change);
    byComponent.set(change.componentName, group);
  }

  let totalApplied = 0;
  let totalSkipped = 0;

  for (const [componentName, componentChanges] of byComponent) {
    const targetSchema = committed.find((c) => c.name === componentName);
    if (!targetSchema) continue;

    const codeComponent = codeComponents.find((c) => c.name === componentName);
    const codePath = targetSchema.codePath ?? codeComponent?.codePath;
    if (!codePath) {
      console.log(chalk.yellow(`  Skipping ${componentName}: no code path found.`));
      totalSkipped += componentChanges.length;
      continue;
    }

    const absolutePath = resolve(projectRoot, codePath);

    const result = applyAndSave(
      absolutePath,
      { targetSchema, changes: componentChanges },
      undefined,
      config.formatCommand,
    );

    totalApplied += result.appliedChanges.length;
    totalSkipped += result.skippedChanges.length;

    if (result.appliedChanges.length > 0) {
      console.log(chalk.green(`  ${componentName}: ${result.appliedChanges.length} change(s) applied → ${codePath}`));
    }
    if (result.skippedChanges.length > 0) {
      console.log(chalk.yellow(`  ${componentName}: ${result.skippedChanges.length} change(s) skipped`));
      for (const skip of result.skippedChanges) {
        console.log(chalk.dim(`    - ${skip}`));
      }
    }
  }

  console.log(chalk.green(`\n  ✅ Done: ${totalApplied} applied, ${totalSkipped} skipped.\n`));
}
