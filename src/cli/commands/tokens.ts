/**
 * tokens command — sync W3C Design Tokens between .tokens.json and Figma variables.
 *
 * gitma tokens status             → show token drift
 * gitma tokens pull figma         → Figma variables (from snapshot) → .tokens.json
 * gitma tokens push figma         → .tokens.json → write ops for Claude Code
 * gitma tokens validate           → validate .tokens.json against W3C spec
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../shared/config.js";
import type { DesignTokenFile } from "../../schema/tokens.js";
import { flattenTokens } from "../../schema/tokens.js";
import { tokensToFigmaVariables, figmaVariablesToTokens } from "../../figma-adapter/token-bridge.js";
import type { RawFigmaData } from "../../figma-adapter/client.js";
import { convertRawVariables } from "../../figma-adapter/client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadTokenFile(projectRoot: string, tokenPath: string): DesignTokenFile | null {
  const absPath = resolve(projectRoot, tokenPath);
  if (!existsSync(absPath)) return null;
  const json = readFileSync(absPath, "utf-8");
  return JSON.parse(json) as DesignTokenFile;
}

function saveTokenFile(projectRoot: string, tokenPath: string, tokens: DesignTokenFile): void {
  const absPath = resolve(projectRoot, tokenPath);
  writeFileSync(absPath, JSON.stringify(tokens, null, 2) + "\n", "utf-8");
}

function loadFigmaVariableSnapshot(projectRoot: string): RawFigmaData | null {
  const path = resolve(projectRoot, ".gitma", "figma-variables.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const tokensCommand = new Command("tokens")
  .description("Sync design tokens between .tokens.json and Figma variables");

// --- tokens status ---

tokensCommand
  .command("status")
  .description("Show token file status")
  .action(async () => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const tokenPath = config.tokenFile ?? "tokens.tokens.json";

    const tokenFile = loadTokenFile(projectRoot, tokenPath);

    if (!tokenFile) {
      console.log(chalk.dim(`\n  No token file found at ${tokenPath}.`));
      console.log(chalk.dim(`  Create one or set tokenFile in .gitma/config.json.\n`));
      return;
    }

    try {
      const resolved = flattenTokens(tokenFile);
      console.log(chalk.bold(`\n  Token file: ${tokenPath}`));
      console.log(chalk.green(`  ${resolved.length} token(s) resolved successfully.\n`));

      const byType = new Map<string, number>();
      for (const token of resolved) {
        byType.set(token.type, (byType.get(token.type) ?? 0) + 1);
      }

      for (const [type, count] of [...byType.entries()].sort()) {
        console.log(chalk.dim(`    ${type}: ${count}`));
      }
      console.log();
    } catch (err) {
      console.log(chalk.red(`\n  Error resolving tokens: ${err instanceof Error ? err.message : String(err)}\n`));
    }
  });

// --- tokens validate ---

tokensCommand
  .command("validate")
  .description("Validate .tokens.json against W3C spec")
  .action(async () => {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const tokenPath = config.tokenFile ?? "tokens.tokens.json";

    const tokenFile = loadTokenFile(projectRoot, tokenPath);

    if (!tokenFile) {
      console.log(chalk.red(`\n  Token file not found: ${tokenPath}\n`));
      return;
    }

    const errors: string[] = [];

    try {
      const resolved = flattenTokens(tokenFile);
      console.log(chalk.green(`\n  Valid: ${resolved.length} token(s) resolved.\n`));

      for (const token of resolved) {
        if (!token.type) {
          errors.push(`Token "${token.path}" has no type`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    if (errors.length > 0) {
      console.log(chalk.red(`  ${errors.length} issue(s):\n`));
      for (const error of errors) {
        console.log(chalk.red(`    - ${error}`));
      }
      console.log();
    }
  });

// --- tokens pull figma ---

tokensCommand
  .command("pull")
  .argument("<source>", "Source: 'figma'")
  .option("--apply", "Write to .tokens.json (default is dry-run)")
  .description("Pull tokens from Figma variables snapshot into .tokens.json")
  .action(async (source: string, opts) => {
    if (source !== "figma") {
      console.log(chalk.red(`  Unknown source: ${source}. Use 'figma'.\n`));
      return;
    }

    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const tokenPath = config.tokenFile ?? "tokens.tokens.json";

    const rawData = loadFigmaVariableSnapshot(projectRoot);
    if (!rawData) {
      console.log(chalk.red("  No Figma variable snapshot. Use /gitma in Claude Code to refresh.\n"));
      return;
    }

    const { variables, collections } = convertRawVariables(rawData);

    if (variables.length === 0) {
      console.log(chalk.dim("\n  No variables found in Figma snapshot.\n"));
      return;
    }

    const tokenFile = figmaVariablesToTokens(variables, collections);
    const resolved = flattenTokens(tokenFile);

    console.log(chalk.bold(`\n  Found ${variables.length} Figma variable(s) → ${resolved.length} token(s).\n`));

    const byType = new Map<string, number>();
    for (const token of resolved) {
      byType.set(token.type, (byType.get(token.type) ?? 0) + 1);
    }
    for (const [type, count] of [...byType.entries()].sort()) {
      console.log(chalk.dim(`    ${type}: ${count}`));
    }

    if (opts.apply) {
      saveTokenFile(projectRoot, tokenPath, tokenFile);
      console.log(chalk.green(`\n  Written to ${tokenPath}.\n`));
    } else {
      console.log(chalk.dim(`\n  Dry run. Use --apply to write to ${tokenPath}.\n`));
    }
  });

// --- tokens push figma ---

tokensCommand
  .command("push")
  .argument("<target>", "Target: 'figma'")
  .option("--apply", "Save write ops for Claude Code (default is dry-run)")
  .description("Push .tokens.json to Figma variables via Claude Code")
  .action(async (target: string, opts) => {
    if (target !== "figma") {
      console.log(chalk.red(`  Unknown target: ${target}. Use 'figma'.\n`));
      return;
    }

    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const tokenPath = config.tokenFile ?? "tokens.tokens.json";

    const tokenFile = loadTokenFile(projectRoot, tokenPath);
    if (!tokenFile) {
      console.log(chalk.red(`\n  Token file not found: ${tokenPath}\n`));
      return;
    }

    const figmaVars = tokensToFigmaVariables(tokenFile);

    if (figmaVars.length === 0) {
      console.log(chalk.dim("\n  No tokens to push (composite types are skipped).\n"));
      return;
    }

    console.log(chalk.bold(`\n  ${figmaVars.length} variable(s) to push to Figma:\n`));

    const byCollection = new Map<string, number>();
    for (const v of figmaVars) {
      byCollection.set(v.collectionName, (byCollection.get(v.collectionName) ?? 0) + 1);
    }
    for (const [collection, count] of [...byCollection.entries()].sort()) {
      console.log(chalk.dim(`    ${collection}: ${count} variable(s)`));
    }

    if (!opts.apply) {
      console.log(chalk.dim("\n  Dry run. Use --apply to save write ops.\n"));
      return;
    }

    // Save variable write ops for Claude Code to apply
    const opsPath = resolve(projectRoot, ".gitma", "figma-token-ops.json");
    writeFileSync(opsPath, JSON.stringify(figmaVars, null, 2) + "\n", "utf-8");

    console.log(chalk.green(`\n  Saved to .gitma/figma-token-ops.json`));
    console.log(chalk.dim("  Claude Code will apply these via figma_execute.\n"));
  });
