/**
 * Convenience: fetch Figma components → convert to schemas → resolve names.
 */

import type { FigmaAdapterConfig } from "./types.js";
import type { ComponentSchema } from "../schema/types.js";
import { fetchComponents } from "./client.js";
import { figmaToSchemas } from "./reader.js";
import { resolveSchemaNames, type NameResolverConfig } from "../shared/name-resolver.js";

/**
 * Read Figma components and return resolved schemas.
 */
export async function readFigmaSchemas(
  config: FigmaAdapterConfig,
  nameConfig: NameResolverConfig,
): Promise<ComponentSchema[]> {
  const { componentSets, components } = await fetchComponents(config);
  const schemas = figmaToSchemas(componentSets, components);
  return resolveSchemaNames(schemas, nameConfig);
}
