<script setup lang="ts">
import { computed } from "vue";
import type { Utterance } from "../types";

const props = defineProps<{ utterances: Utterance[] }>();

const turns = computed(() =>
  props.utterances
    .filter((turn) => turn.committed_at > 0 && turn.role !== "system")
    .sort((a, b) => a.committed_at - b.committed_at),
);

// Older turns have no measured duration; retain the speech-length estimate.
function durationOf(turn: Utterance): number {
  return turn.duration_s || Math.max(2, turn.text.length / 15);
}

const segments = computed(() => {
  const total = turns.value.reduce((sum, turn) => sum + durationOf(turn), 0);
  let position = 0;
  return turns.value.map((turn) => {
    const width = durationOf(turn) / total * 100;
    const segment = { id: turn.id, role: turn.role, x: position, width };
    position += width;
    return segment;
  });
});

const counts = computed(() => ({
  you: turns.value.filter((turn) => turn.role === "user").length,
  agent: turns.value.filter((turn) => turn.role === "claude").length,
}));

const elapsed = computed(() => {
  const list = turns.value;
  if (list.length < 2) return "";
  const seconds = Math.max(0, Math.floor(list[list.length - 1].committed_at - list[0].committed_at));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
});
</script>

<template>
  <div class="turn-history">
    <div class="summary">
      <p class="total"><strong>{{ turns.length }}</strong> {{ turns.length === 1 ? "turn" : "turns" }}</p>
      <span v-if="elapsed" class="elapsed">{{ elapsed }} elapsed</span>
    </div>
    <div class="timeline" role="img" :aria-label="`${turns.length} turns in speech order, oldest to newest`">
      <svg viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
        <rect v-for="segment in segments" :key="segment.id" :x="segment.x" y="0"
          :width="segment.width" height="1"
          :fill="segment.role === 'user' ? 'var(--amber)' : 'var(--violet)'" />
      </svg>
    </div>
    <dl class="counts">
      <div><dt><i class="you" />You</dt><dd>{{ counts.you }}</dd></div>
      <div><dt><i class="agent" />Agent</dt><dd>{{ counts.agent }}</dd></div>
    </dl>
    <p v-if="!turns.length" class="empty">Your turns will appear here.</p>
  </div>
</template>

<style scoped>
.turn-history { display: grid; gap: 12px; font-family: var(--sans); }
.summary { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 10px; }
.total { color: var(--muted); font-size: 13px; }
.total strong { color: var(--ink); font-size: 22px; font-weight: 600; margin-right: 3px; font-variant-numeric: tabular-nums; }
.elapsed, .empty { color: var(--muted); font-size: 12px; }
.timeline { height: 8px; overflow: hidden; border-radius: 4px; background: var(--surface-hover); }
.timeline svg { display: block; width: 100%; height: 100%; }
.counts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; font-size: 12px; }
.counts > div, dt { display: flex; align-items: center; gap: 6px; }
.counts > div { justify-content: space-between; }
dt { color: var(--muted); }
dd { color: var(--ink); font-variant-numeric: tabular-nums; }
dt i { width: 6px; height: 6px; border-radius: 2px; }
.you { background: var(--amber); }
.agent { background: var(--violet); }
</style>
