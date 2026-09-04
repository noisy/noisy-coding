/** Phase 2: the Grok realtime driver behind TRY IT LIVE.
 *
 *  Implements the CompanionDriver seam (types only, from the dashboard) on
 *  top of a live xAI realtime voice session:
 *    - POST /api/demo-token (our separate website-backend) mints an
 *      ephemeral token; the API key never reaches this bundle
 *    - WebSocket to wss://api.x.ai/v1/realtime, authenticated via the
 *      Sec-WebSocket-Protocol subprotocol "xai-client-secret.<token>"
 *      (browsers cannot set an Authorization header on a WebSocket)
 *    - mic PCM16 -> input_audio_buffer.append; agent audio deltas played
 *      through an AudioContext
 *    - partial transcripts -> liveText, finalized turns -> feed entries
 *      with monotonic stable ids, speaking state -> mode
 *
 *  connect() resolves true only when the session is genuinely usable; ANY
 *  failure before or after resolves/ends cleanly so TryLiveSection can fall
 *  back to the scripted driver - the section never shows a broken state.
 *  This driver replaces the phase-1 stopgaps (browser SpeechRecognition,
 *  speechSynthesis/clips): the realtime session transcribes and speaks
 *  natively.
 */
import { onBeforeUnmount, ref, type Ref } from "vue";
import type { CompanionDriver } from "@dashboard/composables/companionDriver";
import type { CompanionAgent, CompanionMessage } from "@dashboard/components/Companion.vue";
/** Realtime audio is 24kHz mono PCM16 both ways (OpenAI-compatible shape). */
const SAMPLE_RATE = 24000;

/** The live demo speaks as "lux", the voice Krzysztof picked. It exists in
 *  the realtime API and in voiceSprites.ts, so the portrait resolves.
 *  Voice ids are case-insensitive on the API side. */
export const REALTIME_VOICE = "lux";

/** ?demo=debug - dev-only: log incoming realtime event NAMES (never
 *  payloads, never tokens) so a live run can confirm the real event
 *  vocabulary. Off by default. */
const DEBUG_EVENTS = new URLSearchParams(window.location.search).get("demo") === "debug";

interface TokenGrant {
  token: string;
  session: {
    ws_url: string;
    model: string;
    max_seconds: number;
    instructions: string;
  };
}

/** Why the live session is not running - for the section's honest error
 *  line. Categories only, never upstream details. */
export type RealtimeFailure = "backend" | "websocket" | "session-ended" | null;

export interface RealtimeDriver extends CompanionDriver {
  /** Mint a token, open the session, start streaming the given mic stream.
   *  Resolves false (never throws) when anything is unavailable. */
  connect: (mic: MediaStream) => Promise<boolean>;
  /** Called when the session ends for any reason after connecting. */
  onEnded: (fn: () => void) => void;
  /** Set when connect() fails or the session dies - see RealtimeFailure. */
  failure: Ref<RealtimeFailure>;
  /** Call-style mute: stop sending mic audio without ending the session. */
  micMuted: Ref<boolean>;
  setMicMuted: (muted: boolean) => void;
  stop: () => void;
}

export function useRealtimeDriver(): RealtimeDriver {
  const mode = ref<"idle" | "user" | "claude">("idle");
  const feed = ref<CompanionMessage[]>([]);
  const liveText = ref("");
  const level = ref(0);
  const activity = ref<string | null>(null);
  // No multi-agent story in the demo; one active voice on the rail.
  const agents = ref<CompanionAgent[]>([{ name: "web-demo", voice: REALTIME_VOICE, active: true }]);

  const failure = ref<RealtimeFailure>(null);
  const micMuted = ref(false);
  let micStream: MediaStream | null = null;

  let ws: WebSocket | null = null;
  let ctx: AudioContext | null = null;
  let capture: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let sessionTimer: number | undefined;
  let nextId = 1;
  let agentText = "";
  let playCursor = 0; // when the next agent audio chunk may start
  let endedFns: (() => void)[] = [];
  let ended = false;

  function push(role: "user" | "claude", text: string) {
    feed.value = [...feed.value, { id: nextId++, role, text, zone: "done" }];
  }

  /* One utterance = one feed row, mirroring the product (useDaemonState /
   * useConversationFeed key everything on the daemon's per-utterance id and
   * update that record through its status transitions; the in-progress
   * utterance lives in the composer slot, not the feed). Here the realtime
   * item id plays the utterance-id role: the model refines a transcript of
   * the SAME utterance with more context, so a repeat of the item id must
   * REPLACE the committed text, never append a duplicate bubble. */
  const userItemRow = new Map<string, number>();
  /** Fallback key when an event carries no item id: one synthetic id per
   *  detected speech turn (reset on speech_started). */
  let turnSeq = 0;
  let turnKey = "turn-0";
  const itemKeyOf = (ev: Record<string, any>) =>
    String(ev.item_id ?? ev.item?.id ?? turnKey);

  function upsertUser(itemKey: string, text: string) {
    const existing = userItemRow.get(itemKey);
    if (existing != null) {
      feed.value = feed.value.map((m) => (m.id === existing ? { ...m, text } : m));
      return;
    }
    const id = nextId++;
    userItemRow.set(itemKey, id);
    feed.value = [...feed.value, { id, role: "user", text, zone: "done" }];
  }

  function end() {
    if (ended) return;
    ended = true;
    if (!failure.value) failure.value = "session-ended";
    stop();
    endedFns.forEach((f) => f());
  }

  function setMicMuted(muted: boolean) {
    micMuted.value = muted;
    micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (muted) level.value = 0;
  }

  function stop() {
    if (sessionTimer) window.clearTimeout(sessionTimer);
    sessionTimer = undefined;
    capture?.disconnect();
    capture = null;
    source?.disconnect();
    source = null;
    ws?.close();
    ws = null;
    void ctx?.close();
    ctx = null;
    mode.value = "idle";
    level.value = 0;
    activity.value = null;
  }

  /* --- audio plumbing ------------------------------------------------------ */

  function startCapture(mic: MediaStream) {
    ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    void ctx.resume();
    source = ctx.createMediaStreamSource(mic);
    // ScriptProcessor is deprecated but universal and plenty for a demo;
    // an AudioWorklet is the polish step once the session proves out.
    capture = ctx.createScriptProcessor(4096, 1, 1);
    capture.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0);
      // Level for the spectrum: same stretch/decay feel as useDemoMic.
      let sum = 0;
      for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i];
      const target = Math.min(1, Math.sqrt(sum / f32.length) * 5);
      level.value = target > level.value ? target : level.value * 0.85;

      if (ws?.readyState !== WebSocket.OPEN) return;
      const pcm = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      let bin = "";
      const bytes = new Uint8Array(pcm.buffer);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(bin) }));
    };
    source.connect(capture);
    capture.connect(ctx.destination); // required for onaudioprocess to fire
  }

  function playPcmChunk(b64: string) {
    if (!ctx) return;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const buf = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    playCursor = Math.max(playCursor, now);
    src.start(playCursor);
    playCursor += buf.duration;
  }

  /* --- session events ------------------------------------------------------ */

  function handleEvent(ev: Record<string, any>) {
    // Event NAME only - payloads can carry transcripts and audio.
    if (DEBUG_EVENTS) console.debug("[realtime-event]", String(ev.type));
    // Diagnostic: when the server echoes the applied config, say whether
    // transcription actually stuck - flags only, no content, no tokens.
    if (DEBUG_EVENTS && (ev.type === "session.updated" || ev.type === "session.created")) {
      const s = ev.session ?? {};
      const nested = s.audio?.input?.transcription;
      const flat = s.input_audio_transcription;
      console.debug(
        "[realtime-session]",
        `transcription nested(audio.input.transcription)=${nested ? "ON model=" + String(nested.model ?? "unset") : "off"}`,
        `flat(input_audio_transcription)=${flat ? "ON model=" + String(flat.model ?? "unset") : "off"}`,
        `voice=${String(s.voice ?? "unset")}`,
      );
    }
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        mode.value = "user";
        turnKey = `turn-${++turnSeq}`; // new utterance for id-less events
        break;
      case "input_audio_buffer.speech_stopped":
        if (mode.value === "user") mode.value = "idle";
        break;
      case "conversation.item.input_audio_transcription.updated": {
        // xAI semantics: CUMULATIVE transcript so far (may correct earlier
        // updates) - replace, never append. While the utterance is still
        // live it belongs in the composer slot (liveText); once its item
        // has been committed, a late correction updates the committed row.
        const text = String(ev.transcript ?? ev.delta ?? "");
        if (userItemRow.has(itemKeyOf(ev))) {
          if (text.trim()) upsertUser(itemKeyOf(ev), text.trim());
        } else {
          mode.value = "user";
          liveText.value = text || liveText.value;
        }
        break;
      }
      case "conversation.item.input_audio_transcription.delta":
        // OpenAI-style fallback shape, in case xAI emits deltas too.
        mode.value = "user";
        liveText.value += String(ev.delta ?? "");
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const text = String(ev.transcript ?? "").trim();
        liveText.value = "";
        // A refined transcript of the same item replaces the earlier row -
        // this is what turned one spoken sentence into two or three bubbles.
        if (text) upsertUser(itemKeyOf(ev), text);
        break;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta": // legacy OpenAI-style name
        mode.value = "claude";
        agentText += String(ev.delta ?? "");
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = String(ev.transcript ?? agentText).trim();
        agentText = "";
        if (text) push("claude", text);
        break;
      }
      case "response.output_audio.delta":
      case "response.audio.delta": // legacy OpenAI-style name
        playPcmChunk(String(ev.delta ?? ""));
        break;
      case "response.done": {
        // Fallback: if no transcript event arrived, xAI may embed the
        // assistant transcript in the response payload itself.
        if (!agentText) {
          const items = ev.response?.output ?? [];
          const text = items
            .flatMap((it: any) => it?.content ?? [])
            .map((c: any) => c?.transcript ?? c?.text ?? "")
            .join("")
            .trim();
          if (text && !feed.value.some((m) => m.role === "claude" && m.text === text)) {
            push("claude", text);
          }
        } else {
          // Deltas arrived but no .done: commit what we accumulated.
          push("claude", agentText.trim());
          agentText = "";
        }
        if (mode.value === "claude") mode.value = "idle";
        break;
      }
      case "error":
        // Code/type only - error messages can echo payload content.
        if (DEBUG_EVENTS)
          console.debug("[realtime-error]", String(ev.error?.type ?? ""), String(ev.error?.code ?? ""));
        end();
        break;
    }
  }

  /* --- lifecycle ----------------------------------------------------------- */

  async function connect(mic: MediaStream): Promise<boolean> {
    failure.value = null;
    ended = false;
    micStream = mic;
    let grant: TokenGrant;
    try {
      const r = await fetch("/api/demo-token", { method: "POST" });
      if (!r.ok) {
        failure.value = "backend"; // demo-paused, rate-limited, not running
        return false;
      }
      grant = (await r.json()) as TokenGrant;
      if (!grant?.token || !grant.session?.ws_url) {
        failure.value = "backend";
        return false;
      }
    } catch {
      failure.value = "backend";
      return false;
    }

    const opened = await new Promise<boolean>((resolve) => {
      try {
        ws = new WebSocket(
          `${grant.session.ws_url}?model=${encodeURIComponent(grant.session.model)}`,
          [`xai-client-secret.${grant.token}`],
        );
      } catch {
        resolve(false);
        return;
      }
      ws.onopen = () => resolve(true);
      ws.onerror = () => resolve(false);
      ws.onclose = () => resolve(false);
    });
    if (!opened || !ws) {
      failure.value = "websocket";
      stop();
      return false;
    }

    ws.onmessage = (m) => {
      try {
        handleEvent(JSON.parse(String(m.data)));
      } catch {
        /* non-JSON frames are ignored */
      }
    };
    ws.onclose = end;
    ws.onerror = end;

    // Persona and voice come from the backend grant (single source); the
    // session speaks first so the widget greets out loud like phase 1 did.
    // audio.input.transcription is MANDATORY for transcripts: without
    // grok-transcribe configured, xAI emits no transcription events at all
    // and the widget stays wordless (live-test finding, 2026-09-04).
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: grant.session.instructions,
          voice: REALTIME_VOICE,
          turn_detection: { type: "server_vad" },
          // Both documented shapes at once, defensively: docs.x.ai's voice
          // agent guide nests it under audio.input.transcription; the
          // OpenAI-compatible flat name is input_audio_transcription. The
          // session.updated echo (visible via ?demo=debug) shows which one
          // the server accepted.
          audio: {
            input: {
              transcription: { model: "grok-transcribe", language_hint: "en" },
            },
            // lux at 1.0 reads too slow - 1.2 is the "about 20% faster"
            // Krzysztof asked for (documented range 0.7-1.5, default 1.0).
            output: { speed: 1.2 },
          },
          input_audio_transcription: { model: "grok-transcribe" },
        },
      }),
    );
    ws.send(JSON.stringify({ type: "response.create" }));

    activity.value = null;
    startCapture(mic);

    // Hard session ceiling, frontend-enforced (the token TTL only guards
    // the handshake window).
    sessionTimer = window.setTimeout(end, grant.session.max_seconds * 1000);
    return true;
  }

  function onEnded(fn: () => void) {
    endedFns.push(fn);
  }

  onBeforeUnmount(stop);
  return {
    mode, feed, liveText, level, activity, agents,
    connect, onEnded, stop, failure, micMuted, setMicMuted,
  };
}
