<script setup lang="ts">
import { computed, ref } from "vue";
import type { DiagnosticChecks } from "../api/client";
import type { InputDevice } from "../types";
import { CUE_LABELS, type CuePrefs } from "../composables/useAudioCues";
import type { CueName } from "../composables/cueEvents";
import { playCue } from "../composables/cueSounds";

const props = withDefaults(
  defineProps<{
    apiKeyHint: string;
    devices?: InputDevice[];
    selectedDevice?: string;
    outputDevice?: string;
    cuePrefs?: CuePrefs | null;
    checks?: DiagnosticChecks | null;
    checksRunning?: boolean;
  }>(),
  {
    devices: () => [], selectedDevice: "", outputDevice: "system", cuePrefs: null,
    checks: null, checksRunning: false,
  },
);
const emit = defineEmits<{
  save: [key: string];
  pickDevice: [name: string];
  pickOutput: [value: string];
  refreshDevices: [];
  toggleCue: [name: CueName, value: boolean];
  runChecks: [];
}>();

const cueNames = Object.keys(CUE_LABELS) as CueName[];

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
  const checks = props.checks;
  if (!checks?.api_key?.ok) return false;
  return ["tts_batch", "tts_stream", "stt_batch", "stt_stream"].some(
    (name) => checks[name] && !checks[name].ok,
  );
});

const keyInput = ref("");
const editing = ref(false);

function submit() {
  const key = keyInput.value.trim();
  if (key.length < 8) return;
  emit("save", key);
  keyInput.value = "";
  editing.value = false;
}
</script>

<template>
  <div class="settings">
    <!-- Microphone first: switched far more often than the API key. -->
    <section class="sec">
      <div class="keyrow">
        <span class="lbl">MICROPHONE</span>
        <select
          class="keyinput"
          :value="selectedDevice"
          @focus="emit('refreshDevices')"
          @change="emit('pickDevice', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">SYSTEM DEFAULT</option>
          <option v-for="d in devices" :key="d.name" :value="d.value ?? d.name">
            {{ d.name.toUpperCase() }}{{ d.default ? " ◆" : "" }}
          </option>
        </select>
      </div>
      <div class="text">
        <p>
          Which input the daemon listens to — switching swaps the audio stream
          live, no restart. ◆ marks the system default. A device plugged in
          after the daemon started shows on the list, but needs a daemon
          restart before it can be opened. THIS BROWSER TAB makes this very
          tab the microphone (asks for permission on pick).
        </p>
      </div>
    </section>

    <section class="sec">
      <div class="keyrow">
        <span class="lbl">OUTPUT</span>
        <select
          class="keyinput"
          :value="outputDevice"
          @change="emit('pickOutput', ($event.target as HTMLSelectElement).value)"
        >
          <option value="system">SYSTEM SPEAKERS</option>
          <option value="browser">THIS BROWSER TAB</option>
        </select>
      </div>
      <div class="text">
        <p>
          Where Claude's voice plays. THIS BROWSER TAB routes speech through
          this page — pair it with the tab microphone and the browser's echo
          cancellation lets you interrupt Claude mid-sentence.
        </p>
      </div>
    </section>

    <section class="sec">
      <div class="keyrow">
        <span class="lbl">XAI API KEY</span>
        <!-- Always an input-shaped field, so it reads as a form at a
             glance — readonly masked value until REPLACE is clicked. -->
        <template v-if="!editing">
          <input class="keyinput stored" :value="`••••••••••••${apiKeyHint.replace(/·/g, '')}`" readonly @click="editing = true" />
          <button class="btn" @click="editing = true">REPLACE</button>
        </template>
        <template v-else>
          <input
            v-model="keyInput"
            type="password"
            class="keyinput"
            placeholder="xai-…"
            @keyup.enter="submit"
          />
          <button class="btn" @click="submit">SAVE</button>
          <button class="btn dim" @click="editing = false">CANCEL</button>
        </template>
      </div>

      <div class="text">
        <p>
          The key powers everything this console does: transcribing your speech
          (Grok STT) and giving Claude a voice (Grok TTS). Get one at
          <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a>
          → <b>API Keys</b> → <b>Create API key</b>, then paste it above.
        </p>
        <details class="costs">
          <summary>WONDERING WHAT THIS COSTS? PENNIES — SEE THE MATH ▾</summary>
          <p>
            Speech-to-text costs <b>$0.10 per hour of audio</b> ($0.20 in
            live-streaming mode) and text-to-speech <b>$4.20 per million
            characters</b>. In practice:
          </p>
          <ul>
            <li>a 15-second spoken command ≈ <b>$0.0004</b></li>
            <li>a typical spoken Claude reply (~200 characters) ≈ <b>$0.0008</b></li>
            <li>a full hour of live conversation ≈ <b>$0.20–0.30</b> both ways</li>
            <li>an hour a day, every workday ≈ <b>$5–7 / month</b></li>
          </ul>
          <p>
            Pricing and docs:
            <a href="https://x.ai/api" target="_blank" rel="noreferrer">x.ai/api</a> ·
            <a href="https://docs.x.ai" target="_blank" rel="noreferrer">docs.x.ai</a> ·
            credits &amp; billing at
            <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a>.
          </p>
        </details>
      </div>
    </section>

    <section class="sec">
      <div class="keyrow">
        <span class="lbl">DIAGNOSTICS</span>
        <button class="btn" :disabled="checksRunning" @click="emit('runChecks')">
          {{ checksRunning ? "RUNNING…" : "RUN CHECKS" }}
        </button>
      </div>
      <div v-if="checks" class="checkgrid">
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
      <div class="text">
        <p>
          Live-checks every xAI call this console makes — each verdict
          stands alone, so one failing endpoint never reads as "your key is
          wrong". The same checks run automatically when you save a key.
        </p>
      </div>
    </section>

    <section v-if="cuePrefs" class="sec">
      <div class="keyrow">
        <span class="lbl">AUDIO CUES</span>
        <span class="cue-hint">{{ cuePrefs.enabled ? "ENABLED" : "DISABLED — TURN ON IN CONTROLS" }}</span>
      </div>
      <div class="cuegrid">
        <div v-for="name in cueNames" :key="name" class="cuerow">
          <button class="btn preview" title="Preview" @click="playCue(name)">▶</button>
          <span class="cue-label">{{ CUE_LABELS[name] }}</span>
          <button
            class="btn"
            :class="{ dim: !cuePrefs.cues[name] }"
            @click="emit('toggleCue', name, !cuePrefs.cues[name])"
          >{{ cuePrefs.cues[name] ? "ON" : "OFF" }}</button>
        </div>
      </div>
      <div class="text">
        <p>
          Whisper-quiet blips for conversation events, so you know what's
          happening without watching the screen. Stored per browser.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings { display: grid; gap: 22px; }

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
.keyinput.stored { color: var(--green); letter-spacing: 0.12em; cursor: pointer; }
.btn {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--cyan);
  background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  padding: 7px 14px;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
}
.btn:hover { color: var(--cyan-hi); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }
.btn.dim { color: var(--muted); border-color: var(--line); }

.checkgrid { display: grid; gap: 6px; margin: 4px 0 14px 102px; max-width: 640px; }
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

.cue-hint { flex: 1; font-size: 9px; letter-spacing: 0.16em; color: var(--muted); }
.cuegrid { display: grid; gap: 8px; margin: 4px 0 14px 102px; max-width: 420px; }
.cuerow { display: flex; align-items: center; gap: 10px; }
.cuerow .preview { padding: 4px 9px; }
.cue-label { flex: 1; font-size: 10px; letter-spacing: 0.14em; color: var(--ink); }

/* The form is the star of this screen; the guidance stays muted and is
   indented to align with the input box. */
.text {
  font-size: 10.5px;
  line-height: 1.75;
  color: var(--muted);
  display: grid;
  gap: 10px;
  max-width: 640px;
  margin-left: 102px; /* label width + gap — lines up with the field */
}
.costs summary {
  cursor: pointer;
  list-style: none;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--cyan-dim);
}
.costs summary::-webkit-details-marker { display: none; }
.costs summary:hover { color: var(--cyan); }
.costs[open] summary { color: var(--cyan); margin-bottom: 8px; }
.costs p, .costs ul { margin-top: 6px; }
.text b { color: var(--ink); font-weight: 400; }
.text a { color: var(--amber-dim); text-decoration: none; border-bottom: 1px dotted var(--amber-dim); }
.text a:hover { color: var(--amber); text-shadow: var(--glow-amber); }
.text ul { margin: 0 0 0 18px; display: grid; gap: 4px; }
.text li b { color: var(--ink); }
</style>
