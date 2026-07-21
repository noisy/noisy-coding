<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { cancelTranscript, getDevices, runDiagnostics, saveApiKey, setAgentMuted, setCharacter, setMode, setMuted, setPtt, setSettings, setVoiceMuted, speakText, stopPlayback, type DiagnosticChecks } from "./api/client";
import type { InputDevice } from "./types";
import { replaySpeechText } from "./components/bubbleStatus";
import type { Character, Utterance } from "./types";
import ActivityLine from "./components/ActivityLine.vue";
import AgentTabs from "./components/AgentTabs.vue";
import VoicePersona from "./components/VoicePersona.vue";
import CharacterReadout from "./components/CharacterReadout.vue";
import ConversationLog from "./components/ConversationLog.vue";
import ConversationTelemetry from "./components/ConversationTelemetry.vue";
import DiagnosticChecklist from "./components/DiagnosticChecklist.vue";
import HudPanel from "./components/HudPanel.vue";
import Oscilloscope from "./components/Oscilloscope.vue";
import SessionRing from "./components/SessionRing.vue";
import SettingsView from "./components/SettingsView.vue";
import SpectrumBars from "./components/SpectrumBars.vue";
import StatusStrip from "./components/StatusStrip.vue";
import type { CueName } from "./composables/cueEvents";
import { useAudioCues } from "./composables/useAudioCues";
import { useBrowserAudio } from "./composables/useBrowserAudio";
import { useDaemonState } from "./composables/useDaemonState";
import { useMicStream } from "./composables/useMicStream";

const { status, utterances, character, offline, viewedAgent, errors, selectAgent, dismissAgent, reorderAgents } =
  useDaemonState();

// Agents visibly "working": their live-activity line was updated in the
// last few seconds (tool running or THINKING between tools).
const THINKING_FRESH_S = 20;
const thinkingAgents = computed(() => {
  const activity = status.value?.activity ?? {};
  const now = Date.now() / 1000;
  return Object.entries(activity)
    .filter(([, a]) => a?.text && now - a.at < THINKING_FRESH_S)
    .map(([name]) => name);
});

const lastError = computed(() => errors.value[errors.value.length - 1] ?? null);
const errorCount = computed(() => errors.value.length);

const { prefs: cuePrefs, enabled: cuesEnabled } = useAudioCues(utterances, status, errorCount);
const setCue = (name: CueName, value: boolean) => (cuePrefs.value.cues[name] = value);

function eventTime(ts: number): string {
  const d = new Date(ts * 1000);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
const { level } = useMicStream();

const levelPercent = computed(() => `${Math.round(level.value * 100)}%`);
const levelDb = computed(() =>
  level.value > 0 ? `${(20 * Math.log10(level.value)).toFixed(1)} dB` : "−∞ dB",
);

// A dev instance is any daemon serving off the production port. The marker
// is deliberately confined to the logo block — the rest of the theme stays
// production-identical so prod colors can be tested on a local instance.
const isDevInstance = window.location.port !== "" && window.location.port !== "8765";
const instancePort = window.location.port;

const clock = ref("");
function tickClock() {
  const d = new Date();
  clock.value = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
let clockTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  tickClock();
  clockTimer = setInterval(tickClock, 1000);
});
onUnmounted(() => clearInterval(clockTimer));

const today = new Date().toISOString().slice(0, 10);

// Controls: fire the POST, then let the next 400 ms poll reflect reality —
// no optimistic local state to get out of sync.
const swallow = () => {};
const toggleMute = () => setMuted(!status.value?.muted).catch(swallow);
const setSttMode = (mode: "batch" | "live") => setMode(mode).catch(swallow);
const setTtsMode = (mode: "batch" | "live") => setSettings({ tts_mode: mode }).catch(swallow);
const setSilence = (event: Event) =>
  setSettings({ end_silence_ms: Number((event.target as HTMLSelectElement).value) }).catch(swallow);
const setSensitivity = (event: Event) =>
  setSettings({ mic_sensitivity: Number((event.target as HTMLSelectElement).value) }).catch(swallow);
const setSmartTurn = (event: Event) =>
  setSettings({ smart_turn: Number((event.target as HTMLSelectElement).value) }).catch(swallow);

const changeCharacter = (patch: Partial<Character>) =>
  setCharacter({ ...patch, agent: viewedAgent.value ?? undefined }).catch(swallow);
// Per-conversation mute: toggles the VIEWED tab; the next poll reflects it.
const toggleAgentMute = () => {
  const agent = viewedAgent.value;
  if (!agent) return;
  const muted = (status.value?.muted_agents ?? []).includes(agent);
  setAgentMuted(agent, !muted).catch(swallow);
};
const setDetection = (mode: "auto" | "ptt") =>
  setSettings({ detection_mode: mode }).catch(swallow);
// The button toggles: playing this very bubble → stop it (the queue moves
// on by itself); otherwise queue a replay that outranks current playback.
const replay = (utterance: Utterance) => {
  if (status.value?.playing_utterance_id === utterance.id) {
    stopPlayback().catch(swallow);
    return;
  }
  speakText(
    replaySpeechText(utterance.text), utterance.id, viewedAgent.value ?? undefined,
  ).catch(swallow);
};
const cancel = (utterance: Utterance) => cancelTranscript(utterance.id).catch(swallow);

const unheard = computed(() =>
  utterances.value.filter((u) => u.role === "claude" && u.status.includes("unheard")),
);
const toggleVoiceMute = () => setVoiceMuted(!status.value?.voice_muted).catch(swallow);
// Catch up: unmute FIRST (or the replays would park as unheard again),
// then queue every parked message in arrival order — the playback queue
// serializes them, each stoppable with its ⏹.
async function catchUp() {
  await setVoiceMuted(false).catch(swallow);
  [...unheard.value]
    .sort((a, b) => (a.committed_at || a.started_at) - (b.committed_at || b.started_at))
    .forEach((u) => speakText(replaySpeechText(u.text), u.id).catch(swallow));
}

// Push-to-talk: while the button (or the space bar) is physically held we
// renew the daemon's hold lease (it expires by itself if we die mid-hold).
let pttTimer: ReturnType<typeof setInterval> | undefined;
function startPtt() {
  if (pttTimer) return; // already holding (e.g. key auto-repeat)
  setPtt(true).catch(swallow);
  pttTimer = setInterval(() => setPtt(true).catch(swallow), 500);
}
function stopPtt() {
  if (!pttTimer) return;
  clearInterval(pttTimer);
  pttTimer = undefined;
  setPtt(false).catch(swallow);
}
function pttPress(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  startPtt();
}

// Space = the talk button, but never while typing into a field.
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
function onKeyDown(event: KeyboardEvent) {
  if (event.code !== "Space" || isTypingTarget(event.target)) return;
  if (status.value?.detection_mode !== "ptt" || status.value?.muted) return;
  event.preventDefault(); // don't scroll / re-click focused buttons
  startPtt();
}
function onKeyUp(event: KeyboardEvent) {
  if (event.code !== "Space" || isTypingTarget(event.target)) return;
  stopPtt();
}
onMounted(() => {
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
});
onUnmounted(() => {
  removeEventListener("keydown", onKeyDown);
  removeEventListener("keyup", onKeyUp);
  clearInterval(pttTimer);
});

// API key setup: full-screen gate when unconfigured; later managed from
// the SETTINGS view (which swaps in for the comm log).
const keyInput = ref("");
const showSettings = ref(false);
// The gate must not blink away mid-verification OR right after a
// rejection: the daemon stores the candidate key while it live-checks it,
// so the polled api_key_set reads true for a few seconds even for a key
// about to be rejected — and stays stale for one more poll after the
// verdict. Both flags bridge those windows.
const firstContactVerifying = ref(false);
const firstContactFailed = ref(false);
const unconfigured = computed(
  () =>
    status.value != null &&
    (!status.value.api_key_set || firstContactVerifying.value || firstContactFailed.value),
);
// Per-endpoint xAI checks: run automatically on key save, or on demand.
// Kept here (not in SettingsView) so the panel stays a dumb form — and
// shared with the first-contact gate, which accepts a key ONLY once the
// daemon verified it against the live service.
const keyChecks = ref<DiagnosticChecks | null>(null);
const checksRunning = ref(false);
const keyError = ref("");
const saveKey = async (key: string): Promise<boolean> => {
  keyChecks.value = null;
  keyError.value = "";
  checksRunning.value = true;
  try {
    const result = await saveApiKey(key);
    keyChecks.value = result.checks ?? null;
    if (!result.ok) keyError.value = result.error ?? "the key failed verification";
    return result.ok;
  } catch {
    keyError.value = "cannot reach the daemon";
    return false;
  } finally {
    checksRunning.value = false;
  }
};
async function submitKey() {
  const key = keyInput.value.trim();
  if (key.length < 8) return;
  firstContactVerifying.value = true;
  firstContactFailed.value = false;
  try {
    const accepted = await saveKey(key);
    if (accepted) keyInput.value = "";
    firstContactFailed.value = !accepted;
  } finally {
    firstContactVerifying.value = false;
  }
}
// While checks run, the daemon reports verdicts as they land — show those;
// once the save resolves, its authoritative result takes over.
const visibleChecks = computed(() =>
  keyChecks.value ?? (checksRunning.value ? status.value?.diagnostic_checks ?? null : null),
);
const runChecks = async () => {
  keyChecks.value = null;
  checksRunning.value = true;
  try {
    keyChecks.value = await runDiagnostics();
  } catch {
    keyChecks.value = null;
  } finally {
    checksRunning.value = false;
  }
};

const setLanguage = (event: Event) =>
  setSettings({ language: (event.target as HTMLSelectElement).value }).catch(swallow);

// Microphone picker: the list refreshes when the select gains focus, so a
// freshly connected headset shows up without reloading the page.
const devices = ref<InputDevice[]>([]);
const loadDevices = () => getDevices().then((d) => (devices.value = d)).catch(swallow);
onMounted(loadDevices);
const browserAudio = useBrowserAudio();
// The SPEAKER side needs no permission and no gesture — connect the WS
// lease the moment the page knows the tab is a nominated device, so
// Claude's first words (the first-contact greeting) can play at once.
let autoConnectTried = false;
watch(status, (s) => {
  if (autoConnectTried || !s) return;
  if (s.input_device === "browser" || s.output_device === "browser") {
    autoConnectTried = true; // once per page load; the banner is the retry
    browserAudio.connect().catch(swallow);
  }
});
// The banner covers what still needs the USER: the mic permission (and a
// reconnect after a failed auto-connect).
const tabAudioNeeded = computed(
  () =>
    !!status.value &&
    !unconfigured.value &&
    ((status.value.input_device === "browser" && !browserAudio.micLive.value) ||
      (status.value.output_device === "browser" && !browserAudio.active.value)),
);
const tabAudioRoles = computed(() => {
  const roles = [];
  if (status.value?.input_device === "browser" && !browserAudio.micLive.value) {
    roles.push("microphone");
  }
  if (status.value?.output_device === "browser" && !browserAudio.active.value) {
    roles.push("speaker");
  }
  return roles.join(" and ");
});
async function enableTabAudio() {
  try {
    if (status.value?.input_device === "browser") await browserAudio.enable();
    else await browserAudio.connect();
  } catch {
    // the reason is already in browserAudio.error, shown on the banner
  }
}
// The tab connection serves both directions — tear it down only when
// NEITHER side uses the tab anymore.
function dropTabUnlessNeeded() {
  const s = status.value;
  if (s?.input_device !== "browser" && s?.output_device !== "browser") {
    browserAudio.disable();
  }
}
async function pickMic(name: string) {
  if (name !== "browser") {
    await setSettings({ input_device: name }).catch(swallow);
    dropTabUnlessNeeded();
    return;
  }
  // The picker click is our user gesture — getUserMedia is allowed here.
  try {
    await browserAudio.enable();
    await setSettings({ input_device: "browser" });
  } catch {
    // Permission or lease refused: stay on the system default rather than
    // pointing the daemon at a microphone that will never send a frame.
    await setSettings({ input_device: "" }).catch(swallow);
  }
}
async function pickOutput(value: string) {
  if (value !== "browser") {
    await setSettings({ output_device: "system" }).catch(swallow);
    dropTabUnlessNeeded();
    return;
  }
  try {
    await browserAudio.connect(); // lease only — the speaker needs no mic permission
    await setSettings({ output_device: "browser" });
  } catch {
    await setSettings({ output_device: "system" }).catch(swallow);
  }
}

const SILENCE_OPTIONS = [800, 1500, 2000, 3000, 4000];
// User terms for the VAD speech threshold (never raw RMS): LOW for noisy
// rooms (mic needs a clear voice), HIGH for quiet rooms / soft speakers.
const SENSITIVITY_OPTIONS: Array<[number, string]> = [
  [0, "MIN"], [25, "LOW"], [50, "MID"], [75, "HIGH"], [100, "MAX"],
];
const SMART_TURN_OPTIONS = [0, 0.5, 0.7, 0.9];
// Languages supported by the Grok voice API (same set as the legacy UI).
const LANGUAGES: Record<string, string> = {
  "": "AUTO-DETECT",
  en: "ENGLISH",
  pl: "POLSKI",
  de: "DEUTSCH",
  es: "ESPAÑOL",
  fr: "FRANÇAIS",
  "pt-BR": "PORTUGUÊS (BR)",
  it: "ITALIANO",
  ja: "日本語",
  zh: "中文",
};
</script>

<template>
  <div class="scanlines" />
  <div class="vignette" />

  <!-- First contact: the HUD itself is the demo — live scopes prove the
       mic works, API-dependent sections sit dimmed behind the key prompt. -->
  <div v-if="unconfigured" class="setup-overlay">
    <div class="setup-box">
      <div class="setup-title">NOISY-CODING · FIRST CONTACT</div>
      <!-- The welcome pitch has done its job the moment a key is submitted:
           from then on the box is a verification panel, and every saved
           line keeps it on-screen even with seven failing checks. It folds
           away (grid-rows collapse) instead of vanishing in one frame. -->
      <div
        class="setup-pitch"
        :class="{ collapsed: checksRunning || !!visibleChecks || firstContactFailed }"
      >
        <div class="setup-pitch-inner">
          <p class="setup-text">
            Talk to Claude out loud — it hears you, answers through your speakers,
            and this console shows the whole conversation live. The oscilloscope
            below is already listening to your mic.
          </p>
          <p class="setup-text">
            All it needs is an xAI API key, and it runs on <b>pennies</b>:
            listening costs <b>$0.10 per hour</b>, a spoken reply is a fraction of
            a cent. Create a key at
            <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a>
            and paste it here:
          </p>
        </div>
      </div>
      <div class="setup-row">
        <input
          v-model="keyInput"
          type="password"
          class="setup-input"
          placeholder="xai-…"
          :disabled="checksRunning"
          @keyup.enter="submitKey"
        />
        <button class="ctl" :disabled="checksRunning" @click="submitKey">
          {{ checksRunning ? "VERIFYING…" : "CONNECT" }}
        </button>
      </div>
      <!-- Verify-then-commit: the key is accepted only after the daemon
           confirmed it against the live service — a dead key must fail
           HERE, not utterances later. Verdicts land row by row, live. -->
      <p v-if="keyError" class="setup-error">✗ {{ keyError.toUpperCase() }}</p>
      <DiagnosticChecklist v-if="visibleChecks" :checks="visibleChecks" class="setup-checks" />
      <!-- Honest next steps: usually it's the key, sometimes it's xAI. -->
      <p v-if="firstContactFailed && !checksRunning" class="setup-text setup-hint">
        This key doesn't seem right — xAI rejected it. Most often the key is
        mistyped, expired, or lacks permissions: check it at
        <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a>
        and paste it again. In fairness, it can also be xAI itself having a
        moment (<a href="https://status.x.ai" target="_blank" rel="noreferrer">status.x.ai</a>)
        — in that case the very same key might pass if you retry in a while.
      </p>
    </div>
  </div>

  <div class="hud">
    <!-- The Docker path preselects the tab as mic/speaker, so the picker
         never fires a change event — and getUserMedia needs a user
         gesture anyway. This banner IS that gesture. -->
    <button v-if="tabAudioNeeded" class="tabaudio" @click="enableTabAudio">
      🎙 ENABLE TAB AUDIO — this tab is your {{ tabAudioRoles }}; click once to activate
      <span v-if="browserAudio.error.value" class="taberr">{{ browserAudio.error.value }}</span>
    </button>
    <header>
      <div class="logo" :class="{ dev: isDevInstance }">
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
          <polygon points="23,2 41,12.5 41,33.5 23,44 5,33.5 5,12.5" fill="none" stroke="#3fd8ff" stroke-width="1.4" opacity="0.9" />
          <polygon points="23,8 36,15.5 36,30.5 23,38 10,30.5 10,15.5" fill="rgba(63,216,255,0.08)" stroke="#3fd8ff" stroke-width="0.7" opacity="0.6" />
          <g stroke="#3fd8ff" stroke-width="2" stroke-linecap="round">
            <line x1="17" y1="20" x2="17" y2="26" />
            <line x1="21" y1="16" x2="21" y2="30" />
            <line x1="25" y1="19" x2="25" y2="27" />
            <line x1="29" y1="21" x2="29" y2="25" />
          </g>
        </svg>
        <div>
          <div class="title">NOISY-CODING</div>
          <div class="sub">TACTICAL VOICE INTERFACE</div>
          <div v-if="isDevInstance" class="devbadge">LOCAL DEV · :{{ instancePort }}</div>
        </div>
      </div>

      <div class="sysstate">
        <div class="clockbox">
          <div class="clock">{{ clock }}</div>
          <div class="date">{{ today }}</div>
        </div>
      </div>
    </header>

    <div class="cols">
      <div class="col-left">
        <!-- Panic-sized mute: quick muting must not require aiming at a
             tiny control, so it gets widget-scale real estate up top. -->
        <button class="bigmute" :class="{ muted: status?.muted, locked: unconfigured }" @click="toggleMute">
          <span class="bm-label">{{ status?.muted ? "◉ MIC MUTED" : "MUTE MIC" }}</span>
          <span class="bm-sub">{{ status?.muted ? "TAP TO UNMUTE" : "ONE TAP TO GO SILENT" }}</span>
        </button>
        <!-- Holding while muted records nothing — lock the button and say
             why instead of silently eating the press. -->
        <button
          v-if="status?.detection_mode === 'ptt'"
          class="bigmute talk"
          :class="{ held: status?.ptt_held }"
          :disabled="status?.muted"
          @pointerdown="pttPress"
          @pointerup="stopPtt"
          @pointercancel="stopPtt"
        >
          <span class="bm-label">
            {{ status?.muted ? "⊘ LOCKED" : status?.ptt_held ? "◉ ON AIR" : "HOLD TO TALK" }}
          </span>
          <span class="bm-sub">
            {{ status?.muted ? "MIC MUTED — UNMUTE FIRST" : status?.ptt_held ? "RELEASE TO SEND" : "HOLD THIS OR THE SPACE BAR" }}
          </span>
        </button>
        <button class="voicemute" :class="{ muted: status?.voice_muted, locked: unconfigured }" @click="toggleVoiceMute">
          <span class="vm-label">{{ status?.voice_muted ? "◉ CLAUDE MUTED" : "MUTE CLAUDE" }}</span>
          <span class="vm-sub">
            {{ status?.voice_muted ? `${unheard.length} UNHEARD — PARKING SILENTLY` : "PARK SPEECH WHILE AWAY" }}
          </span>
        </button>
        <HudPanel index="01" title="MIC INPUT · OSCILLOSCOPE">
          <Oscilloscope :level="level" />
          <div class="dbrow">
            <span class="lbl">LEVEL</span>
            <span class="dbbar"><i :style="{ width: levelPercent }" /></span>
            <span class="val">{{ levelDb }}</span>
          </div>
        </HudPanel>
        <HudPanel index="02" title="AUDIO SPECTRUM">
          <SpectrumBars :level="level" />
        </HudPanel>
        <HudPanel index="03" title="CONTROLS" :class="{ locked: unconfigured }">
          <div class="controls">
            <!-- The two mode toggles sit together: same choice, two
                 directions (Claude's voice out vs your voice in). -->
            <div class="ctlrow" title="Claude's speech: batch renders the whole clip first, live streams as it synthesizes">
              <span class="lbl">TEXT TO SPEECH</span>
              <button class="ctl small" :class="{ on: status?.tts_mode === 'batch' }" @click="setTtsMode('batch')">BATCH</button>
              <button class="ctl small" :class="{ on: status?.tts_mode === 'live' }" @click="setTtsMode('live')">LIVE</button>
            </div>
            <div class="ctlrow" title="Your speech: batch transcribes after silence ($0.10/h), live streams while you talk ($0.20/h)">
              <span class="lbl">SPEECH TO TEXT</span>
              <button class="ctl small" :class="{ on: status?.mode === 'batch' }" @click="setSttMode('batch')">BATCH</button>
              <button class="ctl small" :class="{ on: status?.mode === 'live' }" @click="setSttMode('live')">LIVE</button>
            </div>
            <div class="ctlrow" title="Subtle blips on conversation events; pick which in SETTINGS">
              <span class="lbl">AUDIO CUES</span>
              <button class="ctl small" :class="{ on: cuesEnabled }" @click="cuesEnabled = true">ON</button>
              <button class="ctl small" :class="{ on: !cuesEnabled }" @click="cuesEnabled = false">OFF</button>
            </div>
            <div class="ctlcol" title="How your turn ends: auto = the VAD detects silence; push to talk = you hold the big button">
              <span class="lbl">TURN DETECTION</span>
              <div class="ctlbtns">
                <button class="ctl small" :class="{ on: status?.detection_mode === 'auto' }" @click="setDetection('auto')">AUTO</button>
                <button class="ctl small" :class="{ on: status?.detection_mode === 'ptt' }" @click="setDetection('ptt')">PUSH TO TALK</button>
              </div>
            </div>
            <div class="ctlrow">
              <span class="lbl">SILENCE</span>
              <select class="ctl small" :value="status?.end_silence_ms" @change="setSilence">
                <option v-for="ms in SILENCE_OPTIONS" :key="ms" :value="ms">{{ (ms / 1000).toFixed(1) }}s</option>
              </select>
            </div>
            <div class="ctlrow" title="Noise gate: how loud a voice must be to trip the mic. Lower it in a noisy room (café, open office) so background sound stops triggering recordings.">
              <span class="lbl">MIC SENSITIVITY</span>
              <select class="ctl small" :value="status?.mic_sensitivity ?? 50" @change="setSensitivity">
                <option v-for="[value, label] in SENSITIVITY_OPTIONS" :key="value" :value="value">{{ label }}</option>
              </select>
            </div>
            <div class="ctlrow">
              <span class="lbl">SMART TURN</span>
              <select class="ctl small" :value="status?.smart_turn" @change="setSmartTurn">
                <option v-for="v in SMART_TURN_OPTIONS" :key="v" :value="v">{{ v === 0 ? "OFF" : v.toFixed(1) }}</option>
              </select>
            </div>
            <div class="ctlrow" title="Language for speech recognition and synthesis; auto-detect handles mixed Polish/English">
              <span class="lbl">LANGUAGE</span>
              <select class="ctl small" :value="status?.language ?? ''" @change="setLanguage">
                <option v-for="(name, code) in LANGUAGES" :key="code" :value="code">{{ name }}</option>
              </select>
            </div>
          </div>
        </HudPanel>
        <!-- Global, machine-wide cost/state: deliberately OUTSIDE the
             conversation frame — the daemon meters all conversations. -->
        <HudPanel index="05" title="SYSTEM STATE · COST">
          <StatusStrip :status="status" :offline="offline" />
        </HudPanel>
        <button class="ctl settingsbtn" :class="{ on: showSettings }" @click="showSettings = !showSettings">
          ⚙ SETTINGS
        </button>
      </div>

      <div class="col-mid" :class="{ locked: unconfigured }">
        <HudPanel v-if="showSettings" index="08" title="SETTINGS">
          <button class="settings-x" title="Close settings" @click="showSettings = false">✕</button>
          <SettingsView
            :api-key-hint="status?.api_key_hint ?? ''"
            :devices="devices"
            :selected-device="status?.input_device ?? ''"
            :output-device="status?.output_device ?? 'system'"
            :cue-prefs="cuePrefs"
            :checks="visibleChecks"
            :checks-running="checksRunning"
            @save="saveKey"
            @pick-device="pickMic"
            @pick-output="pickOutput"
            @refresh-devices="loadDevices"
            @toggle-cue="setCue"
            @run-checks="runChecks"
          />
        </HudPanel>
        <!-- Tabs live OUTSIDE the conversation frame, protruding above it
             like folder tabs — the frame reads as "the selected tab's
             window", and everything inside starts one line higher. -->
        <div v-if="!showSettings" class="tabsbar">
          <AgentTabs
            :agents="status?.agent_labels ?? {}"
            :meta="status?.agents_meta ?? null"
            :active="status?.active_agent ?? null"
            :viewed="viewedAgent"
            :speaking="status?.speaking_agents ?? []"
            :thinking="thinkingAgents"
            :queued="status?.queued_by_agent ?? {}"
            :muted="status?.muted_agents ?? []"
            @select="selectAgent"
            @dismiss="dismissAgent"
            @reorder="reorderAgents"
          />
        </div>
        <!-- No panel title: the tabs above ARE the title, and "utterance
             stream" meant nothing to normal humans anyway. -->
        <HudPanel v-if="!showSettings" class="convo-panel">
          <!-- Everything below the tabs is THIS conversation: the log on
               the left, and the conversation-scoped rail (voice avatar,
               character, turn timeline) inside the same frame on the
               right. Global widgets live in the left column instead. -->
          <div class="convo-body">
            <div class="convo-main">
              <!-- Catch-up spans the bubbles column only, like telemetry —
                   never the rail. -->
              <button v-if="unheard.length" class="ctl catchup" @click="catchUp">
                ▶ CATCH UP ({{ unheard.length }} UNHEARD)
              </button>
              <ConversationLog
                :utterances="utterances"
                :playing-id="status?.playing_utterance_id ?? 0"
                :activity="status?.activity?.[viewedAgent ?? ''] ?? null"
                @replay="replay"
                @cancel="cancel"
              />
              <ConversationTelemetry
                :stt-latency-ms="status?.stt_latency_ms ?? null"
                :tts-latency-ms="status?.tts_latency_ms ?? null"
                :user-cost-usd="status?.session_cost_usd.user ?? 0"
                :claude-cost-usd="status?.session_cost_usd.claude ?? 0"
                :stt-seconds="status?.usage.stt_seconds ?? 0"
                :tts-chars="status?.usage.tts_chars ?? 0"
              />
            </div>
            <aside class="convo-rail">
              <section class="railbox">
                <VoicePersona
                  :voice="character?.voice ?? ''"
                  :speaking="!!viewedAgent && (status?.speaking_agents ?? []).includes(viewedAgent)"
                  :muted="!!viewedAgent && (status?.muted_agents ?? []).includes(viewedAgent)"
                  @change="(v) => changeCharacter({ voice: v })"
                  @toggle-mute="toggleAgentMute"
                />
              </section>
              <section class="railbox">
                <div class="railtitle">CHARACTER MATRIX</div>
                <CharacterReadout v-if="character" :character="character" @change="changeCharacter" />
                <p v-else class="todo">NO CHARACTER DATA</p>
              </section>
              <section class="railbox">
                <div class="railtitle">SESSION RING · TURN TIMELINE</div>
                <SessionRing :utterances="utterances" />
              </section>
            </aside>
          </div>
        </HudPanel>
      </div>

    </div>

    <footer>
      <span>DAEMON <b :class="offline ? 'bad' : 'ok'">{{ offline ? "OFFLINE" : "ONLINE" }}</b></span>
      <span v-if="status?.input_device === 'browser'">
        TAB MIC <b :class="status?.tab_audio ? 'ok' : 'bad'">{{ status?.tab_audio ? "LIVE" : "NO TAB" }}</b>
      </span>
      <span>STT MODE <b>{{ status?.mode?.toUpperCase() ?? "—" }}</b></span>
      <span>LANGUAGE <b>{{ status?.language || "AUTO" }}</b></span>
      <span>QUEUE <b>{{ status?.queued ?? "—" }}</b></span>
      <span v-if="lastError" class="lasterr" :title="`${errors.length} error(s) this session`">
        ⚠ {{ eventTime(lastError.ts) }} {{ lastError.kind.toUpperCase() }} · {{ lastError.detail }}
      </span>
      <span style="margin-left: auto">{{ offline ? "◈ LINK DOWN" : lastError ? "◈ DEGRADED — SEE LAST ERROR" : "◈ ALL SYSTEMS NOMINAL" }}</span>
    </footer>
  </div>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  padding: 10px 18px 14px;
  border-bottom: 1px solid var(--line);
  position: relative;
}
header::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 1px;
  width: 220px;
  background: linear-gradient(90deg, var(--cyan), transparent);
  box-shadow: 0 0 8px var(--cyan);
}
.logo { display: flex; align-items: center; gap: 14px; }
.logo svg { display: block; }
.logo .title { font-size: 19px; letter-spacing: 0.28em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); font-weight: 700; }
.logo .sub { font-size: 10px; letter-spacing: 0.34em; color: var(--muted); margin-top: 3px; }
/* Dev-instance marker: recolor the logo and hang a badge under it, nothing else. */
.logo.dev svg { stroke: #ffb84d; }
.logo.dev svg polygon, .logo.dev svg line { stroke: #ffb84d; }
.logo.dev svg polygon[fill^="rgba"] { fill: rgba(255, 184, 77, 0.08); }
.logo.dev .title { color: #ffb84d; text-shadow: 0 0 12px rgba(255, 184, 77, 0.55); }
.devbadge {
  display: inline-block; margin-top: 5px; padding: 2px 8px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.22em;
  color: #1a1205; background: #ffb84d; border-radius: 3px;
}
.sysstate { margin-left: auto; display: flex; align-items: center; gap: 26px; flex-wrap: wrap; }
.clockbox { text-align: right; }
.clockbox .clock { font-size: 17px; letter-spacing: 0.14em; color: var(--ink); }
.clockbox .date { font-size: 10px; letter-spacing: 0.2em; color: var(--muted); margin-top: 3px; }

header { flex: none; }
footer { flex: none; }
.cols {
  display: grid;
  grid-template-columns: 300px minmax(640px, 1fr);
  gap: 18px;
  margin-top: 14px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0; /* let the grid shrink so only the feed scrolls */
}
@media (max-width: 1180px) { .cols { grid-template-columns: 1fr; } .col-mid { order: -1; } }
.col-left {
  min-height: 0;
  overflow-y: auto; /* safety valve on short windows; invisible otherwise */
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
/* Folder-tab bar: sits on top of the conversation frame, buttons overlap
   its top border by 1px so the viewed tab visually fuses with the window
   below — the frame reads as that tab's window, not a separate panel. */
/* The whole bar rises over the page header's bottom line — the tabs
   straddle the main separator, buying the conversation window that
   vertical space back. z-index keeps them painting above the line. */
.tabsbar { padding: 0 14px; margin-top: -50px; position: relative; z-index: 3; }
.tabsbar :deep(.tabs) {
  margin-bottom: -1px;
  gap: 6px;
  position: relative;
  z-index: 1;
  /* Bottom-aligned row: the taller selected tab grows UPWARD only. */
  align-items: flex-end;
}
.tabsbar :deep(.tabs button) {
  /* The window's bright top line PASSES UNDER inactive tabs… */
  border-bottom: 1px solid var(--line-strong);
  padding-top: 8px;
  padding-bottom: 9px;
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
}
.tabsbar :deep(.tabs button.viewing) {
  /* Glow like the component's own viewing style (cyan tint, bright
     border), fading into the panel background at the bottom so the
     fusion seam stays invisible. */
  /* Ends OPAQUE (--panel-solid): the tab's overlapping bottom pixel must
     actually cover the window's bright top line, or it ghosts through
     the translucent panel color. */
  background: linear-gradient(rgba(63, 216, 255, 0.1), rgba(63, 216, 255, 0.02) 60%, var(--panel-solid));
  border-color: var(--line-strong);
  /* …and BREAKS under the selected one, fusing tab and window. */
  border-bottom-color: transparent;
  /* Taller, never wider: extra height comes from top padding only, so
     sibling tabs don't shift and the text keeps its baseline. */
  padding-top: 14px;
  position: relative;
  z-index: 2;
}
/* The 1px overlap loses to the panel's own compositing (backdrop-filter),
   so the gap in the line is painted explicitly: an opaque panel-colored
   strip under the selected tab, covering the window's bright top border. */
.tabsbar :deep(.tabs button.viewing)::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 3px;
  background: var(--panel-solid);
  z-index: 3;
}
/* The conversation window's own top edge matches the bright line. */
.col-mid :deep(.convo-panel) { border-top-color: var(--line-strong); }

/* The conversation frame owns everything conversation-scoped: log on the
   left, the character rail on the right, both INSIDE the panel border and
   starting below the tabs. */
.convo-body { display: flex; gap: 16px; flex: 1; min-height: 0; }
.convo-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.convo-rail {
  width: 300px;
  flex: none;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
  border-left: 1px solid var(--line);
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
@media (max-width: 980px) { .convo-body { flex-direction: column; } .convo-rail { width: auto; border-left: none; padding-left: 0; } }
.railbox { border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.railbox:last-child { border-bottom: none; }
.railtitle { font-size: 9px; letter-spacing: 0.26em; color: var(--muted); margin-bottom: 10px; }
.col-mid {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.col-mid :deep(.panel) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
.todo { color: var(--muted); font-size: 10px; letter-spacing: 0.2em; padding: 22px 0; text-align: center; }

.dbrow { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.dbrow .lbl { font-size: 9px; letter-spacing: 0.2em; color: var(--muted); width: 52px; }
.dbbar { flex: 1; height: 6px; background: rgba(63, 216, 255, 0.08); position: relative; overflow: hidden; }
.dbbar i {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  background: linear-gradient(90deg, rgba(63, 216, 255, 0.35), var(--cyan) 70%, var(--amber));
  box-shadow: 0 0 8px rgba(63, 216, 255, 0.5);
  transition: width 80ms linear;
}
.dbrow .val { font-size: 10px; color: var(--cyan); width: 64px; text-align: right; }

.bigmute {
  width: 100%;
  min-height: 96px;
  margin-bottom: 18px;
  font-family: var(--mono);
  cursor: pointer;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  color: var(--cyan);
  background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}
.bigmute .bm-label { font-size: 19px; letter-spacing: 0.3em; text-shadow: 0 0 8px rgba(63, 216, 255, 0.5); }
.bigmute .bm-sub { font-size: 9px; letter-spacing: 0.24em; color: var(--muted); }
.bigmute:hover { color: var(--cyan-hi); border-color: var(--cyan); background: rgba(63, 216, 255, 0.1); }
.bigmute.muted {
  color: var(--red);
  border-color: rgba(255, 95, 107, 0.65);
  background: rgba(255, 95, 107, 0.1);
  box-shadow: inset 0 0 26px rgba(255, 95, 107, 0.18);
}
.bigmute.muted .bm-label { text-shadow: 0 0 10px rgba(255, 95, 107, 0.7); animation: blink 1.6s step-end infinite; }
.bigmute.muted .bm-sub { color: rgba(255, 95, 107, 0.7); }
@keyframes blink { 50% { opacity: 0.45; } }
.bigmute.talk { touch-action: none; user-select: none; }
.bigmute.talk:disabled {
  cursor: not-allowed;
  color: var(--muted);
  border-color: rgba(93, 127, 150, 0.35);
  background: rgba(93, 127, 150, 0.05);
}
.bigmute.talk:disabled .bm-label { text-shadow: none; }
.bigmute.talk.held {
  color: var(--amber);
  border-color: var(--amber);
  background: rgba(255, 180, 84, 0.12);
  box-shadow: inset 0 0 26px rgba(255, 180, 84, 0.2);
}
.bigmute.talk.held .bm-label { text-shadow: var(--glow-amber); }
.bigmute.talk.held .bm-sub { color: rgba(255, 180, 84, 0.75); }

.voicemute {
  width: 100%;
  min-height: 52px;
  margin-bottom: 18px;
  font-family: var(--mono);
  cursor: pointer;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 4px;
  color: var(--violet);
  background: rgba(185, 140, 255, 0.06);
  border: 1px solid rgba(185, 140, 255, 0.4);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.voicemute .vm-label { font-size: 12px; letter-spacing: 0.26em; }
.voicemute .vm-sub { font-size: 8px; letter-spacing: 0.2em; color: var(--muted); }
.voicemute:hover { border-color: var(--violet); background: rgba(185, 140, 255, 0.12); }
.voicemute.muted {
  color: var(--red);
  border-color: rgba(255, 95, 107, 0.6);
  background: rgba(255, 95, 107, 0.08);
}
.voicemute.muted .vm-label { animation: blink 1.6s step-end infinite; }
.voicemute.muted .vm-sub { color: rgba(255, 95, 107, 0.7); }

/* Must be unmissable when you come back to the desk: green (nothing else
   in the HUD is a green button), tall, glowing and gently pulsing. */
.ctl.catchup {
  width: 100%;
  margin-bottom: 12px;
  min-height: 44px;
  font-size: 12px;
  letter-spacing: 0.26em;
  color: var(--green);
  border-color: rgba(77, 255, 180, 0.7);
  background: rgba(77, 255, 180, 0.12);
  text-shadow: 0 0 8px rgba(77, 255, 180, 0.6);
  box-shadow: 0 0 14px rgba(77, 255, 180, 0.25), inset 0 0 18px rgba(77, 255, 180, 0.12);
  animation: catchup-pulse 1.6s ease-in-out infinite;
}
.ctl.catchup:hover {
  color: #b3ffe0;
  border-color: var(--green);
  background: rgba(77, 255, 180, 0.2);
  animation: none;
}
@keyframes catchup-pulse {
  50% { box-shadow: 0 0 26px rgba(77, 255, 180, 0.5), inset 0 0 26px rgba(77, 255, 180, 0.2); }
}

/* Sections that need the API sit dimmed behind the first-contact prompt. */
.locked { opacity: 0.35; pointer-events: none; filter: saturate(0.4); }


.setup-overlay {
  position: fixed;
  inset: 0;
  z-index: 60; /* above scanlines/vignette */
  display: grid;
  /* Anchored near the top, NOT vertically centered: the box grows as
     check verdicts land, and a centered box would re-balance both edges
     on every row — reading as jumping. Anchored, it only extends down. */
  place-items: start center;
  padding: 14vh 24px 24px;
  pointer-events: none; /* the live scopes behind stay hoverable */
  background: radial-gradient(560px 380px at 50% 46%, rgba(2, 6, 12, 0.88), rgba(2, 6, 12, 0.25) 75%, transparent);
}
.setup-box {
  pointer-events: auto;
  max-width: 480px;
  width: 100%;
  /* Never taller than the viewport allows (see the anchored overlay
     padding) — worst case the box scrolls inside instead of overflowing. */
  max-height: 82vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
  background: var(--panel-solid);
  border: 1px solid var(--line-strong);
  box-shadow: 0 0 40px rgba(63, 216, 255, 0.15);
  padding: 26px 28px;
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
}
.setup-title { font-size: 13px; letter-spacing: 0.3em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); margin-bottom: 14px; }
.setup-text { font-size: 11px; line-height: 1.7; color: var(--muted); margin-bottom: 14px; }
.setup-pitch {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 0.45s ease, opacity 0.3s ease;
}
.setup-pitch.collapsed { grid-template-rows: 0fr; opacity: 0; }
.setup-pitch-inner { overflow: hidden; min-height: 0; }
.setup-error { font-size: 10px; letter-spacing: 0.14em; color: var(--red, #ff5f56); margin: 12px 0 0; }
.setup-checks { margin-top: 12px; }
.setup-hint { margin: 12px 0 0; }
.setup-text b { color: var(--cyan); font-weight: 400; }
.setup-text a { color: var(--amber); text-decoration: none; border-bottom: 1px dotted var(--amber-dim); }
.setup-text a:hover { text-shadow: var(--glow-amber); }
.setup-row { display: flex; gap: 8px; }
.setup-input, .keyinput {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink);
  background: rgba(4, 12, 20, 0.9);
  border: 1px solid var(--line-strong);
  padding: 8px 12px;
}
.settingsbtn { width: 100%; letter-spacing: 0.24em; }
.settings-x {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 1;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
}
.settings-x:hover { color: var(--red); text-shadow: 0 0 8px rgba(255, 95, 107, 0.6); }
.settingsbtn.on { color: var(--amber); border-color: var(--amber-dim); background: rgba(255, 180, 84, 0.08); }

.controls { display: grid; gap: 10px; }
.ctlrow { display: flex; align-items: center; gap: 8px; }
/* Label above full-width buttons — for choices whose names deserve to
   stay unabbreviated ("PUSH TO TALK" won't fit next to a label). */
.ctlcol { display: grid; gap: 6px; }
.ctlcol .lbl { font-size: 9px; letter-spacing: 0.16em; color: var(--muted); }
.ctlbtns { display: flex; gap: 8px; }
.ctlrow .lbl { font-size: 9px; letter-spacing: 0.16em; color: var(--muted); width: 104px; flex: none; }
.ctl {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--cyan);
  background: rgba(63, 216, 255, 0.06);
  border: 1px solid var(--line-strong);
  padding: 8px 12px;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
}
.ctl:hover { color: var(--cyan-hi); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }
.ctl.small { padding: 5px 10px; flex: 1; min-width: 0; max-width: 100%; }
.ctl.on { color: var(--amber); border-color: var(--amber-dim); background: rgba(255, 180, 84, 0.08); text-shadow: var(--glow-amber); }
.ctl.danger { color: var(--red); border-color: rgba(255, 95, 107, 0.5); background: rgba(255, 95, 107, 0.08); }
select.ctl { appearance: none; }

footer {
  margin-top: 6px;
  padding: 12px 18px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--muted);
}
footer b { color: var(--cyan-dim); font-weight: 400; }
footer .ok { color: var(--green); }
footer .bad { color: var(--red); }
footer .lasterr {
  color: var(--red);
  text-shadow: 0 0 8px rgba(255, 95, 107, 0.4);
  max-width: 46ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabaudio {
  /* The one action a fresh Docker install must take — impossible to miss. */
  flex: none;
  width: 100%;
  padding: 12px 18px;
  margin-bottom: 10px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.18em;
  color: #0a0f14;
  background: var(--amber);
  border: none;
  cursor: pointer;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  animation: tabaudio-pulse 1.6s ease-in-out infinite;
}
.tabaudio .taberr {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #5a1020;
}
@keyframes tabaudio-pulse { 50% { filter: brightness(0.82); } }
</style>
