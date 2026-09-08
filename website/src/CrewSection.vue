<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import CompanionCrewScene from "@dashboard/components/marketing/CompanionCrewScene.vue";
import VoiceCarousel from "./VoiceCarousel.vue";
const scene = ref<InstanceType<typeof CompanionCrewScene> | null>(null);
const frame = ref<HTMLElement | null>(null);
const scale = ref(0.7);
const compact = ref(false);
const sound = ref(false);
let observer: ResizeObserver | undefined;
let visibility: IntersectionObserver | undefined;
onMounted(() => {
  if (!frame.value) return;
  observer = new ResizeObserver(() => {
    compact.value = frame.value!.clientWidth < 600;
    scale.value = frame.value!.clientWidth / (compact.value ? 600 : 760);
  });
  observer.observe(frame.value);
  visibility = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting && sound.value) {
      scene.value?.toggleSound();
      sound.value = false;
    }
  });
  visibility.observe(frame.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  visibility?.disconnect();
});
function listen() {
  if (!sound.value) scene.value?.restart();
  scene.value?.toggleSound();
  sound.value = !!scene.value?.soundOn;
}
</script>
<template>
  <section id="voices" class="section voice-section">
    <div class="wrap voice-layout">
      <div class="voice-copy">
        <p class="eyebrow">Different voices. One conversation at a time.</p>
        <h2>Know who’s talking.<br /><em>Before you look.</em></h2>
        <p class="section-intro">
          A deployment update. A PR worth celebrating. A personal reminder.
          Recognize the voice, know the context—and answer when you’re ready.
        </p>
        <VoiceCarousel />
        <button
          class="button primary"
          type="button"
          :aria-pressed="sound"
          @click="listen"
        >
          {{ sound ? "Mute demo" : "Hear the conversation" }}
          <span aria-hidden="true">{{ sound ? "◼" : "▶" }}</span>
        </button>
        <p class="voice-note">
          A scripted example with real voices. No microphone needed.
        </p>
      </div>
      <div>
        <div
          ref="frame"
          class="voice-stage"
          :style="{ height: `${440 * scale}px` }"
        >
          <div
            :style="{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }"
          >
            <CompanionCrewScene ref="scene" :camera="!compact" :compact="compact" />
          </div>
        </div>
        <p class="voice-caption">
          Each voice takes its turn. Waiting messages stay with their
          conversation.
        </p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.voice-section {
  background: radial-gradient(ellipse at 80% 60%, #31303f, #1c1e23 65%);
  border-block: 1px solid var(--line);
}
.voice-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.25fr);
  align-items: center;
  gap: var(--layout-gap);
}
.voice-layout > div { min-width: 0; }
.voice-copy h2 {
  font-size: clamp(36px, 3.5vw, 56px);
}
.voice-note,
.voice-caption {
  font-size: 12px;
  margin-top: 16px;
}
.voice-caption {
  text-align: center;
}
.voice-stage {
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--line-strong);
}
@media (max-width: 900px) {
  .voice-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .voice-copy {
    max-width: 640px;
  }
}
</style>
