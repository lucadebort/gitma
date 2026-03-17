/**
 * Project configuration — reads .gitma/config.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_FRAMEWORKS, SUPPORTED_FRAMEWORKS } from "../code-adapter/framework-profile.js";

const CONFIG_DIR = ".gitma";
const CONFIG_FILE = "config.json";

export interface ProjectConfig {
  /** Figma file key */
  figmaFileKey?: string;
  /** Framework for code adapter (default: "react") */
  framework?: string;
  /** Glob patterns to find component files */
  componentGlobs: string[];
  /** Path to .tokens.json file */
  tokenFile?: string;
  /** Token consumption format in code */
  tokenFormat: "css-vars" | "tailwind";
  /** Command to format files after writing, e.g. "npx prettier --write" */
  formatCommand?: string;
  /**
   * Component name mapping: Figma name → code name.
   * Applied after normalization (trim + whitespace collapse).
   * e.g. { "Button ": "Button", "Fab test": "FloatingActionButton" }
   */
  componentNameMap?: Record<string, string>;
  /**
   * Property mapping per component: maps Figma property names to code property names.
   * Also supports mapping Figma variants to code states and vice versa.
   *
   * e.g. {
   *   "Button": {
   *     "props": { "buttonLabel": "children", "showLabel": null },
   *     "variantToState": { "state": { "isDisabled": "disabled", "isHovered": null } },
   *     "ignore": ["showLabel"]
   *   }
   * }
   *
   * - props: rename Figma prop → code prop. null = ignore this prop.
   * - variantToState: a Figma variant whose values map to code boolean states.
   *   e.g. Figma variant "state" with value "isDisabled" → code state "disabled".
   *   null values are ignored (e.g. "isHovered" is Figma-only, no code equivalent).
   * - ignore: list of Figma property names to skip entirely.
   */
  propertyMap?: Record<string, ComponentPropertyMap>;
}

export interface ComponentPropertyMap {
  /** Figma prop name → code prop name. null to ignore. */
  props?: Record<string, string | null>;
  /** Figma variant name → map of variant values to code state names. null to ignore value. */
  variantToState?: Record<string, Record<string, string | null>>;
  /** Figma property names to skip entirely */
  ignore?: string[];
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
  const config = { ...DEFAULT_CONFIG, ...JSON.parse(json) };

  // Validate framework if specified
  if (config.framework && !KNOWN_FRAMEWORKS.includes(config.framework)) {
    throw new Error(
      `Unknown framework "${config.framework}" in config. ` +
      `Known frameworks: ${KNOWN_FRAMEWORKS.join(", ")}. ` +
      `Fully supported: ${SUPPORTED_FRAMEWORKS.join(", ")}.`,
    );
  }

  return config;
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
