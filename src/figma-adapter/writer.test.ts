import { describe, it, expect } from "vitest";
import type { SchemaChange } from "../diff-engine/types.js";
import { generateDesignerInstructions } from "./writer.js";

// ---------------------------------------------------------------------------
// generateDesignerInstructions tests
// ---------------------------------------------------------------------------

describe("generateDesignerInstructions", () => {
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

    const instructions = generateDesignerInstructions(changes);
    expect(instructions).toHaveLength(1);
    expect(instructions[0].componentName).toBe("Button");
    expect(instructions[0].instructions[0]).toContain("Add variant property");
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

    const instructions = generateDesignerInstructions(changes);
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

    const instructions = generateDesignerInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("Add variant values");
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

    const instructions = generateDesignerInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("string property");
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

    const instructions = generateDesignerInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("instance swap property");
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

    const instructions = generateDesignerInstructions(changes);
    expect(instructions[0].instructions[0]).toContain("boolean property");
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

    const instructions = generateDesignerInstructions(changes);
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

    const instructions = generateDesignerInstructions(changes);
    expect(instructions).toHaveLength(0);
  });
});
