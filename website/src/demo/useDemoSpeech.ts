/** STOPGAP transcription for the TRY IT LIVE demo.
 *
 *  Phase 1 has no STT of its own, so this wraps the browser's
 *  SpeechRecognition (webkit-prefixed in Chrome/Safari) as a progressive
 *  enhancement: interim results stream into the driver's liveText, a
 *  finalized phrase lands as a user message. Feature-detected; browsers
 *  without it (Firefox) degrade silently to the VAD-only behavior.
 *
 *  NOTE: unlike useDemoMic (a pure local meter), Chrome's SpeechRecognition
 *  sends audio to the browser vendor's speech service. That is the
 *  documented cost of this stopgap; phase 2's Grok realtime session
 *  transcribes natively (partials -> liveText per the driver contract) and
 *  replaces this file - see live-demo-architecture.md.
 */
import { onBeforeUnmount, ref } from "vue";

interface Handlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
}

export function useDemoSpeech(handlers: Handlers) {
  const SR: any =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  const supported = Boolean(SR);
  const listening = ref(false);
  let rec: any = null;

  function start() {
    if (!supported || listening.value) return;
    rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const text = String(res[0].transcript).trim();
          if (text) handlers.onFinal(text);
        } else {
          interim += res[0].transcript;
        }
      }
      handlers.onInterim(interim.trim());
    };
    // Chrome ends recognition after silence; keep it alive while we want it.
    rec.onend = () => {
      if (!listening.value) return;
      try {
        rec.start();
      } catch {
        listening.value = false;
      }
    };
    rec.onerror = () => {}; // silent degradation - VAD still carries the demo
    try {
      rec.start();
      listening.value = true;
    } catch {
      listening.value = false;
    }
  }

  function stop() {
    listening.value = false;
    try {
      rec?.stop();
    } catch {
      /* already stopped */
    }
    rec = null;
    handlers.onInterim("");
  }

  onBeforeUnmount(stop);
  return { supported, listening, start, stop };
}
