<script setup lang="ts">
/** TRY IT LIVE - the demo companion, right under the hero.
 *
 * The widget is the REAL Companion component from @dashboard, fed through
 * the CompanionDriver seam (dashboard/src/composables/companionDriver.ts).
 * START TALKING spawns a FLOATING instance fixed to the browser viewport's
 * bottom-right - the way the product floats over your desktop - and that
 * same click requests the mic and opens a LIVE Grok realtime session
 * (useRealtimeDriver). LIVE OR NOTHING: there is no scripted stand-in any
 * more - if the session cannot start (mic denied, backend down, websocket
 * refused) the widget says so plainly and stops. What the visitor hears is
 * always real. (useScriptedDriver and the phase-1 stopgap files stay in the
 * repo, unwired, in case a public scripted fallback returns some day - see
 * src/demo/live-demo-architecture.md.)
 */
import { computed, onMounted, ref } from "vue";
import Companion from "@dashboard/components/Companion.vue";
import { useRealtimeDriver, REALTIME_VOICE, type RealtimeFailure } from "./demo/useRealtimeDriver";

const rt = useRealtimeDriver();
const floating = ref(false);

/** connecting -> live -> ended, or error with a plain category. */
const state = ref<"idle" | "connecting" | "live" | "ended" | "error">("idle");
const errorReason = ref<RealtimeFailure | "mic">(null);

rt.onEnded(() => {
  if (state.value !== "live") return;
  state.value = rt.failure.value === "session-ended" ? "ended" : "error";
  errorReason.value = rt.failure.value;
});

const ERROR_LINES: Record<string, string> = {
  mic: "Live demo needs a microphone - none was available.",
  backend: "Live demo unavailable right now (session service).",
  websocket: "Live demo unavailable right now (voice connection).",
  "session-ended": "Live demo unavailable right now.",
};
const errorLine = computed(() =>
  state.value === "error" ? ERROR_LINES[errorReason.value ?? "session-ended"] : null,
);

/* ONE CLICK: the CTA is the user gesture - it spawns the widget, requests
 * the mic, and opens the real session. No scripted anything. */
async function spawn() {
  floating.value = true;
  state.value = "connecting";
  errorReason.value = null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    state.value = "error";
    errorReason.value = "mic";
    return;
  }
  if (await rt.connect(stream)) {
    state.value = "live"; // the live agent greets out loud (response.create)
    return;
  }
  stream.getTracks().forEach((t) => t.stop());
  state.value = "error";
  errorReason.value = rt.failure.value;
}

/* Call-style mute: stop sending mic audio, session stays up. */
function toggleMute() {
  rt.setMicMuted(!rt.micMuted.value);
}

function closeFloating() {
  rt.stop();
  state.value = "idle";
  floating.value = false;
}

/* ?demo=greet|mic|debug - smoke tests only, never linked from the page: all
 * run the real one-click spawn (headless runs pass Chrome's fake-device
 * flags). debug additionally makes the realtime driver log incoming event
 * names and the session.updated transcription flags to the console - names
 * and flags only, see useRealtimeDriver.ts. */
onMounted(() => {
  const demo = new URLSearchParams(window.location.search).get("demo");
  if (demo === "greet" || demo === "mic" || demo === "auto" || demo === "debug") void spawn();
});
</script>

<template>
  <section id="try" class="trysec">
    <div class="wrap">
      <div class="label"><span class="idx">00.5</span>LIVE DEMO</div>
      <h2>Try it live</h2>
      <div class="try-cols">
        <div class="try-copy">
          <p class="try-lead">
            This is the real companion widget, right here in your browser.
            One click spawns it, opens your mic, and it greets you out loud -
            the same way it floats over your terminal in the app.
          </p>
          <p class="try-note">
            The demo agent has no Claude Code attached - it will tell you so
            itself. To actually drive an agent by voice, install the app.
            Everything you hear is a real model speaking live - nothing is
            pre-recorded, and if the live session cannot start we say so.
          </p>
          <button type="button" class="mic-btn" :disabled="floating" @click="spawn">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
            <span>{{ floating ? "WIDGET IS LIVE - LOOK RIGHT" : "START TALKING" }}</span>
          </button>
          <p class="try-soon">
            <span class="tag">PHASE 2</span> Real-time voice via Grok - your
            mic, its voice, this widget.
          </p>
        </div>
        <div class="try-rail">
          <div class="rail-head">
            <span>COMPANION // WEB DEMO</span>
            <span class="live">&#9679; DEMO</span>
          </div>
          <div class="rail-body">
            <template v-if="!floating">
              <Companion
                :mode="'idle'"
                :voice="REALTIME_VOICE"
                :feed="[]"
                :agents="rt.agents.value"
                :max-height="140"
              />
              <p class="rail-hint">Press START TALKING and it jumps off the page.</p>
            </template>
            <p v-else class="rail-hint detached">
              Widget detached - it is floating at the bottom-right of your
              window, like it floats over a desktop.
            </p>
          </div>
        </div>
      </div>
      <p class="shot-caption">The same widget that floats over your terminal - here it just can't reach your code. Yet.</p>
    </div>
  </section>

  <!-- The floating instance: fixed to the VIEWPORT, over every section.
       It deliberately does NOT set body.companion-transparent (that class
       belongs to the hero scenes); while the hero holds it the widget gets
       the product's transparent look - opaque bubbles, invisible panel -
       which is exactly the right story over page content. -->
  <Teleport to="body">
    <div v-if="floating" class="demo-float" role="dialog" aria-label="noisy-coding companion demo">
      <div class="demo-float-bar">
        <span v-if="state === 'live' && !rt.micMuted.value" class="onair">&#9679; ON AIR - MIC IS LIVE</span>
        <span v-else-if="state === 'connecting'" class="offair">CONNECTING&hellip;</span>
        <span v-else class="offair">MIC OFF</span>
        <div class="demo-float-actions">
          <button
            v-if="state === 'live'"
            type="button"
            class="float-btn"
            :class="{ hot: !rt.micMuted.value }"
            @click="toggleMute"
          >
            {{ rt.micMuted.value ? "UNMUTE" : "MUTE" }}
          </button>
          <button type="button" class="float-btn" aria-label="Close the demo widget" @click="closeFloating">X</button>
        </div>
      </div>
      <Companion
        :mode="rt.mode.value"
        :voice="REALTIME_VOICE"
        :feed="rt.feed.value"
        :live-text="rt.liveText.value"
        :level="rt.level.value"
        :activity="state === 'connecting' ? 'connecting live session' : rt.activity.value"
        :agents="rt.agents.value"
        :max-height="240"
      />
      <p v-if="errorLine" class="float-note">{{ errorLine }}</p>
      <p v-else-if="state === 'ended'" class="float-note">
        Live session ended - thanks for trying. Close and start again for
        another round.
      </p>
    </div>
  </Teleport>
</template>

<style>
/* OPAQUE variant for the EMBEDDED teaser only. The hero scenes put
   companion-transparent on BODY and Companion's transparent styles key off
   it globally; inside the section panel the widget should stay a panel.
   Values copied from Companion.vue/Bubble.vue defaults. Not <style scoped>:
   these must out-specific the body-class rules, including their !important.
   The FLOATING instance (.demo-float) is intentionally left transparent. */
body.companion-transparent .trysec .companion {
  background: rgba(5, 14, 24, 0.92);
  border-color: rgba(63, 216, 255, 0.25);
}
body.companion-transparent .trysec .companion .msg,
body.companion-transparent .trysec .companion .msg.side-left,
body.companion-transparent .trysec .companion .msg.side-right {
  background: rgba(5, 14, 24, 0.85) !important;
  box-shadow: none;
}
body.companion-transparent .trysec .companion .msgs .older { opacity: 0.55; }

/* Floating instance - teleported to body, so unscoped. */
.demo-float {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 60; /* above sections and the variant switcher */
  /* FIXED width, product parity: CompanionFloat gives the widget a constant
     420px window - long messages wrap, they never widen the widget. min()
     only concedes to viewports narrower than the widget itself. */
  width: min(420px, calc(100vw - 24px));
}
.demo-float .companion { max-width: 100%; }
.demo-float-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-bottom: 8px;
  font-family: var(--mono);
  font-size: 9px; letter-spacing: 0.22em;
}
.demo-float-bar .onair { color: #ff5f6b; text-shadow: 0 0 8px rgba(255, 95, 107, 0.7); }
.demo-float-bar .offair { color: #6d93a8; }
.demo-float-actions { display: flex; gap: 8px; }
.float-btn {
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; font-weight: 700;
  color: #3fd8ff; background: rgba(5, 14, 24, 0.9);
  border: 1px solid rgba(63, 216, 255, 0.45);
  padding: 6px 10px; cursor: pointer;
}
.float-btn:hover { background: rgba(63, 216, 255, 0.12); }
.float-btn:focus-visible { outline: 2px solid #3fd8ff; outline-offset: 2px; }
.float-btn.hot { color: #ff5f6b; border-color: rgba(255, 95, 107, 0.55); }
.float-note {
  margin: 8px 0 0; font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.08em; color: #6d93a8; text-align: right;
}
@media (prefers-reduced-motion: reduce) {
  .demo-float * { animation: none !important; }
}
</style>

<style scoped>
/* Companion reads hud.css tokens the site does not define globally; scope
   them here the same way CharacterSection does. */
.trysec {
  --panel-solid: #071626;
  --line: rgba(64, 200, 255, 0.22);
  --line-strong: rgba(64, 200, 255, 0.55);
  --cyan-hi: #9aeeff;
  --violet: #b98cff;
  --violet-hi: #d9c2ff;
  --violet-dim: rgba(185, 140, 255, 0.45);
  --green: #4dffb4;
  --ink: #cfeaf6;
  --glow-amber: 0 0 6px rgba(255, 180, 84, 0.9), 0 0 18px rgba(255, 180, 84, 0.3);
  --glow-violet: 0 0 6px rgba(185, 140, 255, 0.9), 0 0 18px rgba(185, 140, 255, 0.35);
}

.try-cols {
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 36px;
  align-items: start;
}

.try-lead { max-width: 560px; }
.try-note { margin-top: 14px; color: var(--muted); font-size: 13px; max-width: 560px; }

.mic-btn {
  margin-top: 28px;
  display: inline-flex; align-items: center; gap: 14px;
  font-family: var(--mono); font-size: 13px; letter-spacing: 0.25em; font-weight: 700;
  color: #04222e; background: var(--cyan);
  border: none; cursor: pointer;
  padding: 16px 30px;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: var(--glow-cyan);
}
.mic-btn:hover:not(:disabled) { background: #7ae6ff; }
.mic-btn:disabled { opacity: 0.6; cursor: default; }
.mic-btn:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

.try-soon { margin-top: 22px; font-size: 12px; color: var(--muted); display: flex; gap: 12px; align-items: baseline; }
.try-soon .tag {
  flex: none; font-size: 9px; letter-spacing: 0.25em; color: var(--amber);
  border: 1px solid rgba(255, 184, 77, 0.5); padding: 3px 8px;
}

.try-rail {
  border: 1px solid var(--line-strong);
  background: #03090f;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}
.rail-head {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 9px; letter-spacing: 0.24em; color: var(--cyan-dim);
}
.rail-head .live { color: var(--amber); flex: none; }
.rail-body { padding: 16px; overflow-x: auto; }
.rail-hint {
  margin-top: 12px; font-size: 11px; letter-spacing: 0.12em;
  color: var(--muted); text-align: center;
}
.rail-hint.detached { margin: 24px auto; max-width: 320px; }

@media (max-width: 860px) {
  .try-cols { grid-template-columns: 1fr; }
  .try-rail { max-width: 460px; }
}
</style>
