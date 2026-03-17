/**
 * React framework profile.
 *
 * Extracts all React-specific constants and behavior that were previously
 * hardcoded in reader.ts and writer.ts.
 */

import type { SourceFile } from "ts-morph";
import type { FrameworkProfile, FrameworkWrapperMeta } from "../framework-profile.js";

const SLOT_TYPE_NAMES = new Set([
  "ReactNode",
  "React.ReactNode",
  "ReactElement",
  "React.ReactElement",
  "JSX.Element",
]);

const CALLBACK_PATTERNS: RegExp[] = [
  /^\(.*\)\s*=>\s*/,
  /^Function$/,
  /^EventHandler/,
  /^MouseEventHandler/,
  /^ChangeEventHandler/,
  /^FormEventHandler/,
  /^KeyboardEventHandler/,
];

export const reactProfile: FrameworkProfile = {
  name: "react",
  label: "React",
  defaultGlob: "src/components/**/*.tsx",
  jsxEmit: 4, // JsxEmit.ReactJSX
  usesTsMorph: true,

  slotTypeNames: SLOT_TYPE_NAMES,

  isSlotType(typeText: string): boolean {
    const trimmed = typeText.trim();
    if (SLOT_TYPE_NAMES.has(trimmed)) return true;
    if (trimmed.includes("ReactNode") || trimmed.includes("ReactElement")) return true;
    return false;
  },

  callbackPatterns: CALLBACK_PATTERNS,

  slotTypeString: "ReactNode",
  nodeTypeString: "ReactNode",

  ensureSlotImport(sourceFile: SourceFile): void {
    const hasImport = sourceFile.getImportDeclarations().some((imp) => {
      if (imp.getModuleSpecifierValue() !== "react") return false;
      return imp.getNamedImports().some((n) => n.getName() === "ReactNode");
    });

    if (!hasImport) {
      const reactImport = sourceFile.getImportDeclarations().find(
        (imp) => imp.getModuleSpecifierValue() === "react",
      );

      if (reactImport) {
        reactImport.addNamedImport("ReactNode");
      } else {
        sourceFile.addImportDeclaration({
          moduleSpecifier: "react",
          namedImports: ["ReactNode"],
        });
      }
    }
  },

  internalPropNames: new Set(["ref", "key"]),

  detectWrappers(initializerText: string): FrameworkWrapperMeta {
    return {
      isForwardRef: initializerText.includes("forwardRef"),
      isMemo: initializerText.includes("memo("),
    };
  },
};
