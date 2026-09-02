<script setup lang="ts">
// The human status page (day 4): self-test sections the daemon runs on
// demand. Speech to text is a MATRIX - recordings down, pipelines across,
// compact PASS/FAIL chips in the cells. Detail (transcript + word diff)
// appears only where something is red: green needs no explanation.
import { onMounted, ref } from "vue";

interface SpeechTest {
  file: string;
  seconds: number;
  expected: string;
}
interface RunResult {
  error?: string;
  actual?: string;
  expected?: string;
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

/** Word-level diff as render segments - the classic two-line format:
 *  the expected line marks deletions red, the actual line insertions green.
 *  Plain LCS over lowercased words; original casing is what gets shown. */
type Seg = { text: string; changed: boolean };
function diffLines(expected: string, actual: string): { exp: Seg[]; act: Seg[] } {
  const a = expected.split(/\s+/).filter(Boolean);
  const b = actual.split(/\s+/).filter(Boolean);
  const al = a.map((w) => w.toLowerCase());
  const bl = b.map((w) => w.toLowerCase());
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = al[i] === bl[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const exp: Seg[] = [];
  const act: Seg[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (al[i] === bl[j]) { exp.push({ text: a[i++], changed: false }); act.push({ text: b[j++], changed: false }); }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) exp.push({ text: a[i++], changed: true });
    else act.push({ text: b[j++], changed: true });
  }
  while (i < a.length) exp.push({ text: a[i++], changed: true });
  while (j < b.length) act.push({ text: b[j++], changed: true });
  return { exp, act };
}
const cell = (file: string, path: string) => cells.value[key(file, path)];

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

/** A row needs its detail block only when something on it went wrong. */
function failures(file: string) {
  return PIPELINES.map((p) => ({ pipe: p, r: cell(file, p)?.result }))
    .filter(({ r }) => r && (r.error || r.ok === false));
}

</script>

<template>
  <main class="status">
    <h1>STATUS</h1>

    <section>
      <header class="sec-head">
        <h2>Speech to text</h2>
        <span class="meta">{{ engine }} · {{ tests.length }} recordings</span>
        <button :disabled="!tests.length" @click="runAll">RUN ALL</button>
      </header>
      <p v-if="!tests.length" class="meta">
        No recordings archived yet - speak to the daemon first.
      </p>
      <table v-else>
        <thead>
          <tr>
            <th>recording</th>
            <th v-for="p in PIPELINES" :key="p" class="pipe-col">{{ p }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="t in tests" :key="t.file">
            <tr>
              <td>
                <span class="file">{{ t.file }}</span>
                <span class="meta"> · {{ t.seconds }}s</span>
              </td>
              <td v-for="p in PIPELINES" :key="p" class="pipe-col">
                <span v-if="cell(t.file, p)?.running" class="running">…</span>
                <template v-else-if="cell(t.file, p)?.result">
                  <span v-if="cell(t.file, p)!.result!.error" class="chip bad">✗ ERR</span>
                  <span v-else-if="cell(t.file, p)!.result!.ok === false" class="chip bad">
                    ✗ {{ cell(t.file, p)!.result!.ratio!.toFixed(2) }}
                  </span>
                  <span v-else-if="cell(t.file, p)!.result!.ok" class="chip ok">✓</span>
                  <span v-else class="chip ok">✓</span>
                </template>
                <span v-else class="meta">-</span>
              </td>
            </tr>
            <tr v-if="failures(t.file).length" class="detail-row">
              <td colspan="3">
                <div v-for="f in failures(t.file)" :key="f.pipe" class="fail-detail">
                  <span class="pipe">{{ f.pipe }}</span>
                  <template v-if="f.r!.error">{{ f.r!.error }}</template>
                  <div v-else class="difflines">
                    <div class="line del">
                      <span class="sign">-</span>
                      <span v-for="(seg, n) in diffLines(f.r!.expected ?? t.expected, f.r!.actual ?? '').exp"
                        :key="n" :class="{ hl: seg.changed }">{{ seg.text }}&nbsp;</span>
                    </div>
                    <div class="line ins">
                      <span class="sign">+</span>
                      <span v-for="(seg, n) in diffLines(f.r!.expected ?? t.expected, f.r!.actual ?? '').act"
                        :key="n" :class="{ hl: seg.changed }">{{ seg.text }}&nbsp;</span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
/* The HUD shell disables body scrolling (#app is a fixed viewport); a
   status page is a DOCUMENT - it must scroll on its own. */
.status {
  max-width: 900px; margin: 0 auto; padding: 24px;
  font-family: var(--mono);
  height: 100vh; overflow-y: auto; box-sizing: border-box;
}
h1 { font-size: 16px; letter-spacing: 0.3em; color: var(--cyan); }
h2 { font-size: 14px; letter-spacing: 0.2em; margin: 0; }
.sec-head { display: flex; gap: 14px; align-items: center; border-bottom: 1.5px solid var(--line-strong); padding-bottom: 8px; margin-bottom: 12px; }
.sec-head button { margin-left: auto; }
button { background: rgba(4, 12, 20, 0.9); color: var(--cyan); border: 1px solid var(--line-strong); font: inherit; padding: 8px 20px; cursor: pointer; letter-spacing: 0.2em; }
button:disabled { opacity: 0.4; }
.meta { color: var(--muted); font-size: 11px; }
table { border-collapse: collapse; width: 100%; }
td, th { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; font-size: 12px; overflow-wrap: anywhere; }
table { table-layout: fixed; }
th { color: var(--muted); font-weight: normal; letter-spacing: 0.15em; font-size: 10.5px; }
.pipe-col { width: 90px; }
.chip { font-size: 10.5px; letter-spacing: 0.1em; padding: 2px 7px; border: 1px solid; }
.chip.ok { color: var(--green, #6dff9e); border-color: rgba(109, 255, 158, 0.4); }
.chip.bad { color: var(--red, #ff5f6b); border-color: rgba(255, 95, 107, 0.5); }
.chip.none { color: var(--muted); border-color: var(--line); }
.running { color: var(--amber, #ffb84d); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.4; } }
.detail-row td { background: rgba(255, 95, 107, 0.05); }
.fail-detail { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 2px 10px; padding: 4px 0; }
.pipe { color: var(--muted); font-size: 10.5px; letter-spacing: 0.15em; }
/* Classic two-line diff: expected with deletions in red, actual with
   insertions in green - highlights on the words, quiet elsewhere. */
.difflines { font-size: 11.5px; display: grid; gap: 2px; min-width: 0; }
/* Long transcripts WRAP - a failure must never widen the table and summon
   a horizontal scrollbar that shoves the other results off screen. */
.line { padding: 2px 6px; overflow-wrap: anywhere; white-space: normal; }
.line .sign { display: inline-block; width: 14px; color: var(--muted); }
.line.del { background: rgba(255, 95, 107, 0.07); }
.line.ins { background: rgba(109, 255, 158, 0.06); }
.line.del .hl { color: var(--red, #ff5f6b); background: rgba(255, 95, 107, 0.18); }
.line.ins .hl { color: var(--green, #6dff9e); background: rgba(109, 255, 158, 0.16); }
</style>
