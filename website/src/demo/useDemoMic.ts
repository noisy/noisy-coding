/** Website-local microphone level for the TRY IT LIVE demo.
 *
 *  getUserMedia + AnalyserNode -> a 0..1 level ref that drives the real
 *  Companion spectrum. Deliberately NOT the dashboard's useMicStream: the
 *  site bundle depends only on Companion.vue plus the driver interface
 *  (see demo/live-demo-architecture.md, cautions). No audio ever leaves
 *  the page - there is no recording and no network here, just a meter.
 */
import { onBeforeUnmount, ref } from "vue";

export function useDemoMic() {
  /** Mic is open and metering. */
  const on = ref(false);
  /** Smoothed RMS level, 0..1. */
  const level = ref(0);
  /** "denied" | "unavailable" | null - for the fallback path. */
  const error = ref<"denied" | "unavailable" | null>(null);

  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let raf: number | undefined;

  /** The raw stream, for a driver that consumes audio itself (the realtime
   *  session) - one getUserMedia per click, shared, still page-local here. */
  const getStream = () => stream;

  async function start(): Promise<boolean> {
    if (on.value) return true;
    error.value = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      error.value = e instanceof DOMException && e.name === "NotAllowedError"
        ? "denied" : "unavailable";
      return false;
    }
    ctx = new AudioContext();
    // Started from a click this is a no-op; guards the context against
    // starting suspended (autoplay policy edge cases, automated runs).
    void ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const meter = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // Speech RMS rarely passes ~0.25; stretch it so talking fills the bars,
      // and smooth decay so the spectrum falls instead of flickering.
      const target = Math.min(1, rms * 5);
      level.value = target > level.value ? target : level.value * 0.85;
      raf = requestAnimationFrame(meter);
    };
    raf = requestAnimationFrame(meter);
    on.value = true;
    return true;
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = undefined;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void ctx?.close();
    ctx = null;
    level.value = 0;
    on.value = false;
  }

  onBeforeUnmount(stop);
  return { on, level, error, start, stop, getStream };
}
