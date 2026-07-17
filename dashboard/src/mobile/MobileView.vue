<script setup lang="ts">
import { computed } from "vue";
import { setMuted, setPtt } from "../api/client";
import ConversationLog from "../components/ConversationLog.vue";
import { stateLabel } from "../components/systemState";
import { useDaemonState } from "../composables/useDaemonState";

const { status, utterances, offline, viewedAgent } = useDaemonState();

const state = computed(() => stateLabel(status.value, offline.value));
const agentLabel = computed(() => {
  const agent = viewedAgent.value ?? "";
  return status.value?.agent_labels?.[agent] ?? agent;
});
const activity = computed(() => status.value?.activity?.[viewedAgent.value ?? ""] ?? null);

const swallow = () => undefined;
const toggleMute = () => setMuted(!status.value?.muted).catch(swallow);

// PTT mirrors the desktop HUD: re-assert every 500 ms while held so a lost
// release packet can't leave the mic hot.
let pttTimer: ReturnType<typeof setInterval> | undefined;
function pttStart() {
  if (pttTimer || status.value?.muted) return;
  setPtt(true).catch(swallow);
  pttTimer = setInterval(() => setPtt(true).catch(swallow), 500);
}
function pttStop() {
  if (!pttTimer) return;
  clearInterval(pttTimer);
  pttTimer = undefined;
  setPtt(false).catch(swallow);
}
</script>

<template>
  <div class="mobile">
    <header class="topbar" :class="state.tone">
      <span class="dot" />
      <span class="label">{{ state.label }}</span>
      <span v-if="activity" class="activity">{{ activity.text }}</span>
      <span class="agent">{{ agentLabel }}</span>
    </header>

    <main class="log">
      <ConversationLog
        :utterances="utterances"
        :playing-id="status?.playing_utterance_id ?? 0"
        :activity="activity"
      />
    </main>

    <footer class="controls">
      <button
        v-if="status?.detection_mode === 'ptt'"
        class="ptt"
        :class="{ held: status?.ptt_held }"
        @pointerdown.prevent="pttStart"
        @pointerup.prevent="pttStop"
        @pointercancel="pttStop"
        @pointerleave="pttStop"
      >
        {{ status?.ptt_held ? "◉ ON AIR" : "HOLD TO TALK" }}
      </button>
      <button class="mute" :class="{ on: status?.muted }" @click="toggleMute">
        {{ status?.muted ? "⊘ MUTED — TAP TO LISTEN" : "MUTE MIC" }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.mobile {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--bg, #060a0c);
  color: var(--fg, #cfe8ee);
  font-family: "SF Mono", ui-monospace, monospace;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  padding-top: calc(0.55rem + env(safe-area-inset-top));
  border-bottom: 1px solid rgba(120, 220, 232, 0.25);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.topbar .dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #37e0b0;
  flex: none;
}
.topbar.warn .dot { background: #ffb84d; }
.topbar.off .dot { background: #ff5964; }
.topbar .label { flex: none; font-weight: 700; }
.topbar .activity {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.75;
  text-transform: none;
  letter-spacing: normal;
}
.topbar .agent {
  flex: none;
  opacity: 0.55;
  max-width: 34vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.log > :deep(*) { flex: 1; min-height: 0; }

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(120, 220, 232, 0.25);
}
.controls button {
  min-height: 3.2rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(120, 220, 232, 0.4);
  background: rgba(120, 220, 232, 0.08);
  color: inherit;
  font: inherit;
  font-size: 1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.controls .ptt.held {
  background: rgba(55, 224, 176, 0.25);
  border-color: #37e0b0;
}
.controls .mute.on {
  background: rgba(255, 184, 77, 0.2);
  border-color: #ffb84d;
  color: #ffb84d;
}
</style>
