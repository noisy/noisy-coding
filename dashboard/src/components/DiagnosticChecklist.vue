<script setup lang="ts">
/** Per-endpoint xAI check verdicts — shared by first contact and SETTINGS.
 * Each row stands alone by design: one failing endpoint must never read
 * as "your key is wrong" when the key check itself is green.
 *
 * Rows keep a constant height and transform IN PLACE (name … verdict);
 * failure details unfold below the row with a grid-rows animation — the
 * anchored modal then grows smoothly downward instead of jumping. */
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
    (name) => props.checks[name]?.ok === false, // completed failures only
  );
});
</script>

<template>
  <div class="checkgrid">
    <template v-for="(check, name) in checks" :key="name">
      <div class="checkrow">
        <span class="check-label">{{ CHECK_LABELS[name] ?? String(name).toUpperCase() }}</span>
        <span class="leader"></span>
        <span
          class="check-verdict"
          :class="check.pending ? 'pending' : check.ok ? 'pass' : 'fail'"
        >{{ check.pending ? "◌" : check.ok ? `✓${check.ms != null ? ` ${check.ms} ms` : ""}` : "✗ FAILED" }}</span>
      </div>
      <div class="errwrap" :class="{ open: check.ok === false }">
        <div class="errinner">{{ check.detail }}</div>
      </div>
    </template>
    <p v-if="keyFineServiceDegraded" class="check-note">
      Your API key is valid, but xAI's voice service is currently
      rejecting it — this looks like a temporary xAI-side issue, not
      your key. Check <a href="https://status.x.ai" target="_blank" rel="noreferrer">status.x.ai</a>
      or try again shortly.
    </p>
  </div>
</template>

<style scoped>
.checkgrid { display: grid; gap: 4px; max-width: 640px; }
.checkrow { display: flex; align-items: baseline; gap: 8px; height: 18px; }
.check-label { flex: none; font-size: 10px; letter-spacing: 0.14em; color: var(--ink); }
.leader { flex: 1; border-bottom: 1px dotted var(--line-strong); transform: translateY(-3px); }
.check-verdict { flex: none; font-size: 10px; letter-spacing: 0.1em; }
.check-verdict.pass { color: var(--green); }
.check-verdict.fail { color: var(--red, #ff5f56); }
.check-verdict.pending { color: var(--cyan-dim); animation: checkpulse 1s ease-in-out infinite; }
@keyframes checkpulse { 50% { opacity: 0.3; } }

/* Failure details unfold without re-centering the modal: 0fr → 1fr rows. */
.errwrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}
.errwrap.open { grid-template-rows: 1fr; }
.errinner {
  overflow: hidden;
  min-height: 0;
  font-size: 9.5px;
  line-height: 1.6;
  color: var(--muted);
  overflow-wrap: anywhere;
  padding-left: 14px;
}

.check-note {
  margin-top: 8px;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--amber);
}
.check-note a { color: var(--amber); }
</style>
