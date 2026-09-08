<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import HeroSceneG from "./scenes/HeroSceneG.vue";
const headlines = [
  ["Less typing.", "More conversation."],
  ["Stay in the flow.", "Hear the progress."],
  ["Think out loud.", "Give direction."],
  ["Look at your work.", "Listen to your agent."],
  ["Step away.", "Stay in the loop."],
  ["Your next idea.", "Just say it."],
];
const current = ref(0);
const inView = ref(true);
const hero = ref<HTMLElement | null>(null);
const HEADLINE_INTERVAL_MS = 6000;
let timer: ReturnType<typeof setInterval> | undefined;
let observer: IntersectionObserver | undefined;
let motion: MediaQueryList | undefined;
function startRotation() {
  clearInterval(timer);
  if (motion?.matches) return;
  timer = setInterval(() => {
    if (inView.value && !document.hidden)
      current.value = (current.value + 1) % headlines.length;
  }, HEADLINE_INTERVAL_MS);
}
onMounted(() => {
  motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", startRotation);
  startRotation();
  observer = new IntersectionObserver(([entry]) => {
    inView.value = entry.isIntersecting;
  });
  if (hero.value) observer.observe(hero.value);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  observer?.disconnect();
  motion?.removeEventListener("change", startRotation);
});
</script>
<template>
  <section ref="hero" class="hero wrap">
    <div class="hero-heading">
      <p class="eyebrow">
        <span class="signal-dot"></span>Voice for your coding agent
      </p>
      <h1 :aria-label="headlines[current].join(' ')">
        <span
          v-for="(headline, index) in headlines"
          :key="index"
          class="headline"
          :class="{ visible: index === current }"
          aria-hidden="true"
          >{{ headline[0] }}<br /><em>{{ headline[1] }}</em></span
        >
      </h1>
    </div>
    <div class="hero-copy">
      <p>
        Hear what matters. Answer naturally. Keep your attention on the work.
      </p>
      <div class="hero-actions">
        <a class="button primary" href="#install"
          >Give your agent a voice <span aria-hidden="true">↗</span></a
        >
        <span>Claude Code · Codex preview</span>
      </div>
    </div>
    <div class="hero-desktop"><HeroSceneG /></div>
  </section>
</template>
<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.5fr);
  grid-template-areas: "heading scene" "copy scene";
  grid-template-rows: auto 1fr;
  gap: 24px 40px;
  padding-block: 54px 36px;
}
.hero-heading {
  grid-area: heading;
  min-width: 0;
}
.hero-heading h1 {
  display: grid;
  font-size: clamp(34px, 3.4vw, 50px);
}
.headline {
  grid-area: 1/1;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0.2s;
}
.headline.visible {
  transition-delay: 0.2s;
  opacity: 1;
  visibility: visible;
}
.hero-heading .eyebrow {
  font-size: 10px;
  margin-bottom: 12px;
}
.hero-copy {
  grid-area: copy;
  max-width: 340px;
  min-width: 0;
}
.hero-copy > p {
  font-size: 15px;
  line-height: 1.6;
}
.hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
}
.hero-actions .button {
  font-size: 13px;
  padding: 11px 16px;
  gap: 16px;
}
.hero-actions > span {
  color: var(--muted);
  font-size: 11px;
}
.hero-desktop {
  grid-area: scene;
  width: min(100%, 780px, calc((100svh - 190px) * 1.5789));
  min-width: 0;
  justify-self: end;
}
@media (max-width: 1000px) {
  .hero-heading h1 {
    font-size: 36px;
  }
}
@media (max-width: 700px) {
  .hero {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-block: 20px 28px;
  }
  .hero-heading h1 {
    font-size: 36px;
  }
  .hero-desktop {
    width: 100%;
    order: 2;
  }
  .hero-copy {
    max-width: 100%;
    order: 3;
  }
  .hero-actions {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .headline {
    transition: none;
  }
}
</style>
