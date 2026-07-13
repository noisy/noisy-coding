<script setup lang="ts">
import type { Utterance } from "../types";
import ClaudeBubble from "./ClaudeBubble.vue";
import UserBubble from "./UserBubble.vue";

withDefaults(defineProps<{ utterance: Utterance; playing?: boolean }>(), {
  playing: false,
});
defineEmits<{ replay: [utterance: Utterance]; cancel: [utterance: Utterance] }>();

function sysTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return [d.getHours(), d.getMinutes()].map((n) => String(n).padStart(2, "0")).join(":");
}
</script>

<template>
  <!-- System rows: small inline annotations (mic switched, …) that sit in
       the timeline so oddities right below them explain themselves —
       informative, never an alarm. -->
  <div v-if="utterance.role === 'system'" class="sysrow">
    <span>{{ utterance.text }} · {{ sysTime(utterance.committed_at) }}</span>
  </div>
  <UserBubble
    v-else-if="utterance.role === 'user'"
    :utterance="utterance"
    @cancel="$emit('cancel', $event)"
  />
  <ClaudeBubble
    v-else
    :utterance="utterance"
    :playing="playing"
    @replay="$emit('replay', $event)"
  />
</template>

<style scoped>
.sysrow {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 8.5px;
  letter-spacing: 0.22em;
  color: var(--muted);
  text-transform: uppercase;
}
.sysrow::before,
.sysrow::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--line), transparent);
}
</style>
