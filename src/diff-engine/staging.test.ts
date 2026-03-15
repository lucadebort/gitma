import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SchemaChange } from "./types.js";
import {
  stageChange,
  stageChanges,
  getStagedChanges,
  unstageChange,
  clearStaging,
  hasStagedChanges,
} from "./staging.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `antikarlotta-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function makeChange(overrides: Partial<SchemaChange> = {}): SchemaChange {
  return {
    componentName: "Button",
    target: "prop",
    changeType: "added",
    fieldPath: "props.tooltip",
    severity: "additive",
    description: 'Added prop "tooltip"',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("staging", () => {
  it("stages a single change", () => {
    const change = makeChange();
    stageChange(testDir, change);

    const staged = getStagedChanges(testDir);
    expect(staged).toHaveLength(1);
    expect(staged[0].componentName).toBe("Button");
    expect(staged[0].fieldPath).toBe("props.tooltip");
  });

  it("stages multiple changes", () => {
    const changes = [
      makeChange({ fieldPath: "props.tooltip" }),
      makeChange({ fieldPath: "props.size", description: 'Added prop "size"' }),
      makeChange({ componentName: "Card", fieldPath: "slots.header" }),
    ];

    stageChanges(testDir, changes);

    const staged = getStagedChanges(testDir);
    expect(staged).toHaveLength(3);
  });

  it("hasStagedChanges returns false when empty", () => {
    expect(hasStagedChanges(testDir)).toBe(false);
  });

  it("hasStagedChanges returns true after staging", () => {
    stageChange(testDir, makeChange());
    expect(hasStagedChanges(testDir)).toBe(true);
  });

  it("unstages a specific change", () => {
    stageChanges(testDir, [
      makeChange({ fieldPath: "props.tooltip" }),
      makeChange({ fieldPath: "props.size" }),
    ]);

    const removed = unstageChange(testDir, "Button", "props.tooltip");
    expect(removed).toBe(true);

    const staged = getStagedChanges(testDir);
    expect(staged).toHaveLength(1);
    expect(staged[0].fieldPath).toBe("props.size");
  });

  it("unstageChange returns false for non-existent change", () => {
    const removed = unstageChange(testDir, "Button", "props.nonexistent");
    expect(removed).toBe(false);
  });

  it("clears all staged changes", () => {
    stageChanges(testDir, [
      makeChange({ fieldPath: "props.a" }),
      makeChange({ fieldPath: "props.b" }),
      makeChange({ fieldPath: "props.c" }),
    ]);

    clearStaging(testDir);

    expect(getStagedChanges(testDir)).toHaveLength(0);
    expect(hasStagedChanges(testDir)).toBe(false);
  });

  it("getStagedChanges returns empty when no staging dir", () => {
    const emptyDir = join(tmpdir(), `antikarlotta-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    expect(getStagedChanges(emptyDir)).toHaveLength(0);

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("deduplicates by change identity", () => {
    const change = makeChange();
    stageChange(testDir, change);
    stageChange(testDir, change); // stage the same change again

    const staged = getStagedChanges(testDir);
    expect(staged).toHaveLength(1); // should only have one
  });
});
