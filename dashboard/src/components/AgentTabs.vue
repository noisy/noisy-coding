<script setup lang="ts">
withDefaults(
  defineProps<{
    agents: Record<string, string>; // id -> human label
    active: string | null; // the agent receiving transcripts
    viewed: string | null; // the tab being displayed
    speaking: string[]; // agents currently playing audio
    unread?: string[]; // agents with activity since you last viewed them
  }>(),
  { unread: () => [] },
);

defineEmits<{ select: [name: string] }>();
</script>

<template>
  <nav v-if="Object.keys(agents).length" class="tabs">
    <button
      v-for="(label, name) in agents"
      :key="name"
      :class="{ live: name === active, viewing: name === viewed, speaking: speaking.includes(name) }"
      @click="$emit('select', name)"
    >
      <span class="dot" />
      {{ label }}
      <span v-if="speaking.includes(name)" class="spk">🔊</span>
      <span v-if="unread.includes(name) && name !== viewed" class="unread" title="New activity" />
    </button>
  </nav>
</template>

<style scoped>
.tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
button {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  background: rgba(4, 12, 20, 0.9);
  border: 1px solid var(--line);
  padding: 7px 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
button:hover { color: var(--cyan); border-color: var(--cyan-dim); }
button .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(93, 127, 150, 0.5); }
button.live .dot { background: var(--green); box-shadow: 0 0 6px var(--green); }
button.viewing {
  color: var(--cyan-hi);
  border-color: var(--line-strong);
  background: rgba(63, 216, 255, 0.08);
  text-shadow: 0 0 6px rgba(63, 216, 255, 0.6);
}
button.speaking { border-color: var(--violet-dim); }
.spk { filter: drop-shadow(0 0 4px var(--violet)); }
.unread {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 8px var(--amber);
  animation: unread-pulse 1.4s ease-in-out infinite;
}
@keyframes unread-pulse { 50% { opacity: 0.4; } }
</style>
