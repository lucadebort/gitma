/**
 * Convenience: convert raw Figma data → schemas → resolve names → resolve properties.
 */

import type { ComponentSchema } from "../schema/types.js";
import type { ComponentPropertyMap } from "../shared/config.js";
import type { RawFigmaData } from "./client.js";
import { convertRawData } from "./client.js";
import { figmaToSchemas } from "./reader.js";
import { resolveSchemaNames, type NameResolverConfig } from "../shared/name-resolver.js";
import { resolveAllProperties } from "../shared/property-resolver.js";

export interface ReadFigmaOptions {
  nameConfig: NameResolverConfig;
  propertyMap?: Record<string, ComponentPropertyMap>;
}

/**
 * Convert raw Figma data to resolved schemas.
 *
 * Pipeline: convert → schemas → resolve names → resolve properties.
 */
export function rawFigmaToSchemas(
  raw: RawFigmaData,
  options: ReadFigmaOptions,
): ComponentSchema[] {
  const { componentSets, components } = convertRawData(raw);
  const schemas = figmaToSchemas(componentSets, components);
  const named = resolveSchemaNames(schemas, options.nameConfig);
  return resolveAllProperties(named, options.propertyMap);
}
