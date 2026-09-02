<script setup lang="ts">
// The human status page (day 4): sections of self-tests the daemon can run
// on demand. First section: Speech to text - every archived recording is a
// test with an EXPECTED transcript (blessed from a previous run); RUN ALL
// fires one small request per recording per pipeline IN PARALLEL, and each
// row fills in as its result lands, diffed against the expectation.
import { onMounted, ref } from "vue";

interface SpeechTest {
  file: string;
  seconds: number;
  expected: string;
}
interface RunResult {
  error?: string;
  actual?: string;
  ratio?: number;
  ok?: boolean;
  diff?: string;
  ms?: number;
}
type CellState = { running: boolean; result: RunResult | null };

const engine = ref("");
const tests = ref<SpeechTest[]>([]);
const cells = ref<Record<string, CellState>>({});
const PIPELINES = ["batch", "live"] as const;

const key = (file: string, path: string) => `${file}|${path}`;

async function refresh() {
  const data = await fetch("/tests/speech").then((r) => r.json());
  engine.value = data.engine ?? "";
  tests.value = data.tests ?? [];
}
onMounted(refresh);

async function runOne(file: string, path: string) {
  cells.value[key(file, path)] = { running: true, result: null };
  let result: RunResult;
  try {
    result = await fetch("/tests/speech/run", {
      method: "POST",
      body: JSON.stringify({ file, path }),
    }).then((r) => r.json());
  } catch (error) {
    result = { error: String(error) };
  }
  cells.value[key(file, path)] = { running: false, result };
}

/** All recordings, both pipelines, at once - parallelism is the point. */
function runAll() {
  for (const t of tests.value)
    for (const p of PIPELINES) void runOne(t.file, p);
}

/** Store this run's transcript as the recording's expected text. */
async function blessFrom(file: string) {
  const text =
    cells.value[key(file, "batch")]?.result?.actual ??
    cells.value[key(file, "live")]?.result?.actual;
  if (!text) return;
  await fetch("/tests/speech/bless", {
    method: "POST",
    body: JSON.stringify({ file, text }),
  });
  await refresh();
}
</script>

<template>
  <main class="status">
    <h1>STATUS</h1>

    <section>
      <header class="sec-head">
        <h2>Speech to text</h2>
        <span class="meta">{{ engine }} · {{ tests.length }} recordings · batch + live</span>
        <button :disabled="!tests.length" @click="runAll">RUN ALL</button>
      </header>
      <p v-if="!tests.length" class="meta">
        No recordings archived yet - speak to the daemon first.
      </p>
      <div v-for="t in tests" :key="t.file" class="test">
        <div class="test-head">
          <span class="file">{{ t.file }} · {{ t.seconds }}s</span>
          <button
            v-if="!t.expected && (cells[key(t.file, 'batch')]?.result?.actual || cells[key(t.file, 'live')]?.result?.actual)"
            class="small" @click="blessFrom(t.file)">
            SET AS EXPECTED
          </button>
        </div>
        <p v-if="t.expected" class="expected">expected: {{ t.expected }}</p>
        <p v-else class="meta">no expectation yet - run once, then set it</p>
        <div v-for="p in PIPELINES" :key="p" class="cell">
          <span class="pipe">{{ p }}</span>
          <template v-if="cells[key(t.file, p)]?.running">
            <span class="running">running…</span>
          </template>
          <template v-else-if="cells[key(t.file, p)]?.result">
            <template v-if="cells[key(t.file, p)]!.result!.error">
              <span class="bad">{{ cells[key(t.file, p)]!.result!.error }}</span>
            </template>
            <template v-else>
              <span v-if="cells[key(t.file, p)]!.result!.ratio !== undefined"
                :class="cells[key(t.file, p)]!.result!.ok ? 'ok' : 'bad'">
                {{ cells[key(t.file, p)]!.result!.ok ? "PASS" : "FAIL" }}
                {{ cells[key(t.file, p)]!.result!.ratio!.toFixed(3) }}
              </span>
              <span class="meta">{{ cells[key(t.file, p)]!.result!.ms }} ms</span>
              <div class="actual">{{ cells[key(t.file, p)]!.result!.actual }}</div>
              <div v-if="cells[key(t.file, p)]!.result!.diff" class="diff">
                {{ cells[key(t.file, p)]!.result!.diff }}
              </div>
            </template>
          </template>
          <span v-else class="meta">-</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.status { max-width: 900px; margin: 0 auto; padding: 24px; font-family: var(--mono); }
h1 { font-size: 16px; letter-spacing: 0.3em; color: var(--cyan); }
h2 { font-size: 14px; letter-spacing: 0.2em; margin: 0; }
.sec-head { display: flex; gap: 14px; align-items: center; border-bottom: 1.5px solid var(--line-strong); padding-bottom: 8px; margin-bottom: 12px; }
.sec-head button { margin-left: auto; }
button { background: rgba(4, 12, 20, 0.9); color: var(--cyan); border: 1px solid var(--line-strong); font: inherit; padding: 8px 20px; cursor: pointer; letter-spacing: 0.2em; }
button.small { padding: 3px 10px; font-size: 10px; }
button:disabled { opacity: 0.4; }
.meta { color: var(--muted); font-size: 11.5px; }
.test { border-bottom: 1px solid var(--line); padding: 10px 0; }
.test-head { display: flex; gap: 12px; align-items: center; }
.file { font-size: 12px; }
.expected { color: var(--cyan-dim, #7fd0e8); font-size: 12px; margin: 4px 0; }
.cell { display: grid; grid-template-columns: 52px auto 1fr; gap: 4px 12px; align-items: baseline; padding: 3px 0 3px 12px; }
.cell .actual, .cell .diff { grid-column: 2 / 4; }
.pipe { color: var(--muted); font-size: 11px; letter-spacing: 0.15em; }
.running { color: var(--amber, #ffb84d); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.4; } }
.ok { color: var(--green, #6dff9e); }
.bad { color: var(--red, #ff5f6b); }
.actual { color: var(--ink, #cfe9f5); font-size: 12px; }
.diff { color: var(--amber, #ffb84d); font-size: 11px; }
</style>
