/**
 * Figma reader — extract component schemas from Figma component definitions.
 *
 * Converts Figma component properties, variants, instance swaps,
 * and variable bindings into the canonical schema format.
 */

import type { ComponentSchema, Prop, Variant, Slot, State, PropType } from "../schema/types.js";
import type {
  FigmaComponent,
  FigmaComponentSet,
  FigmaComponentProperty,
} from "./types.js";

// ---------------------------------------------------------------------------
// Property mapping
// ---------------------------------------------------------------------------

function mapFigmaPropertyType(figmaType: string): PropType {
  switch (figmaType) {
    case "BOOLEAN": return "boolean";
    case "TEXT": return "string";
    case "INSTANCE_SWAP": return "node";
    case "VARIANT": return "enum";
    default: return "string";
  }
}

/**
 * Clean Figma property names:
 * - Strip trailing node ID suffix: "Button label#712:0" → "Button label"
 * - Strip leading "#" for hidden properties
 * - Trim whitespace
 * - Convert to camelCase: "Button label" → "buttonLabel", "Show Label" → "showLabel"
 */
function cleanPropertyName(name: string): string {
  const stripped = name
    .replace(/#\d+:\d+$/, "")  // strip trailing #nodeId (e.g. #712:0)
    .replace(/^#/, "")          // strip leading # (hidden props)
    .trim();

  return toCamelCase(stripped);
}

/**
 * Convert a string to camelCase.
 * "Button label" → "buttonLabel"
 * "Show Label" → "showLabel"
 * "Icon Placement" → "iconPlacement"
 * "size" → "size" (already lowercase, no change)
 * "isChecked" → "isChecked" (already camelCase)
 */
function toCamelCase(str: string): string {
  // If it's a single word already in camelCase or lowercase, return as-is
  if (!str.includes(" ") && !str.includes("-") && !str.includes("_")) {
    // Lowercase the first character if the whole string isn't uppercase
    if (str.length > 0 && str !== str.toUpperCase()) {
      return str[0].toLowerCase() + str.slice(1);
    }
    return str.toLowerCase();
  }

  // Split on spaces, hyphens, underscores
  const words = str.split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return str;

  return words
    .map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Component set → Schema conversion
// ---------------------------------------------------------------------------

/**
 * Convert a Figma component set (with variants) to a ComponentSchema.
 */
export function figmaComponentSetToSchema(
  componentSet: FigmaComponentSet,
): ComponentSchema {
  const props: Prop[] = [];
  const variants: Variant[] = [];
  const slots: Slot[] = [];
  const states: State[] = [];

  const definitions = componentSet.componentPropertyDefinitions ?? {};

  for (const [rawName, def] of Object.entries(definitions)) {
    const name = cleanPropertyName(rawName);

    switch (def.type) {
      case "VARIANT": {
        variants.push({
          name,
          values: def.variantOptions ?? [],
          defaultValue: typeof def.defaultValue === "string" ? def.defaultValue : undefined,
        });
        break;
      }

      case "BOOLEAN": {
        // Boolean properties that are state-like
        const lowerName = name.toLowerCase();
        const isState = ["disabled", "loading", "active", "selected", "checked",
          "focused", "open", "expanded", "pressed", "error"].includes(lowerName);

        if (isState) {
          states.push({ name: lowerName });
        } else {
          props.push({
            name,
            type: "boolean",
            required: false,
            defaultValue: def.defaultValue as boolean,
          });
        }
        break;
      }

      case "TEXT": {
        props.push({
          name,
          type: "string",
          required: false,
          defaultValue: typeof def.defaultValue === "string" ? def.defaultValue : undefined,
        });
        break;
      }

      case "INSTANCE_SWAP": {
        const allowedComponents = def.preferredValues
          ?.filter((v) => v.type === "COMPONENT" || v.type === "COMPONENT_SET")
          .map((v) => v.key) ?? [];

        slots.push({
          name,
          required: false,
          allowedComponents: allowedComponents.length > 0 ? allowedComponents : undefined,
        });
        break;
      }
    }
  }

  return {
    name: componentSet.name,
    description: componentSet.description || undefined,
    props,
    variants,
    slots,
    states,
    tokenRefs: [],
    figmaNodeId: componentSet.nodeId,
  };
}

/**
 * Convert a standalone Figma component (no variants) to a ComponentSchema.
 */
export function figmaComponentToSchema(component: FigmaComponent): ComponentSchema {
  const props: Prop[] = [];
  const slots: Slot[] = [];
  const states: State[] = [];

  const definitions = component.componentPropertyDefinitions ?? {};

  for (const [rawName, def] of Object.entries(definitions)) {
    const name = cleanPropertyName(rawName);

    switch (def.type) {
      case "BOOLEAN": {
        const lowerName = name.toLowerCase();
        const isState = ["disabled", "loading", "active", "selected", "checked",
          "focused", "open", "expanded", "pressed", "error"].includes(lowerName);

        if (isState) {
          states.push({ name: lowerName });
        } else {
          props.push({
            name,
            type: "boolean",
            required: false,
            defaultValue: def.defaultValue as boolean,
          });
        }
        break;
      }

      case "TEXT": {
        props.push({
          name,
          type: "string",
          required: false,
          defaultValue: typeof def.defaultValue === "string" ? def.defaultValue : undefined,
        });
        break;
      }

      case "INSTANCE_SWAP": {
        slots.push({
          name,
          required: false,
        });
        break;
      }
    }
  }

  return {
    name: component.name,
    description: component.description || undefined,
    props,
    variants: [],
    slots,
    states,
    tokenRefs: [],
    figmaNodeId: component.nodeId,
  };
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

/**
 * Convert an array of Figma component sets and standalone components to schemas.
 */
export function figmaToSchemas(
  componentSets: FigmaComponentSet[],
  standaloneComponents: FigmaComponent[],
): ComponentSchema[] {
  const schemas: ComponentSchema[] = [];

  for (const cs of componentSets) {
    schemas.push(figmaComponentSetToSchema(cs));
  }

  for (const c of standaloneComponents) {
    // Skip components that belong to a component set (they're variants)
    if (c.componentSetId) continue;
    schemas.push(figmaComponentToSchema(c));
  }

  return schemas;
}
