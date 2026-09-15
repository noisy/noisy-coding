<script setup lang="ts">
/* Settings > Hotkeys (#104) - design candidates.
 *
 * Presentational: every state comes in through props so Storybook can show
 * the tab disabled (Input Monitoring missing), enabled, capturing a key, a
 * collision with one of our own actions, and a warning about a macOS
 * shortcut. `layout` switches between the three candidate designs; the
 * one Krzysztof picks stays, the others go. */
import { computed } from "vue";

export interface HotkeyBinding {
  action: string;          // stable id, e.g. "hold", "toggle", "scratch", "tab1"
  label: string;           // "Hold-to-talk"
  chord: string;           // canonical, e.g. "cmd+shift+F8"; "" = unbound
  readonly?: boolean;      // Electron-owned (Ctrl+Alt+G), listed, not editable here
  problem?: { kind: "collision" | "system"; detail: string };
}
export interface HotkeyGroup {
  id: string;
  title: string;
  caption: string;         // what the group enables, in one or two sentences
  bindings: HotkeyBinding[];
  /** Round 2: a sub-block inside the same card ("...to a specific tab"). */
  sub?: { title: string; caption: string; bindings: HotkeyBinding[] };
}

const props = withDefaults(
  defineProps<{
    permission?: "granted" | "missing" | "unavailable" | "unknown";
    groups: HotkeyGroup[];
    capturing?: string | null;  // action id whose field is waiting for a key
    layout?: "list" | "cards" | "table" | "merged";
  }>(),
  { permission: "unknown", capturing: null, layout: "list" },
);
const emit = defineEmits<{
  grant: [];
  capture: [action: string];   // user clicked a field: start listening
  clear: [action: string];
}>();

const locked = computed(() => props.permission === "missing");
const chordLabel = (chord: string) =>
  chord ? chord.split("+").map((k) => k.length === 1 ? k.toUpperCase() : k.replace(/^(cmd|shift|alt|ctrl)$/, (m) => ({ cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃" })[m]!)).join(" ") : "";
</script>

<template>
  <div class="hotkeys" :class="[layout, { locked }]">
    <!-- Permission gate: always visible, the only live control while locked. -->
    <div v-if="locked" class="gate" role="status">
      <div class="gatetext">
        <b>Global hotkeys are off until macOS lets Noisy Studio see your keys.</b>
        They need the Input Monitoring permission — that is what the "receive
        keystrokes from any application" prompt asks for. Nothing below works
        without it; your bindings are kept.
      </div>
      <button class="btn" @click="emit('grant')">Grant access</button>
    </div>
    <div v-else-if="permission === 'unavailable'" class="gate muted" role="status">
      Global hotkeys are a macOS feature; this daemon runs elsewhere.
    </div>

    <fieldset :disabled="locked" class="groups">
      <section v-for="g in groups" :key="g.id" class="group">
        <header class="grouphead">
          <h3>{{ g.title }}</h3>
          <p class="caption">{{ g.caption }}</p>
        </header>

        <div class="rows">
          <div v-for="b in g.bindings" :key="b.action" class="row" :class="{ capturing: capturing === b.action, bad: b.problem?.kind === 'collision', warn: b.problem?.kind === 'system', ro: b.readonly }">
            <span class="lbl">{{ b.label }}</span>
            <button
              class="chord"
              :aria-label="`${b.label} key`"
              :disabled="b.readonly"
              @click="emit('capture', b.action)"
            >
              <template v-if="capturing === b.action"><span class="listen">Press a key or combination…</span></template>
              <template v-else-if="b.chord"><kbd v-for="k in chordLabel(b.chord).split(' ')" :key="k">{{ k }}</kbd></template>
              <template v-else><span class="unbound">Not set</span></template>
            </button>
            <button v-if="b.chord && !b.readonly" class="clear" title="Clear" @click="emit('clear', b.action)">✕</button>
            <span v-else-if="b.readonly" class="rohint">set by the app</span>
            <p v-if="b.problem" class="problem">{{ b.problem.detail }}</p>
          </div>
        </div>

        <div v-if="g.sub" class="sub">
          <header class="grouphead">
            <h4>{{ g.sub.title }}</h4>
            <p class="caption">{{ g.sub.caption }}</p>
          </header>
          <div class="rows">
            <div v-for="b in g.sub.bindings" :key="b.action" class="row" :class="{ capturing: capturing === b.action, bad: b.problem?.kind === 'collision', warn: b.problem?.kind === 'system' }">
              <span class="lbl">{{ b.label }}</span>
              <button class="chord" :aria-label="`${b.label} key`" @click="emit('capture', b.action)">
                <template v-if="capturing === b.action"><span class="listen">Press a key or combination…</span></template>
                <template v-else-if="b.chord"><kbd v-for="k in chordLabel(b.chord).split(' ')" :key="k">{{ k }}</kbd></template>
                <template v-else><span class="unbound">Not set</span></template>
              </button>
              <button v-if="b.chord" class="clear" title="Clear" @click="emit('clear', b.action)">✕</button>
              <p v-if="b.problem" class="problem">{{ b.problem.detail }}</p>
            </div>
          </div>
        </div>
      </section>
    </fieldset>

    <p class="foot">
      Click a key field and press the keys you want; Escape cancels, Delete clears.
      Two Noisy Studio actions cannot share a key. Clashes with macOS shortcuts are
      flagged; clashes with other apps cannot be detected — macOS keeps no list.
    </p>
  </div>
</template>

<style scoped>
.hotkeys { display: grid; gap: 22px; min-width: 0; font-family: var(--sans); }
.gate { display: flex; align-items: center; gap: 16px; padding: 12px 14px; border: 1px solid var(--amber-dim); border-left-width: 3px; border-radius: 6px; background: var(--bg1); font-size: 12px; line-height: 1.5; color: var(--ink); }
.gate.muted { border-color: var(--line); color: var(--muted); }
.gatetext { flex: 1; min-width: 0; }
.gate b { color: var(--amber); font-weight: 400; }
.btn { font-family: var(--sans); font-size: 11px; color: var(--cyan); background: rgba(158,188,245,.06); border: 1px solid var(--line-strong); padding: 7px 14px; cursor: pointer; border-radius: 8px; flex: none; }
.btn:hover { color: var(--cyan-hi); }
.groups { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 22px; }
.locked .groups { opacity: .45; pointer-events: none; }
.grouphead h3 { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .02em; color: var(--ink); }
.caption { margin: 4px 0 0; font-size: 12px; line-height: 1.6; color: var(--muted); max-width: 640px; }
.rows { display: grid; gap: 10px; margin-top: 12px; }
.row { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; column-gap: 10px; }
.lbl { font-size: 11px; color: var(--muted); }
.chord { display: flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 10px; border-radius: 6px; background: var(--bg1); border: 1px solid var(--line-strong); color: var(--ink); font-family: var(--sans); font-size: 12px; text-align: left; cursor: pointer; min-width: 0; }
.chord:hover { border-color: var(--cyan-dim); }
.chord:disabled { cursor: default; color: var(--muted); }
kbd { font-family: var(--mono); font-size: 11px; padding: 2px 7px; border-radius: 4px; background: var(--bg0); border: 1px solid var(--line); border-bottom-width: 2px; color: var(--ink); }
.unbound { color: var(--muted); }
.listen { color: var(--cyan); }
.capturing .chord { border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(158,188,245,.15); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 5px rgba(158,188,245,.05); } }
.clear { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.clear:hover { color: var(--ink); }
.rohint { font-size: 11px; color: var(--muted); }
.problem { grid-column: 2 / span 2; margin: 4px 0 0; font-size: 11px; line-height: 1.5; }
.bad .chord { border-color: #d98a8a; }
.bad .problem { color: #e3a3a3; }
.warn .chord { border-color: var(--amber-dim); }
.warn .problem { color: var(--amber); }
.foot { margin: 0; font-size: 12px; line-height: 1.7; color: var(--muted); max-width: 640px; }

/* ---- layout: merged (round 2) - two panes side by side: Push to talk
   with "...to a specific tab" as a sub-block inside the same card, and the
   app-owned companion keys. Narrower: 560px max, 88px labels. */
.merged { max-width: 560px; }
.merged .groups { grid-template-columns: 1fr; }
.merged .group { padding: 14px 16px 16px; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--bg1) 60%, transparent); }
.merged .row { grid-template-columns: 88px minmax(0, 1fr) auto; }
.merged .sub { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--line); }
.merged h4 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .02em; color: var(--ink); }
.merged .chord { min-height: 30px; }

/* ---- layout: cards - each group is a bordered card, two per row when wide */
.cards .groups { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.cards .group { padding: 14px 16px 16px; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--bg1) 60%, transparent); }
.cards .row { grid-template-columns: 96px minmax(0, 1fr) auto; }

/* ---- layout: table - dense, one grid for everything, captions as
   section dividers; for people with many bindings */
.table .groups { gap: 6px; }
.table .grouphead { display: grid; grid-template-columns: 112px 1fr; align-items: baseline; column-gap: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
.table .group:first-child .grouphead { border-top: 0; padding-top: 0; }
.table .grouphead h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.table .caption { margin: 0; }
.table .rows { gap: 4px; margin-top: 8px; }
.table .chord { min-height: 28px; padding: 3px 8px; }
.table kbd { font-size: 10px; padding: 1px 6px; }
</style>
