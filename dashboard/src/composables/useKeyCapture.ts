/* Press-to-capture for hotkeys (#104).
 *
 * The dashboard window has focus while the user picks a key, so a plain
 * keydown listener sees the chord - no Input Monitoring needed for THIS
 * step; only the daemon's global tap needs it. The chord is spelled the
 * way listener/chords.py spells it: modifiers cmd, ctrl, alt, shift in that
 * order, then the key name. */
import { onBeforeUnmount, ref } from "vue";

const CODE_TO_KEY: Record<string, string> = {
  Space: "space", Escape: "escape", Enter: "return", Tab: "tab", Backspace: "delete", Delete: "forward_delete",
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown", CapsLock: "capslock",
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";",
  Quote: "'", Comma: ",", Period: ".", Slash: "/", Backquote: "`",
  MetaRight: "right_cmd", AltRight: "right_option", ControlRight: "right_ctrl", ShiftRight: "right_shift",
};
const LEFT_MODIFIERS = new Set(["MetaLeft", "AltLeft", "ControlLeft", "ShiftLeft"]);

export type CaptureResult = { kind: "chord"; chord: string } | { kind: "cancel" } | { kind: "clear" } | { kind: "ignore" };

/** Turn one keydown into a capture result. Exported for tests. */
export function interpretKey(e: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): CaptureResult {
  const code = e.code;
  if (code === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) return { kind: "cancel" };
  if ((code === "Backspace" || code === "Delete") && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) return { kind: "clear" };
  if (LEFT_MODIFIERS.has(code)) return { kind: "ignore" }; // wait for the real key
  let key: string | undefined;
  if (code in CODE_TO_KEY) key = CODE_TO_KEY[code];
  else if (/^Key[A-Z]$/.test(code)) key = code.slice(3).toLowerCase();
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-9]|20)$/.test(code)) key = code;
  if (!key) return { kind: "ignore" };
  const bareModifier = key.startsWith("right_") || key === "capslock";
  const mods = bareModifier ? [] : [e.metaKey && "cmd", e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift"].filter(Boolean);
  return { kind: "chord", chord: [...mods, key].join("+") };
}

/** Same window the daemon uses (listener/chords.py DOUBLE_TAP_SECONDS). */
export const DOUBLE_TAP_MS = 350;

/** Fold a second press into an "x2" chord: returns the chord to emit now, or
 * null to keep waiting. Exported for tests. */
export function foldDouble(pending: string | null, next: string, elapsedMs: number): { emit: string | null; pending: string | null } {
  if (pending && pending === next && elapsedMs <= DOUBLE_TAP_MS) return { emit: `${next} x2`, pending: null };
  return { emit: null, pending: next };
}

export function useKeyCapture(onResult: (action: string, result: CaptureResult) => void) {
  const capturing = ref<string | null>(null);
  let pending: { chord: string; at: number; timer: ReturnType<typeof setTimeout> } | null = null;

  const finish = (action: string, result: CaptureResult) => {
    capturing.value = null;
    window.removeEventListener("keydown", handler, true);
    if (pending) clearTimeout(pending.timer);
    pending = null;
    onResult(action, result);
  };
  const handler = (e: KeyboardEvent) => {
    const action = capturing.value;
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    const result = interpretKey(e);
    if (result.kind === "ignore") return;
    if (result.kind !== "chord") { finish(action, result); return; }
    // A single press is held back for DOUBLE_TAP_MS: the same key again in
    // that window makes it a double-press binding ("escape x2").
    const now = performance.now();
    const folded = foldDouble(pending?.chord ?? null, result.chord, pending ? now - pending.at : Infinity);
    if (folded.emit) { finish(action, { kind: "chord", chord: folded.emit }); return; }
    if (pending) clearTimeout(pending.timer);
    const chord = result.chord;
    pending = { chord, at: now, timer: setTimeout(() => finish(action, { kind: "chord", chord }), DOUBLE_TAP_MS) };
  };
  function start(action: string) {
    if (capturing.value) window.removeEventListener("keydown", handler, true);
    if (pending) clearTimeout(pending.timer);
    pending = null;
    capturing.value = action;
    window.addEventListener("keydown", handler, true);
  }
  function stop() {
    capturing.value = null;
    if (pending) clearTimeout(pending.timer);
    pending = null;
    window.removeEventListener("keydown", handler, true);
  }
  onBeforeUnmount(stop);
  return { capturing, start, stop };
}
