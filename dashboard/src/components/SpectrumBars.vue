<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { amplitudeFor, sizeCanvas } from "./waveMath";

const props = defineProps<{ level: number }>();

const HEIGHT = 90;
const BARS = 36;
const canvas = ref<HTMLCanvasElement | null>(null);

let smoothed = 0;
let target = 0;
watch(
  () => props.level,
  (value) => {
    target = value;
  },
  { immediate: true },
);

function drawSpectrum(t: number) {
  if (!canvas.value) return;
  smoothed += (target - smoothed) * 0.3;
  const amp = amplitudeFor(smoothed);
  const [ctx, W, H] = sizeCanvas(canvas.value, HEIGHT);
  ctx.clearRect(0, 0, W, H);
  const bw = W / BARS;
  for (let i = 0; i < BARS; i++) {
    const f = i / BARS;
    // shaped pseudo-noise: strong low-mids (voice band), rolling off high
    const voice = Math.exp(-((f - 0.22) ** 2) / 0.035);
    const n = 0.5 + 0.5 * Math.sin(t * (2.2 + i * 0.37) + i * 1.7);
    const h = Math.max(3, (voice * 0.8 + 0.12) * n * amp * (H - 12));
    const x = i * bw + 1.5;
    const grad = ctx.createLinearGradient(0, H, 0, H - h);
    grad.addColorStop(0, "rgba(63,216,255,0.25)");
    grad.addColorStop(0.7, "rgba(63,216,255,0.85)");
    grad.addColorStop(1, "#9aeeff");
    ctx.fillStyle = grad;
    ctx.fillRect(x, H - h, bw - 3, h);
    ctx.fillStyle = "rgba(255,180,84,0.9)";
    ctx.fillRect(x, H - h - 4, bw - 3, 2);
  }
}

let raf = 0;
onMounted(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    drawSpectrum(1.3);
    return;
  }
  const t0 = performance.now();
  const loop = (now: number) => {
    drawSpectrum((now - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <canvas ref="canvas" :height="HEIGHT" />
</template>
