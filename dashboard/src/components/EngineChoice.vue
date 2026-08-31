<script setup lang="ts">
// The first-contact question, asked FIRST: which voice engine? (#36/#37)
//
// Before providers existed the gate opened with "paste an xAI key" — which
// silently assumed the answer. Now it offers one card per engine kind:
// CLOUD keeps the existing pitch + key + verification flow (the parent owns
// that; we only tell it which path is chosen), LOCAL is one click — select
// local both ways, kick the weight prefetch, and show the download bars
// right here in the gate. Self-contained like ProviderSettings: fetches
// /providers itself, so the parent grows one tag and one event handler.
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getProviders, setProviders, type ProvidersInfo } from "../api/client";

const emit = defineEmits<{ mode: [mode: "cloud" | "local"] }>();

const info = ref<ProvidersInfo | null>(null);
const chosen = ref<"cloud" | "local">("cloud");
const busy = ref(false);
const error = ref("");

const POLL_MS = 1000;
let pollTimer: ReturnType<typeof setInterval> | undefined;

const localEntry = computed(() =>
  info.value?.catalog.find((p) => p.name === "local"),
);
const downloads = computed(() =>
  (info.value?.downloads ?? []).filter((d) => d.state !== "missing"),
);
const downloading = computed(() =>
  (info.value?.downloads ?? []).some((d) => d.state === "downloading"),
);
const localActive = computed(() => {
  const active = info.value?.active;
  return active?.tts === "local" && active?.stt === "local";
});

// Reflect a pre-existing local setup ONCE, on first load — later polls
// must not fight a user who clicked back to CLOUD mid-download.
let syncedOnce = false;

async function refresh() {
  try {
    info.value = await getProviders();
    if (!syncedOnce && localActive.value) setChosen("local");
    syncedOnce = true;
  } catch {
    info.value = null; // an old daemon — the parent's key flow still works
  }
  clearInterval(pollTimer);
  if (downloading.value) pollTimer = setInterval(refresh, POLL_MS);
}
onMounted(refresh);
onUnmounted(() => clearInterval(pollTimer));

// The daemon answers errors as {"error": "..."} — surface that wording;
// anything else gets a human line instead of a stack-trace string.
function friendly(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const match = text.match(/\{"error":\s*"([^"]+)"/);
  return match ? match[1] : "the daemon didn't accept that — try again";
}

function setChosen(mode: "cloud" | "local") {
  chosen.value = mode;
  emit("mode", mode);
}

async function pickLocal() {
  setChosen("local");
  if (!localEntry.value?.ready) return; // remedy line renders below
  busy.value = true;
  error.value = "";
  try {
    // One click does it all: local for both directions, weights on the way.
    await setProviders({ tts: "local", stt: "local" });
    await refresh();
  } catch (e) {
    error.value = friendly(e);
  } finally {
    busy.value = false;
  }
}

function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}
function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

async function retryDownloads() {
  busy.value = true;
  try {
    await setProviders({ prefetch: true });
    await refresh();
  } catch (e) {
    error.value = friendly(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="info" class="engines">
    <div class="cards">
      <button
        class="card"
        :class="{ on: chosen === 'cloud' }"
        :disabled="busy"
        @click="setChosen('cloud')"
      >
        <span class="card-title">CLOUD · GROK (xAI)</span>
        <span class="card-text">
          The full experience: natural voices, live streaming both ways.
          Needs an API key — runs on pennies.
        </span>
      </button>
      <button
        class="card"
        :class="{ on: chosen === 'local' }"
        :disabled="busy"
        @click="pickLocal"
      >
        <span class="card-title">LOCAL · OFFLINE</span>
        <span class="card-text">
          No key, no cloud, no cost: whisper hears you, Kokoro speaks.
          One click — the models (~340 MB) download while you watch.
        </span>
      </button>
    </div>

    <template v-if="chosen === 'local'">
      <p v-if="localEntry && !localEntry.ready" class="remedy">
        {{ localEntry.ready_detail || "local engines are not available on this system" }}
      </p>
      <div v-if="downloads.length" class="downloads">
        <div v-for="d in downloads" :key="d.name" class="dlrow">
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
          <template v-else-if="d.state === 'error'">
            <span class="dl-state err">FAILED — {{ d.detail }}</span>
            <button class="retry" :disabled="busy" @click="retryDownloads">RETRY</button>
          </template>
        </div>
      </div>
      <p v-if="localActive && !downloading" class="ok-line">
        ✓ Local voice is set up — this gate closes by itself. A cloud key can
        be added any time in SETTINGS.
      </p>
      <p v-if="error" class="remedy">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.engines { display: grid; gap: 12px; margin-bottom: 14px; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card {
  display: grid; gap: 6px; text-align: left; cursor: pointer;
  font-family: var(--mono); color: var(--ink);
  background: rgba(4, 12, 20, 0.9);
  border: 1px solid var(--line-strong);
  padding: 12px 14px;
}
.card.on { border-color: var(--cyan); box-shadow: 0 0 8px rgba(63, 216, 255, 0.25); }
.card:hover { border-color: var(--cyan-dim); }
.card-title { font-size: 10px; letter-spacing: 0.2em; color: var(--cyan); }
.card-text { font-size: 10px; line-height: 1.6; color: var(--muted); }

.remedy { font-size: 10.5px; color: var(--amber); margin: 0; }
.ok-line { font-size: 10.5px; color: var(--green); margin: 0; }

.downloads { display: grid; gap: 8px; }
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
.retry {
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em;
  color: var(--cyan); background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong); padding: 4px 10px; cursor: pointer;
}
</style>
