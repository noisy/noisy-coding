<script setup lang="ts">
/* The desktop app's launch splash (#96): shown while the engine boots.
 *
 * It says the app is alive, nothing more - no engine or daemon wording, no
 * status text a user cannot act on. The chosen variant is exported as a
 * self-contained page for Electron (desktop/splash.html); this component is
 * the design reference and the regression surface.
 *
 * Round 1 (mark / wordmark / card / pulse): A won on idea, lost on balance -
 * everything sat in a tight centre. Round 2 iterates on A only. */
withDefaults(defineProps<{ look?: "mark" | "spaced" | "row" | "edge" | "icon-only" }>(), { look: "spaced" });
</script>

<template>
  <div class="splash" :class="look" role="status" aria-label="Noisy Studio is starting">
    <svg class="icon" viewBox="0 0 46 46" aria-hidden="true">
      <rect x="3" y="3" width="40" height="40" rx="11" fill="#263448" />
      <g stroke="#b8cff3" stroke-width="3.2" stroke-linecap="round">
        <path d="M14 17v12 M20 11v24 M26 15v16 M32 19v8" />
      </g>
    </svg>
    <div v-if="look !== 'icon-only'" class="name">Noisy Studio</div>
    <div class="track" aria-hidden="true"><div class="bar"></div></div>
  </div>
</template>

<style scoped>
.splash {
  --bg: #151619; --ink: #edeef0; --muted: #a3a8b2; --line: #363940; --accent: #80d1cb;
  width: 320px; height: 170px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--bg); color: var(--ink);
  font: 500 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0.01em; position: relative; overflow: hidden;
}
.icon { width: 40px; height: 40px; }
.name { font-size: 14px; }
.track { width: 140px; height: 3px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar { width: 38%; height: 100%; border-radius: 2px; background: var(--accent); animation: slide 1.2s ease-in-out infinite alternate; }
@keyframes slide { from { margin-left: 0 } to { margin-left: 62% } }

/* mark: round 1 winner, kept for comparison (gap 12 everywhere) */
.mark { gap: 12px; height: 150px; }

/* spaced: same stack, tuned rhythm - bigger icon, air above the name,
   more air before the bar, the bar wider and thinner so it reads as a
   baseline rather than a third object */
.spaced { gap: 0; }
.spaced .icon { width: 52px; height: 52px; }
.spaced .name { margin-top: 18px; font-size: 15px; letter-spacing: 0.02em; }
.spaced .track { margin-top: 26px; width: 180px; height: 2px; }

/* row: icon and name side by side as one lockup, the bar centred under the
   lockup - two rows instead of three, so the centre is no longer crowded */
.row { display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto; column-gap: 14px; row-gap: 22px; justify-content: center; align-content: center; }
.row .icon { width: 36px; height: 36px; grid-column: 1; grid-row: 1; }
.row .name { grid-column: 2; grid-row: 1; align-self: center; font-size: 17px; letter-spacing: 0.02em; }
.row .track { grid-column: 1 / span 2; grid-row: 2; width: 100%; height: 2px; }

/* edge: icon and name centred with real air, the progress line is the
   window's bottom edge - like a browser's loading bar, never competing
   with the lockup */
.edge { gap: 0; justify-content: center; }
.edge .icon { width: 52px; height: 52px; }
.edge .name { margin-top: 18px; font-size: 15px; letter-spacing: 0.02em; }
.edge .track { position: absolute; left: 0; right: 0; bottom: 0; width: auto; height: 3px; border-radius: 0; background: var(--line); }
.edge .bar { border-radius: 0; }

/* icon-only: the mark is the name; nothing else but the line */
.icon-only { gap: 0; }
.icon-only .icon { width: 64px; height: 64px; }
.icon-only .track { margin-top: 30px; width: 120px; height: 2px; }
</style>
