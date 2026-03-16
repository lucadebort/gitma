import { describe, it, expect } from "vitest";
import type { SchemaChange } from "../diff-engine/types.js";
import { schemaChangesToWriteOps, writeOpsToInstructions } from "./writer.js";

/** Helper: changes → human-readable instructions (replaces old generateDesignerInstructions) */
function toInstructions(changes: SchemaChange[]) {
  // Add figmaNodeId so ops are generated (writer skips changes without nodeId)
  const withNodeId = changes.map((c) => ({ ...c, figmaNodeId: "test:1" }));
  const ops = schemaChangesToWriteOps(withNodeId);
  return writeOpsToInstructions(ops);
}

// ---------------------------------------------------------------------------
// writeOpsToInstructions tests (equivalent to old generateDesignerInstructions)
// ---------------------------------------------------------------------------

describe("writeOpsToInstructions", () => {
  it("generates instruction for added variant", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "variant",
        changeType: "added",
        fieldPath: "variants.size",
        after: { name: "size", values: ["sm", "md", "lg"] },
        severity: "additive",
        description: 'Added variant "size"',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions).toHaveLength(1);
    expect(instructions[0].componentName).toBe("Button");
    expect(instructions[0].instructions[0]).toContain("variant property");
    expect(instructions[0].instructions[0]).toContain("sm, md, lg");
  });

  it("generates instruction for removed variant", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "variant",
        changeType: "removed",
        fieldPath: "variants.color",
        severity: "breaking",
        description: 'Removed variant "color"',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("Remove variant property");
  });

  it("generates instruction for modified variant values", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "variant",
        changeType: "modified",
        fieldPath: "variants.size.values",
        before: ["sm", "md", "lg"],
        after: ["sm", "md", "lg", "xl"],
        severity: "additive",
        description: 'Added variant values: xl',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("variant values");
    expect(instructions[0].instructions[0]).toContain("xl");
  });

  it("generates instruction for added prop", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "prop",
        changeType: "added",
        fieldPath: "props.tooltip",
        after: { name: "tooltip", type: "string" },
        severity: "additive",
        description: 'Added prop "tooltip"',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("TEXT property");
    expect(instructions[0].instructions[0]).toContain("tooltip");
  });

  it("generates instruction for added slot", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "slot",
        changeType: "added",
        fieldPath: "slots.icon",
        severity: "additive",
        description: 'Added slot "icon"',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("INSTANCE_SWAP property");
  });

  it("generates instruction for added state", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "state",
        changeType: "added",
        fieldPath: "states.loading",
        severity: "additive",
        description: 'Added state "loading"',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("BOOLEAN property");
    expect(instructions[0].instructions[0]).toContain("loading");
  });

  it("groups instructions by component", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "variant",
        changeType: "added",
        fieldPath: "variants.size",
        after: { name: "size", values: ["sm", "md"] },
        severity: "additive",
        description: 'Added variant "size"',
      },
      {
        componentName: "Button",
        target: "state",
        changeType: "added",
        fieldPath: "states.loading",
        severity: "additive",
        description: 'Added state "loading"',
      },
      {
        componentName: "Card",
        target: "slot",
        changeType: "added",
        fieldPath: "slots.header",
        severity: "additive",
        description: 'Added slot "header"',
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions).toHaveLength(2);
    expect(instructions[0].componentName).toBe("Button");
    expect(instructions[0].instructions).toHaveLength(2);
    expect(instructions[1].componentName).toBe("Card");
    expect(instructions[1].instructions).toHaveLength(1);
  });

  it("returns empty for no relevant changes", () => {
    const changes: SchemaChange[] = [
      {
        componentName: "Button",
        target: "metadata",
        changeType: "modified",
        fieldPath: "description",
        before: "old",
        after: "new",
        severity: "additive",
        description: "Changed description",
      },
    ];

    const instructions = toInstructions(changes);
    expect(instructions).toHaveLength(0);
  });
});
