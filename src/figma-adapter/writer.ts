/**
 * Figma writer — produces structured change descriptions for Claude Code
 * to apply via figma_execute.
 *
 * Gitma does not connect to Figma directly. Instead, it outputs
 * change instructions as structured JSON that the /gitma skill
 * in Claude Code applies using figma-console's figma_execute tool.
 */

import type { SchemaChange } from "../diff-engine/types.js";

// ---------------------------------------------------------------------------
// Structured change output (for Claude Code to apply)
// ---------------------------------------------------------------------------

export interface FigmaWriteOperation {
  /** Target component's Figma node ID */
  nodeId: string;
  /** Component name (for display) */
  componentName: string;
  /** Operation type */
  operation:
    | { type: "addProperty"; name: string; propertyType: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP"; defaultValue: unknown }
    | { type: "deleteProperty"; name: string }
    | { type: "addVariantValue"; variantName: string; values: string[] }
    | { type: "removeVariantValue"; variantName: string; values: string[] }
    | { type: "manual"; description: string };
}

/**
 * Convert schema changes into structured write operations.
 *
 * Returns operations that Claude Code can apply via figma_execute,
 * plus human-readable instructions for changes that need manual work.
 */
export function schemaChangesToWriteOps(
  changes: SchemaChange[],
): FigmaWriteOperation[] {
  const ops: FigmaWriteOperation[] = [];

  for (const change of changes) {
    const nodeId = (change as any).figmaNodeId;
    if (!nodeId) continue;

    const fieldName = change.fieldPath.split(".")[1];

    switch (change.target) {
      case "prop": {
        if (change.changeType === "added") {
          const prop = change.after as { type: string; defaultValue?: unknown };
          const figmaType = mapPropTypeToFigma(prop.type);
          if (figmaType) {
            ops.push({
              nodeId,
              componentName: change.componentName,
              operation: {
                type: "addProperty",
                name: fieldName,
                propertyType: figmaType,
                defaultValue: prop.defaultValue ?? getDefaultForType(figmaType),
              },
            });
          }
        } else if (change.changeType === "removed") {
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: { type: "deleteProperty", name: fieldName },
          });
        }
        break;
      }

      case "slot": {
        if (change.changeType === "added") {
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: {
              type: "addProperty",
              name: fieldName,
              propertyType: "INSTANCE_SWAP",
              defaultValue: "",
            },
          });
        } else if (change.changeType === "removed") {
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: { type: "deleteProperty", name: fieldName },
          });
        }
        break;
      }

      case "state": {
        if (change.changeType === "added") {
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: {
              type: "addProperty",
              name: fieldName,
              propertyType: "BOOLEAN",
              defaultValue: false,
            },
          });
        } else if (change.changeType === "removed") {
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: { type: "deleteProperty", name: fieldName },
          });
        }
        break;
      }

      case "variant": {
        if (change.changeType === "modified" && change.fieldPath.endsWith(".values")) {
          const before = new Set(change.before as string[]);
          const after = change.after as string[];
          const added = after.filter((v) => !before.has(v));
          const removed = [...before].filter((v) => !after.includes(v));

          if (added.length) {
            ops.push({
              nodeId,
              componentName: change.componentName,
              operation: {
                type: "manual",
                description: `Add variant values to "${fieldName}": ${added.join(", ")} (requires creating new child components)`,
              },
            });
          }
          if (removed.length) {
            ops.push({
              nodeId,
              componentName: change.componentName,
              operation: {
                type: "manual",
                description: `Remove variant values from "${fieldName}": ${removed.join(", ")} (requires deleting child components)`,
              },
            });
          }
        } else if (change.changeType === "added") {
          const values = (change.after as any)?.values;
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: {
              type: "manual",
              description: `Add variant property "${fieldName}" with values: ${values?.join(", ") ?? "unknown"}`,
            },
          });
        } else if (change.changeType === "removed") {
          ops.push({
            nodeId,
            componentName: change.componentName,
            operation: {
              type: "manual",
              description: `Remove variant property "${fieldName}"`,
            },
          });
        }
        break;
      }
    }
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Human-readable instructions (fallback display)
// ---------------------------------------------------------------------------

export interface ComponentChangeInstruction {
  componentName: string;
  figmaNodeId?: string;
  instructions: string[];
}

/**
 * Convert write operations into human-readable instructions.
 */
export function writeOpsToInstructions(
  ops: FigmaWriteOperation[],
): ComponentChangeInstruction[] {
  const byComponent = new Map<string, string[]>();

  for (const op of ops) {
    const lines = byComponent.get(op.componentName) ?? [];

    switch (op.operation.type) {
      case "addProperty":
        lines.push(`Add ${op.operation.propertyType} property "${op.operation.name}" (default: ${op.operation.defaultValue})`);
        break;
      case "deleteProperty":
        lines.push(`Remove property "${op.operation.name}"`);
        break;
      case "manual":
        lines.push(op.operation.description);
        break;
    }

    byComponent.set(op.componentName, lines);
  }

  const instructions: ComponentChangeInstruction[] = [];
  for (const [componentName, lines] of byComponent) {
    if (lines.length > 0) {
      const nodeId = ops.find((o) => o.componentName === componentName)?.nodeId;
      instructions.push({ componentName, figmaNodeId: nodeId, instructions: lines });
    }
  }

  return instructions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPropTypeToFigma(schemaType: string): "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | null {
  switch (schemaType) {
    case "boolean": return "BOOLEAN";
    case "string": return "TEXT";
    case "node": return "INSTANCE_SWAP";
    default: return null;
  }
}

function getDefaultForType(figmaType: string): unknown {
  switch (figmaType) {
    case "BOOLEAN": return false;
    case "TEXT": return "";
    default: return "";
  }
}
