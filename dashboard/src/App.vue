<script setup lang="ts">
// Provisional assembly: components land here with mock data as they are
// built; live daemon data replaces the mocks in the wiring task.
import AgentTabs from "./components/AgentTabs.vue";
import CharacterReadout from "./components/CharacterReadout.vue";
import ConversationLog from "./components/ConversationLog.vue";
import HudPanel from "./components/HudPanel.vue";
import StatusStrip from "./components/StatusStrip.vue";
import type { Character, DaemonStatus, Utterance } from "./types";

const mockCharacter: Character = { humor: 50, honesty: 50, brevity: 100, chatty: 100, voice: "altair", speed: 1.1 };
const mockStatus: DaemonStatus = {
  listening: true, muted: false, recording: false, claude_speaking: false,
  speaking_agents: [], queued: 0, session_cost_usd: { user: 0.0021, claude: 0.0226 },
  credits_usd: 4.53, mode: "live", tts_mode: "live", end_silence_ms: 4000,
  smart_turn: 0, smart_turn_mode: "soft", language: "pl",
  agents: { demo: 0 }, agent_labels: { demo: "grok-voice-stabilization" }, active_agent: "demo",
};

const now = Date.now() / 1000;
const mockFeed: Utterance[] = [
  { id: 1, role: "user", status: "delivered to Claude", text: "Sprawdź czy pipeline na branchu feature/auth przeszedł.", detail: "STT 1.1 s · 7.8 s AUDIO", cost_usd: 0.0005, agent: null, started_at: now - 260, updated_at: now - 250 },
  { id: 2, role: "claude", status: "played", text: "[altair] „Pipeline #48210 passed — 214 tests green.”", detail: "TTS 1.4 s · 11.2 s AUDIO", cost_usd: 0.0038, agent: null, started_at: now - 240, updated_at: now - 230 },
  { id: 3, role: "user", status: "delivered to Claude", text: "Okej, odpal deploy na staging i daj znać jak skończy.", detail: "STT 0.9 s · 6.4 s AUDIO", cost_usd: 0.0004, agent: null, started_at: now - 120, updated_at: now - 110 },
  { id: 4, role: "claude", status: "synthesizing (Grok TTS)…", text: "", detail: "QUEUE POS 1", cost_usd: 0, agent: null, started_at: now - 20, updated_at: now - 20 },
  { id: 5, role: "user", status: "recording…", text: "No dobra, to teraz przejdźmy do refaktoru modułu billing i", detail: "VAD OPEN · 3.2 s", cost_usd: 0, agent: null, started_at: now - 4, updated_at: now },
];
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
          <div class="sub">TACTICAL VOICE INTERFACE · WORK IN PROGRESS</div>
        </div>
      </div>
    </header>

    <div class="cols">
      <div class="col-left">
        <HudPanel index="01" title="MIC INPUT · OSCILLOSCOPE">
          <p class="todo">oscilloscope lands here</p>
        </HudPanel>
        <HudPanel index="02" title="AUDIO SPECTRUM">
          <p class="todo">spectrum lands here</p>
        </HudPanel>
      </div>
      <div class="col-mid">
        <HudPanel index="04" title="COMM LOG · UTTERANCE STREAM">
          <AgentTabs
            :agents="mockStatus.agent_labels"
            :active="mockStatus.active_agent"
            :viewed="mockStatus.active_agent"
            :speaking="mockStatus.speaking_agents"
          />
          <ConversationLog :utterances="mockFeed" />
        </HudPanel>
      </div>
      <div class="col-right">
        <HudPanel index="05" title="CHARACTER MATRIX">
          <CharacterReadout :character="mockCharacter" />
        </HudPanel>
        <HudPanel index="06" title="SYSTEM STATE · COST">
          <StatusStrip :status="mockStatus" :offline="false" />
        </HudPanel>
      </div>
    </div>
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
</style>
