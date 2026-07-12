/** Live mic level (0..1) from the daemon's SSE stream at /stream/mic. */

import { onMounted, onUnmounted, ref, type Ref } from "vue";

export function useMicStream(): { level: Ref<number>; recording: Ref<boolean> } {
  const level = ref(0);
  const recording = ref(false);

  let source: EventSource | undefined;

  onMounted(() => {
    source = new EventSource("/stream/mic");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { level?: number; recording?: boolean };
        level.value = Math.max(0, Math.min(1, data.level ?? 0));
        recording.value = Boolean(data.recording);
      } catch {
        // malformed frame — keep the last known level
      }
    };
    // EventSource reconnects by itself; between attempts show silence.
    source.onerror = () => {
      level.value = 0;
      recording.value = false;
    };
  });
  onUnmounted(() => source?.close());

  return { level, recording };
}
