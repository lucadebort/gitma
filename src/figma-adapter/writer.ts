/**
 * Figma writer — push schema changes back to Figma.
 *
 * Capabilities:
 * - Variables (tokens): full CRUD via Figma REST API /v1/files/:key/variables
 * - Component properties: NOT supported via REST API — requires Figma Plugin API
 *   or MCP write-back. Component property changes are returned as instructions
 *   for the designer to apply manually or via MCP.
 */

import type { FigmaAdapterConfig } from "./types.js";
import type { FigmaVariableInput } from "./token-bridge.js";

const FIGMA_API_BASE = "https://api.figma.com/v1";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getToken(config: FigmaAdapterConfig): string {
  const token = config.accessToken ?? process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Figma access token not found. Set FIGMA_ACCESS_TOKEN env var or pass accessToken in config.",
    );
  }
  return token;
}

// ---------------------------------------------------------------------------
// Variable write-back
// ---------------------------------------------------------------------------

/**
 * Figma Variables API payload shape.
 * @see https://www.figma.com/developers/api#variables
 */
interface VariableChange {
  action: "CREATE" | "UPDATE" | "DELETE";
  id?: string;
  name?: string;
  variableCollectionId?: string;
  resolvedType?: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  description?: string;
  /** Values per mode ID */
  valueModeValues?: Array<{
    variableId?: string;
    modeId: string;
    value: unknown;
  }>;
}

interface VariableCollectionChange {
  action: "CREATE" | "UPDATE" | "DELETE";
  id?: string;
  name?: string;
  initialModeId?: string;
}

interface VariablesPayload {
  variableCollections?: VariableCollectionChange[];
  variables?: VariableChange[];
  variableModeValues?: Array<{
    variableId: string;
    modeId: string;
    value: unknown;
  }>;
}

export interface WriteVariablesResult {
  created: number;
  updated: number;
  errors: string[];
}

/**
 * Push token variables to Figma.
 *
 * Creates or updates variables in the Figma file. Groups variables
 * into collections based on the first path segment.
 */
export async function writeVariablesToFigma(
  config: FigmaAdapterConfig,
  variables: FigmaVariableInput[],
  existingCollections?: Map<string, string>, // name → id
  existingVariables?: Map<string, string>,   // name → id
): Promise<WriteVariablesResult> {
  const token = getToken(config);
  const result: WriteVariablesResult = { created: 0, updated: 0, errors: [] };

  // Group variables by collection
  const byCollection = new Map<string, FigmaVariableInput[]>();
  for (const v of variables) {
    const group = byCollection.get(v.collectionName) ?? [];
    group.push(v);
    byCollection.set(v.collectionName, group);
  }

  // Build the payload
  const payload: VariablesPayload = {
    variableCollections: [],
    variables: [],
    variableModeValues: [],
  };

  // Create collections that don't exist
  const tempCollectionIds = new Map<string, string>();
  let tempIdCounter = 0;

  for (const collectionName of byCollection.keys()) {
    const existingId = existingCollections?.get(collectionName);
    if (!existingId) {
      const tempId = `temp_collection_${tempIdCounter++}`;
      tempCollectionIds.set(collectionName, tempId);
      payload.variableCollections!.push({
        action: "CREATE",
        id: tempId,
        name: collectionName,
      });
    }
  }

  // Create or update variables
  let tempVarIdCounter = 0;

  for (const [collectionName, vars] of byCollection) {
    const collectionId = existingCollections?.get(collectionName)
      ?? tempCollectionIds.get(collectionName);

    if (!collectionId) continue;

    for (const v of vars) {
      const existingId = existingVariables?.get(v.name);

      if (existingId) {
        // Update existing variable
        payload.variables!.push({
          action: "UPDATE",
          id: existingId,
          name: v.name,
          description: v.description,
        });
        result.updated++;
      } else {
        // Create new variable
        const tempId = `temp_var_${tempVarIdCounter++}`;
        payload.variables!.push({
          action: "CREATE",
          id: tempId,
          name: v.name,
          variableCollectionId: collectionId,
          resolvedType: v.resolvedType,
          description: v.description,
        });
        result.created++;
      }
    }
  }

  // POST to Figma
  try {
    const response = await fetch(
      `${FIGMA_API_BASE}/files/${config.fileKey}/variables`,
      {
        method: "POST",
        headers: {
          "X-FIGMA-TOKEN": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      result.errors.push(`Figma API error ${response.status}: ${body}`);
    }
  } catch (err) {
    result.errors.push(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component property change instructions
// ---------------------------------------------------------------------------

/**
 * Component property changes can't be done via REST API.
 * Instead, generate human-readable instructions for the designer
 * or structured data for MCP write-back.
 */

export interface ComponentChangeInstruction {
  componentName: string;
  figmaNodeId?: string;
  instructions: string[];
}

import type { SchemaChange } from "../diff-engine/types.js";

/**
 * Convert schema changes into designer-readable instructions.
 */
export function generateDesignerInstructions(
  changes: SchemaChange[],
): ComponentChangeInstruction[] {
  const byComponent = new Map<string, SchemaChange[]>();
  for (const change of changes) {
    const group = byComponent.get(change.componentName) ?? [];
    group.push(change);
    byComponent.set(change.componentName, group);
  }

  const instructions: ComponentChangeInstruction[] = [];

  for (const [componentName, componentChanges] of byComponent) {
    const lines: string[] = [];

    for (const change of componentChanges) {
      const path = change.fieldPath.split(".");
      const fieldName = path[1];

      switch (change.target) {
        case "variant":
          if (change.changeType === "added") {
            const values = (change.after as any)?.values;
            lines.push(
              `Add variant property "${fieldName}" with values: ${values?.join(", ") ?? "unknown"}`,
            );
          } else if (change.changeType === "removed") {
            lines.push(`Remove variant property "${fieldName}"`);
          } else if (change.changeType === "modified") {
            if (path[2] === "values") {
              const before = new Set(change.before as string[]);
              const after = change.after as string[];
              const added = after.filter((v) => !before.has(v));
              const removed = [...before].filter((v) => !after.includes(v));
              if (added.length) lines.push(`Add variant values to "${fieldName}": ${added.join(", ")}`);
              if (removed.length) lines.push(`Remove variant values from "${fieldName}": ${removed.join(", ")}`);
            }
          }
          break;

        case "prop":
          if (change.changeType === "added") {
            lines.push(`Add ${(change.after as any)?.type ?? "text"} property "${fieldName}"`);
          } else if (change.changeType === "removed") {
            lines.push(`Remove property "${fieldName}"`);
          }
          break;

        case "slot":
          if (change.changeType === "added") {
            lines.push(`Add instance swap property "${fieldName}"`);
          } else if (change.changeType === "removed") {
            lines.push(`Remove instance swap property "${fieldName}"`);
          }
          break;

        case "state":
          if (change.changeType === "added") {
            lines.push(`Add boolean property "${fieldName}" (interactive state)`);
          } else if (change.changeType === "removed") {
            lines.push(`Remove boolean property "${fieldName}"`);
          }
          break;
      }
    }

    if (lines.length > 0) {
      instructions.push({ componentName, instructions: lines });
    }
  }

  return instructions;
}
