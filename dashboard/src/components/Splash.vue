<script setup lang="ts">
/* The desktop app's launch splash (#96): shown while the engine boots.
 *
 * It says the app is alive, nothing more - no engine or daemon wording, no
 * status text a user cannot act on. The chosen variant is exported as a
 * self-contained page for Electron (desktop/splash.html); this component is
 * the design reference and the regression surface. */
withDefaults(defineProps<{ look?: "mark" | "wordmark" | "card" | "pulse" }>(), { look: "mark" });
</script>

<template>
  <div class="splash" :class="look" role="status" aria-label="Noisy Studio is starting">
    <svg v-if="look !== 'wordmark'" class="icon" viewBox="0 0 46 46" aria-hidden="true">
      <rect x="3" y="3" width="40" height="40" rx="11" fill="#263448" />
      <g stroke="#b8cff3" stroke-width="3.2" stroke-linecap="round">
        <path d="M14 17v12 M20 11v24 M26 15v16 M32 19v8" />
      </g>
    </svg>
    <div v-if="look === 'pulse'" class="ring" aria-hidden="true"></div>
    <div class="name">Noisy Studio</div>
    <div v-if="look !== 'pulse'" class="track" aria-hidden="true"><div class="bar"></div></div>
    <div v-else class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
  </div>
</template>

<style scoped>
.splash {
  --bg: #151619; --ink: #edeef0; --muted: #a3a8b2; --line: #363940; --accent: #80d1cb;
  width: 320px; height: 150px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  background: var(--bg); color: var(--ink);
  font: 500 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0.01em; position: relative; overflow: hidden;
}
.icon { width: 40px; height: 40px; }
.name { font-size: 14px; }
.track { width: 140px; height: 3px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar { width: 38%; height: 100%; border-radius: 2px; background: var(--accent); animation: slide 1.2s ease-in-out infinite alternate; }
@keyframes slide { from { margin-left: 0 } to { margin-left: 62% } }

/* mark: icon + name, one quiet line under it (default) */

/* wordmark: no icon, larger name, bar tight under the word */
.wordmark { gap: 10px; }
.wordmark .name { font-size: 18px; letter-spacing: 0.02em; }
.wordmark .track { width: 96px; }

/* card: a bordered HUD panel; icon and name side by side, bar spans the card */
.card { padding: 18px 22px; align-items: stretch; gap: 14px; }
.card::before { content: ""; position: absolute; inset: 10px; border: 1px solid var(--line); border-radius: 10px; pointer-events: none; }
.card .icon { width: 28px; height: 28px; position: absolute; left: 24px; top: 26px; }
.card .name { margin-left: 40px; font-size: 15px; height: 28px; line-height: 28px; }
.card .track { width: auto; }

/* pulse: icon with a soft breathing ring, three dots instead of a bar */
.pulse .icon { width: 44px; height: 44px; position: relative; z-index: 1; }
.pulse .ring { position: absolute; top: 50%; left: 50%; width: 64px; height: 64px; margin: -50px 0 0 -32px; border-radius: 18px; border: 1px solid var(--accent); opacity: 0.35; animation: breathe 1.6s ease-in-out infinite; }
@keyframes breathe { 0%, 100% { transform: scale(0.92); opacity: 0.15 } 50% { transform: scale(1.06); opacity: 0.45 } }
.dots { display: flex; gap: 6px; }
.dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: 0.3; animation: blink 1.2s infinite; }
.dots i:nth-child(2) { animation-delay: 0.2s } .dots i:nth-child(3) { animation-delay: 0.4s }
@keyframes blink { 0%, 100% { opacity: 0.3 } 50% { opacity: 1 } }
</style>
