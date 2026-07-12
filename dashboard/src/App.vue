<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { cancelTranscript, setCharacter, setMode, setMuted, setPtt, setSettings, speakText, stopPlayback } from "./api/client";
import { replaySpeechText } from "./components/bubbleStatus";
import type { Character, Utterance } from "./types";
import AgentTabs from "./components/AgentTabs.vue";
import CharacterReadout from "./components/CharacterReadout.vue";
import ConversationLog from "./components/ConversationLog.vue";
import HudPanel from "./components/HudPanel.vue";
import Oscilloscope from "./components/Oscilloscope.vue";
import SpectrumBars from "./components/SpectrumBars.vue";
import StatusStrip from "./components/StatusStrip.vue";
import { useDaemonState } from "./composables/useDaemonState";
import { useMicStream } from "./composables/useMicStream";

const { status, utterances, character, offline, viewedAgent, selectAgent } = useDaemonState();
const { level } = useMicStream();

const levelPercent = computed(() => `${Math.round(level.value * 100)}%`);
const levelDb = computed(() =>
  level.value > 0 ? `${(20 * Math.log10(level.value)).toFixed(1)} dB` : "−∞ dB",
);

const clock = ref("");
function tickClock() {
  const d = new Date();
  clock.value = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
let clockTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  tickClock();
  clockTimer = setInterval(tickClock, 1000);
});
onUnmounted(() => clearInterval(clockTimer));

const today = new Date().toISOString().slice(0, 10);

// Controls: fire the POST, then let the next 400 ms poll reflect reality —
// no optimistic local state to get out of sync.
const swallow = () => {};
const toggleMute = () => setMuted(!status.value?.muted).catch(swallow);
const setSttMode = (mode: "batch" | "live") => setMode(mode).catch(swallow);
const setTtsMode = (mode: "batch" | "live") => setSettings({ tts_mode: mode }).catch(swallow);
const setSilence = (event: Event) =>
  setSettings({ end_silence_ms: Number((event.target as HTMLSelectElement).value) }).catch(swallow);
const setSmartTurn = (event: Event) =>
  setSettings({ smart_turn: Number((event.target as HTMLSelectElement).value) }).catch(swallow);

const changeCharacter = (patch: Partial<Character>) =>
  setCharacter({ ...patch, agent: viewedAgent.value ?? undefined }).catch(swallow);
const setDetection = (mode: "auto" | "ptt") =>
  setSettings({ detection_mode: mode }).catch(swallow);
// The button toggles: playing this very bubble → stop it (the queue moves
// on by itself); otherwise queue a replay that outranks current playback.
const replay = (utterance: Utterance) => {
  if (status.value?.playing_utterance_id === utterance.id) {
    stopPlayback().catch(swallow);
    return;
  }
  speakText(
    replaySpeechText(utterance.text), utterance.id, viewedAgent.value ?? undefined,
  ).catch(swallow);
};
const cancel = (utterance: Utterance) => cancelTranscript(utterance.id).catch(swallow);

// Push-to-talk: while the button is physically held we renew the daemon's
// hold lease (it expires by itself if we die mid-hold — see the daemon).
let pttTimer: ReturnType<typeof setInterval> | undefined;
function pttPress(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  setPtt(true).catch(swallow);
  pttTimer = setInterval(() => setPtt(true).catch(swallow), 500);
}
function pttRelease() {
  clearInterval(pttTimer);
  pttTimer = undefined;
  setPtt(false).catch(swallow);
}
onUnmounted(() => clearInterval(pttTimer));

const SILENCE_OPTIONS = [800, 1500, 2000, 3000, 4000];
const SMART_TURN_OPTIONS = [0, 0.5, 0.7, 0.9];
</script>

<template>
  <div class="scanlines" />
  <div class="vignette" />
  <div class="hud">
    <header>
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
          <div class="title">GROK-VOICE</div>
          <div class="sub">TACTICAL VOICE INTERFACE</div>
        </div>
      </div>

      <div class="sysstate">
        <div class="clockbox">
          <div class="clock">{{ clock }}</div>
          <div class="date">{{ today }}</div>
        </div>
      </div>
    </header>

    <div class="cols">
      <div class="col-left">
        <!-- Panic-sized mute: quick muting must not require aiming at a
             tiny control, so it gets widget-scale real estate up top. -->
        <button class="bigmute" :class="{ muted: status?.muted }" @click="toggleMute">
          <span class="bm-label">{{ status?.muted ? "◉ MIC MUTED" : "MUTE MIC" }}</span>
          <span class="bm-sub">{{ status?.muted ? "TAP TO UNMUTE" : "ONE TAP TO GO SILENT" }}</span>
        </button>
        <HudPanel index="01" title="MIC INPUT · OSCILLOSCOPE">
          <Oscilloscope :level="level" />
          <div class="dbrow">
            <span class="lbl">LEVEL</span>
            <span class="dbbar"><i :style="{ width: levelPercent }" /></span>
            <span class="val">{{ levelDb }}</span>
          </div>
        </HudPanel>
        <HudPanel index="02" title="AUDIO SPECTRUM">
          <SpectrumBars :level="level" />
        </HudPanel>
        <HudPanel index="03" title="CONTROLS">
          <div class="controls">
            <!-- The two mode toggles sit together: same choice, two
                 directions (Claude's voice out vs your voice in). -->
            <div class="ctlrow" title="Claude's speech: batch renders the whole clip first, live streams as it synthesizes">
              <span class="lbl">TEXT TO SPEECH</span>
              <button class="ctl small" :class="{ on: status?.tts_mode === 'batch' }" @click="setTtsMode('batch')">BATCH</button>
              <button class="ctl small" :class="{ on: status?.tts_mode === 'live' }" @click="setTtsMode('live')">LIVE</button>
            </div>
            <div class="ctlrow" title="Your speech: batch transcribes after silence ($0.10/h), live streams while you talk ($0.20/h)">
              <span class="lbl">SPEECH TO TEXT</span>
              <button class="ctl small" :class="{ on: status?.mode === 'batch' }" @click="setSttMode('batch')">BATCH</button>
              <button class="ctl small" :class="{ on: status?.mode === 'live' }" @click="setSttMode('live')">LIVE</button>
            </div>
            <div class="ctlcol" title="How your turn ends: auto = the VAD detects silence; push to talk = you hold the big button">
              <span class="lbl">TURN DETECTION</span>
              <div class="ctlbtns">
                <button class="ctl small" :class="{ on: status?.detection_mode === 'auto' }" @click="setDetection('auto')">AUTO</button>
                <button class="ctl small" :class="{ on: status?.detection_mode === 'ptt' }" @click="setDetection('ptt')">PUSH TO TALK</button>
              </div>
            </div>
            <div class="ctlrow">
              <span class="lbl">SILENCE</span>
              <select class="ctl small" :value="status?.end_silence_ms" @change="setSilence">
                <option v-for="ms in SILENCE_OPTIONS" :key="ms" :value="ms">{{ (ms / 1000).toFixed(1) }}s</option>
              </select>
            </div>
            <div class="ctlrow">
              <span class="lbl">SMART TURN</span>
              <select class="ctl small" :value="status?.smart_turn" @change="setSmartTurn">
                <option v-for="v in SMART_TURN_OPTIONS" :key="v" :value="v">{{ v === 0 ? "OFF" : v.toFixed(1) }}</option>
              </select>
            </div>
          </div>
        </HudPanel>
      </div>

      <div class="col-mid">
        <HudPanel index="04" title="COMM LOG · UTTERANCE STREAM">
          <AgentTabs
            :agents="status?.agent_labels ?? {}"
            :active="status?.active_agent ?? null"
            :viewed="viewedAgent"
            :speaking="status?.speaking_agents ?? []"
            @select="selectAgent"
          />
          <ConversationLog
            :utterances="utterances"
            :playing-id="status?.playing_utterance_id ?? 0"
            @replay="replay"
            @cancel="cancel"
          />
        </HudPanel>
      </div>

      <div class="col-right">
        <!-- Holding while muted records nothing — lock the button and say
             why instead of silently eating the press. -->
        <button
          v-if="status?.detection_mode === 'ptt'"
          class="bigmute talk"
          :class="{ held: status?.ptt_held }"
          :disabled="status?.muted"
          @pointerdown="pttPress"
          @pointerup="pttRelease"
          @pointercancel="pttRelease"
        >
          <span class="bm-label">
            {{ status?.muted ? "⊘ LOCKED" : status?.ptt_held ? "◉ ON AIR" : "HOLD TO TALK" }}
          </span>
          <span class="bm-sub">
            {{ status?.muted ? "MIC MUTED — UNMUTE FIRST" : status?.ptt_held ? "RELEASE TO SEND" : "RECORDS WHILE HELD" }}
          </span>
        </button>
        <HudPanel index="05" title="CHARACTER MATRIX">
          <CharacterReadout v-if="character" :character="character" @change="changeCharacter" />
          <p v-else class="todo">NO CHARACTER DATA</p>
        </HudPanel>
        <HudPanel index="06" title="SYSTEM STATE · COST">
          <StatusStrip :status="status" :offline="offline" />
        </HudPanel>
      </div>
    </div>

    <footer>
      <span>DAEMON <b :class="offline ? 'bad' : 'ok'">{{ offline ? "OFFLINE" : "ONLINE" }}</b></span>
      <span>STT MODE <b>{{ status?.mode?.toUpperCase() ?? "—" }}</b></span>
      <span>LANGUAGE <b>{{ status?.language || "AUTO" }}</b></span>
      <span>QUEUE <b>{{ status?.queued ?? "—" }}</b></span>
      <span style="margin-left: auto">{{ offline ? "◈ LINK DOWN" : "◈ ALL SYSTEMS NOMINAL" }}</span>
    </footer>
  </div>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  padding: 10px 18px 14px;
  border-bottom: 1px solid var(--line);
  position: relative;
}
header::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 1px;
  width: 220px;
  background: linear-gradient(90deg, var(--cyan), transparent);
  box-shadow: 0 0 8px var(--cyan);
}
.logo { display: flex; align-items: center; gap: 14px; }
.logo svg { display: block; }
.logo .title { font-size: 19px; letter-spacing: 0.28em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); font-weight: 700; }
.logo .sub { font-size: 10px; letter-spacing: 0.34em; color: var(--muted); margin-top: 3px; }
.sysstate { margin-left: auto; display: flex; align-items: center; gap: 26px; flex-wrap: wrap; }
.clockbox { text-align: right; }
.clockbox .clock { font-size: 17px; letter-spacing: 0.14em; color: var(--ink); }
.clockbox .date { font-size: 10px; letter-spacing: 0.2em; color: var(--muted); margin-top: 3px; }

header { flex: none; }
footer { flex: none; }
.cols {
  display: grid;
  grid-template-columns: 300px minmax(420px, 1fr) 330px;
  gap: 18px;
  margin-top: 14px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0; /* let the grid shrink so only the feed scrolls */
}
@media (max-width: 1180px) { .cols { grid-template-columns: 1fr 1fr; } .col-mid { order: -1; grid-column: 1 / -1; } }
@media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
.col-left,
.col-right {
  min-height: 0;
  overflow-y: auto; /* safety valve on short windows; invisible otherwise */
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.col-mid {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.col-mid :deep(.panel) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
.todo { color: var(--muted); font-size: 10px; letter-spacing: 0.2em; padding: 22px 0; text-align: center; }

.dbrow { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.dbrow .lbl { font-size: 9px; letter-spacing: 0.2em; color: var(--muted); width: 52px; }
.dbbar { flex: 1; height: 6px; background: rgba(63, 216, 255, 0.08); position: relative; overflow: hidden; }
.dbbar i {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  background: linear-gradient(90deg, rgba(63, 216, 255, 0.35), var(--cyan) 70%, var(--amber));
  box-shadow: 0 0 8px rgba(63, 216, 255, 0.5);
  transition: width 80ms linear;
}
.dbrow .val { font-size: 10px; color: var(--cyan); width: 64px; text-align: right; }

.bigmute {
  width: 100%;
  min-height: 96px;
  margin-bottom: 18px;
  font-family: var(--mono);
  cursor: pointer;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  color: var(--cyan);
  background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}
.bigmute .bm-label { font-size: 19px; letter-spacing: 0.3em; text-shadow: 0 0 8px rgba(63, 216, 255, 0.5); }
.bigmute .bm-sub { font-size: 9px; letter-spacing: 0.24em; color: var(--muted); }
.bigmute:hover { color: var(--cyan-hi); border-color: var(--cyan); background: rgba(63, 216, 255, 0.1); }
.bigmute.muted {
  color: var(--red);
  border-color: rgba(255, 95, 107, 0.65);
  background: rgba(255, 95, 107, 0.1);
  box-shadow: inset 0 0 26px rgba(255, 95, 107, 0.18);
}
.bigmute.muted .bm-label { text-shadow: 0 0 10px rgba(255, 95, 107, 0.7); animation: blink 1.6s step-end infinite; }
.bigmute.muted .bm-sub { color: rgba(255, 95, 107, 0.7); }
@keyframes blink { 50% { opacity: 0.45; } }
.bigmute.talk { touch-action: none; user-select: none; }
.bigmute.talk:disabled {
  cursor: not-allowed;
  color: var(--muted);
  border-color: rgba(93, 127, 150, 0.35);
  background: rgba(93, 127, 150, 0.05);
}
.bigmute.talk:disabled .bm-label { text-shadow: none; }
.bigmute.talk.held {
  color: var(--amber);
  border-color: var(--amber);
  background: rgba(255, 180, 84, 0.12);
  box-shadow: inset 0 0 26px rgba(255, 180, 84, 0.2);
}
.bigmute.talk.held .bm-label { text-shadow: var(--glow-amber); }
.bigmute.talk.held .bm-sub { color: rgba(255, 180, 84, 0.75); }

.controls { display: grid; gap: 10px; }
.ctlrow { display: flex; align-items: center; gap: 8px; }
/* Label above full-width buttons — for choices whose names deserve to
   stay unabbreviated ("PUSH TO TALK" won't fit next to a label). */
.ctlcol { display: grid; gap: 6px; }
.ctlcol .lbl { font-size: 9px; letter-spacing: 0.16em; color: var(--muted); }
.ctlbtns { display: flex; gap: 8px; }
.ctlrow .lbl { font-size: 9px; letter-spacing: 0.16em; color: var(--muted); width: 104px; flex: none; }
.ctl {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--cyan);
  background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  padding: 8px 12px;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
}
.ctl:hover { color: var(--cyan-hi); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }
.ctl.small { padding: 5px 10px; flex: 1; }
.ctl.on { color: var(--amber); border-color: var(--amber-dim); background: rgba(255, 180, 84, 0.08); text-shadow: var(--glow-amber); }
.ctl.danger { color: var(--red); border-color: rgba(255, 95, 107, 0.5); background: rgba(255, 95, 107, 0.08); }
select.ctl { appearance: none; }

footer {
  margin-top: 6px;
  padding: 12px 18px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--muted);
}
footer b { color: var(--cyan-dim); font-weight: 400; }
footer .ok { color: var(--green); }
footer .bad { color: var(--red); }
</style>
