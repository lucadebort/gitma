/**
 * Component name resolver — normalizes and maps names between Figma and code.
 *
 * Pipeline:
 * 1. Trim whitespace
 * 2. Collapse internal whitespace
 * 3. Apply explicit mapping (if configured)
 */

import type { ComponentSchema } from "../schema/types.js";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Normalize a component name: trim + collapse whitespace */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Name resolver
// ---------------------------------------------------------------------------

export interface NameResolverConfig {
  /** Explicit mapping: source name → canonical name */
  nameMap?: Record<string, string>;
}

/**
 * Resolve a Figma component name to its canonical (code) name.
 *
 * 1. Normalize (trim + collapse whitespace)
 * 2. Check explicit map (raw name first, then normalized)
 * 3. Return normalized name as fallback
 */
export function resolveNameToCode(
  figmaName: string,
  config: NameResolverConfig,
): string {
  // Check explicit map with raw name first
  if (config.nameMap?.[figmaName]) {
    return config.nameMap[figmaName];
  }

  const normalized = normalizeName(figmaName);

  // Check explicit map with normalized name
  if (config.nameMap?.[normalized]) {
    return config.nameMap[normalized];
  }

  return normalized;
}

/**
 * Resolve a code component name to its Figma name.
 * Reverses the nameMap lookup.
 */
export function resolveNameToFigma(
  codeName: string,
  config: NameResolverConfig,
): string {
  if (!config.nameMap) return codeName;

  // Find the Figma name that maps to this code name
  for (const [figmaName, mappedCodeName] of Object.entries(config.nameMap)) {
    if (mappedCodeName === codeName) {
      return figmaName;
    }
  }

  return codeName;
}

/**
 * Apply name resolution to an array of schemas (mutates names in place).
 * Returns the schemas with resolved names.
 */
export function resolveSchemaNames(
  schemas: ComponentSchema[],
  config: NameResolverConfig,
): ComponentSchema[] {
  return schemas.map((schema) => ({
    ...schema,
    name: resolveNameToCode(schema.name, config),
  }));
}
