import { describe, it, expect } from "vitest";
import {
  getFrameworkProfile,
  getFrameworkInfo,
  KNOWN_FRAMEWORKS,
  SUPPORTED_FRAMEWORKS,
} from "./framework-profile.js";

describe("framework-profile", () => {
  // -------------------------------------------------------------------------
  // Registry
  // -------------------------------------------------------------------------

  it("KNOWN_FRAMEWORKS includes all 5 frameworks", () => {
    expect(KNOWN_FRAMEWORKS).toContain("react");
    expect(KNOWN_FRAMEWORKS).toContain("solid");
    expect(KNOWN_FRAMEWORKS).toContain("vue");
    expect(KNOWN_FRAMEWORKS).toContain("svelte");
    expect(KNOWN_FRAMEWORKS).toContain("angular");
    expect(KNOWN_FRAMEWORKS).toHaveLength(5);
  });

  it("SUPPORTED_FRAMEWORKS includes react and solid", () => {
    expect(SUPPORTED_FRAMEWORKS).toContain("react");
    expect(SUPPORTED_FRAMEWORKS).toContain("solid");
    expect(SUPPORTED_FRAMEWORKS).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // getFrameworkProfile
  // -------------------------------------------------------------------------

  it("defaults to react when no framework specified", () => {
    const profile = getFrameworkProfile();
    expect(profile.name).toBe("react");
  });

  it("returns react profile", () => {
    const profile = getFrameworkProfile("react");
    expect(profile.name).toBe("react");
    expect(profile.slotTypeString).toBe("ReactNode");
  });

  it("returns solid profile", () => {
    const profile = getFrameworkProfile("solid");
    expect(profile.name).toBe("solid");
    expect(profile.slotTypeString).toBe("JSX.Element");
  });

  it("throws on unknown framework", () => {
    expect(() => getFrameworkProfile("ember")).toThrow(
      /Unknown framework "ember"/,
    );
    expect(() => getFrameworkProfile("ember")).toThrow(
      /Known frameworks:/,
    );
  });

  it("throws on profile-only framework (vue)", () => {
    expect(() => getFrameworkProfile("vue")).toThrow(
      /reader\/writer support is not yet implemented/,
    );
    expect(() => getFrameworkProfile("vue")).toThrow(
      /Fully supported today: react, solid/,
    );
  });

  it("throws on profile-only framework (svelte)", () => {
    expect(() => getFrameworkProfile("svelte")).toThrow(
      /reader\/writer support is not yet implemented/,
    );
  });

  it("throws on profile-only framework (angular)", () => {
    expect(() => getFrameworkProfile("angular")).toThrow(
      /reader\/writer support is not yet implemented/,
    );
  });

  // -------------------------------------------------------------------------
  // getFrameworkInfo (non-throwing)
  // -------------------------------------------------------------------------

  it("getFrameworkInfo returns info for known frameworks", () => {
    const react = getFrameworkInfo("react");
    expect(react?.supportLevel).toBe("full");

    const vue = getFrameworkInfo("vue");
    expect(vue?.supportLevel).toBe("profile-only");
  });

  it("getFrameworkInfo returns undefined for unknown frameworks", () => {
    expect(getFrameworkInfo("ember")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // React profile specifics
  // -------------------------------------------------------------------------

  describe("react profile", () => {
    const profile = getFrameworkProfile("react");

    it("detects ReactNode as slot type", () => {
      expect(profile.isSlotType("ReactNode")).toBe(true);
      expect(profile.isSlotType("React.ReactNode")).toBe(true);
      expect(profile.isSlotType("ReactElement")).toBe(true);
      expect(profile.isSlotType("JSX.Element")).toBe(true);
      expect(profile.isSlotType("ReactNode | undefined")).toBe(true);
    });

    it("rejects non-slot types", () => {
      expect(profile.isSlotType("string")).toBe(false);
      expect(profile.isSlotType("number")).toBe(false);
      expect(profile.isSlotType("boolean")).toBe(false);
    });

    it("detects callback patterns", () => {
      const matches = (text: string) =>
        profile.callbackPatterns.some((p) => p.test(text));

      expect(matches("() => void")).toBe(true);
      expect(matches("(e: Event) => void")).toBe(true);
      expect(matches("Function")).toBe(true);
      expect(matches("MouseEventHandler")).toBe(true);
      expect(matches("string")).toBe(false);
    });

    it("has correct internal prop names", () => {
      expect(profile.internalPropNames.has("ref")).toBe(true);
      expect(profile.internalPropNames.has("key")).toBe(true);
      expect(profile.internalPropNames.has("children")).toBe(false);
    });

    it("detects forwardRef and memo", () => {
      expect(profile.detectWrappers("forwardRef((props) => {})")).toEqual({
        isForwardRef: true,
        isMemo: false,
      });
      expect(profile.detectWrappers("memo(() => {})")).toEqual({
        isForwardRef: false,
        isMemo: true,
      });
      expect(profile.detectWrappers("forwardRef(memo(() => {}))")).toEqual({
        isForwardRef: true,
        isMemo: true,
      });
    });

    it("has correct defaults", () => {
      expect(profile.defaultGlob).toBe("src/components/**/*.tsx");
      expect(profile.jsxEmit).toBe(4);
      expect(profile.usesTsMorph).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Solid profile specifics
  // -------------------------------------------------------------------------

  describe("solid profile", () => {
    const profile = getFrameworkProfile("solid");

    it("detects JSX.Element as slot type", () => {
      expect(profile.isSlotType("JSX.Element")).toBe(true);
      expect(profile.isSlotType("JSXElement")).toBe(true);
    });

    it("does not detect ReactNode", () => {
      expect(profile.isSlotType("ReactNode")).toBe(false);
    });

    it("does not detect forwardRef/memo", () => {
      expect(profile.detectWrappers("forwardRef(...)")).toEqual({
        isForwardRef: false,
        isMemo: false,
      });
    });

    it("has correct defaults", () => {
      expect(profile.defaultGlob).toBe("src/components/**/*.tsx");
      expect(profile.jsxEmit).toBe(1);
      expect(profile.usesTsMorph).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Profile-only frameworks (verify profile data is correct)
  // -------------------------------------------------------------------------

  describe("profile-only frameworks", () => {
    it("vue profile has correct slot type", () => {
      const info = getFrameworkInfo("vue");
      expect(info?.profile.slotTypeString).toBe("VNode");
      expect(info?.profile.defaultGlob).toBe("src/components/**/*.vue");
      expect(info?.profile.usesTsMorph).toBe(false);
    });

    it("svelte profile has correct slot type", () => {
      const info = getFrameworkInfo("svelte");
      expect(info?.profile.slotTypeString).toBe("Snippet");
      expect(info?.profile.defaultGlob).toBe("src/lib/components/**/*.svelte");
      expect(info?.profile.usesTsMorph).toBe(false);
    });

    it("angular profile has correct slot type", () => {
      const info = getFrameworkInfo("angular");
      expect(info?.profile.slotTypeString).toBe("TemplateRef<unknown>");
      expect(info?.profile.defaultGlob).toBe("src/app/components/**/*.component.ts");
      expect(info?.profile.usesTsMorph).toBe(true);
    });
  });
});
