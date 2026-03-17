/**
 * Status output — inspired by git status.
 */

import chalk from "chalk";
import type { SchemaChange } from "../../diff-engine/types.js";

export interface StatusSummary {
  figmaChanges: SchemaChange[];
  codeChanges: SchemaChange[];
  synced: string[];
}

export function formatStatus(status: StatusSummary): string {
  const lines: string[] = [];

  lines.push(chalk.bold("\n  📊 gitma status\n"));

  // Synced components
  if (status.synced.length > 0) {
    lines.push(chalk.green(`  ${status.synced.length} component(s) in sync:`));
    for (const name of status.synced) {
      lines.push(chalk.green(`    ✓ ${name}`));
    }
  }

  // Figma drift
  if (status.figmaChanges.length > 0) {
    const components = new Set(status.figmaChanges.map((c) => c.componentName));
    lines.push(chalk.blue(`\n  ${components.size} component(s) with Figma drift:`));
    for (const name of components) {
      const count = status.figmaChanges.filter((c) => c.componentName === name).length;
      lines.push(chalk.blue(`    ↓ ${name} (${count} change${count > 1 ? "s" : ""})`));
    }
  }

  // Code drift
  if (status.codeChanges.length > 0) {
    const components = new Set(status.codeChanges.map((c) => c.componentName));
    lines.push(chalk.yellow(`\n  ${components.size} component(s) with code drift:`));
    for (const name of components) {
      const count = status.codeChanges.filter((c) => c.componentName === name).length;
      lines.push(chalk.yellow(`    ↑ ${name} (${count} change${count > 1 ? "s" : ""})`));
    }
  }

  // No changes
  if (status.figmaChanges.length === 0 && status.codeChanges.length === 0 && status.synced.length > 0) {
    lines.push(chalk.green("\n  ✨ Everything is in sync."));
  }

  if (status.figmaChanges.length === 0 && status.codeChanges.length === 0 && status.synced.length === 0) {
    lines.push(chalk.dim("  No components tracked. Run `gitma init` to get started."));
  }

  lines.push("");
  return lines.join("\n");
}
