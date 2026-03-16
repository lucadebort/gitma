/**
 * figma command — manage Figma data snapshots.
 *
 * gitma figma refresh   → read raw Figma data from stdin, save as snapshot
 * gitma figma status    → show figma snapshot info
 *
 * Gitma doesn't connect to Figma directly. Claude Code reads Figma
 * via figma-console and pipes the data to this command.
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { loadConfig } from "../../shared/config.js";
import { saveSnapshot, loadSnapshot } from "../../diff-engine/snapshot.js";
import type { RawFigmaData } from "../../figma-adapter/client.js";
import { rawFigmaToSchemas } from "../../figma-adapter/read-and-resolve.js";

export const figmaCommand = new Command("figma")
  .description("Manage Figma data snapshots");

// --- figma refresh ---

figmaCommand
  .command("refresh")
  .description("Import raw Figma data and save as snapshot")
  .option("--file <path>", "Read from file instead of stdin")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);

    let json: string;

    if (opts.file) {
      json = readFileSync(opts.file, "utf-8");
    } else {
      // Read from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      json = Buffer.concat(chunks).toString("utf-8");
    }

    let raw: RawFigmaData;
    try {
      raw = JSON.parse(json);
    } catch {
      console.log(chalk.red("  Invalid JSON input. Expected RawFigmaData format."));
      process.exit(1);
    }

    if (!raw.componentSets && !raw.components) {
      console.log(chalk.red("  Missing componentSets or components in input data."));
      process.exit(1);
    }

    const schemas = rawFigmaToSchemas(raw, {
      nameConfig: { nameMap: config.componentNameMap },
      propertyMap: config.propertyMap,
    });

    saveSnapshot(projectRoot, "figma", schemas, "figma");

    console.log(chalk.green(`  Figma snapshot saved: ${schemas.length} component(s)`));

    // Show summary
    const withVariants = schemas.filter((s) => s.variants.length > 0).length;
    const withSlots = schemas.filter((s) => s.slots.length > 0).length;
    const totalProps = schemas.reduce((sum, s) => sum + s.props.length, 0);

    console.log(chalk.dim(`    ${withVariants} with variants, ${withSlots} with slots, ${totalProps} total props`));
  });

// --- figma status ---

figmaCommand
  .command("status")
  .description("Show Figma snapshot info")
  .action(() => {
    const projectRoot = process.cwd();
    const snapshot = loadSnapshot(projectRoot, "figma");

    if (!snapshot || snapshot.length === 0) {
      console.log(chalk.dim("\n  No Figma snapshot. Run the /gitma skill in Claude Code to refresh.\n"));
      return;
    }

    console.log(chalk.bold(`\n  Figma snapshot: ${snapshot.length} component(s)\n`));
    for (const comp of snapshot) {
      const parts: string[] = [];
      if (comp.props.length) parts.push(`${comp.props.length} props`);
      if (comp.variants.length) parts.push(`${comp.variants.length} variants`);
      if (comp.slots.length) parts.push(`${comp.slots.length} slots`);
      if (comp.states.length) parts.push(`${comp.states.length} states`);
      console.log(chalk.dim(`    ${comp.name}: ${parts.join(", ") || "empty"}`));
    }
    console.log();
  });
