<script setup lang="ts">
// Voice-engine chooser (issues #36/#37). Self-contained on purpose: it
// fetches /providers itself and posts its own changes, so mounting it is
// one import + one tag and no parent grows new plumbing. The form is
// generated from the catalog the daemon sends — a provider added on the
// Python side shows up here with zero frontend work.
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getProviders,
  setProviders,
  type ProviderEntry,
  type ProvidersInfo,
} from "../api/client";

const info = ref<ProvidersInfo | null>(null);
const busy = ref(false);
const note = ref("");

// Big weights arrive in the background — while any file is in flight,
// poll so the bar actually moves.
const POLL_MS = 1000;
let pollTimer: ReturnType<typeof setInterval> | undefined;

const downloading = computed(() =>
  (info.value?.downloads ?? []).some((d) => d.state === "downloading"),
);

// A weight matters on screen only when a local engine is picked (or it
// is mid-flight / failed — never hide an error).
const visibleDownloads = computed(() => {
  const active = info.value?.active;
  const localActive = active && (active.tts === "local" || active.stt === "local");
  return (info.value?.downloads ?? []).filter(
    (d) => d.state === "downloading" || d.state === "error" || (localActive && d.state !== "missing"),
  );
});

function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

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

async function pick(direction: "tts" | "stt", name: string) {
  busy.value = true;
  note.value = "";
  try {
    await setProviders({ [direction]: name });
    note.value = `${direction.toUpperCase()} → ${name.toUpperCase()} — live now, no restart`;
    await refresh();
  } catch (error) {
    note.value = String(error);
  } finally {
    busy.value = false;
  }
}

async function saveField(provider: ProviderEntry, key: string, value: string) {
  if (provider.name !== "local") return; // secrets (xAI key) keep their own flow
  busy.value = true;
  try {
    await setProviders({ local: { [key]: value } });
    note.value = `${key} saved`;
    await refresh();
  } catch (error) {
    note.value = String(error);
  } finally {
    busy.value = false;
  }
}

function fieldsFor(name: string) {
  const entry = info.value?.catalog.find((p) => p.name === name);
  // The xAI key already has a dedicated editor above — don't render secrets twice.
  return entry ? entry.fields.filter((f) => f.kind !== "secret") : [];
}
</script>

<template>
  <section v-if="info" class="sec">
    <div v-for="direction in (['stt', 'tts'] as const)" :key="direction" class="keyrow">
      <span class="lbl">{{ direction === "stt" ? "TRANSCRIPTION" : "VOICE ENGINE" }}</span>
      <select
        class="keyinput"
        :disabled="busy"
        :value="info.active[direction]"
        @change="pick(direction, ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="p in info.catalog.filter((p) => p.directions.includes(direction))"
          :key="p.name"
          :value="p.name"
        >
          {{ p.label.toUpperCase() }}{{ p.ready ? "" : " — NOT READY" }}
        </option>
      </select>
    </div>

    <template v-for="direction in (['stt', 'tts'] as const)" :key="`f-${direction}`">
      <div
        v-for="field in fieldsFor(info.active[direction])"
        :key="`${info.active[direction]}-${field.key}`"
        class="keyrow"
      >
        <span class="lbl">{{ field.label.toUpperCase() }}</span>
        <select
          v-if="field.kind === 'choice'"
          class="keyinput"
          :disabled="busy"
          :value="field.value ?? ''"
          @change="saveField(info.catalog.find((p) => p.name === info!.active[direction])!,
                             field.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in field.options ?? []" :key="o" :value="o">{{ o.toUpperCase() }}</option>
        </select>
        <input
          v-else
          class="keyinput"
          :disabled="busy"
          :value="field.value ?? ''"
          @change="saveField(info.catalog.find((p) => p.name === info!.active[direction])!,
                             field.key, ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <div v-if="visibleDownloads.length" class="downloads">
      <div v-for="d in visibleDownloads" :key="d.name" class="dlrow">
        <span class="dl-label">{{ d.label.toUpperCase() }}</span>
        <template v-if="d.state === 'downloading'">
          <div class="bar">
            <div
              class="fill"
              :class="{ pulse: !d.total_bytes }"
              :style="{ width: (d.total_bytes ? percent(d.done_bytes, d.total_bytes) : 100) + '%' }"
            />
          </div>
          <span class="dl-state">
            {{ d.total_bytes
              ? `${percent(d.done_bytes, d.total_bytes)}% OF ${megabytes(d.total_bytes)}`
              : "DOWNLOADING…" }}
          </span>
        </template>
        <span v-else-if="d.state === 'done'" class="dl-state ok">
          ✓ DOWNLOADED{{ d.total_bytes ? ` — ${megabytes(d.total_bytes)}` : "" }}
        </span>
        <span v-else-if="d.state === 'error'" class="dl-state err">FAILED — {{ d.detail }}</span>
      </div>
    </div>

    <div class="text">
      <p v-if="note" class="note">{{ note }}</p>
      <p>
        Which engine hears you (transcription) and which speaks
        (voice engine). LOCAL runs entirely on this machine — whisper for
        your speech, Kokoro for Claude's — free and offline; the model
        downloads on first use. Switching is live: the daemon re-reads the
        selection on every utterance. Engines marked NOT READY are missing
        a key or an optional install.
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Mirrors SettingsView's form idiom so the section reads as native. */
.keyrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.keyrow .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); width: 92px; flex: none; }
.keyinput {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink);
  background: rgba(4, 12, 20, 0.9);
  border: 1px solid var(--line-strong);
  padding: 8px 12px;
}
.text {
  font-size: 10.5px;
  line-height: 1.75;
  color: var(--muted);
  display: grid;
  gap: 10px;
  max-width: 640px;
  margin-left: 102px;
}
.note { color: var(--green); letter-spacing: 0.08em; }

.downloads { display: grid; gap: 10px; margin: 0 0 16px 102px; max-width: 640px; }
.dlrow { display: flex; align-items: center; gap: 10px; }
.dl-label { font-size: 9px; letter-spacing: 0.18em; color: var(--muted); flex: none; }
.bar {
  flex: 1; height: 6px; background: rgba(4, 12, 20, 0.9);
  border: 1px solid var(--line-strong); overflow: hidden;
}
.fill { height: 100%; background: var(--cyan); transition: width 0.4s linear; }
.fill.pulse { animation: dl-pulse 1.2s ease-in-out infinite; }
@keyframes dl-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }
.dl-state { font-size: 9px; letter-spacing: 0.14em; color: var(--cyan-dim); flex: none; }
.dl-state.ok { color: var(--green); }
.dl-state.err { color: var(--amber); }
</style>
