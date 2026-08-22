/** Tiny synthesized cues — subtle by design, no audio assets needed. */

import type { CueName } from "./cueEvents";

interface Tone {
  freq: number;
  at: number; // seconds after cue start
  duration: number;
  gain: number;
}

// Each cue is one or two short sine blips; volumes stay whisper-quiet so
// they never compete with speech. Contours are deliberately distinct:
// committed = single tick, delivered = rising pair, claude = FALLING pair.
const CUE_TONES: Record<CueName, Tone[]> = {
  committed: [{ freq: 1180, at: 0, duration: 0.05, gain: 0.04 }],
  delivered: [
    { freq: 620, at: 0, duration: 0.06, gain: 0.05 },
    { freq: 880, at: 0.07, duration: 0.08, gain: 0.05 },
  ],
  claude: [
    { freq: 840, at: 0, duration: 0.09, gain: 0.06 },
    { freq: 540, at: 0.1, duration: 0.14, gain: 0.06 },
  ],
  unheard: [{ freq: 320, at: 0, duration: 0.1, gain: 0.03 }],
  error: [
    { freq: 220, at: 0, duration: 0.12, gain: 0.06 },
    { freq: 180, at: 0.14, duration: 0.16, gain: 0.06 },
  ],
};

let context: AudioContext | undefined;

function audioContext(): AudioContext | undefined {
  if (typeof AudioContext === "undefined") return undefined;
  context ??= new AudioContext();
  if (context.state === "suspended") context.resume();
  return context;
}

export function playCue(cue: CueName): void {
  const ctx = audioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  for (const tone of CUE_TONES[cue]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tone.freq;
    // Soft attack/release envelope — clickless, unobtrusive.
    gain.gain.setValueAtTime(0, start + tone.at);
    gain.gain.linearRampToValueAtTime(tone.gain, start + tone.at + 0.015);
    gain.gain.linearRampToValueAtTime(0, start + tone.at + tone.duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + tone.at);
    oscillator.stop(start + tone.at + tone.duration + 0.02);
  }
}

/* --- recording hum ------------------------------------------------------
The "mic is live" indicator you can hear: a barely-there two-note drone
(a soft fifth, slowly breathing) that starts when recording starts and
stops the instant it ends. Continuous by design - a glance-free answer to
"is it capturing?" in every mode: hold, toggle and auto. */

let hum: { oscillators: OscillatorNode[]; gain: GainNode; lfo: OscillatorNode } | null = null;

export function startRecordingHum(): void {
  const ctx = audioContext();
  if (!ctx || hum) return;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 0.25); // whisper
  // A soft fifth (A3 + E4), slightly detuned so it shimmers instead of
  // beeping; a slow LFO makes it "breathe" so the ear doesn't tune it out
  // entirely - present, never annoying.
  const oscillators = [220, 330.5].map((freq) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = freq;
    oscillator.connect(master);
    oscillator.start();
    return oscillator;
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.35;
  lfoGain.gain.value = 0.004;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start();
  master.connect(ctx.destination);
  hum = { oscillators, gain: master, lfo };
}

export function stopRecordingHum(): void {
  const ctx = audioContext();
  if (!ctx || !hum) return;
  const { oscillators, gain, lfo } = hum;
  hum = null;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
  for (const oscillator of oscillators) oscillator.stop(ctx.currentTime + 0.15);
  lfo.stop(ctx.currentTime + 0.15);
}
