/** The dashboard tab as an audio device — both directions.
 *
 * Microphone: getUserMedia (browser AEC on) → AudioWorklet tap → resample
 * to int16 16 kHz (pure fns in pcm.ts) → WS to the daemon's tab-audio
 * bridge (one port above the HTTP API).
 * Speaker: the bridge sends {"type":"play"} + one binary MP3 clip; the tab
 * plays it and acks {"type":"played"} — {"type":"stop"} cuts it short.
 * Every outgoing message renews the daemon-side lease; a closed or
 * crashed tab frees the device by itself.
 */

import { ref, type Ref } from "vue";
import { concatFloat, floatToInt16, resampleTo16k, TARGET_SAMPLE_RATE } from "./pcm";

// The worklet only TAPS audio (128-sample crumbs to the main thread);
// conversion stays here, testable in pcm.ts.
const WORKLET_SOURCE = `
class TabMicTap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("tab-mic-tap", TabMicTap);
`;

const HEARTBEAT_MS = 500; // renews the daemon's 2 s lease 4× per period
// Batch audio to ≥30 ms per WS message (one VAD frame) — per-crumb sends
// would be ~375 messages a second.
const MIN_SEND_SAMPLES_16K = 480;

function bridgeUrl(): string {
  // The bridge listens one port above the daemon's HTTP API. Served from
  // the daemon, that's location.port+1; on the Vite dev server (which
  // proxies HTTP but not this WS) assume the default daemon port.
  const served = Number(window.location.port || "0");
  const bridgePort = served && served !== 5173 ? served + 1 : 8766;
  return `ws://${window.location.hostname}:${bridgePort}`;
}

export interface BrowserAudio {
  /** The tab holds the audio lease (connected to the bridge). */
  active: Ref<boolean>;
  /** The tab is capturing and streaming its microphone. */
  micLive: Ref<boolean>;
  error: Ref<string>;
  /** Lease + playback only — enough to be the SPEAKER. */
  connect: () => Promise<void>;
  /** connect() + microphone capture — the tab as the MIC. */
  enable: () => Promise<void>;
  disable: () => void;
}

export function useBrowserAudio(): BrowserAudio {
  const active = ref(false);
  const micLive = ref(false);
  const error = ref("");
  let ws: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pending: Float32Array[] = [];
  let pendingLength = 0;
  let clipType = "audio/mpeg";
  let clip: HTMLAudioElement | null = null;

  function stopClip() {
    if (!clip) return;
    clip.onended = null;
    clip.pause();
    clip = null;
  }

  function disable() {
    clearInterval(heartbeat);
    heartbeat = undefined;
    stopClip();
    ws?.close();
    ws = null;
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    audioContext?.close().catch(() => {});
    audioContext = null;
    pending = [];
    pendingLength = 0;
    active.value = false;
    micLive.value = false;
  }

  function ackPlayed(socket: WebSocket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "played" }));
    }
  }

  function playClip(socket: WebSocket, data: ArrayBuffer) {
    stopClip();
    const url = URL.createObjectURL(new Blob([data], { type: clipType }));
    clip = new Audio(url);
    const finish = () => {
      URL.revokeObjectURL(url);
      clip = null;
      ackPlayed(socket);
    };
    clip.onended = finish;
    // A refused play() (autoplay policy) must still ack, or the daemon's
    // playback worker would sit on a clip nobody will ever hear.
    clip.play().catch(() => {
      error.value = "tab playback blocked — click the page once and retry";
      finish();
    });
  }

  async function connect(): Promise<void> {
    if (ws && ws.readyState === WebSocket.OPEN && active.value) return;
    disable();
    error.value = "";

    const socket = new WebSocket(bridgeUrl());
    ws = socket;
    socket.binaryType = "arraybuffer";

    const granted = new Promise<void>((resolve, reject) => {
      socket.onopen = () => socket.send(JSON.stringify({ type: "hello" }));
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          playClip(socket, event.data as ArrayBuffer);
          return;
        }
        let message: { type?: string; reason?: string; content_type?: string };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "granted") {
          active.value = true;
          resolve();
        } else if (message.type === "rejected") {
          error.value = message.reason ?? "audio lease rejected";
          reject(new Error(error.value));
        } else if (message.type === "play") {
          clipType = message.content_type ?? "audio/mpeg";
        } else if (message.type === "stop") {
          stopClip();
          ackPlayed(socket);
        }
      };
      socket.onerror = () => {
        error.value = "cannot reach the daemon's audio bridge";
        reject(new Error(error.value));
      };
    });
    socket.onclose = () => {
      if (ws === socket) disable();
    };

    heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "hb" }));
      }
    }, HEARTBEAT_MS);

    try {
      await granted;
    } catch (rejection) {
      disable();
      throw rejection;
    }
  }

  /** Must run from a user gesture (the picker click) — both getUserMedia
   * and AudioContext need one. Throws when the mic or lease is refused. */
  async function enable(): Promise<void> {
    await connect();
    if (micLive.value) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        // Browser AEC is the whole point: it removes Claude's own voice
        // from the capture, which is what makes barge-in possible.
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      error.value = "microphone permission denied";
      disable();
      throw new Error(error.value);
    }

    audioContext = new AudioContext();
    const workletUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: "text/javascript" }),
    );
    await audioContext.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);
    const capturedRate = audioContext.sampleRate;
    const minPendingSamples = Math.ceil(
      (MIN_SEND_SAMPLES_16K * capturedRate) / TARGET_SAMPLE_RATE,
    );

    const source = audioContext.createMediaStreamSource(mediaStream);
    const tap = new AudioWorkletNode(audioContext, "tab-mic-tap");
    source.connect(tap);
    tap.port.onmessage = (event) => {
      const socket = ws;
      if (!socket || socket.readyState !== WebSocket.OPEN || !active.value) return;
      pending.push(event.data as Float32Array);
      pendingLength += (event.data as Float32Array).length;
      if (pendingLength < minPendingSamples) return;
      const batch = concatFloat(pending, pendingLength);
      pending = [];
      pendingLength = 0;
      socket.send(floatToInt16(resampleTo16k(batch, capturedRate)).buffer);
    };
    micLive.value = true;
  }

  return { active, micLive, error, connect, enable, disable };
}
