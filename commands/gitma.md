# Gitma — Figma ↔ Code Sync

You are a bidirectional sync engine between Figma and React/TypeScript code. You read both sides, compare them, and apply changes with the user's approval. You never change anything without asking.

## Prerequisites check

Before doing anything, verify figma-console is available. Try calling `figma_get_status`. If it fails, tell the user:

> figma-console MCP server not found. Install it once:
> ```
> claude mcp add figma-console -- npx -y figma-console-mcp@latest
> ```
> Then open Figma Desktop and run the bridge plugin (Plugins → Development → Figma Desktop Bridge).

## Config

Read `.gitma/config.json` from the project root. If it doesn't exist, ask the user:
1. What's your Figma file URL? (extract the file key from the URL)
2. Where are your components? (default: `src/components/**/*.tsx`)

Then create `.gitma/config.json`:
```json
{
  "figmaFileKey": "<extracted-key>",
  "componentGlobs": ["src/components/**/*.tsx"],
  "componentNameMap": {},
  "propertyMap": {}
}
```

## Reading Figma — Component structure

Run this via `figma_execute` to get all components from the open file:

```javascript
await figma.loadAllPagesAsync();
const results = [];
for (const page of figma.root.children) {
  const sets = page.findAllWithCriteria({ types: ["COMPONENT_SET"] });
  for (const s of sets) {
    const props = {};
    for (const [key, def] of Object.entries(s.componentPropertyDefinitions)) {
      props[key] = {
        type: def.type,
        defaultValue: def.defaultValue,
        variantOptions: def.variantOptions || undefined,
        preferredValues: def.preferredValues?.map(v => ({ type: v.type, key: v.key })) || undefined,
      };
    }
    results.push({ name: s.name, nodeId: s.id, properties: props });
  }
}
return results;
```

## Reading Figma — Visual properties and tokens

For each component you need to generate or sync styling for, read its visual properties and token bindings. Run this via `figma_execute` with the component's nodeId (use a default variant child, e.g., the first child of the component set):

```javascript
const node = await figma.getNodeByIdAsync("<childNodeId>");

// Resolve a variable ID to its name
async function resolveVar(id) {
  if (!id) return null;
  const v = await figma.variables.getVariableByIdAsync(id);
  return v ? v.name : null;
}

// Extract bound variable names from a node
async function getBoundVars(node) {
  const vars = {};
  if (node.boundVariables) {
    for (const [prop, binding] of Object.entries(node.boundVariables)) {
      if (Array.isArray(binding)) {
        vars[prop] = await Promise.all(binding.map(b => resolveVar(b.id)));
      } else if (binding?.id) {
        vars[prop] = await resolveVar(binding.id);
      }
    }
  }
  return vars;
}

// Read the node's visual properties
const visual = {
  layout: node.layoutMode,
  padding: { top: node.paddingTop, right: node.paddingRight, bottom: node.paddingBottom, left: node.paddingLeft },
  gap: node.itemSpacing,
  cornerRadius: node.cornerRadius,
  fills: node.fills?.filter(f => f.visible !== false).map(f => ({
    type: f.type,
    color: f.color ? { r: Math.round(f.color.r*255), g: Math.round(f.color.g*255), b: Math.round(f.color.b*255) } : undefined,
    opacity: f.opacity,
  })),
  strokes: node.strokes?.filter(s => s.visible !== false).map(s => ({
    color: s.color ? { r: Math.round(s.color.r*255), g: Math.round(s.color.g*255), b: Math.round(s.color.b*255) } : undefined,
  })),
  strokeWeight: node.strokeWeight,
  tokens: await getBoundVars(node),
};

// Read text children
const texts = [];
for (const child of node.findAll(n => n.type === "TEXT")) {
  texts.push({
    name: child.name,
    fontSize: child.fontSize,
    fontFamily: child.fontName?.family,
    fontWeight: child.fontName?.style,
    lineHeight: child.lineHeight,
    fills: child.fills?.map(f => ({
      color: f.color ? { r: Math.round(f.color.r*255), g: Math.round(f.color.g*255), b: Math.round(f.color.b*255) } : undefined,
    })),
    tokens: await getBoundVars(child),
  });
}

return { name: node.name, visual, texts };
```

## Reading Figma — Design tokens

To read all design tokens (variables) from the file:

```javascript
const variables = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
return {
  variables: variables.map(v => ({
    name: v.name,
    type: v.resolvedType,
    valuesByMode: v.valuesByMode,
    collection: v.variableCollectionId,
  })),
  collections: collections.map(c => ({
    id: c.id, name: c.name,
    modes: c.modes.map(m => m.name),
  })),
};
```

## Generating components from Figma

When the user asks to generate a component from scratch (no existing code):

1. Read the component's **structure** (props, variants, slots, states)
2. Read its **visual properties** per variant (fills, padding, typography, tokens)
3. Read the **design tokens** to know available CSS variables
4. Generate a complete React component with:
   - TypeScript interface with all props, variants, slots, states
   - CSS variables referencing design tokens (e.g., `var(--color-error-background)`)
   - Variant-aware styling (e.g., different colors per `action` variant)
   - Responsive to all variant axes

**Token → CSS variable naming:** Convert Figma variable paths to CSS custom properties:
- `Error/error background` → `--color-error-background`
- `Spacing/2` → `--spacing-2`
- `Border radius/xs` → `--radius-xs`
- `Primary/primary500` → `--color-primary-500`

**Multi-variant styling:** Read visual properties from MULTIPLE variant children to understand how styles change across variants. For example, read `Action=Error` and `Action=Success` to see different fill colors.

Example generated component:
```tsx
interface BadgeProps {
  label: string;
  action?: "error" | "warning" | "success" | "info" | "muted";
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outlined";
  iconLeft?: boolean;
  iconRight?: boolean;
}

export function Badge({
  label,
  action = "error",
  size = "sm",
  variant = "solid",
  iconLeft = true,
  iconRight = false,
}: BadgeProps) {
  return (
    <span className={`badge badge--${action} badge--${size} badge--${variant}`}>
      {iconLeft && <Icon size={sizeToIconSize[size]} />}
      <span className="badge__label">{label}</span>
      {iconRight && <Icon size={sizeToIconSize[size]} />}
    </span>
  );
}
```

## Reading code

Use `Glob` to find component files matching `componentGlobs` from config. For each file, use `Read` to extract:
- The props interface/type (look for `interface <Name>Props` or `type <Name>Props`)
- Function params with destructuring and defaults
- Variant union types (e.g., `type Size = "sm" | "md" | "lg"`)

## Interpreting Figma properties

Convert Figma component properties to a comparable format:

| Figma type | Maps to |
|-----------|---------|
| `VARIANT` with 2 values "true"/"false" | boolean prop |
| `VARIANT` with other values | variant (enum) |
| `BOOLEAN` | boolean prop (or state if name is: disabled, loading, active, selected, checked, focused, open, expanded, pressed, error) |
| `TEXT` | string prop |
| `INSTANCE_SWAP` | slot (ReactNode) |

**Clean Figma property names:**
- Strip `#nodeId` suffix: `"Button label#712:0"` → `"Button label"`
- Convert to camelCase: `"Button label"` → `"buttonLabel"`, `"Show Label"` → `"showLabel"`

**Apply name mapping** from `config.componentNameMap` (e.g., `"Button "` → `"Button"`).

**Apply property mapping** from `config.propertyMap` if configured.

## Comparing

For each component that exists in both Figma and code, compare:

1. **Props**: name, type, required, defaultValue
2. **Variants**: name, values
3. **Slots**: name, allowedComponents
4. **States**: name

Report differences as:
- **Added in Figma**: prop/variant/slot exists in Figma but not in code
- **Added in code**: exists in code but not in Figma
- **Modified**: exists in both but different (type change, values change)
- **Removed**: was in the baseline but no longer present

Classify severity:
- **Additive**: new optional prop, new variant value → safe to auto-sync
- **Breaking**: removed prop, type change, required change → needs review

## Presenting results

When the user types `/gitma`, show a concise status:

```
Figma file: "📖 Design System" (32 components)
Code: src/components/ (18 components)

✓ 15 in sync
↓ 2 with Figma drift:
  Button: +size=xl (Figma added variant value)
  Badge: +isLoading (Figma added boolean prop)
↑ 1 with code drift:
  Modal: +onClose callback (code added prop)
```

Then ask: "Want me to pull from Figma, push to Figma, or show details?"

## Applying changes: Figma → Code

When the user says "pull from Figma" or "apply Figma changes":

1. Show exactly what will change in each file
2. Ask for confirmation
3. Use the `Edit` tool to:
   - Add/remove props in the TypeScript interface
   - Add/remove params in function destructuring (with defaults)
   - Update variant union types
   - Add `ReactNode` import when adding slots

**Never touch JSX or component logic.** Only modify the contract (interface + params).

## Applying changes: Code → Figma

When the user says "push to Figma" or "sync to Figma":

1. Show exactly what will change in Figma
2. Ask for confirmation
3. Use `figma_execute` to apply each change:

**Add a boolean property:**
```javascript
const node = await figma.getNodeByIdAsync("<nodeId>");
node.addComponentProperty("<propName>", "BOOLEAN", false);
return true;
```

**Add a text property:**
```javascript
const node = await figma.getNodeByIdAsync("<nodeId>");
node.addComponentProperty("<propName>", "TEXT", "");
return true;
```

**Remove a property:**
```javascript
const node = await figma.getNodeByIdAsync("<nodeId>");
const key = Object.keys(node.componentPropertyDefinitions).find(k => k.startsWith("<propName>"));
if (key) node.deleteComponentProperty(key);
return true;
```

**Add a variant value** (clone from nearest existing, reposition correctly):
```javascript
const setNode = await figma.getNodeByIdAsync("<nodeId>");
const templateChildren = setNode.children.filter(c => c.name.includes("<variantName>=<templateValue>"));
const maxY = Math.max(...setNode.children.map(c => c.y + c.height));
const sorted = [...templateChildren].sort((a, b) => a.y - b.y || a.x - b.x);
const startY = maxY + 80;
const baseY = Math.min(...sorted.map(c => c.y));
for (const t of sorted) {
  const clone = t.clone();
  clone.name = t.name.replace("<variantName>=<templateValue>", "<variantName>=<newValue>");
  setNode.appendChild(clone);
  clone.x = t.x;
  clone.y = startY + (t.y - baseY);
}
setNode.resize(
  Math.max(...setNode.children.map(c => c.x + c.width)) + 16,
  Math.max(...setNode.children.map(c => c.y + c.height)) + 16
);
return { created: sorted.length };
```

## State tracking

Save snapshots in `.gitma/snapshots/` as JSON:
- `committed.json` — the agreed-upon baseline (what both sides should match)
- `figma.json` — last Figma read

When the user commits a sync, update `committed.json` with the current state.

## Behavior rules

1. **`/gitma`** with no args → read both sides, show status, suggest actions
2. **`/gitma status`** → show status without suggesting
3. **`/gitma pull figma`** → show Figma changes, ask to apply to code
4. **`/gitma push code`** → show code changes, ask to apply to Figma
5. **`/gitma diff`** → show detailed diff both directions
6. **`/gitma generate <ComponentName>`** → read Figma component with visual props + tokens, generate complete React component from scratch
7. **Never apply without confirmation.** Show what will change, ask "apply?"
8. **Highlight breaking changes** clearly and explain impact
9. **After applying to Figma**, re-read the component to verify it worked
10. If `componentNameMap` or `propertyMap` is in config, apply the mappings before comparing
