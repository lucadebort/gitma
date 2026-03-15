/**
 * Post-write formatting — runs the project's configured formatter on modified files.
 */

import { execSync } from "node:child_process";

/**
 * Format a file using the project's configured format command.
 * No-op if formatCommand is not set.
 */
export function formatFile(filePath: string, formatCommand?: string): void {
  if (!formatCommand) return;

  try {
    execSync(`${formatCommand} ${filePath}`, {
      stdio: "pipe",
      timeout: 10_000,
    });
  } catch {
    // Formatting is best-effort — don't fail the write
  }
}
