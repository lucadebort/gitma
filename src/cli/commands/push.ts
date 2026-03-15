/**
 * push command — read from one side, commit to schema, then apply to the other.
 *
 * antikarlotta push figma-to-code  → read Figma → commit → apply to code
 * antikarlotta push code-to-figma  → read code → commit → (apply to Figma — future)
 */

import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { loadConfig } from "../../shared/config.js";
import { loadSnapshot, saveSnapshot } from "../../diff-engine/snapshot.js";
import { diffSchemas } from "../../diff-engine/differ.js";
import { readCodeComponents } from "../../code-adapter/reader.js";
import { applyAndSave } from "../../code-adapter/writer.js";
import { readFigmaSchemas } from "../../figma-adapter/read-and-resolve.js";
import { formatDiff } from "../formatters/diff-printer.js";
import { generateDesignerInstructions } from "../../figma-adapter/writer.js";
import type { ComponentSchema } from "../../schema/types.js";

export const pushCommand = new Command("push")
  .description("Read from source, commit to schema, apply to target")
  .argument("<direction>", "Direction: 'figma-to-code' or 'code-to-figma'")
  .option("--apply", "Apply changes (default is dry-run)")
  .option("--component <name>", "Only push changes for a specific component")
  .action(async (direction: string, opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const committed = loadSnapshot(projectRoot, "committed") ?? [];

    if (direction === "figma-to-code") {
      await pushFigmaToCode(projectRoot, config, committed, opts);
    } else if (direction === "code-to-figma") {
      await pushCodeToFigma(projectRoot, config, committed, opts);
    } else {
      console.log(chalk.red(`  Unknown direction: ${direction}. Use 'figma-to-code' or 'code-to-figma'.`));
      process.exit(1);
    }
  });

async function pushFigmaToCode(
  projectRoot: string,
  config: ReturnType<typeof loadConfig>,
  committed: ComponentSchema[],
  opts: { apply?: boolean; component?: string },
) {
  if (!config.figmaFileKey) {
    console.log(chalk.red("  No Figma file key configured. Run `antikarlotta init --figma-key <key>`."));
    process.exit(1);
  }

  // Step 1: Read Figma
  console.log(chalk.dim("  Step 1/3: Reading Figma components..."));
  const figmaSchemas = await readFigmaSchemas(
    { fileKey: config.figmaFileKey },
    { nameMap: config.componentNameMap },
  );

  // Step 2: Diff Figma vs committed
  let figmaChanges = diffSchemas(committed, figmaSchemas);
  if (opts.component) {
    figmaChanges = figmaChanges.filter((c) => c.componentName === opts.component);
  }

  if (figmaChanges.length === 0) {
    console.log(chalk.green("\n  No changes in Figma. Everything is in sync.\n"));
    return;
  }

  console.log(chalk.bold("\n  Step 2/3: Figma changes detected:"));
  console.log(formatDiff(figmaChanges));

  if (!opts.apply) {
    console.log(chalk.dim("\n  Dry run. Use --apply to execute the full push.\n"));
    return;
  }

  // Step 3: Commit Figma state, then apply to code
  console.log(chalk.dim("\n  Step 3/3: Applying to code..."));
  saveSnapshot(projectRoot, "committed", figmaSchemas, "figma");

  const codeComponents = readCodeComponents(projectRoot, config.componentGlobs);

  // Now diff the NEW committed schema against current code
  let codeChanges = diffSchemas(codeComponents, figmaSchemas);
  if (opts.component) {
    codeChanges = codeChanges.filter((c) => c.componentName === opts.component);
  }

  if (codeChanges.length === 0) {
    console.log(chalk.green("  Code is already in sync with Figma. Schema updated.\n"));
    return;
  }

  let totalApplied = 0;

  const byComponent = new Map<string, typeof codeChanges>();
  for (const change of codeChanges) {
    const group = byComponent.get(change.componentName) ?? [];
    group.push(change);
    byComponent.set(change.componentName, group);
  }

  for (const [componentName, componentChanges] of byComponent) {
    const targetSchema = figmaSchemas.find((c) => c.name === componentName);
    if (!targetSchema) continue;

    const codeComponent = codeComponents.find((c) => c.name === componentName);
    const codePath = targetSchema.codePath ?? codeComponent?.codePath;
    if (!codePath) {
      console.log(chalk.yellow(`  Skipping ${componentName}: no code path found.`));
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

    if (result.appliedChanges.length > 0) {
      console.log(chalk.green(`  ${componentName}: ${result.appliedChanges.length} change(s) → ${codePath}`));
    }
  }

  console.log(chalk.green(`\n  Push complete: schema updated, ${totalApplied} code change(s) applied.\n`));
}

async function pushCodeToFigma(
  projectRoot: string,
  config: ReturnType<typeof loadConfig>,
  committed: ComponentSchema[],
  opts: { apply?: boolean; component?: string },
) {
  // Step 1: Read code
  console.log(chalk.dim("  Step 1/3: Reading code components..."));
  const codeComponents = readCodeComponents(projectRoot, config.componentGlobs);

  // Step 2: Diff code vs committed
  let changes = diffSchemas(committed, codeComponents);
  if (opts.component) {
    changes = changes.filter((c) => c.componentName === opts.component);
  }

  if (changes.length === 0) {
    console.log(chalk.green("\n  No changes in code. Everything is in sync.\n"));
    return;
  }

  console.log(chalk.bold("\n  Step 2/3: Code changes detected:"));
  console.log(formatDiff(changes));

  if (!opts.apply) {
    console.log(chalk.dim("\n  Dry run. Use --apply to execute the full push.\n"));
    return;
  }

  // Step 3: Commit code state and generate designer instructions
  console.log(chalk.dim("\n  Step 3/3: Updating schema..."));
  saveSnapshot(projectRoot, "committed", codeComponents, "code");

  // Generate instructions for the designer
  const instructions = generateDesignerInstructions(changes);

  if (instructions.length > 0) {
    console.log(chalk.bold("\n  Designer instructions (apply in Figma):\n"));
    for (const inst of instructions) {
      console.log(chalk.blue(`  ${inst.componentName}:`));
      for (const line of inst.instructions) {
        console.log(chalk.dim(`    → ${line}`));
      }
    }
    console.log(chalk.dim("\n  These changes require manual application in Figma."));
    console.log(chalk.dim("  Component properties cannot be modified via REST API.\n"));
  } else {
    console.log(chalk.green("\n  Schema updated from code.\n"));
  }
}
