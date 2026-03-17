/**
 * Svelte framework profile.
 *
 * Profile-only: defines Svelte-specific constants for future reader/writer support.
 * Svelte parsing requires svelte/compiler, not ts-morph.
 */

import type { SourceFile } from "ts-morph";
import type { FrameworkProfile, FrameworkWrapperMeta } from "../framework-profile.js";

const SLOT_TYPE_NAMES = new Set([
  "Snippet",
  "Component",
  "SvelteComponent",
]);

const CALLBACK_PATTERNS: RegExp[] = [
  /^\(.*\)\s*=>\s*/,
  /^Function$/,
  /^EventDispatcher/,
];

export const svelteProfile: FrameworkProfile = {
  name: "svelte",
  label: "Svelte",
  defaultGlob: "src/lib/components/**/*.svelte",
  jsxEmit: 1, // Not applicable for Svelte, but needed for interface
  usesTsMorph: false,

  slotTypeNames: SLOT_TYPE_NAMES,

  isSlotType(typeText: string): boolean {
    const trimmed = typeText.trim();
    return SLOT_TYPE_NAMES.has(trimmed) || trimmed.includes("Snippet");
  },

  callbackPatterns: CALLBACK_PATTERNS,

  slotTypeString: "Snippet",
  nodeTypeString: "Snippet",

  ensureSlotImport(sourceFile: SourceFile): void {
    // Svelte 5: Snippet is available via $props() runes, no import needed
    // Svelte 4: slots via <slot> in template
  },

  internalPropNames: new Set(["$$slots", "$$events", "$$props"]),

  detectWrappers(_initializerText: string): FrameworkWrapperMeta {
    return { isForwardRef: false, isMemo: false };
  },
};
