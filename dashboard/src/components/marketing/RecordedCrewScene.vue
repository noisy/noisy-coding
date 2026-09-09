<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Companion from "../Companion.vue";
import "../../styles/companion-window.css";
import recording from "./recorded-crew/crew-v1.mp4";
import poster from "./recorded-crew/crew-v1-poster.jpg";
import take from "./recorded-crew/crew-v1.json";
import { recordedCrewAt } from "./recordedCrewTimeline";

const props = withDefaults(defineProps<{ compact?: boolean; camera?: boolean; cameraZoom?: number }>(), { camera: true, cameraZoom: 2 });
const cameraScale = computed(() => Math.max(1, Math.min(4, props.cameraZoom)));
const video = ref<HTMLVideoElement | null>(null);
const timeMs = ref(0);
const soundOn = ref(false);
const playbackError = ref(false);
const soundBlocked = ref(false);
const reducedMotion = ref(false);
const state = computed(() => recordedCrewAt(take, timeMs.value));
let animation = 0;
let visibility: IntersectionObserver | undefined;
let motion: MediaQueryList;
let soundRequest = 0;
function motionChanged() { reducedMotion.value = motion.matches; }
function sampleTime() {
  if (video.value) timeMs.value = video.value.currentTime * 1000;
  animation = requestAnimationFrame(sampleTime);
}
function updateTime() { timeMs.value = (video.value?.currentTime ?? 0) * 1000; }
function restart() {
  if (video.value) video.value.currentTime = 0;
  timeMs.value = 0;
}
async function setSound(enabled: boolean) {
  const media = video.value;
  if (!media) return;
  const request = ++soundRequest;
  soundOn.value = enabled;
  media.muted = !enabled;
  if (!enabled) return;
  if (media.ended) restart();
  try {
    await media.play();
    if (request !== soundRequest) return;
    playbackError.value = false;
    soundBlocked.value = false;
  } catch {
    if (request !== soundRequest) return;
    soundOn.value = false;
    media.muted = true;
    soundBlocked.value = true;
    // Hover isn't a browser activation gesture. Keep the silent preview alive
    // when autoplay policy rejects unmuting; the explicit sound button retries.
    void media.play().catch(() => { playbackError.value = true; });
  }
}
function toggleSound() { return setSound(!soundOn.value); }
function ended() {
  void setSound(false);
}
onMounted(() => {
  motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionChanged();
  motion.addEventListener("change", motionChanged);
  animation = requestAnimationFrame(sampleTime);
  visibility = new IntersectionObserver(([entry]) => {
    if (!video.value) return;
    if (!entry.isIntersecting) {
      video.value.pause();
      void setSound(false);
    } else if (!reducedMotion.value && !video.value.ended) {
      void video.value.play().catch(() => {});
    }
  });
  if (video.value) visibility.observe(video.value);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(animation);
  visibility?.disconnect();
  motion?.removeEventListener("change", motionChanged);
  video.value?.pause();
});
defineExpose({ restart, toggleSound, soundOn });
</script>

<template>
  <div class="recorded-crew companion-transparent" :class="{ compact }" :style="{ width: compact ? '600px' : '760px' }"
    tabindex="0" role="group" aria-label="Conversation demo. Hover or focus to hear audio."
    @pointerenter="$event.pointerType === 'mouse' && setSound(true)"
    @pointerleave="$event.pointerType === 'mouse' && setSound(false)"
    @focusin="setSound(true)" @focusout="setSound(false)">
    <div class="recorded-widget" :style="{
      transform: camera && !reducedMotion && state.zoom ? 'scale(2)' : 'scale(1)',
    }">
      <div class="companion-window" inert><div class="companion-host">
        <Companion draggable avatar-set="editorial" :mode="state.mode" :voice="state.voice" :feed="state.feed"
          :live-text="state.liveText" :agents="state.agents" :max-height="200" />
      </div></div>
    </div>
    <!-- The camera is a sibling of the zooming widget: anchored to the
         screenshot's bottom-left corner throughout every agent handover. -->
    <div class="recorded-camera">
      <video ref="video" :src="recording" :poster="poster" muted playsinline preload="metadata"
        :style="{ transform: `scale(${cameraScale})` }"
        aria-label="Recorded conversation with Krzysztof and Lux, Rex and Luna"
        @timeupdate="updateTime" @seeked="updateTime" @ended="ended"
        @error="playbackError = true" />
    </div>
    <p v-if="playbackError" class="playback-error" role="status">Unable to play this recording. Please try again.</p>
    <p v-else-if="soundBlocked" class="playback-error" role="status">Click the sound button to enable audio.</p>
  </div>
</template>

<style scoped>
.recorded-crew {
  height: 440px; position: relative; overflow: hidden;
  background: radial-gradient(1100px 700px at 25% 15%, #2a2350 0%, transparent 55%),
    radial-gradient(900px 600px at 85% 85%, #1b2a4a 0%, transparent 60%),
    linear-gradient(160deg, #0b0d1f, #141334 55%, #0a0f24);
}
.recorded-widget {
  position: absolute; right: 20px; top: 20px; width: 420px; height: 400px;
  transform-origin: 94% 100%; transition: transform .75s cubic-bezier(.22,.61,.36,1);
}
.recorded-widget :deep(.companion-header) { visibility: hidden; }
.recorded-widget :deep(.companion-window::after) { display: none; }
.recorded-widget :deep(.rail) { scrollbar-width: none; }
.recorded-widget :deep(.rail::-webkit-scrollbar) { display: none; }
.recorded-camera {
  position: absolute; left: 16px; bottom: 16px; width: 192px; aspect-ratio: 16 / 9;
  overflow: hidden; border-radius: 12px; border: 1px solid #ffffff38;
  box-shadow: 0 6px 24px #0005; background: #18171c;
}
.compact .recorded-camera { width: 132px; }
.recorded-camera video { display: block; width: 100%; height: 100%; }
.playback-error { position: absolute; left: 16px; top: 8px; color: #ffcfb1; font-size: 12px; }
@media (prefers-reduced-motion: reduce) { .recorded-widget { transition: none; } }
</style>
