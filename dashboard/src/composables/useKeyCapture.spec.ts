import { describe, expect, it } from "vitest";
import { interpretKey } from "./useKeyCapture";

const k = (code: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) =>
  interpretKey({ code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

describe("interpretKey (#104)", () => {
  it("spells chords the way the daemon does", () => {
    expect(k("F8")).toEqual({ kind: "chord", chord: "F8" });
    expect(k("F8", { shiftKey: true, metaKey: true })).toEqual({ kind: "chord", chord: "cmd+shift+F8" });
    expect(k("KeyG", { ctrlKey: true, altKey: true })).toEqual({ kind: "chord", chord: "ctrl+alt+g" });
    expect(k("Digit1", { metaKey: true })).toEqual({ kind: "chord", chord: "cmd+1" });
    expect(k("Space", { metaKey: true })).toEqual({ kind: "chord", chord: "cmd+space" });
  });
  it("binds a right-hand modifier alone, waits on a left-hand one", () => {
    expect(k("AltRight", { altKey: true })).toEqual({ kind: "chord", chord: "right_option" });
    expect(k("MetaLeft", { metaKey: true })).toEqual({ kind: "ignore" });
  });
  it("Escape cancels, Delete clears, but only unmodified", () => {
    expect(k("Escape")).toEqual({ kind: "cancel" });
    expect(k("Backspace")).toEqual({ kind: "clear" });
    expect(k("Escape", { metaKey: true })).toEqual({ kind: "chord", chord: "cmd+escape" });
  });
  it("ignores keys it cannot name", () => {
    expect(k("MediaPlayPause")).toEqual({ kind: "ignore" });
  });
});
