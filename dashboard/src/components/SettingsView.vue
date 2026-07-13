<script setup lang="ts">
import { ref } from "vue";
import type { InputDevice } from "../types";

withDefaults(
  defineProps<{
    apiKeyHint: string;
    devices?: InputDevice[];
    selectedDevice?: string;
  }>(),
  { devices: () => [], selectedDevice: "" },
);
const emit = defineEmits<{
  save: [key: string];
  pickDevice: [name: string];
  refreshDevices: [];
}>();

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
          <option v-for="d in devices" :key="d.name" :value="d.name">
            {{ d.name.toUpperCase() }}{{ d.default ? " ◆" : "" }}
          </option>
        </select>
      </div>
      <div class="text">
        <p>
          Which input the daemon listens to — switching swaps the audio stream
          live, no restart. ◆ marks the system default. A device plugged in
          after the daemon started shows on the list, but needs a daemon
          restart before it can be opened.
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
