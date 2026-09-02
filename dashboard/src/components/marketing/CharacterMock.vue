<script setup lang="ts">
/* The character matrix, content only - no OS chrome.
 *
 * Marketing prop for the website: the persona rail exactly as the
 * dashboard composes it (VoicePersona portrait + CharacterReadout dials),
 * lifted into a standalone panel for scripts/marketing-shots.sh. Real
 * components, expressive but believable dial values - humor sits at 75
 * to match the landing page's headline.
 */
import type { Character } from "../../types";
import CharacterReadout from "../CharacterReadout.vue";
import HudPanel from "../HudPanel.vue";
import VoicePersona from "../VoicePersona.vue";

const CHARACTER: Character = { humor: 75, honesty: 90, brevity: 60, chatty: 35, voice: "lux", speed: 1.1 };
</script>

<template>
  <div class="charmock">
    <HudPanel index="04" title="AGENT CHARACTER">
      <div class="rail">
        <div class="railbox">
          <VoicePersona voice="lux" :speaking="false" :muted="false" />
        </div>
        <div class="railbox">
          <div class="railtitle">CHARACTER SETTINGS</div>
          <CharacterReadout :character="CHARACTER" />
        </div>
      </div>
    </HudPanel>
  </div>
</template>

<style scoped>
.charmock {
  width: 380px;
  padding: 16px;
}
/* Same violet recolor the dashboard's persona rail applies. */
.rail {
  padding: 4px 2px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  --cyan: var(--violet);
  --cyan-hi: var(--violet-hi);
  --cyan-dim: var(--violet-dim);
  --glow-cyan: var(--glow-violet);
  --line: color-mix(in srgb, var(--violet) 22%, transparent);
  --line-strong: color-mix(in srgb, var(--violet) 55%, transparent);
}
.railbox { border-bottom: 1px solid var(--line); padding-bottom: 14px; }
.railbox:last-child { border-bottom: none; padding-bottom: 4px; }
.railtitle { font-size: 9px; letter-spacing: 0.26em; color: var(--muted); margin-bottom: 10px; }
</style>
