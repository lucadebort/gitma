# Gitma

Git-like bidirectional sync between Figma and code.

Gitma keeps your design system in Figma and your component library in code perfectly aligned. When the designer changes a component in Figma, the developer sees the diff and pulls it into code. When the developer adds a prop, the designer gets instructions to update Figma. One source of truth, two tools, zero drift.

## Who is this for

Designer-developer pairs working on component-based design systems. You need:

- A Figma file with published components (variants, properties)
- A codebase with React/TypeScript components
- Both sides wanting to stay in sync without manual checking

## How it works

```
Figma ←→ Schema ←→ Code
```

Gitma sits in the middle. It reads both sides, compares them through a canonical schema, and shows you what's different. You decide what to sync — it never changes anything without your approval.

Think of it like git, but between Figma and code:

- `gitma status` — what's out of sync?
- `gitma diff` — show me the details
- `gitma pull` — bring changes from one side
- `gitma push` — sync from one side to the other
- `gitma resolve` — handle conflicts when both sides changed

## Quick start

### 1. Install

```bash
# In your project
pnpm add -D gitma
```

### 2. Set up Figma access

Create a Figma Personal Access Token at **Figma → Settings → Security → Personal access tokens**.

Scopes needed:
- `file_content:read` — read components
- `library_assets:read` — read published components
- `file_variables:read` — read tokens (Enterprise only)
- `file_variables:write` — write tokens (Enterprise only)

Add it to your project's `.env`:

```
FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxx
```

### 3. Initialize

```bash
npx gitma init
```

Gitma will ask you:
- Your Figma file URL
- Where your components live (e.g., `src/components/**/*.tsx`)
- Whether you have a token file

This creates `.gitma/config.json` in your project.

### 4. First sync

```bash
# See what's in your code
npx gitma status

# Commit your current code as the baseline
npx gitma commit -m "initial baseline"

# See what's different in Figma
npx gitma diff --figma

# Pull Figma changes into the schema
npx gitma pull figma --apply

# Apply schema changes to your code
npx gitma pull code --apply
```

## Commands

### Sync status

```bash
gitma status              # overview: what's in sync, what's drifted
gitma diff --code         # detailed code changes
gitma diff --figma        # detailed Figma changes
gitma diff --component Button  # diff for a specific component
```

### Syncing changes

```bash
# Designer changed Figma → update code
gitma push figma-to-code          # dry run (preview)
gitma push figma-to-code --apply  # do it

# Developer changed code → update schema + show designer instructions
gitma push code-to-figma          # dry run
gitma push code-to-figma --apply  # do it
```

### Granular control

```bash
gitma stage Button        # stage changes for one component
gitma stage --all         # stage everything
gitma stage --list        # see what's staged
gitma commit -m "message" # commit staged changes
gitma pull figma --apply  # update schema from Figma
gitma pull code --apply   # apply schema to code files
```

### Conflict resolution

```bash
gitma resolve                # show conflicts
gitma resolve --take figma   # resolve all: take Figma version
gitma resolve --take code    # resolve all: take code version
```

### Design tokens (W3C format)

```bash
gitma tokens status          # show token summary
gitma tokens validate        # check W3C spec compliance
gitma tokens pull figma --apply   # Figma variables → .tokens.json
gitma tokens push figma --apply   # .tokens.json → Figma variables
```

## Configuration

Gitma stores config in `.gitma/config.json`:

```json
{
  "figmaFileKey": "your-figma-file-key",
  "componentGlobs": ["src/components/**/*.tsx"],
  "tokenFile": "tokens.tokens.json",
  "tokenFormat": "css-vars",
  "formatCommand": "npx prettier --write",
  "componentNameMap": {},
  "propertyMap": {}
}
```

### Component name mapping

Figma and code don't always name things the same. Map them:

```json
{
  "componentNameMap": {
    "Button ": "Button",
    "Fab test": "FloatingActionButton"
  }
}
```

Names are auto-normalized (trimmed, whitespace collapsed). The map is for cases where the names are genuinely different.

### Property mapping

Figma properties often don't match code props 1:1. Configure per component:

```json
{
  "propertyMap": {
    "Button": {
      "props": {
        "buttonLabel": "children",
        "showLabel": null
      },
      "variantToState": {
        "state": {
          "isDisabled": "disabled",
          "isHovered": null,
          "default": null
        }
      },
      "ignore": ["internalProp"]
    }
  }
}
```

- **`props`** — rename Figma prop → code prop. `null` to ignore.
- **`variantToState`** — convert a Figma variant to boolean states. Figma's `state` variant with value `"isDisabled"` becomes code's `disabled: boolean`. `null` values are skipped (Figma-only states like hover).
- **`ignore`** — skip these Figma properties entirely.

## What Gitma changes in your code

When you run `gitma pull code --apply`, Gitma modifies your component files:

**What it does:**
- Adds/removes props in the TypeScript interface
- Adds/removes params in the function destructuring (with defaults)
- Updates variant union types when values change
- Updates default values in destructuring
- Adds `ReactNode` import when slots are created

**What it does NOT do:**
- Touch your JSX or component logic
- Rewrite files — it makes surgical AST edits
- Change anything without `--apply` flag

If a prop is removed, TypeScript will highlight every remaining usage. You clean up the logic — Gitma handles the contract.

## Design tokens

Gitma uses the [W3C Design Tokens](https://www.designtokens.org/tr/2025.10/) format (`.tokens.json`). Supported types:

| Type | Syncs to Figma |
|------|---------------|
| color | Yes (COLOR variable) |
| dimension | Yes (FLOAT variable) |
| number | Yes (FLOAT variable) |
| fontFamily | Yes (STRING variable) |
| fontWeight | Yes (FLOAT variable) |
| duration | Yes (FLOAT, in ms) |
| shadow | No (composite — preserved in `$extensions`) |
| border | No (composite) |
| typography | No (composite) |

Token aliases (`{color.primary.500}`) and group inheritance (`$type` on parent groups) are fully supported.

## Claude Code integration

If you use [Claude Code](https://claude.ai/claude-code), add the `/gitma` command for a conversational sync experience:

1. Copy `commands/gitma.md` to `~/.claude/commands/gitma.md`
2. In any project, type `/gitma` — Claude runs status, interprets the diff, and suggests actions

## Project structure

```
your-project/
  .gitma/
    config.json       # project config (committed to git)
    snapshots/        # schema states (gitignored)
    staging/          # staged changes (gitignored)
  .env                # FIGMA_ACCESS_TOKEN (gitignored)
  src/
    components/       # your React components
  tokens.tokens.json  # W3C design tokens (optional)
```

## License

ISC
