<script setup lang="ts">
import { ref } from "vue";

defineProps<{ apiKeyHint: string }>();
const emit = defineEmits<{ save: [key: string] }>();

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
    <section class="sec">
      <div class="sec-title"><span class="idx">01</span> GROK · XAI API KEY</div>

      <div class="keyrow">
        <span class="lbl">STATUS</span>
        <template v-if="!editing">
          <span class="keyhint">SET {{ apiKeyHint }}</span>
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
          → <b>API Keys</b> → <b>Create API key</b>, then paste it above. It is stored
          locally in <b>~/.config/grok-voice/credentials.json</b> and never leaves
          this machine except toward the xAI API.
        </p>
        <p>
          The voice API is <b>cheap</b> — speech-to-text costs <b>$0.10 per hour of
          audio</b> ($0.20 in live-streaming mode) and text-to-speech
          <b>$4.20 per million characters</b>. In practice:
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
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings { display: grid; gap: 22px; }
.sec-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--cyan);
  text-transform: uppercase;
}
.sec-title::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, var(--line-strong), transparent); }
.sec-title .idx { color: var(--muted); letter-spacing: 0.1em; }

.keyrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.keyrow .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); width: 78px; flex: none; }
.keyhint { flex: 1; font-size: 11px; letter-spacing: 0.14em; color: var(--green); text-shadow: 0 0 8px rgba(77, 255, 180, 0.4); }
.keyinput {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink);
  background: rgba(4, 12, 20, 0.9);
  border: 1px solid var(--line-strong);
  padding: 8px 12px;
}
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

.text { font-size: 11.5px; line-height: 1.75; color: var(--ink); display: grid; gap: 10px; max-width: 640px; }
.text b { color: var(--cyan-hi); font-weight: 400; }
.text a { color: var(--amber); text-decoration: none; border-bottom: 1px dotted var(--amber-dim); }
.text a:hover { text-shadow: var(--glow-amber); }
.text ul { margin: 0 0 0 18px; display: grid; gap: 4px; }
.text li { color: var(--muted); }
.text li b { color: var(--green); }
</style>
