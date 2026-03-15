import { describe, it, expect } from "vitest";
import {
  normalizeName,
  resolveNameToCode,
  resolveNameToFigma,
  resolveSchemaNames,
} from "./name-resolver.js";
import type { ComponentSchema } from "../schema/types.js";

describe("normalizeName", () => {
  it("trims whitespace", () => {
    expect(normalizeName("Button ")).toBe("Button");
    expect(normalizeName(" Button")).toBe("Button");
    expect(normalizeName(" Button ")).toBe("Button");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeName("Fab  test")).toBe("Fab test");
    expect(normalizeName("Form   Control")).toBe("Form Control");
  });

  it("leaves clean names unchanged", () => {
    expect(normalizeName("Button")).toBe("Button");
    expect(normalizeName("FormControl")).toBe("FormControl");
  });
});

describe("resolveNameToCode", () => {
  it("normalizes without a map", () => {
    expect(resolveNameToCode("Button ", {})).toBe("Button");
  });

  it("applies explicit mapping with raw name", () => {
    const config = { nameMap: { "Button ": "Button" } };
    expect(resolveNameToCode("Button ", config)).toBe("Button");
  });

  it("applies explicit mapping with normalized name", () => {
    const config = { nameMap: { "Fab test": "FloatingActionButton" } };
    expect(resolveNameToCode("Fab  test", config)).toBe("FloatingActionButton");
  });

  it("prefers raw name match over normalized", () => {
    const config = { nameMap: { "Button ": "Btn", "Button": "ButtonComp" } };
    expect(resolveNameToCode("Button ", config)).toBe("Btn");
  });

  it("falls back to normalized when no map match", () => {
    const config = { nameMap: { "Other": "OtherComp" } };
    expect(resolveNameToCode("Button ", config)).toBe("Button");
  });
});

describe("resolveNameToFigma", () => {
  it("returns the same name without a map", () => {
    expect(resolveNameToFigma("Button", {})).toBe("Button");
  });

  it("reverse-lookups the mapping", () => {
    const config = { nameMap: { "Button ": "Button" } };
    expect(resolveNameToFigma("Button", config)).toBe("Button ");
  });

  it("returns code name when no reverse match", () => {
    const config = { nameMap: { "Other": "OtherComp" } };
    expect(resolveNameToFigma("Button", config)).toBe("Button");
  });
});

describe("resolveSchemaNames", () => {
  it("applies name resolution to all schemas", () => {
    const schemas: ComponentSchema[] = [
      { name: "Button ", props: [], variants: [], slots: [], states: [], tokenRefs: [] },
      { name: "Fab test", props: [], variants: [], slots: [], states: [], tokenRefs: [] },
      { name: "Input", props: [], variants: [], slots: [], states: [], tokenRefs: [] },
    ];

    const config = {
      nameMap: { "Fab test": "FloatingActionButton" },
    };

    const resolved = resolveSchemaNames(schemas, config);

    expect(resolved[0].name).toBe("Button");    // normalized (trim)
    expect(resolved[1].name).toBe("FloatingActionButton");  // mapped
    expect(resolved[2].name).toBe("Input");      // unchanged
  });
});
