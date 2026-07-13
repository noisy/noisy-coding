<script setup lang="ts">
/** Chat-window sandbox at /debug.

Drives the REAL ConversationLog with hand-clicked state transitions, no
daemon involved. Every click lands in an event log (ms timestamps) that
can be copied and pasted into a bug report: "with this sequence, X". */

import { ref } from "vue";
import ConversationLog from "../components/ConversationLog.vue";
import HudPanel from "../components/HudPanel.vue";
import type { Utterance } from "../types";

const utterances = ref<Utterance[]>([]);
const activity = ref<{ text: string; at: number } | null>(null);
const playingId = ref(0);
const log = ref<string[]>([]);
let nextId = 1;

const SAMPLE_USER = "No dobra, to teraz przejdźmy do refaktoru modułu billing i zróbmy to porządnie.";
const SAMPLE_CLAUDE = "Zrobione — testy zielone, wszystko zacommitowane na main.";

function note(action: string, detail = "") {
  const d = new Date();
  const ts = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":") + "." + String(d.getMilliseconds()).padStart(3, "0");
  log.value.push(`${ts} ${action}${detail ? ` ${detail}` : ""}`);
}

function now() {
  return Date.now() / 1000;
}

function latest(role: "user" | "claude"): Utterance | undefined {
  return [...utterances.value].reverse().find((u) => u.role === role);
}

function patch(u: Utterance | undefined, fields: Partial<Utterance>, action: string) {
  if (!u) {
    note(`${action} — SKIPPED (no such message)`);
    return;
  }
  Object.assign(u, fields, { updated_at: now() });
  note(action, `(id ${u.id} → "${u.status}")`);
}

// --- user lifecycle -------------------------------------------------------
function userStartRecording() {
  const u: Utterance = {
    id: nextId++, role: "user", status: "recording…", text: "",
    detail: "VAD OPEN", cost_usd: 0, agent: null,
    started_at: now(), updated_at: now(), committed_at: 0,
  };
  utterances.value.push(u);
  note("user.start_recording", `(id ${u.id})`);
}
function userTranscribing() {
  const u = latest("user");
  patch(u, {
    status: "transcribing (live)…",
    text: (u?.text ? u.text + " " : "") + SAMPLE_USER.split(" ").slice(0, 5).join(" "),
  }, "user.transcribing_partial");
}
function userReady() {
  patch(latest("user"), {
    status: "ready — awaiting pickup", text: SAMPLE_USER, committed_at: now(), duration_s: 6.4,
  }, "user.ready_awaiting");
}
function userDelivered() {
  patch(latest("user"), { status: "delivered to Claude" }, "user.delivered");
}
function userEmpty() {
  patch(latest("user"), { status: "empty — no speech" }, "user.empty_noise");
}
function userError() {
  patch(latest("user"), { status: "transcription error" }, "user.stt_error");
}
function userCancelled() {
  patch(latest("user"), { status: "cancelled by you" }, "user.cancelled");
}

// --- claude lifecycle -----------------------------------------------------
function claudeNew() {
  const u: Utterance = {
    id: nextId++, role: "claude", status: "queued", text: SAMPLE_CLAUDE,
    detail: "", cost_usd: 0.0008, agent: null,
    started_at: now(), updated_at: now(), committed_at: now(),
  };
  utterances.value.push(u);
  note("claude.arrives_queued", `(id ${u.id})`);
}
function claudeHolding() {
  patch(latest("claude"), { status: "queued — waiting for you to finish" }, "claude.holding");
}
function claudeSynthesizing() {
  patch(latest("claude"), { status: "synthesizing (Grok TTS)…" }, "claude.synthesizing");
}
function claudePlaying() {
  const u = latest("claude");
  patch(u, { status: "playing through speakers…" }, "claude.playing");
  if (u) playingId.value = u.id;
}
function claudePlayed() {
  patch(latest("claude"), { status: "played", duration_s: 8.2 }, "claude.played");
  playingId.value = 0;
}
function claudeUnheard() {
  patch(latest("claude"), { status: "unheard — voice muted" }, "claude.unheard");
}

// --- activity (start/stop pairs) -----------------------------------------
function startTool() {
  activity.value = { text: "Edit · App.vue", at: now() };
  note("activity.start_tool", "(Edit · App.vue)");
}
function startThinking() {
  activity.value = { text: "THINKING…", at: now() };
  note("activity.start_thinking");
}
function stopActivity() {
  activity.value = null;
  note("activity.stop (turn ended)");
}

// --- system ---------------------------------------------------------------
function sysMicRow() {
  utterances.value.push({
    id: nextId++, role: "system", status: "", text: "MIC → Sandbox Device",
    detail: "", cost_usd: 0, agent: null,
    started_at: now(), updated_at: now(), committed_at: now(),
  });
  note("system.mic_row");
}

function resetAll() {
  utterances.value = [];
  activity.value = null;
  playingId.value = 0;
  nextId = 1;
  note("reset");
}

async function copyLog() {
  try {
    await navigator.clipboard.writeText(log.value.join("\n"));
    note("log.copied_to_clipboard");
  } catch {
    note("log.copy_FAILED");
  }
}
</script>

<template>
  <div class="scanlines" />
  <div class="vignette" />
  <div class="hud">
    <header class="dbg-header">
      <div class="title">GROK-VOICE // CHAT SANDBOX</div>
      <span class="sub">/debug — clicks drive the real ConversationLog; nothing touches the daemon</span>
    </header>

    <div class="dbg-cols">
      <HudPanel index="D1" title="EVENT INJECTOR" class="dbg-panel">
        <div class="group">
          <div class="glabel">USER MESSAGE</div>
          <button class="ctl" @click="userStartRecording">START RECORDING</button>
          <button class="ctl" @click="userTranscribing">+ PARTIAL TRANSCRIPT</button>
          <button class="ctl" @click="userReady">READY (AWAITING)</button>
          <button class="ctl" @click="userDelivered">DELIVERED</button>
          <button class="ctl dim" @click="userEmpty">EMPTY (NOISE)</button>
          <button class="ctl dim" @click="userError">STT ERROR</button>
          <button class="ctl dim" @click="userCancelled">CANCELLED</button>
        </div>
        <div class="group">
          <div class="glabel">CLAUDE MESSAGE</div>
          <button class="ctl" @click="claudeNew">ARRIVES (QUEUED)</button>
          <button class="ctl" @click="claudeHolding">HOLDING</button>
          <button class="ctl" @click="claudeSynthesizing">SYNTHESIZING</button>
          <button class="ctl" @click="claudePlaying">PLAYING</button>
          <button class="ctl" @click="claudePlayed">PLAYED</button>
          <button class="ctl dim" @click="claudeUnheard">UNHEARD</button>
        </div>
        <div class="group">
          <div class="glabel">ACTIVITY (START/STOP)</div>
          <button class="ctl" @click="startTool">START TOOL</button>
          <button class="ctl" @click="startThinking">START THINKING</button>
          <button class="ctl warn" @click="stopActivity">STOP ACTIVITY</button>
        </div>
        <div class="group">
          <div class="glabel">SYSTEM</div>
          <button class="ctl" @click="sysMicRow">MIC SWITCH ROW</button>
          <button class="ctl danger" @click="resetAll">RESET ALL</button>
        </div>
      </HudPanel>

      <HudPanel index="D2" title="COMM LOG · UNDER TEST" class="dbg-mid">
        <ConversationLog
          :utterances="utterances"
          :playing-id="playingId"
          :activity="activity"
          @replay="(u) => note('ui.replay_clicked', `(id ${u.id})`)"
          @cancel="(u) => note('ui.cancel_clicked', `(id ${u.id})`)"
        />
      </HudPanel>

      <HudPanel index="D3" title="EVENT LOG" class="dbg-panel">
        <button class="ctl" @click="copyLog">COPY LOG</button>
        <div class="loglines">
          <div v-for="(line, i) in [...log].reverse()" :key="log.length - i" class="logline">{{ line }}</div>
        </div>
      </HudPanel>
    </div>
  </div>
</template>

<style scoped>
.dbg-header { padding: 10px 18px 14px; border-bottom: 1px solid var(--line); flex: none; }
.dbg-header .title { font-size: 16px; letter-spacing: 0.28em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); }
.dbg-header .sub { font-size: 9px; letter-spacing: 0.2em; color: var(--muted); }
.dbg-cols {
  display: grid;
  grid-template-columns: 240px minmax(380px, 1fr) 320px;
  gap: 18px;
  margin-top: 14px;
  flex: 1 1 auto;
  min-height: 0;
}
.dbg-panel { overflow-y: auto; }
.dbg-mid { display: flex; flex-direction: column; min-height: 0; }
.dbg-cols :deep(.panel) { margin-bottom: 0; }
.dbg-mid :deep(.panel) { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.group { display: grid; gap: 6px; margin-bottom: 16px; }
.glabel { font-size: 8.5px; letter-spacing: 0.24em; color: var(--muted); margin-bottom: 2px; }
.ctl {
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--cyan);
  background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  padding: 6px 10px;
  cursor: pointer;
  text-align: left;
  clip-path: polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px);
}
.ctl:hover { color: var(--cyan-hi); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }
.ctl.dim { color: var(--muted); border-color: var(--line); }
.ctl.warn { color: var(--amber); border-color: var(--amber-dim); }
.ctl.danger { color: var(--red); border-color: rgba(255, 95, 107, 0.5); }

.loglines { margin-top: 10px; display: grid; gap: 3px; overflow-y: auto; }
.logline { font-size: 9px; color: var(--muted); letter-spacing: 0.04em; white-space: nowrap; }
.logline:first-child { color: var(--cyan); }
</style>
