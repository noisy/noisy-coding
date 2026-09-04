/** Audible agent voice for the TRY IT LIVE demo.
 *
 *  Preferred source: pre-generated mp3 clips shipped as static assets in
 *  src/assets/demo-voice/<key>.mp3 (one clip per scripted line, keys match
 *  the line keys useScriptedDriver passes to speak()). Clips dropped into
 *  that folder are picked up automatically via import.meta.glob - no code
 *  change needed when they land.
 *
 *  INTERIM FALLBACK: until the clips are generated (fal TTS, see the
 *  architecture doc), lines without a clip go through the browser's
 *  speechSynthesis. Quality varies per OS voice - this is a stopgap, not
 *  the shipped experience.
 *
 *  Playback starts from the START TALKING click chain (user gesture), so
 *  autoplay policy allows it; a refused play() is swallowed - the bubbles
 *  still tell the story. MUTE silences both sources immediately.
 */
import { onBeforeUnmount, ref } from "vue";

const clips = import.meta.glob("../assets/demo-voice/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function useDemoVoice() {
  const muted = ref(false);
  /** True while the interim speechSynthesis fallback is in use. */
  const usingSynthFallback = ref(false);

  let audio: HTMLAudioElement | null = null;

  function clipUrl(key: string): string | null {
    const hit = Object.entries(clips).find(([path]) => path.endsWith(`/${key}.mp3`));
    return hit ? hit[1] : null;
  }

  function stop() {
    audio?.pause();
    audio = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function speak(key: string, text: string) {
    if (muted.value) return;
    stop();
    const url = clipUrl(key);
    if (url) {
      audio = new Audio(url);
      void audio.play().catch(() => {});
      return;
    }
    if (!("speechSynthesis" in window)) return;
    usingSynthFallback.value = true;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const en =
      voices.find(
        (v) => v.lang.startsWith("en") && /samantha|google us english|karen|serena/i.test(v.name),
      ) ?? voices.find((v) => v.lang.startsWith("en"));
    if (en) u.voice = en;
    window.speechSynthesis.speak(u);
  }

  function setMuted(m: boolean) {
    muted.value = m;
    if (m) stop();
  }

  onBeforeUnmount(stop);
  return { muted, usingSynthFallback, speak, setMuted, stop };
}
