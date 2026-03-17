/**
 * update command — update the /gitma command file from GitHub.
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const COMMAND_URL =
  "https://raw.githubusercontent.com/lucadebort/gitma/main/commands/gitma.md";

export const updateCommand = new Command("update")
  .description("Update the /gitma command file from GitHub")
  .action(async () => {
    console.log(chalk.bold("  🔄 Updating /gitma command...\n"));

    // Detect where the command file is installed
    const projectRoot = process.cwd();
    const projectPath = join(projectRoot, ".claude", "commands", "gitma.md");
    const globalPath = join(
      process.env.HOME ?? "~",
      ".claude",
      "commands",
      "gitma.md",
    );

    const targets: Array<{ path: string; label: string }> = [];
    if (existsSync(projectPath)) {
      targets.push({ path: projectPath, label: "project" });
    }
    if (existsSync(globalPath)) {
      targets.push({ path: globalPath, label: "global" });
    }

    if (targets.length === 0) {
      console.log(chalk.dim("  No /gitma command file found. Installing to project..."));
      const dir = join(projectRoot, ".claude", "commands");
      mkdirSync(dir, { recursive: true });
      targets.push({ path: projectPath, label: "project" });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(COMMAND_URL, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        console.log(chalk.red(`  Failed to fetch: HTTP ${res.status}`));
        return;
      }

      const content = await res.text();

      for (const target of targets) {
        writeFileSync(target.path, content, "utf-8");
        console.log(chalk.green(`  Updated (${target.label}): ${target.path}`));
      }

      console.log(chalk.green.bold("\n  ✅ Done!\n"));
    } catch {
      console.log(chalk.red("  ❌ Failed to download. Check your network connection."));
    }
  });
