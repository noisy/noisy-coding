<script setup lang="ts">
import { computed, ref } from "vue";

export interface AgentMeta {
  label: string;
  online: boolean;
  activated_at: number;
  offline_since: number | null;
  manual_pos?: number | null;
}

const props = withDefaults(
  defineProps<{
    agents: Record<string, string>; // id -> human label (legacy daemons)
    meta?: Record<string, AgentMeta> | null; // id -> tab metadata (#11)
    active: string | null; // the agent receiving transcripts
    viewed: string | null; // the tab being displayed
    speaking: string[]; // agents currently playing audio
    unread?: string[]; // agents with activity since you last viewed them
  }>(),
  { unread: () => [], meta: null },
);

const emit = defineEmits<{
  select: [name: string];
  dismiss: [name: string];
  reorder: [names: string[]];
}>();

interface Tab {
  name: string;
  label: string;
  online: boolean;
  activatedAt: number;
  offlineSince: number;
  manualPos: number | null;
}

// Within each group, user-pinned tabs (drag & drop) come first in pinned
// order; the rest follow the group's natural order.
function groupSort(tabsIn: Tab[], natural: (a: Tab, b: Tab) => number): Tab[] {
  return [...tabsIn].sort((a, b) => {
    if (a.manualPos != null && b.manualPos != null) return a.manualPos - b.manualPos;
    if (a.manualPos != null) return -1;
    if (b.manualPos != null) return 1;
    return natural(a, b);
  });
}

// Two groups: actives first (by arrival into the group — activated_at asc),
// then offline (most recently ended first — offline_since desc). A daemon
// without agents_meta yields the legacy flat list, all treated as online.
const groups = computed(() => {
  const meta = props.meta ?? {};
  const all: Tab[] = Object.keys(props.agents).map((name) => ({
    name,
    label: meta[name]?.label ?? props.agents[name],
    online: meta[name]?.online ?? true,
    activatedAt: meta[name]?.activated_at ?? 0,
    offlineSince: meta[name]?.offline_since ?? 0,
    manualPos: meta[name]?.manual_pos ?? null,
  }));
  return {
    actives: groupSort(all.filter((t) => t.online), (a, b) => a.activatedAt - b.activatedAt),
    offline: groupSort(all.filter((t) => !t.online), (a, b) => b.offlineSince - a.offlineSince),
  };
});
const tabs = computed(() => [...groups.value.actives, ...groups.value.offline]);

// Drag & drop within a group only: dropping an active tab onto an offline
// one (or vice versa) is ignored — group membership is liveness, not choice.
const dragging = ref<string | null>(null);
function onDrop(target: Tab) {
  const name = dragging.value;
  dragging.value = null;
  if (!name || name === target.name) return;
  const group = target.online ? groups.value.actives : groups.value.offline;
  const names = group.map((t) => t.name);
  const from = names.indexOf(name);
  if (from === -1) return; // cross-group drop
  names.splice(from, 1);
  names.splice(names.indexOf(target.name) + (from <= names.indexOf(target.name) ? 1 : 0), 0, name);
  emit("reorder", names);
}
</script>

<template>
  <nav v-if="tabs.length" class="tabs">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      draggable="true"
      :class="{
        live: tab.name === active,
        viewing: tab.name === viewed,
        speaking: speaking.includes(tab.name),
        offline: !tab.online,
        dragging: tab.name === dragging,
      }"
      @click="$emit('select', tab.name)"
      @dragstart="dragging = tab.name"
      @dragend="dragging = null"
      @dragover.prevent
      @drop.prevent="onDrop(tab)"
    >
      <span class="dot" />
      {{ tab.label }}
      <span v-if="speaking.includes(tab.name)" class="spk">🔊</span>
      <span
        v-if="unread.includes(tab.name) && tab.name !== viewed"
        class="unread"
        title="New activity"
      />
      <!-- Dismiss: offline conversations only; overlaid so hover never
           changes the tab's width. -->
      <span
        v-if="!tab.online"
        class="dismiss"
        role="button"
        title="Dismiss this conversation"
        @click.stop="$emit('dismiss', tab.name)"
        >✕</span
      >
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
  position: relative;
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
button.offline { opacity: 0.45; }
button.dragging { opacity: 0.3; border-style: dashed; }
button.offline .dot { background: rgba(93, 127, 150, 0.35); }
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
/* Overlaid in the top-right corner: appearing on hover must not resize
   the tab (a layout shift under the cursor makes the ✕ unclickable). */
.dismiss {
  position: absolute;
  top: 0;
  right: 2px;
  padding: 0 3px;
  font-size: 9px;
  line-height: 1.4;
  color: var(--muted);
  opacity: 0;
  pointer-events: none;
}
button:hover .dismiss { opacity: 1; pointer-events: auto; }
.dismiss:hover { color: var(--amber); }
</style>
