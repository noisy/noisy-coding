<script setup lang="ts">
import CharacterSection from "./CharacterSection.vue";
import VoiceAvatar from "@dashboard/components/VoiceAvatar.vue";
import terminalShot from "./assets/shots/TerminalVoiceFix.png";
import dashboardShot from "./assets/shots/dashboard-content.png";
import reviewShot from "./assets/shots/CodeReviewSpace.png";
import refactorShot from "./assets/shots/LongRefactorMesh.png";
const source = "https://github.com/noisy/noisy-coding";
const voices = ["lux", "atlas", "cosmo", "orion", "celeste"];
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header wrap">
    <a class="brand" href="#" aria-label="Noisy Coding home">
      <svg viewBox="0 0 46 46" width="40" height="40" aria-hidden="true">
        <rect x="3" y="3" width="40" height="40" rx="11" fill="#263448" />
        <g stroke="#b8cff3" stroke-width="3.2" stroke-linecap="round">
          <path d="M14 17v12M20 11v24M26 15v16M32 19v8" />
        </g>
      </svg>
      Noisy Coding
    </a>
    <nav aria-label="Main navigation">
      <a href="#workflow">Product</a><a href="#character">Character</a
      ><a :href="source">GitHub ↗</a>
    </nav>
    <a class="button small" href="#install"
      >Get started <span aria-hidden="true">↗</span></a
    >
  </header>
  <main id="main">
    <section class="hero wrap">
      <div class="eyebrow">
        <span class="signal-dot"></span> Your voice, in the workflow
      </div>
      <h1>Less typing.<br />More <em>conversation.</em></h1>
      <div class="hero-bottom">
        <p>
          Talk to your coding agent while it works. Hear what matters. Give it
          direction. Keep your hands—and your attention—where you want them.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#install"
            >Give your agent a voice <span aria-hidden="true">↗</span></a
          ><span>Claude Code · Codex preview</span>
        </div>
      </div>
      <div class="hero-art">
        <div class="art-label">
          <span class="signal-dot"></span> A conversation, in context
          <span>Synthetic product demo</span>
        </div>
        <a
          :href="terminalShot"
          aria-label="Open full-size companion and terminal demonstration"
          ><img
            :src="terminalShot"
            alt="The current Noisy Coding companion over a Claude Code terminal, showing a spoken exchange about fixing a webhook."
            fetchpriority="high"
        /></a>
        <div class="identity-note">
          <div class="avatar-stack">
            <VoiceAvatar
              v-for="voice in voices.slice(0, 3)"
              :key="voice"
              :voice="voice"
              :size="40"
              set="editorial"
            />
          </div>
          <span>A familiar voice.<br /><strong>For every agent.</strong></span>
        </div>
      </div>
    </section>
    <section id="workflow" class="section wrap">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Keep your train of thought</p>
          <h2>
            The work keeps moving.<br /><span>So does the conversation.</span>
          </h2>
        </div>
        <p>
          A question shouldn’t require finding a terminal, switching windows,
          and typing a message. Just say it.
        </p>
      </div>
      <div class="workflow-grid">
        <article>
          <span class="step">01 / Listen</span>
          <h3>Updates you can hear.</h3>
          <p>
            Your agent shares progress, findings, and questions in short spoken
            updates.
          </p>
        </article>
        <article>
          <span class="step">02 / Respond</span>
          <h3>Direction in your own words.</h3>
          <p>
            Answer by voice. Steer the next step while your coding session
            continues.
          </p>
        </article>
        <article>
          <span class="step">03 / Stay in flow</span>
          <h3>Room to think.</h3>
          <p>
            Read a diff, sketch an idea, or step away from the keyboard. Keep
            the conversation close.
          </p>
        </article>
      </div>
    </section>
    <section class="section companion-section">
      <div class="wrap">
        <p class="eyebrow">A presence on your desktop</p>
        <h2>Small window.<br /><em>Ongoing conversation.</em></h2>
        <p class="section-intro">
          The companion lives alongside your work. Messages stay in view; window
          controls appear when you reach for them.
        </p>
        <div class="story-grid">
          <figure>
            <a :href="reviewShot"
              ><img
                :src="reviewShot"
                alt="Synthetic code review conversation in the current floating companion."
                loading="lazy"
            /></a>
            <figcaption>
              <span>01 — Review together</span>
              <h3>Hear the finding. Make the call.</h3>
              <p>
                Turn a code review into a conversation, with decisions given by
                voice.
              </p>
            </figcaption>
          </figure>
          <figure>
            <a :href="refactorShot"
              ><img
                :src="refactorShot"
                alt="Synthetic long refactor progress exchange in the current floating companion."
                loading="lazy"
            /></a>
            <figcaption>
              <span>02 — Keep the long run moving</span>
              <h3>Stay informed without checking in.</h3>
              <p>
                Spoken progress keeps you connected while an agent works through
                a larger task.
              </p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
    <section class="section wrap crew-section">
      <div>
        <p class="eyebrow">Distinct voices. Shared conversation.</p>
        <h2>Know who’s talking.<br /><span>Before you look.</span></h2>
        <p class="section-intro">
          Give each agent a voice and a face. Queued speech takes turns, and
          conversation history lets you revisit what you missed.
        </p>
      </div>
      <div class="voice-line">
        <div
          v-for="(voice, i) in voices"
          :key="voice"
          class="voice-tile"
          :style="{ '--tile-angle': `${(i - 2) * 4}deg` }"
        >
          <VoiceAvatar :voice="voice" :size="88" set="editorial" /><span>{{
            voice
          }}</span>
        </div>
      </div>
    </section>
    <CharacterSection />
    <section id="dashboard" class="section wrap">
      <div class="section-heading">
        <div>
          <p class="eyebrow">The whole conversation, at a glance</p>
          <h2>
            A little more control.<br /><span>A lot less guesswork.</span>
          </h2>
        </div>
        <p>
          Replay an exchange. Adjust your microphone. Check voice usage and
          latency. Everything has a place.
        </p>
      </div>
      <a
        class="dashboard-art"
        :href="dashboardShot"
        aria-label="Open full-size dashboard demonstration"
        ><img
          :src="dashboardShot"
          alt="Current Noisy Coding dashboard with conversation tabs, voice controls, character settings and usage information."
          loading="lazy"
      /></a>
      <p class="image-caption">
        The real interface, rendered with demonstration data.
      </p>
    </section>
    <section id="install" class="section install-section">
      <div class="wrap install-grid">
        <div>
          <p class="eyebrow">Make yourself heard</p>
          <h2>Your next session<br />could sound <em>different.</em></h2>
          <p class="section-intro">
            Start with your coding agent. Bring your voice API key. Follow the
            setup guide for your environment.
          </p>
        </div>
        <div class="install-options">
          <a
            :href="`${source}/blob/v3-desktop/README.md#install-for-claude-code`"
            ><span>Claude Code</span
            ><strong
              >Installation & setup <span aria-hidden="true">↗</span></strong
            ></a
          ><a :href="`${source}/blob/v3-desktop/docs/codex.md`"
            ><span>Codex <small>Preview</small></span
            ><strong
              >Preview setup guide <span aria-hidden="true">↗</span></strong
            ></a
          >
        </div>
      </div>
    </section>
    <section class="section wrap questions">
      <div>
        <p class="eyebrow">A few practical details</p>
        <h2>Good to know.</h2>
      </div>
      <div>
        <details>
          <summary>Does everything run locally?</summary>
          <p>
            The application runs on your machine. Speech processing uses an
            external voice provider; it is not an offline voice system.
          </p>
        </details>
        <details>
          <summary>Do I need an API key?</summary>
          <p>
            Yes. Bring your own voice-provider API key. Provider usage is billed
            separately, and the dashboard shows usage and cost information.
          </p>
        </details>
        <details>
          <summary>Can I use more than one agent?</summary>
          <p>
            Yes. Conversations can have distinct voices and character settings.
            Agent speech is queued so replies take turns.
          </p>
        </details>
        <details>
          <summary>What can I customize?</summary>
          <p>
            Choose voices and avatar families, adjust Humor, Honesty, Verbosity,
            Talkative and Speed, and configure your microphone and speech
            controls.
          </p>
        </details>
      </div>
    </section>
  </main>
  <footer class="site-footer wrap">
    <a class="brand" href="#">Noisy Coding</a
    ><span>Your voice, in the workflow.</span
    ><a :href="source">Built in the open ↗</a>
  </footer>
</template>
