<script setup lang="ts">
/** Live daemon event stream at /logs.

The daemon already keeps an event log (agent lifecycle, character changes,
credential checks, and — since #16 — narration-nudge decisions). This view
just polls /events and renders it, so the user can WATCH the daemon's
reasoning on a screen instead of reading a stdout they never see. Read-only:
no state is mutated here. */

import { computed, onMounted, onUnmounted, ref } from "vue";
import { getEvents, getStatus, type DaemonEvent } from "../api/client";
import type { DaemonStatus } from "../types";

const POLL_MS = 700;
const MAX_ROWS = 500;

const events = ref<DaemonEvent[]>([]);
const clocks = ref<DaemonStatus["nudge_clocks"]>({});
const labels = ref<Record<string, string>>({});
const filter = ref<string>("all");
const paused = ref(false);
let sinceSeq = 0;
let timer: ReturnType<typeof setInterval> | undefined;

async function poll() {
  if (paused.value) return;
  try {
    const fresh = await getEvents(sinceSeq);
    if (fresh.length) {
      sinceSeq = fresh[fresh.length - 1].seq;
      events.value = [...events.value, ...fresh].slice(-MAX_ROWS);
    }
  } catch {
    // daemon down / transient — keep the last rows, try again next tick.
  }
  try {
    // The silence clocks piggyback on /status — no per-second stream; the
    // number simply refreshes each poll, and a spoken reset shows up as the
    // silence dropping back toward zero on the very next tick.
    const status = await getStatus();
    clocks.value = status.nudge_clocks ?? {};
    labels.value = status.agent_labels ?? {};
  } catch {
    // leave the last known clocks on screen.
  }
}

const clockRows = computed(() =>
  Object.entries(clocks.value ?? {}).map(([agent, c]) => ({
    agent,
    label: labels.value[agent] || agent.slice(0, 8),
    ...c,
    // fraction of the budget spent, for the meter fill (0 when nudging off)
    pct: c.threshold ? Math.min(100, (c.silence / c.threshold) * 100) : 0,
    over: c.threshold != null && c.silence >= c.threshold,
  })),
);

onMounted(() => {
  void poll();
  timer = setInterval(poll, POLL_MS);
});
onUnmounted(() => timer && clearInterval(timer));

const kinds = computed(() => ["all", ...new Set(events.value.map((e) => e.kind))]);
const shown = computed(() =>
  filter.value === "all" ? events.value : events.value.filter((e) => e.kind === filter.value),
);

// Color by kind, reusing the HUD's semantics: violet = the agent's own
// working/thinking channel (nudges live here); red = anything that errored.
function kindColor(kind: string): string {
  if (kind.endsWith("_error") || kind === "error") return "var(--red)";
  if (kind === "nudge") return "var(--violet)";
  if (kind === "voice" || kind === "character") return "var(--amber)";
  if (kind === "muted" || kind === "unmuted") return "var(--red)";
  return "var(--cyan)";
}

function clockOf(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function clear() {
  events.value = [];
}
</script>

<template>
  <div class="logs">
    <header class="bar">
      <span class="title">DAEMON EVENT LOG</span>
      <div class="controls">
        <label class="flt">
          <span>KIND</span>
          <select v-model="filter">
            <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <button class="btn" :class="{ live: !paused }" @click="paused = !paused">
          {{ paused ? "PAUSED" : "LIVE" }}
        </button>
        <button class="btn" @click="clear">CLEAR</button>
      </div>
    </header>

    <section v-if="clockRows.length" class="clocks">
      <div v-for="c in clockRows" :key="c.agent" class="clock" :class="{ over: c.over, muted: c.threshold == null }">
        <div class="clabel">
          <span class="cname">{{ c.label }}</span>
          <span class="cval">
            {{ c.threshold == null ? "nudging off" : `${c.silence.toFixed(0)}s / ${c.threshold.toFixed(0)}s` }}
            <span class="cflag" :class="{ on: c.fresh }">{{ c.fresh ? "working" : "waiting" }}</span>
          </span>
        </div>
        <div class="meter"><div class="mfill" :style="{ width: c.pct + '%' }"></div></div>
      </div>
    </section>

    <div class="stream">
      <p v-if="!shown.length" class="empty">waiting for events…</p>
      <div v-for="e in shown" :key="e.seq" class="row">
        <span class="ts">{{ clockOf(e.ts) }}</span>
        <span class="kind" :style="{ color: kindColor(e.kind), borderColor: kindColor(e.kind) }">{{ e.kind }}</span>
        <span class="detail">{{ e.detail }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg0);
  color: var(--ink);
  font-family: var(--mono, ui-monospace, monospace);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line-strong, rgba(63, 216, 255, 0.25));
  background: var(--panel-solid);
}
.title {
  font-size: 11px;
  letter-spacing: 0.24em;
  color: var(--cyan);
  text-shadow: var(--glow-cyan);
}
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.flt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--muted);
}
.flt select {
  background: var(--bg1);
  color: var(--cyan-hi);
  border: 1px solid var(--cyan-dim);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: inherit;
  font-size: 11px;
}
.btn {
  background: transparent;
  border: 1px solid var(--cyan-dim);
  color: var(--muted);
  border-radius: 4px;
  padding: 3px 10px;
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 0.16em;
  cursor: pointer;
}
.btn.live {
  color: var(--green);
  border-color: var(--green);
}
.btn:hover {
  border-color: var(--cyan-hi);
}
.clocks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(93, 127, 150, 0.14);
  background: var(--bg1);
}
.clock {
  flex: 1 1 220px;
  min-width: 200px;
}
.clabel {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
  font-size: 11px;
}
.cname {
  color: var(--cyan-hi);
  letter-spacing: 0.06em;
}
.cval {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.cflag {
  margin-left: 8px;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0 4px;
}
.cflag.on {
  color: var(--violet);
}
.meter {
  height: 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--violet) 14%, transparent);
  overflow: hidden;
}
.mfill {
  height: 100%;
  background: var(--violet);
  box-shadow: 0 0 6px var(--violet);
  transition: width 0.4s ease;
}
.clock.over .mfill {
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber);
}
.clock.over .cval {
  color: var(--amber);
}
.clock.muted {
  opacity: 0.45;
}

.stream {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 24px;
  display: flex;
  flex-direction: column;
  /* newest at the bottom, scrolled into view by the browser as rows append */
  justify-content: flex-end;
}
.empty {
  color: var(--muted);
  font-size: 12px;
  padding: 20px 0;
}
.row {
  display: grid;
  grid-template-columns: 72px 90px 1fr;
  align-items: baseline;
  gap: 12px;
  padding: 3px 0;
  font-size: 12px;
  line-height: 1.4;
  border-bottom: 1px solid rgba(93, 127, 150, 0.08);
}
.ts {
  color: var(--muted);
  font-size: 11px;
}
.kind {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-align: center;
  border: 1px solid;
  border-radius: 3px;
  padding: 1px 4px;
  white-space: nowrap;
}
.detail {
  color: var(--ink);
  word-break: break-word;
}
</style>
