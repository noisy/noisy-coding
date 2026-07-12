<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { setMode, setMuted, setSettings } from "./api/client";
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
        <div class="modetoggle" title="Batch: transcribe after silence ($0.10/h) · Live: stream while speaking ($0.20/h)">
          <span :class="{ on: status?.mode === 'batch' }" @click="setSttMode('batch')">BATCH<span class="rate">$0.10/h</span></span>
          <span :class="{ on: status?.mode === 'live' }" @click="setSttMode('live')">LIVE<span class="rate">$0.20/h</span></span>
        </div>
        <div class="clockbox">
          <div class="clock">{{ clock }}</div>
          <div class="date">{{ today }}</div>
        </div>
      </div>
    </header>

    <div class="cols">
      <div class="col-left">
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
            <button class="ctl" :class="{ danger: status?.muted }" @click="toggleMute">
              {{ status?.muted ? "UNMUTE MIC" : "MUTE MIC" }}
            </button>
            <div class="ctlrow">
              <span class="lbl">TTS</span>
              <button class="ctl small" :class="{ on: status?.tts_mode === 'batch' }" @click="setTtsMode('batch')">BATCH</button>
              <button class="ctl small" :class="{ on: status?.tts_mode === 'live' }" @click="setTtsMode('live')">LIVE</button>
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
          <ConversationLog :utterances="utterances" />
        </HudPanel>
      </div>

      <div class="col-right">
        <HudPanel index="05" title="CHARACTER MATRIX">
          <CharacterReadout v-if="character" :character="character" />
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
.modetoggle {
  display: flex;
  border: 1px solid var(--line-strong);
  overflow: hidden;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background: rgba(4, 12, 20, 0.9);
}
.modetoggle span { padding: 8px 18px; font-size: 11px; letter-spacing: 0.24em; color: var(--muted); cursor: pointer; }
.modetoggle span.on {
  background: linear-gradient(180deg, rgba(255, 180, 84, 0.22), rgba(255, 180, 84, 0.08));
  color: var(--amber);
  text-shadow: var(--glow-amber);
  box-shadow: inset 0 0 12px rgba(255, 180, 84, 0.25);
}
.modetoggle .rate { font-size: 9px; display: block; letter-spacing: 0.1em; margin-top: 2px; opacity: 0.75; }
.clockbox { text-align: right; }
.clockbox .clock { font-size: 17px; letter-spacing: 0.14em; color: var(--ink); }
.clockbox .date { font-size: 10px; letter-spacing: 0.2em; color: var(--muted); margin-top: 3px; }

.cols {
  display: grid;
  grid-template-columns: 300px minmax(420px, 1fr) 330px;
  gap: 18px;
  margin-top: 18px;
  align-items: start;
}
@media (max-width: 1180px) { .cols { grid-template-columns: 1fr 1fr; } .col-mid { order: -1; grid-column: 1 / -1; } }
@media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
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

.controls { display: grid; gap: 10px; }
.ctlrow { display: flex; align-items: center; gap: 8px; }
.ctlrow .lbl { font-size: 9px; letter-spacing: 0.2em; color: var(--muted); width: 84px; flex: none; }
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
