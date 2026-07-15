<script setup lang="ts">
/** Per-endpoint xAI check verdicts — shared by first contact and SETTINGS.
 * Each row stands alone by design: one failing endpoint must never read
 * as "your key is wrong" when the key check itself is green. */
import { computed } from "vue";
import type { DiagnosticChecks } from "../api/client";

const props = defineProps<{ checks: DiagnosticChecks }>();

// What each check confirms, in the plugin's own terms.
const CHECK_LABELS: Record<string, string> = {
  api_key: "API KEY",
  tts_batch: "TEXT-TO-SPEECH",
  tts_stream: "TEXT-TO-SPEECH (LIVE)",
  stt_batch: "SPEECH-TO-TEXT",
  stt_stream: "SPEECH-TO-TEXT (LIVE)",
  voices: "VOICE LIST",
  billing: "CREDITS DISPLAY",
};

// The distinction that saves a debugging session: the key itself passed,
// but a voice endpoint rejected it → xAI-side degradation, not the key.
const keyFineServiceDegraded = computed(() => {
  if (!props.checks.api_key?.ok) return false;
  return ["tts_batch", "tts_stream", "stt_batch", "stt_stream"].some(
    (name) => props.checks[name] && !props.checks[name].ok,
  );
});
</script>

<template>
  <div class="checkgrid">
    <div v-for="(check, name) in checks" :key="name" class="checkrow">
      <span class="check-mark" :class="check.ok ? 'pass' : 'fail'">{{ check.ok ? "✓" : "✗" }}</span>
      <span class="check-label">{{ CHECK_LABELS[name] ?? String(name).toUpperCase() }}</span>
      <span class="check-detail">{{ check.ok ? (check.ms != null ? `${check.ms} ms` : "") : check.detail }}</span>
    </div>
    <p v-if="keyFineServiceDegraded" class="check-note">
      Your API key is valid, but xAI's voice service is currently
      rejecting it — this looks like a temporary xAI-side issue, not
      your key. Check <a href="https://status.x.ai" target="_blank" rel="noreferrer">status.x.ai</a>
      or try again shortly.
    </p>
  </div>
</template>

<style scoped>
.checkgrid { display: grid; gap: 6px; max-width: 640px; }
.checkrow { display: flex; align-items: baseline; gap: 10px; }
.check-mark { width: 14px; flex: none; font-size: 11px; }
.check-mark.pass { color: var(--green); }
.check-mark.fail { color: var(--red, #ff5f56); }
.check-label { width: 190px; flex: none; font-size: 10px; letter-spacing: 0.14em; color: var(--ink); }
.check-detail { flex: 1; font-size: 9.5px; color: var(--muted); overflow-wrap: anywhere; }
.check-note {
  margin-top: 8px;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--amber);
}
.check-note a { color: var(--amber); }
</style>
