/**
 * Angular framework profile.
 *
 * Profile-only: defines Angular-specific constants for future reader/writer support.
 * Angular uses decorators (@Input, @Output) parsed via ts-morph, but requires
 * custom extraction logic different from JSX-based frameworks.
 */

import type { SourceFile } from "ts-morph";
import type { FrameworkProfile, FrameworkWrapperMeta } from "../framework-profile.js";

const SLOT_TYPE_NAMES = new Set([
  "TemplateRef",
  "Type",
]);

const CALLBACK_PATTERNS: RegExp[] = [
  /^\(.*\)\s*=>\s*/,
  /^Function$/,
  /^EventEmitter/,
  /^OutputEmitterRef/,
];

export const angularProfile: FrameworkProfile = {
  name: "angular",
  label: "Angular",
  defaultGlob: "src/app/components/**/*.component.ts",
  jsxEmit: 0, // No JSX in Angular
  usesTsMorph: true, // Decorators are parseable via ts-morph

  slotTypeNames: SLOT_TYPE_NAMES,

  isSlotType(typeText: string): boolean {
    const trimmed = typeText.trim();
    return SLOT_TYPE_NAMES.has(trimmed) || trimmed.includes("TemplateRef");
  },

  callbackPatterns: CALLBACK_PATTERNS,

  slotTypeString: "TemplateRef<unknown>",
  nodeTypeString: "TemplateRef<unknown>",

  ensureSlotImport(sourceFile: SourceFile): void {
    const hasImport = sourceFile.getImportDeclarations().some((imp) => {
      if (imp.getModuleSpecifierValue() !== "@angular/core") return false;
      return imp.getNamedImports().some((n) => n.getName() === "TemplateRef");
    });

    if (!hasImport) {
      const angularImport = sourceFile.getImportDeclarations().find(
        (imp) => imp.getModuleSpecifierValue() === "@angular/core",
      );

      if (angularImport) {
        angularImport.addNamedImport("TemplateRef");
      } else {
        sourceFile.addImportDeclaration({
          moduleSpecifier: "@angular/core",
          namedImports: ["TemplateRef"],
        });
      }
    }
  },

  internalPropNames: new Set(["ngOnInit", "ngOnDestroy", "ngOnChanges"]),

  detectWrappers(_initializerText: string): FrameworkWrapperMeta {
    // Angular doesn't use forwardRef/memo patterns
    return { isForwardRef: false, isMemo: false };
  },
};
