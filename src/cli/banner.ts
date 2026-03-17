/**
 * ASCII art banner and version check.
 */

import chalk from "chalk";

const BANNER = `
 ______     __     ______   __    __     ______
/\\  ___\\   /\\ \\   /\\__  _\\ /\\ "-./  \\   /\\  __ \\
\\ \\ \\__ \\  \\ \\ \\  \\/_/\\ \\/ \\ \\ \\-./\\ \\  \\ \\  __ \\
 \\ \\_____\\  \\ \\_\\    \\ \\_\\  \\ \\_\\ \\ \\_\\  \\ \\_\\ \\_\\
  \\/_____/   \\/_/     \\/_/   \\/_/  \\/_/   \\/_/\\/_/
`;

const VERSION_URL =
  "https://raw.githubusercontent.com/lucadebort/gitma/main/VERSION";

export function printBanner(version: string): void {
  console.log(chalk.bold(BANNER));
  console.log(chalk.dim(`  figma ↔ code. zero drift.                      v${version}`));
  console.log();
}

/**
 * Check GitHub for latest version. Non-blocking — prints a notice
 * if a newer version is available, silently does nothing on error.
 *
 * Reads a VERSION file from the repo (single line, e.g. "0.2.0").
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(VERSION_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return;

    const latest = (await res.text()).trim();
    if (!latest || !latest.match(/^\d+\.\d+\.\d+$/)) return;

    if (latest !== currentVersion && isNewer(latest, currentVersion)) {
      console.log(
        chalk.yellow(`  🆕 Update available: ${currentVersion} → ${latest}`),
      );
      console.log(
        chalk.dim(`  Run ${chalk.cyan("/gitma update")} or ${chalk.cyan("gitma update")} to upgrade.\n`),
      );
    }
  } catch {
    // Network error, timeout — silently ignore
  }
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}
