```
 ______     __     ______   __    __     ______
/\  ___\   /\ \   /\__  _\ /\ "-./  \   /\  __ \
\ \ \__ \  \ \ \  \/_/\ \/ \ \ \-./\ \  \ \  __ \
 \ \_____\  \ \_\    \ \_\  \ \_\ \ \_\  \ \_\ \_\
  \/_____/   \/_/     \/_/   \/_/  \/_/   \/_/\/_/

  figma ↔ code. zero drift.
```

Gitma keeps your Figma components and your React codebase in perfect sync. Designer changes a variant? You see the diff. Developer adds a prop? Gitma writes it to Figma. No copy-paste, no "did you update the component?", no drift.

## Setup (once)

```bash
# 1. Add the figma-console MCP server to Claude Code
claude mcp add figma-console -- npx -y figma-console-mcp@latest

# 2. Install the bridge plugin in Figma Desktop
npx figma-console-mcp@latest --print-path
# → Import the manifest in Figma: Plugins → Development → Import plugin from manifest

# 3. Install the /gitma command
curl -o ~/.claude/commands/gitma.md https://raw.githubusercontent.com/lucadebort/gitma/main/commands/gitma.md
```

## Use (every day)

Open Figma Desktop with your file. Run the bridge plugin. Then in Claude Code:

```
/gitma
```

That's it. Claude reads Figma, compares with your code, shows what's different, and asks what you want to do.

```
Figma file: "📖 Design System" (32 components)
Code: src/components/ (18 components)

✓ 15 in sync
↓ 2 with Figma drift:
  Button: +size=xl (Figma added variant value)
  Badge: +isLoading (Figma added boolean prop)
↑ 1 with code drift:
  Modal: +onClose callback (code added prop)

Want me to pull from Figma, push to Figma, or show details?
```

### Pull from Figma → Code

"Pull from Figma" — Claude updates your TypeScript interfaces, function params, and types to match Figma. Surgical AST edits, never touches your JSX.

### Push from Code → Figma

"Push to Figma" — Claude writes new props, states, and variant values directly to your Figma file via figma_execute. Including cloning variant children with correct positioning.

## What you need

- [Claude Code](https://claude.ai/claude-code)
- Figma Desktop with the bridge plugin
- React/TypeScript components

No API tokens. No npm packages in your project. No CLI to learn.

## What it can sync

| From Figma | To Code |
|-----------|---------|
| Variant property (enum) | Union type + prop |
| Boolean property | `boolean` prop or state |
| Text property | `string` prop |
| Instance swap | `ReactNode` slot |
| Variant values (sm, md, lg) | Union type values |

| From Code | To Figma |
|-----------|---------|
| New boolean prop | `addComponentProperty("BOOLEAN")` |
| New string prop | `addComponentProperty("TEXT")` |
| New slot | `addComponentProperty("INSTANCE_SWAP")` |
| Removed prop | `deleteComponentProperty()` |
| New variant value | Clone + rename + reposition |

## Configuration

On first run, `/gitma` creates `.gitma/config.json`:

```json
{
  "figmaFileKey": "your-figma-file-key",
  "componentGlobs": ["src/components/**/*.tsx"]
}
```

### Name mapping

When Figma and code name things differently:

```json
{
  "componentNameMap": {
    "Button ": "Button",
    "Fab test": "FloatingActionButton"
  }
}
```

### Property mapping

When Figma properties don't match code props 1:1:

```json
{
  "propertyMap": {
    "Button": {
      "props": { "buttonLabel": "children", "showLabel": null },
      "variantToState": {
        "state": { "isDisabled": "disabled", "isHovered": null }
      }
    }
  }
}
```

## Commands

```
/gitma              → read both sides, show status, suggest actions
/gitma status       → show sync status
/gitma pull figma   → Figma changes → apply to code
/gitma push code    → code changes → apply to Figma
/gitma diff         → detailed diff both directions
```

## License

ISC
