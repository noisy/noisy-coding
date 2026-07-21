<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { amplitudeFor, sizeCanvas } from "./waveMath";

const props = defineProps<{ level: number }>();

const MIN_HEIGHT = 70;
const canvas = ref<HTMLCanvasElement | null>(null);

// Smooth the level so the wave breathes instead of jittering per frame.
let smoothed = 0;
let target = 0;
watch(
  () => props.level,
  (value) => {
    target = value;
  },
  { immediate: true },
);

function drawWave(t: number) {
  if (!canvas.value) return;
  smoothed += (target - smoothed) * 0.3;
  const amp = amplitudeFor(smoothed);
  const cssHeight = Math.max(MIN_HEIGHT, canvas.value.clientHeight);
  const [ctx, W, H] = sizeCanvas(canvas.value, cssHeight);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(63,216,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  ctx.strokeStyle = "#3fd8ff";
  ctx.lineWidth = 1.6;
  ctx.shadowColor = "rgba(63,216,255,0.9)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 2) {
    const p = x / W;
    const env = Math.sin(p * Math.PI) ** 0.7; // fade edges
    const y =
      H / 2 +
      amp * env * (
        Math.sin(p * 34 + t * 3.1) * 12 +
        Math.sin(p * 91 + t * 6.7) * 7 +
        Math.sin(p * 220 + t * 11.3) * 3.5
      );
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

let raf = 0;
onMounted(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    drawWave(1.7);
    return;
  }
  const t0 = performance.now();
  const loop = (now: number) => {
    drawWave((now - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <canvas ref="canvas" class="scope-canvas" />
</template>

<style scoped>
.scope-canvas { display: block; width: 100%; height: 100%; min-height: 70px; }
</style>
