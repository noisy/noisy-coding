/** Shared plumbing for the hero-scene variants.
 *
 *  Every variant composes the REAL dashboard components (ClaudeCodeMock,
 *  Companion) on a fixed 1200x760 stage and differs only in choreography.
 *  This module holds the cast (feeds, agents), the stage-scaling hook, and
 *  a tiny timeline helper so each variant file is just its own story.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import type { CompanionMessage } from "@dashboard/components/Companion.vue";

/* One agent on the hero - the multi-agent story has its own section. */
export const AGENTS = [
  { name: "orderflow-api", voice: "lux", active: true },
];

export const FULL_FEED: CompanionMessage[] = [
  { id: 1, role: "user", text: "what's wrong with the webhook?" },
  { id: 2, role: "claude", text: "Bad signatures were retried forever. I made them fail fast." },
  { id: 3, role: "user", text: "good, run the full suite" },
  { id: 4, role: "claude", text: "Running - both paths are pinned by the new test." },
];

/** Total transcript lines in ClaudeCodeMock (prompt..cursor). */
export const TRANSCRIPT_LINES = 10;

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scale the fixed 1200x760 stage into the width the hero gives us, and
 *  hold the body class the companion's transparency styles key off. */
export function useStage(): { frame: Ref<HTMLElement | null>; scale: Ref<number> } {
  const frame = ref<HTMLElement | null>(null);
  const scale = ref(0.5);
  let ro: ResizeObserver | null = null;
  onMounted(() => {
    document.body.classList.add("companion-transparent");
    if (frame.value) {
      ro = new ResizeObserver(() => {
        if (frame.value) scale.value = frame.value.clientWidth / 1200;
      });
      ro.observe(frame.value);
      scale.value = frame.value.clientWidth / 1200;
    }
  });
  onBeforeUnmount(() => {
    document.body.classList.remove("companion-transparent");
    ro?.disconnect();
  });
  return { frame, scale };
}

/** setTimeout bookkeeping: schedule with at(), everything is cleared on
 *  unmount, and restart() wipes the slate for the next loop pass. */
export function useTimeline() {
  let timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const clear = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };
  onBeforeUnmount(clear);
  return { at, clear };
}
