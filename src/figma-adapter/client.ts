/**
 * Figma client — reads component and variable data from snapshots.
 *
 * Gitma does not connect to Figma directly. Instead, Claude Code
 * reads Figma via figma-console and saves snapshots that Gitma
 * consumes. This module provides utilities for importing raw
 * Figma data (from stdin/file) into the snapshot format.
 */

import type {
  FigmaComponent,
  FigmaComponentSet,
  FigmaVariable,
  FigmaVariableCollection,
  FigmaComponentProperty,
} from "./types.js";

// ---------------------------------------------------------------------------
// Raw Figma data types (as produced by figma_execute in Claude Code)
// ---------------------------------------------------------------------------

/** Raw component set data from figma_execute */
export interface RawFigmaComponentSet {
  name: string;
  key: string;
  nodeId: string;
  description?: string;
  properties: Record<string, FigmaComponentProperty>;
  variants: Array<{
    key: string;
    name: string;
    description?: string;
    nodeId: string;
  }>;
}

/** Raw standalone component data from figma_execute */
export interface RawFigmaComponent {
  name: string;
  key: string;
  nodeId: string;
  description?: string;
  properties?: Record<string, FigmaComponentProperty>;
}

/** Raw variable data from figma_execute */
export interface RawFigmaVariable {
  id: string;
  name: string;
  key: string;
  resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  description?: string;
  valuesByMode: Record<string, unknown>;
  variableCollectionId: string;
}

/** Raw variable collection data from figma_execute */
export interface RawFigmaVariableCollection {
  id: string;
  name: string;
  key: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
}

/** Complete raw Figma file data */
export interface RawFigmaData {
  fileKey: string;
  fileName: string;
  componentSets: RawFigmaComponentSet[];
  components: RawFigmaComponent[];
  variables?: RawFigmaVariable[];
  collections?: RawFigmaVariableCollection[];
}

// ---------------------------------------------------------------------------
// Conversion: raw data → adapter types
// ---------------------------------------------------------------------------

/**
 * Convert raw Figma data into the adapter types used by reader.ts.
 */
export function convertRawData(raw: RawFigmaData): {
  componentSets: FigmaComponentSet[];
  components: FigmaComponent[];
} {
  const componentSets: FigmaComponentSet[] = raw.componentSets.map((cs) => ({
    key: cs.key,
    name: cs.name,
    description: cs.description ?? "",
    nodeId: cs.nodeId,
    componentPropertyDefinitions: cs.properties,
    variantComponents: cs.variants.map((v) => ({
      key: v.key,
      name: v.name,
      description: v.description ?? "",
      nodeId: v.nodeId,
      componentSetId: cs.nodeId,
    })),
  }));

  const components: FigmaComponent[] = raw.components.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description ?? "",
    nodeId: c.nodeId,
    componentPropertyDefinitions: c.properties,
  }));

  return { componentSets, components };
}

/**
 * Convert raw variable data into adapter types.
 */
export function convertRawVariables(raw: RawFigmaData): {
  variables: FigmaVariable[];
  collections: FigmaVariableCollection[];
} {
  const variables: FigmaVariable[] = (raw.variables ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    key: v.key,
    resolvedType: v.resolvedType,
    description: v.description ?? "",
    valuesByMode: v.valuesByMode as Record<string, any>,
    variableCollectionId: v.variableCollectionId,
  }));

  const collections: FigmaVariableCollection[] = (raw.collections ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    key: c.key,
    modes: c.modes,
    variableIds: c.variableIds,
  }));

  return { variables, collections };
}
