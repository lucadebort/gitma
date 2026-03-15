/**
 * Staging area — stage specific changes before committing.
 *
 * Staged changes are stored as JSON in .antikarlotta/staging/
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { SchemaChange } from "./types.js";

const STAGING_DIR = ".antikarlotta/staging";

function stagingDir(projectRoot: string): string {
  return join(projectRoot, STAGING_DIR);
}

function ensureDir(projectRoot: string): void {
  const dir = stagingDir(projectRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function changeId(change: SchemaChange): string {
  // Create a stable ID from the change
  return `${change.componentName}__${change.target}__${change.fieldPath}`.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Stage a single change */
export function stageChange(projectRoot: string, change: SchemaChange): void {
  ensureDir(projectRoot);
  const id = changeId(change);
  const path = join(stagingDir(projectRoot), `${id}.json`);
  writeFileSync(path, JSON.stringify(change, null, 2) + "\n", "utf-8");
}

/** Stage multiple changes */
export function stageChanges(projectRoot: string, changes: SchemaChange[]): void {
  for (const change of changes) {
    stageChange(projectRoot, change);
  }
}

/** Get all staged changes */
export function getStagedChanges(projectRoot: string): SchemaChange[] {
  const dir = stagingDir(projectRoot);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const json = readFileSync(join(dir, f), "utf-8");
    return JSON.parse(json) as SchemaChange;
  });
}

/** Unstage a specific change by component name and field path */
export function unstageChange(
  projectRoot: string,
  componentName: string,
  fieldPath: string,
): boolean {
  const dir = stagingDir(projectRoot);
  if (!existsSync(dir)) return false;

  const staged = getStagedChanges(projectRoot);
  const target = staged.find(
    (c) => c.componentName === componentName && c.fieldPath === fieldPath,
  );

  if (!target) return false;

  const id = changeId(target);
  const path = join(dir, `${id}.json`);
  if (existsSync(path)) {
    unlinkSync(path);
    return true;
  }
  return false;
}

/** Clear all staged changes */
export function clearStaging(projectRoot: string): void {
  const dir = stagingDir(projectRoot);
  if (!existsSync(dir)) return;

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    unlinkSync(join(dir, f));
  }
}

/** Check if there are any staged changes */
export function hasStagedChanges(projectRoot: string): boolean {
  const dir = stagingDir(projectRoot);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith(".json"));
}
