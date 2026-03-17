/**
 * Framework profile — pluggable abstraction for framework-specific behavior.
 *
 * The code adapter delegates all framework-specific decisions (slot detection,
 * import management, type mapping) to a FrameworkProfile. This keeps the reader
 * and writer framework-agnostic.
 */

import type { SourceFile } from "ts-morph";

// ---------------------------------------------------------------------------
// Profile interface
// ---------------------------------------------------------------------------

export interface FrameworkProfile {
  /** Profile identifier, e.g. "react", "vue", "svelte" */
  readonly name: string;

  /** Human-readable label for CLI output */
  readonly label: string;

  /** Default glob for component discovery */
  readonly defaultGlob: string;

  /** ts-morph JsxEmit value (4 = ReactJSX, 1 = Preserve, etc.) */
  readonly jsxEmit: number;

  /** Whether the framework uses ts-morph for parsing (JSX/TS-based) */
  readonly usesTsMorph: boolean;

  /** Type strings that represent a slot (renderable child content) */
  readonly slotTypeNames: Set<string>;

  /** Check if a raw type string represents a slot (handles unions, aliases) */
  isSlotType(typeText: string): boolean;

  /** Regex patterns that identify callback/event-handler types */
  readonly callbackPatterns: RegExp[];

  /** The type string to emit when writing a slot prop */
  readonly slotTypeString: string;

  /** The type string to emit for a node-typed prop (PropType === "node") */
  readonly nodeTypeString: string;

  /** Ensure the slot type import exists in a source file */
  ensureSlotImport(sourceFile: SourceFile): void;

  /** Framework-internal prop names to skip (e.g. "ref", "key") */
  readonly internalPropNames: Set<string>;

  /** Detect framework-specific wrappers on component declarations */
  detectWrappers(initializerText: string): FrameworkWrapperMeta;
}

export interface FrameworkWrapperMeta {
  isForwardRef: boolean;
  isMemo: boolean;
}

// ---------------------------------------------------------------------------
// Support level — distinguishes "profile exists" from "reader/writer work"
// ---------------------------------------------------------------------------

export type SupportLevel = "full" | "profile-only";

export interface FrameworkInfo {
  profile: FrameworkProfile;
  supportLevel: SupportLevel;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

import { reactProfile } from "./profiles/react.profile.js";
import { solidProfile } from "./profiles/solid.profile.js";
import { vueProfile } from "./profiles/vue.profile.js";
import { svelteProfile } from "./profiles/svelte.profile.js";
import { angularProfile } from "./profiles/angular.profile.js";

const FRAMEWORK_REGISTRY: Record<string, FrameworkInfo> = {
  react:   { profile: reactProfile,   supportLevel: "full" },
  solid:   { profile: solidProfile,   supportLevel: "full" },
  vue:     { profile: vueProfile,     supportLevel: "profile-only" },
  svelte:  { profile: svelteProfile,  supportLevel: "profile-only" },
  angular: { profile: angularProfile, supportLevel: "profile-only" },
};

/** All recognized framework names. */
export const KNOWN_FRAMEWORKS = Object.keys(FRAMEWORK_REGISTRY);

/** Frameworks with full reader/writer support. */
export const SUPPORTED_FRAMEWORKS = Object.entries(FRAMEWORK_REGISTRY)
  .filter(([, info]) => info.supportLevel === "full")
  .map(([name]) => name);

/**
 * Resolve a framework name to its profile.
 *
 * Throws with a clear message for unknown or profile-only frameworks.
 */
export function getFrameworkProfile(name?: string): FrameworkProfile {
  const framework = name ?? "react";
  const info = FRAMEWORK_REGISTRY[framework];

  if (!info) {
    throw new Error(
      `Unknown framework "${framework}". ` +
      `Known frameworks: ${KNOWN_FRAMEWORKS.join(", ")}`,
    );
  }

  if (info.supportLevel === "profile-only") {
    throw new Error(
      `Framework "${framework}" is recognized but reader/writer support is not yet implemented. ` +
      `Fully supported today: ${SUPPORTED_FRAMEWORKS.join(", ")}`,
    );
  }

  return info.profile;
}

/**
 * Get framework info without throwing — for config validation and CLI display.
 */
export function getFrameworkInfo(name: string): FrameworkInfo | undefined {
  return FRAMEWORK_REGISTRY[name];
}
