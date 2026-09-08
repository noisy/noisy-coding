<script setup lang="ts">
// The provider chooser as a picture of the audio path (#36/#37):
//
//   YOUR MIC ── [GROK HEARS] ── CLAUDE ── [LOCAL SPEAKS] ── SPEAKERS
//
// One pill per direction; clicking a pill flips that half between cloud
// and local. Mixing directions is not an "advanced" concept here — it is
// simply the two pills disagreeing, which the benchmarks say is the best
// real configuration (local STT is faster than the cloud round-trip,
// local TTS is ~5 s per reply). Downloads hang under the pill they
// belong to; whisper size and voice choices fold behind ADVANCED.
// Self-contained like its predecessor: fetches /providers itself.
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getProviders,
  setProviders,
  type ModelDownload,
  type ProvidersInfo,
} from "../api/client";

const info = ref<ProvidersInfo | null>(null);
const busy = ref(false);
const note = ref("");
const advanced = ref(false);

const POLL_MS = 1000;
let pollTimer: ReturnType<typeof setInterval> | undefined;

const downloading = computed(() =>
  (info.value?.downloads ?? []).some((d) => d.state === "downloading"),
);

async function refresh() {
  try {
    info.value = await getProviders();
  } catch {
    info.value = null; // an old daemon without /providers — hide quietly
  }
  clearInterval(pollTimer);
  if (downloading.value) pollTimer = setInterval(refresh, POLL_MS);
}
onMounted(refresh);
onUnmounted(() => clearInterval(pollTimer));

function friendly(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const match = text.match(/\{"error":\s*"([^"]+)"/);
  return match ? match[1] : "the daemon didn't accept that — try again";
}

async function flip(direction: "tts" | "stt") {
  const current = info.value?.active[direction];
  const next = current === "local" ? "grok" : "local";
  busy.value = true;
  note.value = "";
  try {
    await setProviders({ [direction]: next });
    note.value =
      `${direction === "stt" ? "hearing" : "speaking"} → ` +
      `${next === "local" ? "LOCAL" : "GROK"} — live now, no restart`;
    await refresh();
  } catch (e) {
    note.value = friendly(e);
  } finally {
    busy.value = false;
  }
}

async function saveLocalOption(key: string, value: string) {
  busy.value = true;
  try {
    await setProviders({ local: { [key]: value } });
    note.value = `${key} saved`;
    await refresh();
  } catch (e) {
    note.value = friendly(e);
  } finally {
    busy.value = false;
  }
}

async function retryDownloads() {
  busy.value = true;
  try {
    await setProviders({ prefetch: true });
    note.value = "download restarted";
    await refresh();
  } catch (e) {
    note.value = friendly(e);
  } finally {
    busy.value = false;
  }
}

function pillLabel(direction: "tts" | "stt"): string {
  const name = info.value?.active[direction] === "local" ? "LOCAL" : "GROK";
  return direction === "stt" ? `${name} HEARS` : `${name} SPEAKS`;
}

// Each weight belongs under one pill: whisper under the ear, Kokoro
// under the mouth — visible while its half is LOCAL (errors always).
function downloadsFor(direction: "tts" | "stt"): ModelDownload[] {
  const all = info.value?.downloads ?? [];
  const mine = all.filter((d) =>
    direction === "stt" ? d.name.startsWith("whisper") : d.name.startsWith("kokoro") || d.name.startsWith("voices"),
  );
  const localHalf = info.value?.active[direction] === "local";
  return mine.filter(
    (d) => d.state === "error" || d.state === "downloading" || (localHalf && d.state === "done"),
  );
}

const localEntry = computed(() =>
  info.value?.catalog.find((p) => p.name === "local"),
);
const grokEntry = computed(() =>
  info.value?.catalog.find((p) => p.name === "grok"),
);

// Why a SELECTED engine can't run — under the path, always actionable.
const remedies = computed(() => {
  const out: string[] = [];
  const active = info.value?.active;
  if (!active) return out;
  for (const entry of [grokEntry.value, localEntry.value]) {
    if (!entry || entry.ready) continue;
    if (Object.values(active).includes(entry.name) && entry.ready_detail) {
      out.push(`${entry.label.toUpperCase()}: ${entry.ready_detail}`);
    }
  }
  return out;
});

const advancedFields = computed(
  () => localEntry.value?.fields.filter((f) => f.kind !== "secret") ?? [],
);

function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}
function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}
</script>

<template>
  <section v-if="info" class="sec">
    <div class="path">
      <span class="node">YOUR MIC</span><span class="wire" />
      <button class="pill" :disabled="busy" title="click to switch who transcribes you"
        @click="flip('stt')">{{ pillLabel("stt") }}</button>
      <span class="wire" /><span class="node">AGENT</span><span class="wire" />
      <button class="pill" :disabled="busy" title="click to switch who renders the agent’s voice"
        @click="flip('tts')">{{ pillLabel("tts") }}</button>
      <span class="wire" /><span class="node">SPEAKERS</span>
    </div>

    <div v-for="direction in (['stt', 'tts'] as const)" :key="direction">
      <div v-if="downloadsFor(direction).length || info.active[direction] === 'local'" class="under">
        <div v-for="d in downloadsFor(direction)" :key="d.name" class="dlrow">
          <span class="dl-label">{{ d.label.toUpperCase() }}</span>
          <template v-if="d.state === 'downloading'">
            <div class="bar">
              <div class="fill" :class="{ pulse: !d.total_bytes }"
                :style="{ width: (d.total_bytes ? percent(d.done_bytes, d.total_bytes) : 100) + '%' }" />
            </div>
            <span class="dl-state">
              {{ d.total_bytes
                ? `${percent(d.done_bytes, d.total_bytes)}% OF ${megabytes(d.total_bytes)}`
                : "DOWNLOADING…" }}
            </span>
          </template>
          <span v-else-if="d.state === 'done'" class="dl-state ok">
            ✓ ON DISK{{ d.total_bytes ? ` — ${megabytes(d.total_bytes)}` : "" }}
          </span>
          <template v-else-if="d.state === 'error'">
            <span class="dl-state err">FAILED — {{ d.detail }}</span>
            <button class="btn" :disabled="busy" @click="retryDownloads">RETRY</button>
          </template>
        </div>
        <p v-if="info.active[direction] === 'local'" class="hint">
          {{ direction === "stt"
            ? "local hearing is faster than realtime — free, offline"
            : "voice replies take ~5 s on this machine — free, offline" }}
        </p>
      </div>
    </div>

    <p v-for="r in remedies" :key="r" class="warn">{{ r }}</p>
    <p v-if="note" class="note">{{ note }}</p>

    <div class="adv" @click="advanced = !advanced">
      ADVANCED {{ advanced ? "▴" : "▾" }}
      <span class="adv-hint">whisper size · voice</span>
    </div>
    <div v-if="advanced" class="adv-body">
      <div v-for="field in advancedFields" :key="field.key" class="keyrow">
        <span class="lbl">{{ field.label.toUpperCase() }}</span>
        <select v-if="field.kind === 'choice'" class="keyinput" :disabled="busy"
          :value="field.value ?? ''"
          @change="saveLocalOption(field.key, ($event.target as HTMLSelectElement).value)">
          <option v-for="o in field.options ?? []" :key="o" :value="o">{{ o.toUpperCase() }}</option>
        </select>
        <input v-else class="keyinput" :disabled="busy" :value="field.value ?? ''"
          @change="saveLocalOption(field.key, ($event.target as HTMLInputElement).value)" />
      </div>
    </div>

    <div class="text">
      <p>
        The audio path, left to right: click a pill to flip that half
        between GROK (cloud, needs the key) and LOCAL (on this machine,
        free). The halves are independent — mixed setups are normal, and
        switching is live on the next utterance.
      </p>
    </div>
  </section>
</template>

<style scoped>
.sec { display: grid; gap: 12px; }
.path {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: normal; color: var(--muted);
}
.node { flex: none; }
.wire { flex: 1; border-top: 1px dashed var(--line-strong); }
.pill {
  font-family: var(--sans); font-size: 11px; letter-spacing: normal;
  color: var(--cyan); cursor: pointer;
  border: 1px solid var(--cyan-dim); border-radius: 999px; padding: 5px 14px;
  background: var(--bg1); flex: none;
}
.pill:hover { border-color: var(--cyan); text-shadow: none; }

.under { display: grid; gap: 6px; margin-left: 90px; max-width: 560px; }
.dlrow { display: flex; align-items: center; gap: 10px; }
.dl-label { font-size: 11px; letter-spacing: normal; color: var(--muted); flex: none; }
.bar {
  flex: 1; height: 6px; background: var(--bg1);
  border: 1px solid var(--line-strong); overflow: hidden;
}
.fill { height: 100%; background: var(--cyan); transition: width 0.4s linear; }
.fill.pulse { animation: none; }
@keyframes dl-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }
.dl-state { font-size: 11px; letter-spacing: normal; color: var(--cyan-dim); flex: none; }
.dl-state.ok { color: var(--green); }
.dl-state.err { color: var(--amber); }
.hint { font-size: 11px; color: var(--muted); margin: 0; }

.warn { font-size: 11px; color: var(--amber); margin: 0 0 0 90px; }
.note { font-size: 11px; color: var(--green); letter-spacing: normal; margin: 0 0 0 90px; }

.adv {
  font-size: 11px; letter-spacing: normal; color: var(--cyan-dim);
  cursor: pointer; margin-left: 90px;
}
.adv:hover { color: var(--cyan); }
.adv-hint { color: var(--muted); margin-left: 8px; letter-spacing: normal; }
.adv-body { display: grid; gap: 10px; margin-left: 90px; max-width: 560px; }
.keyrow { display: flex; align-items: center; gap: 10px; }
.keyrow .lbl { font-size: 11px; letter-spacing: normal; color: var(--muted); width: 140px; flex: none; }
.keyinput {
  flex: 1; font-family: var(--sans); font-size: 12px; color: var(--ink);
  background: var(--bg1); border: 1px solid var(--line-strong);
  padding: 8px 12px;
}
.btn {
  font-family: var(--sans); font-size: 11px; letter-spacing: normal;
  color: var(--cyan); background: rgba(158, 188, 245, 0.06);
  border: 1px solid var(--line-strong); padding: 4px 10px; cursor: pointer; flex: none;
}
.text {
  font-size: 11px; line-height: 1.75; color: var(--muted);
  max-width: 640px; margin-left: 90px;
}
</style>
