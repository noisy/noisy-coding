<script setup lang="ts">
// The strip under the conversation log: pipeline latencies and what this
// session has cost so far. Purely presentational — all numbers arrive as
// props from /status.
defineProps<{
  sttLatencyMs: number | null;
  ttsLatencyMs: number | null;
  userCostUsd: number;
  claudeCostUsd: number;
  sttSeconds: number;
  ttsChars: number;
}>();

// Latency traffic lights, calibrated on observed healthy values
// (STT ≈ 250-450 ms, TTS first-audio/render ≈ 1-1.5 s).
const LATENCY_BANDS = {
  stt: { warn: 600, bad: 1200 },
  tts: { warn: 1500, bad: 3000 },
} as const;
function latencyTone(kind: keyof typeof LATENCY_BANDS, ms: number | null): string {
  if (ms == null) return "";
  const bands = LATENCY_BANDS[kind];
  return ms >= bands.bad ? "bad" : ms >= bands.warn ? "warn" : "ok";
}

function formatAudioTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
function formatChars(chars: number): string {
  return chars < 10_000 ? `${chars}` : `${(chars / 1000).toFixed(1)}k`;
}
</script>

<template>
  <div class="telemetry">
    <div>
      <div class="k">Transcription</div>
      <div class="v" :class="latencyTone('stt', sttLatencyMs)">
        {{ sttLatencyMs != null ? sttLatencyMs : "—" }}<small v-if="sttLatencyMs != null"> ms</small>
      </div>
    </div>
    <div>
      <div class="k">Voice response</div>
      <div class="v" :class="latencyTone('tts', ttsLatencyMs)">
        {{ ttsLatencyMs != null ? ttsLatencyMs : "—" }}<small v-if="ttsLatencyMs != null"> ms</small>
      </div>
    </div>
    <div>
      <div class="k">Your speech</div>
      <div class="v warn">
        ${{ userCostUsd.toFixed(4) }}
        <small>· {{ formatAudioTime(sttSeconds) }} audio</small>
      </div>
    </div>
    <div>
      <div class="k">Agent speech</div>
      <div class="v violet">
        ${{ claudeCostUsd.toFixed(4) }}
        <small>· {{ formatChars(ttsChars) }} characters</small>
      </div>
    </div>
    <div>
      <div class="k">Conversation total</div>
      <div class="v">${{ (userCostUsd + claudeCostUsd).toFixed(4) }}</div>
    </div>
  </div>
</template>

<style scoped>
.telemetry {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0;
  margin-top: 14px;
  flex: none;
  border: 1px solid var(--line);
  background: var(--bg1);
  border-radius: 8px;
}
.telemetry > div { min-width:0; padding: 9px 12px; border-right: 1px solid rgba(158, 188, 245, 0.12); }
.telemetry > div:last-child { border-right: none; }
.telemetry .k { font-size: 11px; letter-spacing: normal; color: var(--muted); }
.telemetry .v { font-size: 14px; color: var(--cyan); margin-top: 3px; text-shadow: none; }
.telemetry .v small { font-size: 11px; color: var(--muted); }
.telemetry .v.warn { color: var(--amber); text-shadow: none; }
.telemetry .v.violet { color: var(--violet); text-shadow: none; }
.telemetry .v.ok { color: var(--green); text-shadow: none; }
.telemetry .v.bad { color: var(--red); text-shadow: none; }
</style>
