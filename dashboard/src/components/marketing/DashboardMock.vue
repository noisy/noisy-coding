<script setup lang="ts">
/* The dashboard, content only - no OS chrome.
 *
 * Marketing prop for the website hero: the landing page wraps screenshots
 * in its own CSS window frame, so this shot must NOT carry a macOS title
 * bar of its own. Real components, invented but believable session data,
 * a light re-creation of App.vue's layout (App itself needs a live daemon).
 */
import { onMounted, onUnmounted, ref } from "vue";
import type { Character, DaemonStatus, Utterance } from "../../types";
import AgentTabs from "../AgentTabs.vue";
import CharacterReadout from "../CharacterReadout.vue";
import ConversationLog from "../ConversationLog.vue";
import ConversationTelemetry from "../ConversationTelemetry.vue";
import HudPanel from "../HudPanel.vue";
import Oscilloscope from "../Oscilloscope.vue";
import SessionRing from "../SessionRing.vue";
import SpectrumBars from "../SpectrumBars.vue";
import StatusStrip from "../StatusStrip.vue";
import VoicePersona from "../VoicePersona.vue";

const now = Date.now() / 1000;

const UTTERANCES: Utterance[] = [
  { id: 1, role: "user", status: "delivered to Claude", text: "How far are we with the payment retries branch?", detail: "STT 0.4 s - 3.8 s AUDIO", cost_usd: 0.0003, agent: null, started_at: now - 340, updated_at: now - 336, committed_at: now - 340 },
  { id: 2, role: "claude", status: "played", voice: "lux", text: "The backoff logic is in and covered. I am reworking the dead-letter path now - the old one dropped events on redeploy.", detail: "TTS 1.2 s - 9.1 s AUDIO", cost_usd: 0.0031, agent: null, started_at: now - 320, updated_at: now - 308, committed_at: now - 320 },
  { id: 3, role: "user", status: "delivered to Claude", text: "Good catch. Keep the events in the queue and add a metric for it.", detail: "STT 0.4 s - 5.0 s AUDIO", cost_usd: 0.0004, agent: null, started_at: now - 180, updated_at: now - 175, committed_at: now - 180 },
  { id: 4, role: "claude", status: "played", voice: "lux", text: "Done - events survive redeploys and the new retry_backlog gauge is on the board. Two tests pin the behavior.", detail: "TTS 1.1 s - 8.3 s AUDIO", cost_usd: 0.0027, agent: null, started_at: now - 90, updated_at: now - 80, committed_at: now - 90 },
  { id: 5, role: "user", status: "recording...", text: "Nice. Next, let's look at the slow dashboard query and", detail: "VAD OPEN - 2.8 s", cost_usd: 0, agent: null, started_at: now - 3, updated_at: now, committed_at: now - 3 },
];

const STATUS = {
  listening: true, muted: false, voice_muted: false,
  api_key_set: true, api_key_hint: "xai-...k3f9",
  stt_latency_ms: 410, tts_latency_ms: 1240,
  recording: true, claude_speaking: false, playing_utterance_id: 0,
  speaking_agents: [], queued: 0,
  session_cost_usd: { user: 0.0214, claude: 0.1187 },
  usage: { stt_seconds: 764, tts_chars: 18432 },
  credits_usd: 4.21,
  mode: "batch", tts_mode: "batch", end_silence_ms: 1500,
  mic_sensitivity: 50, smart_turn: 0.7, smart_turn_mode: "soft",
  detection_mode: "auto", ptt_held: false,
  input_device: "", output_device: "system", tab_audio: false,
  activity: {}, language: "en",
  agents: { "payment-retries": 5, "code-review": 2, "docs": 1 },
  agent_labels: { "payment-retries": "payment-retries", "code-review": "code-review", "docs": "docs" },
  active_agent: "payment-retries",
} as DaemonStatus;

const CHARACTER: Character = { humor: 40, honesty: 90, brevity: 70, chatty: 30, voice: "lux", speed: 1.1 };

// The scopes draw from a live level; feed them a plausible voice envelope
// so the canvases are not flat in a static capture.
const level = ref(0.3);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    level.value = Math.max(0.05, Math.min(0.85, level.value + (Math.random() - 0.48) * 0.25));
  }, 50);
});
onUnmounted(() => clearInterval(timer));

const noop = () => {};
</script>

<template>
  <div class="mock">
    <div class="cols">
      <div class="col-left">
        <button class="bigmute">
          <span class="bm-label">MUTE MIC</span>
          <span class="bm-sub">ONE TAP TO GO SILENT</span>
        </button>
        <HudPanel index="01" title="MIC INPUT - OSCILLOSCOPE">
          <Oscilloscope :level="level" />
        </HudPanel>
        <HudPanel index="02" title="AUDIO SPECTRUM">
          <SpectrumBars :level="level" />
        </HudPanel>
        <HudPanel index="05" title="SYSTEM STATE - COST">
          <StatusStrip :status="STATUS" :offline="false" />
        </HudPanel>
      </div>

      <div class="col-mid">
        <header class="topbar">
          <div class="logo">
            <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
              <polygon points="23,2 41,12.5 41,33.5 23,44 5,33.5 5,12.5" fill="none" stroke="#3fd8ff" stroke-width="1.4" opacity="0.9" />
              <polygon points="23,8 36,15.5 36,30.5 23,38 10,30.5 10,15.5" fill="rgba(63,216,255,0.08)" stroke="#3fd8ff" stroke-width="0.7" opacity="0.6" />
              <g stroke="#3fd8ff" stroke-width="2" stroke-linecap="round">
                <line x1="17" y1="20" x2="17" y2="26" />
                <line x1="21" y1="16" x2="21" y2="30" />
                <line x1="25" y1="19" x2="25" y2="27" />
                <line x1="29" y1="21" x2="29" y2="25" />
              </g>
            </svg>
            <div>
              <div class="title">NOISY-CODING</div>
              <div class="sub">TALK WITH YOUR AGENT</div>
            </div>
          </div>
          <button class="voicemute">
            <span class="vm-label">MUTE ALL AGENTS</span>
            <span class="vm-sub">SILENT NOW, CATCH UP LATER</span>
          </button>
        </header>

        <div class="tabsbar">
          <AgentTabs
            :agents="STATUS.agent_labels"
            :active="'payment-retries'"
            :viewed="'payment-retries'"
            :speaking="[]"
            :thinking="['payment-retries']"
            :queued="{ 'code-review': 1 }"
            @select="noop"
            @dismiss="noop"
            @reorder="noop"
          />
        </div>
        <HudPanel class="convo-panel">
          <div class="convo-body">
            <div class="convo-main">
              <ConversationLog :utterances="UTTERANCES" :playing-id="0" />
              <ConversationTelemetry
                :stt-latency-ms="410"
                :tts-latency-ms="1240"
                :user-cost-usd="0.0214"
                :claude-cost-usd="0.1187"
                :stt-seconds="764"
                :tts-chars="18432"
              />
            </div>
            <aside class="convo-rail">
              <section class="railbox">
                <VoicePersona voice="lux" :speaking="false" :muted="false" />
              </section>
              <section class="railbox">
                <div class="railtitle">CHARACTER SETTINGS</div>
                <CharacterReadout :character="CHARACTER" />
              </section>
              <section class="railbox">
                <div class="railtitle">SESSION RING - TURN TIMELINE</div>
                <SessionRing :utterances="UTTERANCES" />
              </section>
            </aside>
          </div>
        </HudPanel>
      </div>
    </div>

    <footer>
      <span>DAEMON <b class="ok">ONLINE</b></span>
      <span>STT MODE <b>BATCH</b></span>
      <span>LANGUAGE <b>EN</b></span>
      <span>QUEUE <b>0</b></span>
      <span style="margin-left: auto">v3.0.0</span>
      <span>&#9672; ALL SYSTEMS NOMINAL</span>
    </footer>
  </div>
</template>

<style scoped>
.mock {
  width: 1600px;
  height: 1000px;
  padding: 20px 22px 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cols {
  display: grid;
  grid-template-columns: 300px minmax(640px, 1fr);
  gap: 18px;
  flex: 1 1 auto;
  min-height: 0;
}
.col-left { min-height: 0; display: flex; flex-direction: column; }
.col-left > * { flex: none; }
.col-mid { min-height: 0; display: flex; flex-direction: column; }
.col-mid :deep(.panel) { flex: 1; min-height: 0; display: flex; flex-direction: column; margin-bottom: 0; }

.topbar { display: flex; align-items: stretch; gap: 16px; min-height: 96px; margin-bottom: 18px; flex: none; }
.logo { flex: 1; display: flex; align-items: center; justify-content: center; gap: 14px; transform: scale(1.3); }
.logo .title { font-size: 19px; letter-spacing: 0.28em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); font-weight: 700; }
.logo .sub { font-size: 10px; letter-spacing: 0.393em; color: var(--muted); margin-top: 3px; }

.bigmute {
  width: 100%; min-height: 96px; margin-bottom: 18px;
  font-family: var(--mono); cursor: default;
  display: grid; place-items: center; align-content: center; gap: 6px;
  color: var(--cyan); background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}
.bigmute .bm-label { font-size: 19px; letter-spacing: 0.3em; text-shadow: 0 0 8px rgba(63, 216, 255, 0.5); }
.bigmute .bm-sub { font-size: 9px; letter-spacing: 0.24em; color: var(--muted); }

.voicemute {
  width: 316px; flex: none; min-height: 96px;
  font-family: var(--mono); cursor: default;
  display: grid; place-items: center; align-content: center; gap: 4px;
  color: var(--violet);
  background: color-mix(in srgb, var(--violet) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--violet) 40%, transparent);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.voicemute .vm-label { font-size: 19px; letter-spacing: 0.3em; }
.voicemute .vm-sub { font-size: 9px; letter-spacing: 0.24em; color: var(--muted); }

.tabsbar { padding: 0 14px; position: relative; z-index: 3; }
.tabsbar :deep(.tabs) { margin-bottom: -1px; gap: 6px; align-items: flex-end; }

.convo-body { display: flex; gap: 16px; flex: 1; min-height: 0; }
.convo-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.convo-rail {
  width: 300px; flex: none; overflow: hidden;
  border-left: 1px solid var(--line); padding-left: 16px;
  background: color-mix(in srgb, var(--violet) 6%, transparent);
  display: flex; flex-direction: column; gap: 14px;
  --cyan: var(--violet);
  --cyan-hi: var(--violet-hi);
  --cyan-dim: var(--violet-dim);
  --glow-cyan: var(--glow-violet);
  --line: color-mix(in srgb, var(--violet) 22%, transparent);
  --line-strong: color-mix(in srgb, var(--violet) 55%, transparent);
}
.railbox { border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.railbox:last-child { border-bottom: none; }
.railtitle { font-size: 9px; letter-spacing: 0.26em; color: var(--muted); margin-bottom: 10px; }

footer {
  flex: none; margin-top: 6px; padding: 12px 18px;
  border-top: 1px solid var(--line);
  display: flex; gap: 26px; flex-wrap: wrap;
  font-size: 9px; letter-spacing: 0.18em; color: var(--muted);
}
footer b { color: var(--cyan-dim); font-weight: 400; }
footer .ok { color: var(--green); }
</style>
