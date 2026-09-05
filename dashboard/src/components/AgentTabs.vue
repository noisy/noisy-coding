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
  <nav v-if="tabs.length" class="tabs" aria-label="Conversations">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      draggable="true"
      :aria-pressed="tab.name === viewed"
      :title="[tab.label, tab.name === active ? 'Receiving your speech' : '', !tab.online ? 'Offline' : muted.includes(tab.name) ? 'Muted' : speaking.includes(tab.name) ? 'Speaking' : thinking.includes(tab.name) ? 'Working' : 'Ready'].filter(Boolean).join(' · ')"
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
           WAIT count (amber — messages waiting to be heard beat the mere
           "working" pulse) > WORKING (violet) > idle dot. "Who gets the
           mic" needs no glyph — that's the selected (fused, taller) tab. -->
      <span class="statusslot">
        <template v-if="muted.includes(tab.name)">
          <span v-if="(queued[tab.name] ?? 0) > 0" class="mutecount" :title="`Muted — ${queued[tab.name]} waiting`">
            {{ queued[tab.name] }}
          </span>
          <svg v-else class="mutespk" viewBox="0 0 14 14" title="Muted" aria-label="muted">
            <path d="M2 5.2 L5 5.2 L8.2 2.6 L8.2 11.4 L5 8.8 L2 8.8 Z" fill="currentColor" />
            <line x1="10" y1="5" x2="13" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <line x1="13" y1="5" x2="10" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </template>
        <span v-else-if="speaking.includes(tab.name)" class="eq" aria-label="speaking">
          <i /><i /><i />
        </span>
        <span v-else-if="(queued[tab.name] ?? 0) > 0" class="waitcount" :title="`${queued[tab.name]} waiting`">
          {{ queued[tab.name] }}
        </span>
        <span v-else-if="thinking.includes(tab.name)" class="dot think" title="Working" />
        <span v-else class="dot" />
      </span>
      <span class="tab-label">{{ tab.label }}</span>
      <!-- Dismiss: offline conversations only; overlaid so hover never
           changes the tab's width. -->
      <span
        v-if="!tab.online"
        class="dismiss"
        role="button" tabindex="0" @keydown.enter.stop.prevent="$emit('dismiss', tab.name)" @keydown.space.stop.prevent="$emit('dismiss', tab.name)"
        title="Dismiss this conversation"
        @click.stop="$emit('dismiss', tab.name)"
        >✕</span
      >
    </button>
  </nav>
</template>

<style scoped>

.tabs { display:flex; flex-wrap:wrap; gap:6px; }
button { position:relative; display:inline-flex; align-items:center; gap:8px; font:13px var(--sans); color:var(--muted); border:1px solid transparent; background:transparent; padding:9px 12px; min-width:0; max-width:100%; }
.tab-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px; }
button:hover { color:var(--ink); background:var(--surface-hover); }
button.viewing { background:var(--surface-hover); border-color:var(--line-strong); color:var(--ink); }
button.offline { border-style:dashed; padding-right:34px; }
button.dragging { opacity:.5; }
.statusslot { display:inline-flex; justify-content:center; align-items:center; width:13px; height:13px; flex:none; }
.dot { width:6px; height:6px; background:var(--muted); border-radius:50%; }
.think { background:var(--violet); }
.eq { height:12px; display:flex; gap:2px; align-items:center; }
.eq i { width:2px; height:9px; background:var(--green); animation:eq 1s ease-in-out infinite; }
.eq i:nth-child(2) { height:13px; animation-delay:.2s; }
.waitcount { color:var(--amber); font-size:11px; }
.mutecount, .mutespk { color:var(--red); }
.mutespk { width:14px; height:14px; }
.dismiss { position:absolute; right:5px; padding:4px; color:var(--muted); }
.dismiss:hover, .dismiss:focus-visible { color:var(--red); }
@keyframes eq { 50% { transform:scaleY(.5); } }

</style>
