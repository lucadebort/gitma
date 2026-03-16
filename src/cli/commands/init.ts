/**
 * init command — interactive setup of .gitma/ in a project.
 *
 * When run without flags, asks questions interactively.
 * When run with flags, uses them directly (for scripting/CI).
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { saveConfig, configExists, type ProjectConfig } from "../../shared/config.js";
import { saveSnapshot } from "../../diff-engine/snapshot.js";
import readlineSync from "readline-sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ask(question: string, defaultValue?: string): string {
  const suffix = defaultValue ? chalk.dim(` (${defaultValue})`) : "";
  const answer = readlineSync.question(`  ${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

function confirm(question: string, defaultYes: boolean = true): boolean {
  const suffix = defaultYes ? chalk.dim(" (Y/n)") : chalk.dim(" (y/N)");
  const answer = readlineSync.question(`  ${question}${suffix}: `).trim().toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

function extractFileKey(input: string): string {
  // Accept full URL or just the key
  const match = input.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  return input.trim();
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const initCommand = new Command("init")
  .description("Initialize gitma in the current project")
  .option("--figma-key <key>", "Figma file key (skip interactive)")
  .option("--globs <patterns...>", "Component file glob patterns")
  .option("--token-file <path>", "Path to .tokens.json file")
  .option("--token-format <format>", "Token format in code")
  .action(async (opts) => {
    const projectRoot = process.cwd();

    // Check if already initialized
    if (configExists(projectRoot)) {
      if (!opts.figmaKey) {
        const overwrite = confirm("Gitma is already initialized. Overwrite config?", false);
        if (!overwrite) {
          console.log(chalk.dim("\n  Aborted.\n"));
          return;
        }
      }
    }

    console.log(chalk.bold("\n  Welcome to Gitma\n"));
    console.log(chalk.dim("  Bidirectional sync between Figma and code.\n"));

    // Interactive or flag-based
    const isInteractive = !opts.figmaKey;

    // --- Figma file ---
    let figmaFileKey: string | undefined;
    if (isInteractive) {
      console.log(chalk.bold("  1. Figma file\n"));
      const figmaInput = ask("Paste your Figma file URL (or file key)");
      if (figmaInput) {
        figmaFileKey = extractFileKey(figmaInput);
        console.log(chalk.green(`     File key: ${figmaFileKey}\n`));
      } else {
        console.log(chalk.dim("     Skipped — you can add it later in .gitma/config.json\n"));
      }
    } else {
      figmaFileKey = opts.figmaKey;
    }

    // --- Component globs ---
    let componentGlobs: string[];
    if (isInteractive) {
      console.log(chalk.bold("  2. Component files\n"));

      // Auto-detect common patterns
      const detected = detectComponentPaths(projectRoot);
      if (detected) {
        console.log(chalk.dim(`     Detected: ${detected}`));
        const useDetected = confirm(`Use "${detected}"?`);
        componentGlobs = useDetected ? [detected] : [ask("Glob pattern for component files", "src/components/**/*.tsx")];
      } else {
        componentGlobs = [ask("Glob pattern for component files", "src/components/**/*.tsx")];
      }
      console.log();
    } else {
      componentGlobs = opts.globs ?? ["src/components/**/*.tsx"];
    }

    // --- Token file ---
    let tokenFile: string | undefined;
    let tokenFormat: "css-vars" | "tailwind" = "css-vars";
    if (isInteractive) {
      console.log(chalk.bold("  3. Design tokens\n"));

      // Auto-detect token files
      const detectedTokens = detectTokenFile(projectRoot);
      if (detectedTokens) {
        console.log(chalk.dim(`     Found: ${detectedTokens}`));
        const useDetected = confirm(`Use "${detectedTokens}"?`);
        tokenFile = useDetected ? detectedTokens : undefined;
      } else {
        const hasTokens = confirm("Do you have a .tokens.json file?", false);
        if (hasTokens) {
          tokenFile = ask("Path to token file", "tokens.tokens.json");
        }
      }

      if (tokenFile) {
        const useTailwind = confirm("Are you using Tailwind CSS?", false);
        tokenFormat = useTailwind ? "tailwind" : "css-vars";
      }
      console.log();
    } else {
      tokenFile = opts.tokenFile;
      tokenFormat = opts.tokenFormat ?? "css-vars";
    }

    // --- Formatter ---
    let formatCommand: string | undefined;
    if (isInteractive) {
      console.log(chalk.bold("  4. Code formatting\n"));

      const hasPrettier = existsSync(join(projectRoot, ".prettierrc"))
        || existsSync(join(projectRoot, ".prettierrc.json"))
        || existsSync(join(projectRoot, "prettier.config.js"))
        || existsSync(join(projectRoot, "prettier.config.mjs"));

      if (hasPrettier) {
        console.log(chalk.dim("     Detected Prettier config."));
        const usePrettier = confirm('Use "npx prettier --write" after code changes?');
        if (usePrettier) formatCommand = "npx prettier --write";
      } else {
        const hasFormatter = confirm("Do you have a code formatter you want to run after changes?", false);
        if (hasFormatter) {
          formatCommand = ask("Format command (applied to each modified file)");
        }
      }
      console.log();
    }

    // --- .env ---
    if (isInteractive && figmaFileKey) {
      const envPath = join(projectRoot, ".env");
      if (!existsSync(envPath)) {
        console.log(chalk.bold("  5. Figma access token\n"));
        console.log(chalk.dim("     Create a token at: Figma → Settings → Security → Personal access tokens"));
        console.log(chalk.dim("     Scopes needed: file_content:read, library_assets:read\n"));

        const token = ask("Paste your Figma access token (or press Enter to skip)");
        if (token) {
          writeFileSync(envPath, `FIGMA_ACCESS_TOKEN=${token}\n`, "utf-8");
          console.log(chalk.green("     Saved to .env\n"));
        } else {
          console.log(chalk.dim("     Skipped — create .env with FIGMA_ACCESS_TOKEN=<token> later\n"));
        }
      }
    }

    // --- Save config ---
    const config: ProjectConfig = {
      figmaFileKey,
      componentGlobs,
      tokenFile,
      tokenFormat,
      formatCommand,
    };

    saveConfig(projectRoot, config);
    saveSnapshot(projectRoot, "committed", [], "manual");

    // --- Summary ---
    console.log(chalk.green.bold("  Done!\n"));
    console.log(chalk.dim("  Created:"));
    console.log(chalk.dim("    .gitma/config.json"));
    console.log(chalk.dim("    .gitma/snapshots/committed.json"));
    console.log();

    // --- Next steps ---
    console.log(chalk.bold("  Next steps:\n"));
    console.log(`    1. ${chalk.cyan("gitma status")}           See what's in your code and Figma`);
    console.log(`    2. ${chalk.cyan('gitma commit -m "init"')}  Set your code as the baseline`);
    console.log(`    3. ${chalk.cyan("gitma diff --figma")}      See what's different in Figma`);
    console.log();

    if (!figmaFileKey) {
      console.log(chalk.yellow("  Note: Add your Figma file key to .gitma/config.json to enable Figma sync.\n"));
    }
  });

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

function detectComponentPaths(projectRoot: string): string | null {
  const candidates = [
    "src/components",
    "src/ui",
    "components",
    "app/components",
    "lib/components",
  ];

  for (const dir of candidates) {
    if (existsSync(join(projectRoot, dir))) {
      return `${dir}/**/*.tsx`;
    }
  }
  return null;
}

function detectTokenFile(projectRoot: string): string | null {
  const candidates = [
    "tokens.tokens.json",
    "tokens.json",
    "design-tokens.tokens.json",
    "src/tokens.tokens.json",
    "src/tokens/tokens.tokens.json",
  ];

  for (const file of candidates) {
    if (existsSync(join(projectRoot, file))) {
      return file;
    }
  }
  return null;
}
