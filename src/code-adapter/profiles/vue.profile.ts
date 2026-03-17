/**
 * Vue framework profile.
 *
 * Profile-only: defines Vue-specific constants for future reader/writer support.
 * Vue SFC parsing requires vue/compiler-sfc, not ts-morph.
 */

import type { SourceFile } from "ts-morph";
import type { FrameworkProfile, FrameworkWrapperMeta } from "../framework-profile.js";

const SLOT_TYPE_NAMES = new Set([
  "VNode",
  "Component",
]);

const CALLBACK_PATTERNS: RegExp[] = [
  /^\(.*\)\s*=>\s*/,
  /^Function$/,
];

export const vueProfile: FrameworkProfile = {
  name: "vue",
  label: "Vue",
  defaultGlob: "src/components/**/*.vue",
  jsxEmit: 1, // Not applicable for SFC, but needed for interface
  usesTsMorph: false,

  slotTypeNames: SLOT_TYPE_NAMES,

  isSlotType(typeText: string): boolean {
    const trimmed = typeText.trim();
    return SLOT_TYPE_NAMES.has(trimmed) || trimmed.includes("VNode");
  },

  callbackPatterns: CALLBACK_PATTERNS,

  slotTypeString: "VNode",
  nodeTypeString: "VNode",

  ensureSlotImport(sourceFile: SourceFile): void {
    // Vue SFC: slots are declared via <slot> in template, not imports
    // This is a placeholder for future vue/compiler-sfc integration
  },

  internalPropNames: new Set(["$slots", "$emit", "$attrs"]),

  detectWrappers(_initializerText: string): FrameworkWrapperMeta {
    return { isForwardRef: false, isMemo: false };
  },
};
