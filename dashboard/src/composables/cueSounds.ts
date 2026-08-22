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
The "mic is live" indicator you can hear: soft pink-ish noise (white noise
through a gentle lowpass), like a distant air vent - far less musical and
less intrusive than a tone. Starts when recording starts, stops the
instant it ends. Continuous by design: a glance-free answer to "is it
capturing?" in every mode - hold, toggle and auto. */

export type HumNoise = "pink" | "white" | "brown";
export const HUM_NOISES: HumNoise[] = ["pink", "white", "brown"];
/** UI volume 0..1 maps onto this gain ceiling - even "10" stays polite. */
const HUM_MAX_GAIN = 0.02;
export const HUM_DEFAULT_VOLUME = 0.25;

let hum: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
const noiseBuffers: Partial<Record<HumNoise, AudioBuffer>> = {};

function noiseBuffer(ctx: AudioContext, kind: HumNoise): AudioBuffer {
  const cached = noiseBuffers[kind];
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (kind === "white") {
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
  } else if (kind === "brown") {
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    // Paul Kellet's economy pink approximation - softer than white,
    // brighter than brown; nothing for the ear to latch onto.
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
  }
  noiseBuffers[kind] = buffer;
  return buffer;
}

export function startRecordingHum(
  kind: HumNoise = "pink",
  volume: number = HUM_DEFAULT_VOLUME,
): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (hum) stopRecordingHum();
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, kind);
  source.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 500; // keep only the airy bottom
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(
    Math.max(0, Math.min(1, volume)) * HUM_MAX_GAIN,
    ctx.currentTime + 0.3,
  );
  source.connect(lowpass).connect(gain).connect(ctx.destination);
  source.start();
  hum = { source, gain };
}

export function stopRecordingHum(): void {
  const ctx = audioContext();
  if (!ctx || !hum) return;
  const { source, gain } = hum;
  hum = null;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
  source.stop(ctx.currentTime + 0.15);
}
