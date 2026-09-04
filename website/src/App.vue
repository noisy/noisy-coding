<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type Component } from "vue";
import HeroSceneA from "./scenes/HeroSceneA.vue";
import HeroSceneB from "./scenes/HeroSceneB.vue";
import HeroSceneC from "./scenes/HeroSceneC.vue";
import HeroSceneD from "./scenes/HeroSceneD.vue";
import HeroSceneE from "./scenes/HeroSceneE.vue";
import HeroSceneF from "./scenes/HeroSceneF.vue";
import HeroSceneG from "./scenes/HeroSceneG.vue";
import CharacterSection from "./CharacterSection.vue";
import TryLiveSection from "./TryLiveSection.vue";

/** TRY IT LIVE is intentionally DORMANT for the first public version
 *  (Krzysztof's call, 2026-09-04). Everything stays in the repo and works:
 *  flip this to true AND run website-backend/ with XAI_DEMO_API_KEY to
 *  bring the live demo back. See src/demo/live-demo-architecture.md. */
const TRY_LIVE_ENABLED = false;

/* voiceSprites.ts (product code) paints portraits with url(/avatars.png) -
 * an absolute path that 404s when the site is served under a base like
 * GitHub Pages' /noisy-coding/. Import the same sprite through Vite so the
 * URL respects `base`, and override the inline style globally (see the
 * .companion .head rule in this file's <style>). Every voice the site uses
 * (lux + the hero AGENTS) has a sprite cell, so the override never paints
 * a head that should show the monogram fallback. */
import avatarsSprite from "../../dashboard/public/avatars.png";
document.documentElement.style.setProperty("--avatars-sprite", `url(${avatarsSprite})`);
import terminalFallback from "./assets/shots/TerminalVoiceFix.png";
import dashboardShot from "./assets/shots/dashboard-content.png";
import codeReviewShot from "./assets/shots/CodeReviewSpace.png";
import longRefactorShot from "./assets/shots/LongRefactorMesh.png";

const SLOGANS = [
  "VIBE CODING WAS STEP ONE.",
  "YOU STOPPED WRITING CODE. NOW STOP TYPING.",
  "TALK TO YOUR AGENT. WALK AWAY. SHIP.",
  "YOUR AGENT DOESN'T NEED THE KEYBOARD. NEITHER DO YOU.",
  "THIS IS WHAT COMES AFTER VIBE CODING.",
];
const VARIANTS: Record<string, Component> = {
  a: HeroSceneA,
  b: HeroSceneB,
  c: HeroSceneC,
  d: HeroSceneD,
  e: HeroSceneE,
  f: HeroSceneF,
  g: HeroSceneG,
};
const variantKey = (() => {
  const v = new URLSearchParams(window.location.search).get("variant") ?? "g";
  return v in VARIANTS ? v : "a";
})();
const HeroScene = VARIANTS[variantKey];

const slogan = ref(SLOGANS[0]);
const sloganShow = ref(false);
let sloganTimer: number | undefined;
let sloganSwap: number | undefined;

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sloganShow.value = true;
    return;
  }
  sloganShow.value = true;
  let i = 0;
  sloganTimer = window.setInterval(() => {
    sloganShow.value = false;
    sloganSwap = window.setTimeout(() => {
      i = (i + 1) % SLOGANS.length;
      slogan.value = SLOGANS[i];
      sloganShow.value = true;
    }, 450) as unknown as number;
  }, 3400);
});
onBeforeUnmount(() => {
  if (sloganTimer) window.clearInterval(sloganTimer);
  if (sloganSwap) window.clearTimeout(sloganSwap);
});
</script>

<template>
  <main>
    <div class="wrap">
      <header class="top">
        <div class="logo">
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
            <div class="sub">TALK WITH YOUR AGENT</div>
          </div>
        </div>
        <nav class="toplinks">
          <a href="#features">FEATURES</a>
          <a href="#install">INSTALL</a>
          <a href="#roadmap">ROADMAP</a>
          <a href="https://github.com/noisy/noisy-coding">GITHUB</a>
        </nav>
      </header>
    </div>

    <section class="hero">
      <div class="wrap">
        <h1>Talk to Claude Code <span class="hl">while it works</span>.</h1>
        <div class="slogan" :class="{ show: sloganShow }" aria-live="polite">{{ slogan }}</div>
        <component :is="HeroScene" class="hero-live-scene" />
        <img class="hero-fallback" :src="terminalFallback" alt="A Claude Code terminal session with the NOISY-CODING companion widget floating bottom-right, carrying the spoken exchange as chat bubbles" />
        <div class="cta-row">
          <a class="btn btn-primary" href="#install">INSTALL IN 2 MINUTES</a>
          <a class="btn btn-ghost" href="https://github.com/noisy/noisy-coding">VIEW SOURCE</a>
        </div>
        <p class="shot-caption">A live run: Claude Code fixes a webhook bug in the terminal while the whole conversation happens by voice in the companion widget.</p>
        <p class="pitch" style="margin-top: 28px;">
          Claude speaks short summaries aloud. An always-on listener turns your speech into
          messages Claude receives mid-task, without stopping it - no push-to-send, no
          copy-pasting transcripts. Step away from the keyboard and keep steering your agent.
          "It's your voice that's noisy, not your code."
        </p>
      </div>
    </section>

    <TryLiveSection v-if="TRY_LIVE_ENABLED" />

    <section id="feed">
      <div class="wrap">
        <div class="label"><span class="idx">00</span>VISUAL FEED</div>
        <h2>In the field</h2>
        <div class="hud-frame">
          <div class="hud-frame-bar">
            <span>NOISY-CODING // TACTICAL DASHBOARD</span>
            <span class="live">&#9679; LIVE</span>
          </div>
          <img :src="dashboardShot" alt="The NOISY-CODING tactical HUD dashboard: conversation log with played voice messages, mic oscilloscope and cost panel on the left, active voice persona with character dials and turn timeline on the right" loading="lazy" />
        </div>
        <p class="shot-caption">Every spoken exchange logged with replay. Costs to a fraction of a cent. One persona in command, dials at your fingertips.</p>
        <div class="feed-grid">
          <div class="feed-item">
            <img :src="codeReviewShot" alt="The companion widget over the desktop during a code review: Claude asks whether to surface a swallowed timeout error, and the developer answers by voice to add a test" loading="lazy" />
            <p class="shot-caption">Code review by voice - findings read aloud, decisions given from across the room.</p>
          </div>
          <div class="feed-item">
            <img :src="longRefactorShot" alt="The companion widget over the desktop during a long refactor: Claude reports 14 of 23 call sites migrated and the developer steers it to the websocket handler by voice" loading="lazy" />
            <p class="shot-caption">Long refactor, hands off the keyboard - status spoken aloud, next target given by voice.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="features">
      <div class="wrap">
        <div class="label"><span class="idx">01</span>CAPABILITIES</div>
        <h2>Features</h2>
        <div class="grid">
          <div class="panel feat">
            <div class="fidx">F-01</div>
            <h3>Interrupt-free flow</h3>
            <p>Speak while Claude works. Your words land in the running session, not a text box.</p>
          </div>
          <div class="panel feat">
            <div class="fidx">F-02</div>
            <h3>Hands-free reviews</h3>
            <p>Claude reads findings aloud. Answer from across the room.</p>
          </div>
          <div class="panel feat">
            <div class="fidx">F-03</div>
            <h3>Live tactical HUD dashboard</h3>
            <p>Conversation log with replay, real-time oscilloscope, mute buttons, costs and latencies at a glance.</p>
          </div>
          <div class="panel feat">
            <div class="fidx">F-04</div>
            <h3>Per-agent character</h3>
            <p>Voice, speed, personality dials per agent. 34 voice personas with avatar portraits.</p>
          </div>
          <div class="panel feat">
            <div class="fidx">F-05</div>
            <h3>Companion widget</h3>
            <p>Floating always-on-top companion widget keeps the essentials in view.</p>
          </div>
          <div class="panel feat">
            <div class="fidx">F-06</div>
            <h3>Nothing to configure in files</h3>
            <p>API key, devices, language, push-to-talk - all set in the UI.</p>
          </div>
          <div class="panel feat">
            <div class="fidx">F-07</div>
            <h3>Never talks over you</h3>
            <p>One voice at a time. Missed speech parks as <span class="tick">UNHEARD</span> with CATCH UP replay.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="crew">
      <div class="wrap">
        <div class="label"><span class="idx">01.2</span>MULTI-AGENT COMMS</div>
        <h2>Talk to your whole crew</h2>
        <p class="crew-lead">
          Run several Claude Code sessions and talk to all of them - one voice
          channel, many agents. Each agent waits for the others to finish
          speaking, so they never overlap and never interrupt you. Answers
          you miss while another agent has the floor queue up and wait their
          turn instead of talking over each other.
        </p>
        <div class="steps crew-steps">
          <div class="step">
            <div class="n">A</div>
            <h3>One at a time</h3>
            <p>Agents take turns on the voice channel. Two finish at once? The second waits.</p>
          </div>
          <div class="step">
            <div class="n">B</div>
            <h3>Never interrupts you</h3>
            <p>While you speak, every agent holds its reply until you are done.</p>
          </div>
          <div class="step">
            <div class="n">C</div>
            <h3>Nothing lost</h3>
            <p>Queued speech parks as UNHEARD with one-tap CATCH UP replay.</p>
          </div>
        </div>
      </div>
    </section>

    <CharacterSection />

    <section id="how">
      <div class="wrap">
        <div class="label"><span class="idx">02</span>OPERATION SEQUENCE</div>
        <h2>How it works</h2>
        <div class="steps">
          <div class="step">
            <div class="n">01</div>
            <h3>Claude speaks</h3>
            <p>Short spoken summaries as your agent works - progress, findings, questions.</p>
          </div>
          <div class="step">
            <div class="n">02</div>
            <h3>You answer</h3>
            <p>An always-on listener captures your speech. No push-to-send, no transcript pasting.</p>
          </div>
          <div class="step">
            <div class="n">03</div>
            <h3>Claude hears mid-task</h3>
            <p>Your words become messages the running session receives without stopping.</p>
          </div>
          <div class="step">
            <div class="n">04</div>
            <h3>You keep steering</h3>
            <p>Step away from the keyboard. The HUD dashboard and companion widget keep you in the loop.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="install">
      <div class="wrap">
        <div class="label"><span class="idx">03</span>DEPLOYMENT</div>
        <h2>Install in 2 minutes</h2>
        <div class="codebox">
          <code><span class="c"># install in 2 minutes</span>
<span class="p">$</span> claude plugin marketplace add noisy/noisy-coding &amp;&amp; claude plugin install noisy-coding@noisy
<span class="p">$</span> /noisy-coding:setup</code>
        </div>
        <p class="install-note">Everything runs locally. Setup walks you through the rest inside Claude Code.</p>
      </div>
    </section>

    <section id="roadmap">
      <div class="wrap">
        <div class="label"><span class="idx">04</span>INBOUND</div>
        <h2>Roadmap</h2>
        <div class="road">
          <div class="road-item">
            <span class="tag">COMING SOON</span>
            <p><b>Native macOS app (v3.0)</b> - one download, one icon.</p>
          </div>
          <div class="road-item">
            <span class="tag">COMING SOON</span>
            <p><b>Local / offline voice models</b> - keep your voice on your machine.</p>
          </div>
          <div class="road-item">
            <span class="tag">COMING SOON</span>
            <p><b>OpenAI Voice API support</b> - alternative voice backend.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="cost">
      <div class="wrap oss">
        <div class="label"><span class="idx">05</span>COST</div>
        <h2>Runs on your machine</h2>
        <p class="big">Everything runs <span class="mit">locally</span>.</p>
        <p>You bring your own voice-API key. The voice backend is the Grok (xAI) Voice API,
        which is extremely cheap in practice. Built for developers who use Claude Code daily
        and steer long agent runs away from the keyboard.</p>
      </div>
    </section>

    <footer>
      <div class="wrap foot">
        <div>
          <a href="https://github.com/noisy/noisy-coding">github.com/noisy/noisy-coding</a>
        </div>
        <div class="fine">NOISY-CODING // TALK WITH YOUR AGENT</div>
      </div>
    </footer>

  </main>
</template>

<style>
/* Base-safe portrait sprite: overrides voiceSprites' inline
   url(/avatars.png) with the Vite-resolved asset (see script setup). */
.companion .head {
  background-image: var(--avatars-sprite) !important;
}
</style>
