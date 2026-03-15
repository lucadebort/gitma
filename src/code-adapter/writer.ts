/**
 * Code writer — apply schema changes to React/TypeScript source files.
 *
 * Uses ts-morph for surgical AST modifications that preserve
 * existing code, formatting, and comments.
 */

import {
  Project,
  SyntaxKind,
  type SourceFile,
  type InterfaceDeclaration,
  type TypeAliasDeclaration,
  type ObjectBindingPattern,
  type FunctionDeclaration,
  type VariableDeclaration,
} from "ts-morph";
import type { SchemaChange } from "../diff-engine/types.js";
import type { ComponentSchema, Prop, Variant, Slot, State } from "../schema/types.js";
import { formatFile } from "../shared/format.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteResult {
  filePath: string;
  /** Original file content (for backup/diff) */
  originalContent: string;
  /** New file content after modifications */
  newContent: string;
  /** Changes applied */
  appliedChanges: string[];
  /** Changes that could not be applied */
  skippedChanges: string[];
}

// ---------------------------------------------------------------------------
// Project setup
// ---------------------------------------------------------------------------

function createWriteProject(tsConfigPath?: string): Project {
  if (tsConfigPath) {
    return new Project({ tsConfigFilePath: tsConfigPath });
  }
  return new Project({
    compilerOptions: {
      jsx: 4, // ReactJSX
      esModuleInterop: true,
      strict: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Props interface finder
// ---------------------------------------------------------------------------

/**
 * Find the props interface or type alias for a component in a source file.
 * Convention: ComponentNameProps or ComponentName + Props suffix.
 */
function findPropsDeclaration(
  sourceFile: SourceFile,
  componentName: string,
): InterfaceDeclaration | TypeAliasDeclaration | undefined {
  const candidates = [
    `${componentName}Props`,
    `${componentName}Properties`,
    `I${componentName}Props`,
  ];

  // Try interfaces first
  for (const name of candidates) {
    const iface = sourceFile.getInterface(name);
    if (iface) return iface;
  }

  // Try type aliases
  for (const name of candidates) {
    const alias = sourceFile.getTypeAlias(name);
    if (alias) return alias;
  }

  // Fallback: look for inline type in the component function params
  // e.g., function Button({ label }: { label: string })
  return undefined;
}

// ---------------------------------------------------------------------------
// Add prop to interface
// ---------------------------------------------------------------------------

function addPropToInterface(
  iface: InterfaceDeclaration,
  prop: Prop | Variant | Slot,
  kind: "prop" | "variant" | "slot",
): boolean {
  // Check if prop already exists
  if (iface.getProperty(prop.name)) return false;

  const typeStr = propToTypeString(prop, kind);
  const isOptional = kind === "prop" ? !(prop as Prop).required
    : kind === "variant" ? true
    : !(prop as Slot).required;

  iface.addProperty({
    name: prop.name,
    type: typeStr,
    hasQuestionToken: isOptional,
    ...(prop.description && {
      docs: [{ description: prop.description }],
    }),
  });

  return true;
}

function propToTypeString(
  prop: Prop | Variant | Slot,
  kind: "prop" | "variant" | "slot",
): string {
  if (kind === "variant") {
    const variant = prop as Variant;
    return variant.values.map((v) => `"${v}"`).join(" | ");
  }

  if (kind === "slot") {
    return "ReactNode";
  }

  const p = prop as Prop;
  switch (p.type) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "enum": return p.values?.map((v) => `"${v}"`).join(" | ") ?? "string";
    case "node": return "ReactNode";
    case "callback": return p.rawType ?? "() => void";
    case "object": return p.rawType ?? "Record<string, unknown>";
    default: return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Remove prop from interface
// ---------------------------------------------------------------------------

function removePropFromInterface(
  iface: InterfaceDeclaration,
  propName: string,
): boolean {
  const prop = iface.getProperty(propName);
  if (!prop) return false;
  prop.remove();
  return true;
}

// ---------------------------------------------------------------------------
// Modify prop type in interface
// ---------------------------------------------------------------------------

function modifyPropType(
  iface: InterfaceDeclaration,
  propName: string,
  newType: string,
): boolean {
  const prop = iface.getProperty(propName);
  if (!prop) return false;
  prop.setType(newType);
  return true;
}

// ---------------------------------------------------------------------------
// Modify prop optionality
// ---------------------------------------------------------------------------

function modifyPropRequired(
  iface: InterfaceDeclaration,
  propName: string,
  required: boolean,
): boolean {
  const prop = iface.getProperty(propName);
  if (!prop) return false;
  prop.setHasQuestionToken(!required);
  return true;
}

// ---------------------------------------------------------------------------
// Update variant values (union type)
// ---------------------------------------------------------------------------

function updateVariantValues(
  iface: InterfaceDeclaration,
  variantName: string,
  newValues: string[],
): boolean {
  const prop = iface.getProperty(variantName);
  if (!prop) return false;
  const newType = newValues.map((v) => `"${v}"`).join(" | ");
  prop.setType(newType);
  return true;
}

// ---------------------------------------------------------------------------
// Destructuring manipulation (Layer 2)
// ---------------------------------------------------------------------------

/**
 * Find the destructuring binding pattern for a component's props parameter.
 * Handles both function declarations and arrow functions assigned to variables.
 */
function findDestructuringPattern(
  sourceFile: SourceFile,
  componentName: string,
): ObjectBindingPattern | undefined {
  // Try function declaration: export function Button({ ... }: Props)
  const func = sourceFile.getFunction(componentName);
  if (func) {
    const param = func.getParameters()[0];
    if (param) {
      return param.getFirstDescendantByKind(SyntaxKind.ObjectBindingPattern);
    }
  }

  // Try variable declaration: export const Button = ({ ... }: Props) => ...
  const varDecl = sourceFile.getVariableDeclaration(componentName);
  if (varDecl) {
    const arrowFunc = varDecl.getFirstDescendantByKind(SyntaxKind.ArrowFunction)
      ?? varDecl.getFirstDescendantByKind(SyntaxKind.FunctionExpression);
    if (arrowFunc) {
      const param = arrowFunc.getParameters()[0];
      if (param) {
        return param.getFirstDescendantByKind(SyntaxKind.ObjectBindingPattern);
      }
    }
  }

  return undefined;
}

/**
 * Add a prop to the destructuring pattern: { label } → { label, newProp }
 * Optionally with a default value: { label, newProp = "default" }
 */
function addToDestructuring(
  sourceFile: SourceFile,
  componentName: string,
  propName: string,
  defaultValue?: string,
): boolean {
  const pattern = findDestructuringPattern(sourceFile, componentName);
  if (!pattern) return false;

  // Check if already destructured
  const existing = pattern.getElements().find((e) => e.getName() === propName);
  if (existing) {
    // Already there — maybe update the default value
    if (defaultValue !== undefined && !existing.getInitializer()) {
      existing.setInitializer(defaultValue);
      return true;
    }
    return false;
  }

  // Add the binding element
  const elements = pattern.getElements();
  const lastElement = elements[elements.length - 1];

  // Build the new element text
  const newElementText = defaultValue !== undefined
    ? `${propName} = ${defaultValue}`
    : propName;

  // Insert after the last element using text manipulation
  // ts-morph doesn't have a direct addElement on ObjectBindingPattern,
  // so we manipulate the source text
  const fullText = sourceFile.getFullText();
  const patternEnd = pattern.getEnd();
  const patternText = pattern.getText();

  // Find the position just before the closing brace
  const closingBracePos = patternText.lastIndexOf("}");
  const beforeBrace = patternText.slice(0, closingBracePos).trimEnd();
  const hasTrailingComma = beforeBrace.endsWith(",");

  const separator = hasTrailingComma ? " " : ", ";
  const newPatternText = beforeBrace + separator + newElementText + " }";

  const patternStart = pattern.getStart();
  const newFullText = fullText.slice(0, patternStart) + newPatternText + fullText.slice(patternEnd);
  sourceFile.replaceWithText(newFullText);

  return true;
}

/**
 * Remove a prop from the destructuring pattern: { label, disabled } → { label }
 */
function removeFromDestructuring(
  sourceFile: SourceFile,
  componentName: string,
  propName: string,
): boolean {
  const pattern = findDestructuringPattern(sourceFile, componentName);
  if (!pattern) return false;

  const element = pattern.getElements().find((e) => e.getName() === propName);
  if (!element) return false;

  const fullText = sourceFile.getFullText();
  const elementStart = element.getStart();
  const elementEnd = element.getEnd();

  // Determine the range to remove (including surrounding comma/whitespace)
  let removeStart = elementStart;
  let removeEnd = elementEnd;

  // Look for trailing comma and whitespace
  const afterElement = fullText.slice(elementEnd);
  const trailingMatch = afterElement.match(/^(\s*,\s*)/);
  if (trailingMatch) {
    removeEnd += trailingMatch[1].length;
  } else {
    // No trailing comma — look for leading comma
    const beforeElement = fullText.slice(0, elementStart);
    const leadingMatch = beforeElement.match(/(\s*,\s*)$/);
    if (leadingMatch) {
      removeStart -= leadingMatch[1].length;
    }
  }

  const newFullText = fullText.slice(0, removeStart) + fullText.slice(removeEnd);
  sourceFile.replaceWithText(newFullText);

  return true;
}

/**
 * Update the default value of a prop in the destructuring pattern.
 */
function updateDefaultInDestructuring(
  sourceFile: SourceFile,
  componentName: string,
  propName: string,
  newDefaultValue: string,
): boolean {
  const pattern = findDestructuringPattern(sourceFile, componentName);
  if (!pattern) return false;

  const element = pattern.getElements().find((e) => e.getName() === propName);
  if (!element) return false;

  const initializer = element.getInitializer();
  if (initializer) {
    // Replace existing default
    const fullText = sourceFile.getFullText();
    const initStart = initializer.getStart();
    const initEnd = initializer.getEnd();
    const newFullText = fullText.slice(0, initStart) + newDefaultValue + fullText.slice(initEnd);
    sourceFile.replaceWithText(newFullText);
    return true;
  }

  // No existing default — add one
  element.setInitializer(newDefaultValue);
  return true;
}

// ---------------------------------------------------------------------------
// Ensure ReactNode import
// ---------------------------------------------------------------------------

function ensureReactNodeImport(sourceFile: SourceFile): void {
  const hasReactNodeImport = sourceFile.getImportDeclarations().some((imp) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (moduleSpecifier !== "react") return false;
    return imp.getNamedImports().some((n) => n.getName() === "ReactNode");
  });

  if (!hasReactNodeImport) {
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
}

// ---------------------------------------------------------------------------
// Apply changes to a source file
// ---------------------------------------------------------------------------

export interface ApplyChangesOptions {
  /** The component schema to sync towards */
  targetSchema: ComponentSchema;
  /** Changes to apply (from diff engine) */
  changes: SchemaChange[];
}

function applyChangesToFile(
  sourceFile: SourceFile,
  options: ApplyChangesOptions,
): WriteResult {
  const originalContent = sourceFile.getFullText();
  const appliedChanges: string[] = [];
  const skippedChanges: string[] = [];
  const { targetSchema, changes } = options;

  // Find the props interface
  const propsDecl = findPropsDeclaration(sourceFile, targetSchema.name);

  if (!propsDecl) {
    // Can't modify without a props declaration
    return {
      filePath: sourceFile.getFilePath(),
      originalContent,
      newContent: originalContent,
      appliedChanges: [],
      skippedChanges: changes.map((c) => `${c.description} (no props interface found)`),
    };
  }

  // Only handle InterfaceDeclaration for now (most common)
  if (propsDecl.getKind() !== SyntaxKind.InterfaceDeclaration) {
    return {
      filePath: sourceFile.getFilePath(),
      originalContent,
      newContent: originalContent,
      appliedChanges: [],
      skippedChanges: changes.map((c) => `${c.description} (type alias not yet supported, use interface)`),
    };
  }

  const iface = propsDecl as InterfaceDeclaration;
  let needsReactNodeImport = false;

  // Track destructuring updates to apply after interface changes
  const destructuringOps: Array<{ type: "add" | "remove" | "updateDefault"; name: string; defaultValue?: string }> = [];

  for (const change of changes) {
    const applied = applyChange(sourceFile, iface, change, targetSchema, destructuringOps);
    if (applied) {
      appliedChanges.push(change.description);
      // Check if we added a slot (ReactNode)
      if (change.target === "slot" && change.changeType === "added") {
        needsReactNodeImport = true;
      }
    } else {
      skippedChanges.push(change.description);
    }
  }

  // Apply destructuring changes after all interface changes
  // (text manipulation can shift positions, so do it after AST-based changes)
  for (const op of destructuringOps) {
    if (op.type === "add") {
      addToDestructuring(sourceFile, targetSchema.name, op.name, op.defaultValue);
    } else if (op.type === "remove") {
      removeFromDestructuring(sourceFile, targetSchema.name, op.name);
    } else if (op.type === "updateDefault" && op.defaultValue !== undefined) {
      updateDefaultInDestructuring(sourceFile, targetSchema.name, op.name, op.defaultValue);
    }
  }

  if (needsReactNodeImport) {
    ensureReactNodeImport(sourceFile);
  }

  return {
    filePath: sourceFile.getFilePath(),
    originalContent,
    newContent: sourceFile.getFullText(),
    appliedChanges,
    skippedChanges,
  };
}

function applyChange(
  sourceFile: SourceFile,
  iface: InterfaceDeclaration,
  change: SchemaChange,
  schema: ComponentSchema,
  destructuringOps: Array<{ type: "add" | "remove" | "updateDefault"; name: string; defaultValue?: string }>,
): boolean {
  // Extract the field name from the fieldPath
  // e.g., "props.size" → "size", "variants.size.values" → "size"
  const pathParts = change.fieldPath.split(".");
  const fieldName = pathParts[1]; // second segment is the name

  switch (change.target) {
    case "prop": {
      if (change.changeType === "added") {
        const prop = schema.props.find((p) => p.name === fieldName);
        if (!prop) return false;
        const added = addPropToInterface(iface, prop, "prop");
        if (added) {
          const defaultStr = formatDefaultValue(prop.defaultValue, prop.type);
          destructuringOps.push({ type: "add", name: prop.name, defaultValue: defaultStr });
        }
        return added;
      }
      if (change.changeType === "removed") {
        const removed = removePropFromInterface(iface, fieldName);
        if (removed) {
          destructuringOps.push({ type: "remove", name: fieldName });
        }
        return removed;
      }
      if (change.changeType === "modified") {
        const subField = pathParts[2]; // e.g., "type", "required"
        if (subField === "type" && typeof change.after === "string") {
          return modifyPropType(iface, fieldName, change.after);
        }
        if (subField === "required" && typeof change.after === "boolean") {
          return modifyPropRequired(iface, fieldName, change.after);
        }
        if (subField === "defaultValue" && change.after !== undefined) {
          destructuringOps.push({
            type: "updateDefault",
            name: fieldName,
            defaultValue: String(change.after),
          });
          return true;
        }
      }
      return false;
    }

    case "variant": {
      if (change.changeType === "added") {
        const variant = schema.variants.find((v) => v.name === fieldName);
        if (!variant) return false;
        const added = addPropToInterface(iface, variant, "variant");
        if (added) {
          const defaultStr = variant.defaultValue ? `"${variant.defaultValue}"` : undefined;
          destructuringOps.push({ type: "add", name: variant.name, defaultValue: defaultStr });
        }
        return added;
      }
      if (change.changeType === "removed") {
        const removed = removePropFromInterface(iface, fieldName);
        if (removed) {
          destructuringOps.push({ type: "remove", name: fieldName });
        }
        return removed;
      }
      if (change.changeType === "modified") {
        const subField = pathParts[2];
        if (subField === "values" && Array.isArray(change.after)) {
          return updateVariantValues(iface, fieldName, change.after as string[]);
        }
      }
      return false;
    }

    case "slot": {
      if (change.changeType === "added") {
        const slot = schema.slots.find((s) => s.name === fieldName);
        if (!slot) return false;
        const added = addPropToInterface(iface, slot, "slot");
        if (added) {
          destructuringOps.push({ type: "add", name: slot.name });
        }
        return added;
      }
      if (change.changeType === "removed") {
        const removed = removePropFromInterface(iface, fieldName);
        if (removed) {
          destructuringOps.push({ type: "remove", name: fieldName });
        }
        return removed;
      }
      return false;
    }

    case "state": {
      // States map to boolean props in code
      if (change.changeType === "added") {
        const state = schema.states.find((s) => s.name === fieldName);
        if (!state) return false;
        const prop: Prop = {
          name: state.name,
          type: "boolean",
          required: false,
          description: state.description,
        };
        const added = addPropToInterface(iface, prop, "prop");
        if (added) {
          destructuringOps.push({ type: "add", name: state.name });
        }
        return added;
      }
      if (change.changeType === "removed") {
        const removed = removePropFromInterface(iface, fieldName);
        if (removed) {
          destructuringOps.push({ type: "remove", name: fieldName });
        }
        return removed;
      }
      return false;
    }

    case "component": {
      // Component-level changes (add/remove entire component) are not handled
      // at the file level — they require creating/deleting files
      return false;
    }

    default:
      return false;
  }
}

/**
 * Format a schema default value for use in destructuring.
 */
function formatDefaultValue(
  value: string | number | boolean | undefined,
  type: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  return `"${value}"`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply schema changes to a React component file.
 *
 * @param filePath - Absolute path to the component file
 * @param options - Target schema and changes to apply
 * @param tsConfigPath - Optional path to tsconfig.json
 * @returns WriteResult with original and new content
 */
export function applySchemaChanges(
  filePath: string,
  options: ApplyChangesOptions,
  tsConfigPath?: string,
): WriteResult {
  const project = createWriteProject(tsConfigPath);
  project.addSourceFileAtPath(filePath);
  const sourceFile = project.getSourceFileOrThrow(filePath);

  const result = applyChangesToFile(sourceFile, options);

  return result;
}

/**
 * Apply schema changes and save the file.
 * Returns the WriteResult for review.
 */
export function applyAndSave(
  filePath: string,
  options: ApplyChangesOptions,
  tsConfigPath?: string,
  formatCommand?: string,
): WriteResult {
  const project = createWriteProject(tsConfigPath);
  project.addSourceFileAtPath(filePath);
  const sourceFile = project.getSourceFileOrThrow(filePath);

  const result = applyChangesToFile(sourceFile, options);

  if (result.appliedChanges.length > 0) {
    sourceFile.saveSync();
    formatFile(filePath, formatCommand);
  }

  return result;
}

/**
 * Apply schema changes to in-memory source (for testing).
 */
export function applySchemaChangesToSource(
  source: string,
  options: ApplyChangesOptions,
  fileName: string = "Component.tsx",
): WriteResult {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 4,
      esModuleInterop: true,
      strict: true,
    },
  });

  const sourceFile = project.createSourceFile(fileName, source);
  return applyChangesToFile(sourceFile, options);
}
