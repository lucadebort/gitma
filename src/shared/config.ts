/**
 * Project configuration — reads .antikarlotta/config.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CONFIG_DIR = ".antikarlotta";
const CONFIG_FILE = "config.json";

export interface ProjectConfig {
  /** Figma file key */
  figmaFileKey?: string;
  /** Glob patterns to find React component files */
  componentGlobs: string[];
  /** Path to .tokens.json file */
  tokenFile?: string;
  /** Token consumption format in code */
  tokenFormat: "css-vars" | "tailwind";
  /** Command to format files after writing, e.g. "npx prettier --write" */
  formatCommand?: string;
}

const DEFAULT_CONFIG: ProjectConfig = {
  componentGlobs: ["src/components/**/*.tsx"],
  tokenFormat: "css-vars",
};

function configPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_DIR, CONFIG_FILE);
}

export function loadConfig(projectRoot: string): ProjectConfig {
  const path = configPath(projectRoot);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const json = readFileSync(path, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(json) };
}

export function saveConfig(projectRoot: string, config: ProjectConfig): void {
  const dir = join(projectRoot, CONFIG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath(projectRoot), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function configExists(projectRoot: string): boolean {
  return existsSync(configPath(projectRoot));
}
