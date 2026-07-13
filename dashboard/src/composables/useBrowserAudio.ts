/** The dashboard tab as a microphone.
 *
 * getUserMedia (browser AEC on) → AudioWorklet taps raw PCM → resample to
 * int16 16 kHz → WebSocket to the daemon's tab-audio bridge (one port
 * above the HTTP API). Every outgoing message renews the daemon-side
 * lease; a closed or crashed tab frees the device by itself.
 */

import { ref, type Ref } from "vue";
import { concatFloat, floatToInt16, resampleTo16k, TARGET_SAMPLE_RATE } from "./pcm";

// The worklet only TAPS audio (128-sample crumbs to the main thread);
// resampling and int16 conversion stay here, testable in pcm.ts.
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
  /** The tab holds the audio lease and is streaming. */
  active: Ref<boolean>;
  error: Ref<string>;
  enable: () => Promise<void>;
  disable: () => void;
}

export function useBrowserAudio(): BrowserAudio {
  const active = ref(false);
  const error = ref("");
  let ws: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pending: Float32Array[] = [];
  let pendingLength = 0;

  function disable() {
    clearInterval(heartbeat);
    heartbeat = undefined;
    ws?.close();
    ws = null;
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    audioContext?.close().catch(() => {});
    audioContext = null;
    pending = [];
    pendingLength = 0;
    active.value = false;
  }

  /** Must run from a user gesture (the picker click) — both getUserMedia
   * and AudioContext need one. Throws when the mic or lease is refused. */
  async function enable(): Promise<void> {
    disable();
    error.value = "";
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        // Browser AEC is the whole point: it removes Claude's own voice
        // from the capture, which is what makes barge-in possible.
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      error.value = "microphone permission denied";
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

    const socket = new WebSocket(bridgeUrl());
    ws = socket;
    socket.binaryType = "arraybuffer";

    const granted = new Promise<void>((resolve, reject) => {
      socket.onopen = () => socket.send(JSON.stringify({ type: "hello" }));
      socket.onmessage = (event) => {
        let message: { type?: string; reason?: string };
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.type === "granted") {
          active.value = true;
          resolve();
        } else if (message.type === "rejected") {
          error.value = message.reason ?? "audio lease rejected";
          reject(new Error(error.value));
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

    const source = audioContext.createMediaStreamSource(mediaStream);
    const tap = new AudioWorkletNode(audioContext, "tab-mic-tap");
    source.connect(tap);
    tap.port.onmessage = (event) => {
      if (!active.value || socket.readyState !== WebSocket.OPEN) return;
      pending.push(event.data as Float32Array);
      pendingLength += (event.data as Float32Array).length;
      if (pendingLength < minPendingSamples) return;
      const batch = concatFloat(pending, pendingLength);
      pending = [];
      pendingLength = 0;
      socket.send(floatToInt16(resampleTo16k(batch, capturedRate)).buffer);
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

  return { active, error, enable, disable };
}
