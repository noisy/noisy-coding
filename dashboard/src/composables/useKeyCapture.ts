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

export function useKeyCapture(onResult: (action: string, result: CaptureResult) => void) {
  const capturing = ref<string | null>(null);
  const handler = (e: KeyboardEvent) => {
    const action = capturing.value;
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    const result = interpretKey(e);
    if (result.kind === "ignore") return;
    capturing.value = null;
    window.removeEventListener("keydown", handler, true);
    onResult(action, result);
  };
  function start(action: string) {
    if (capturing.value) window.removeEventListener("keydown", handler, true);
    capturing.value = action;
    window.addEventListener("keydown", handler, true);
  }
  function stop() {
    capturing.value = null;
    window.removeEventListener("keydown", handler, true);
  }
  onBeforeUnmount(stop);
  return { capturing, start, stop };
}
