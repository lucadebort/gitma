/**
 * SolidJS framework profile.
 *
 * SolidJS uses JSX and TypeScript — very similar to React but with
 * different slot types and no forwardRef/memo wrappers.
 */

import type { SourceFile } from "ts-morph";
import type { FrameworkProfile, FrameworkWrapperMeta } from "../framework-profile.js";

const SLOT_TYPE_NAMES = new Set([
  "JSX.Element",
  "JSXElement",
  "Element",
]);

const CALLBACK_PATTERNS: RegExp[] = [
  /^\(.*\)\s*=>\s*/,
  /^Function$/,
  /^EventHandler/,
];

export const solidProfile: FrameworkProfile = {
  name: "solid",
  label: "SolidJS",
  defaultGlob: "src/components/**/*.tsx",
  jsxEmit: 1, // JsxEmit.Preserve
  usesTsMorph: true,

  slotTypeNames: SLOT_TYPE_NAMES,

  isSlotType(typeText: string): boolean {
    const trimmed = typeText.trim();
    if (SLOT_TYPE_NAMES.has(trimmed)) return true;
    if (trimmed.includes("JSX.Element") || trimmed.includes("JSXElement")) return true;
    return false;
  },

  callbackPatterns: CALLBACK_PATTERNS,

  slotTypeString: "JSX.Element",
  nodeTypeString: "JSX.Element",

  ensureSlotImport(sourceFile: SourceFile): void {
    // SolidJS: JSX.Element comes from solid-js, typically already available
    // via tsconfig jsx setting. Only add import if JSXElement is used directly.
    const hasImport = sourceFile.getImportDeclarations().some((imp) => {
      if (imp.getModuleSpecifierValue() !== "solid-js") return false;
      return imp.getNamedImports().some((n) => n.getName() === "JSXElement");
    });

    if (!hasImport) {
      // JSX.Element is globally available in Solid projects — no import needed
      // for the JSX namespace. Only import JSXElement if we reference it directly.
    }
  },

  internalPropNames: new Set(["ref"]),

  detectWrappers(_initializerText: string): FrameworkWrapperMeta {
    // SolidJS doesn't use forwardRef or memo wrappers
    return { isForwardRef: false, isMemo: false };
  },
};
