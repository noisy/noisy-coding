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
    thinking?: string[]; // agents currently working (live activity line)
    queued?: Record<string, number>; // waiting messages per agent
    muted?: string[]; // per-conversation mute (future daemon feature)
  }>(),
  { thinking: () => [], queued: () => ({}), muted: () => [], meta: null },
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
      <!-- ONE status glyph, fixed slot, priority ladder (option B):
           MUTE (with or without a count) > SPEAKING (green equalizer) >
           WORKING (violet pulse) > WAIT count (amber) > idle dot.
           "Who gets the mic" needs no glyph — that's the selected
           (fused, taller) tab itself. -->
      <span class="statusslot">
        <template v-if="muted.includes(tab.name)">
          <span v-if="(queued[tab.name] ?? 0) > 0" class="mutecount" :title="`Muted — ${queued[tab.name]} waiting`">
            {{ queued[tab.name] }}
          </span>
          <span v-else class="mutering" title="Muted" />
        </template>
        <span v-else-if="speaking.includes(tab.name)" class="eq" aria-label="speaking">
          <i /><i /><i />
        </span>
        <span v-else-if="thinking.includes(tab.name)" class="dot think" title="Working" />
        <span v-else-if="(queued[tab.name] ?? 0) > 0" class="waitcount" :title="`${queued[tab.name]} waiting`">
          {{ queued[tab.name] }}
        </span>
        <span v-else class="dot" />
      </span>
      {{ tab.label }}
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
button .dot.think {
  background: var(--violet, #b48cff);
  box-shadow: 0 0 6px var(--violet, #b48cff);
  animation: think-pulse 1.2s ease-in-out infinite;
}
@keyframes think-pulse { 50% { opacity: 0.35; } }
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
/* Fixed-size status slot on the left: idle dot, thinking pulse or the
   speaking equalizer all render inside the same box, so the tab never
   changes size when the state does. */
.statusslot {
  width: 13px;
  height: 10px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 100%; }
.eq i {
  width: 3px;
  background: var(--green, #6dff9e);
  box-shadow: 0 0 5px var(--green, #6dff9e);
  transform-origin: bottom;
  animation: eq-bounce 0.8s ease-in-out infinite;
}
.eq i:nth-child(1) { height: 50%; }
.eq i:nth-child(2) { height: 100%; animation-delay: 0.2s; }
.eq i:nth-child(3) { height: 70%; animation-delay: 0.4s; }
@keyframes eq-bounce { 50% { transform: scaleY(0.45); } }
.waitcount {
  font-size: 10px;
  font-weight: 700;
  color: var(--amber, #ffb454);
  text-shadow: 0 0 6px var(--amber, #ffb454);
}
/* Muted with a backlog: dimmed amber under a hairline slash — warm
   enough to keep reminding, quiet enough to respect the mute. */
.mutecount {
  position: relative;
  padding: 0 2px;
  font-size: 10px;
  font-weight: 700;
  color: #a8834a;
}
.mutecount::after {
  content: "";
  position: absolute;
  left: -1px;
  top: 50%;
  width: calc(100% + 2px);
  height: 1px;
  background: rgba(93, 127, 150, 0.9);
  transform: rotate(-35deg);
}
.mutering {
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid rgba(93, 127, 150, 0.9);
}
.mutering::after {
  content: "";
  position: absolute;
  left: 2.5px;
  top: -3px;
  width: 1.5px;
  height: 12px;
  background: rgba(93, 127, 150, 0.9);
  transform: rotate(45deg);
}
/* Overlaid in the top-right corner: appearing on hover must not resize
   the tab (a layout shift under the cursor makes the ✕ unclickable). */
.dismiss {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  padding: 3px 5px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: var(--amber);
  background: rgba(4, 12, 20, 0.92);
  text-shadow: 0 0 6px var(--amber);
  opacity: 0;
  pointer-events: none;
}
button:hover .dismiss { opacity: 1; pointer-events: auto; }
.dismiss:hover { color: #fff; text-shadow: 0 0 8px var(--amber); }
</style>
