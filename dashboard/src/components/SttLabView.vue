<script setup lang="ts">
// STT Lab (day 4): one-button consistency sweep over the daemon's archived
// utterances. The daemon owns the DATA (POST /stt-lab/run returns JSON);
// this view owns the pixels - born from the review note "why is the daemon
// producing HTML?", which was a fair question.
import { ref } from "vue";

interface SweepRow {
  file: string;
  text: string;
  batch: number;
  live: number;
  batch_diff?: string;
  live_diff?: string;
}
interface SweepResult {
  error?: string;
  engine?: string;
  files?: number;
  runs_per_path?: number;
  worst?: number;
  verdict?: "PASS" | "FAIL";
  rows?: SweepRow[];
}

const running = ref(false);
const result = ref<SweepResult | null>(null);

async function rerun() {
  running.value = true;
  try {
    const response = await fetch("/stt-lab/run", { method: "POST" });
    result.value = (await response.json()) as SweepResult;
  } catch (error) {
    result.value = { error: String(error) };
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <main class="lab">
    <h1>STT LAB</h1>
    <p class="intro">
      One sweep: the newest recordings, replayed through the active engine on
      both pipelines. 1.000 = deterministic; red = the engine changes its
      mind about identical audio.
    </p>
    <div class="bar">
      <button :disabled="running" @click="rerun">RERUN</button>
      <span v-if="running" class="busy">running… ~1 min (real transcriptions)</span>
      <template v-else-if="result && !result.error">
        <span class="verdict" :class="result.verdict === 'PASS' ? 'ok' : 'bad'">
          {{ result.verdict }}
        </span>
        <span class="meta">
          {{ result.engine }} · worst {{ result.worst?.toFixed(3) }}
        </span>
      </template>
      <span v-else-if="result?.error" class="bad">{{ result.error }}</span>
    </div>
    <table v-if="result?.rows">
      <thead>
        <tr><th>recording</th><th>batch</th><th>live</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in result.rows" :key="row.file">
          <td>
            {{ row.file }}
            <div class="txt">{{ row.text }}</div>
            <div v-if="row.batch_diff" class="diff">batch: {{ row.batch_diff }}</div>
            <div v-if="row.live_diff" class="diff">live: {{ row.live_diff }}</div>
          </td>
          <td :class="row.batch >= 0.9 ? 'ok' : 'bad'">{{ row.batch.toFixed(3) }}</td>
          <td :class="row.live >= 0.9 ? 'ok' : 'bad'">{{ row.live.toFixed(3) }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.lab { max-width: 860px; margin: 0 auto; padding: 24px; font-family: var(--mono); }
h1 { font-size: 16px; letter-spacing: 0.3em; color: var(--cyan); }
.intro { color: var(--muted); font-size: 12.5px; max-width: 620px; }
.bar { display: flex; gap: 14px; align-items: center; margin: 16px 0; }
button {
  background: rgba(4, 12, 20, 0.9); color: var(--cyan);
  border: 1px solid var(--line-strong); font: inherit;
  padding: 10px 26px; cursor: pointer; letter-spacing: 0.2em;
}
button:disabled { opacity: 0.4; }
.busy, .meta { color: var(--muted); font-size: 12px; }
.verdict { font-size: 15px; letter-spacing: 0.2em; }
.ok { color: var(--green, #6dff9e); }
.bad { color: var(--red, #ff5f6b); }
table { border-collapse: collapse; width: 100%; margin-top: 8px; }
td, th { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; }
th { color: var(--muted); font-weight: normal; letter-spacing: 0.15em; font-size: 11px; }
.txt { color: var(--muted); font-size: 11px; }
.diff { color: var(--amber, #ffb84d); font-size: 11px; }
</style>
