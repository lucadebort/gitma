/**
 * preview command — generate an interactive design system preview.
 *
 * Inspects the Figma snapshot for components and variables,
 * then renders a self-contained HTML page from the bundled template.
 */

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { exec } from "node:child_process";
import { assemblePreviewData } from "../../preview/assemble.js";
import { renderPreview } from "../../preview/render.js";

export const previewCommand = new Command("preview")
  .description("Generate interactive design system preview")
  .option("-o, --output <path>", "Output file path", ".gitma/preview/index.html")
  .option("--template <path>", "Custom template HTML file")
  .option("--no-open", "Skip opening in browser")
  .action(async (opts) => {
    const projectRoot = process.cwd();

    // 1. Inspect & assemble
    console.log(chalk.dim("\n  🔍 Inspecting Figma data...\n"));

    const data = assemblePreviewData(projectRoot);
    const { inspect } = data;

    // Report what was found
    if (!inspect.hasComponents && !inspect.hasVariables) {
      console.log(chalk.yellow("  ⚠️  No Figma data found."));
      console.log(chalk.dim("  Run /gitma to pull from Figma first, or use:"));
      console.log(chalk.dim("    gitma figma import <snapshot.json>\n"));
      return;
    }

    if (inspect.hasComponents) {
      console.log(chalk.green(`  📦 Components: ${inspect.componentCount}`));
    } else {
      console.log(chalk.dim("  Components: none found"));
    }

    if (inspect.hasVariables) {
      console.log(chalk.green(`  🎨 Variables: ${inspect.variableCount} (${inspect.collectionCount} collections)`));
      console.log(chalk.dim(`  Modes: ${inspect.modeNames.join(", ")}`));
    } else {
      console.log(chalk.dim("  Variables: none found"));
    }

    console.log();

    // 2. Render
    const html = renderPreview(data, projectRoot, opts.template);

    // 3. Write output
    const outputPath = join(projectRoot, opts.output);
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    writeFileSync(outputPath, html, "utf-8");

    console.log(chalk.green(`  ✅ Preview: ${opts.output}`));

    // 4. Open in browser
    if (opts.open !== false) {
      const openCmd = process.platform === "darwin" ? "open"
        : process.platform === "win32" ? "start"
        : "xdg-open";
      exec(`${openCmd} "${outputPath}"`);
      console.log(chalk.dim("  🌐 Opened in browser.\n"));
    } else {
      console.log();
    }
  });
