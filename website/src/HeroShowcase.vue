<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import HeroSceneG from "./scenes/HeroSceneG.vue";
const variants = [
  {
    id: "briefing",
    name: "Briefing",
    detail: "A short headline strip, then the whole product.",
  },
  {
    id: "top-aligned",
    name: "Top aligned",
    detail: "Copy and product begin together, with room around both.",
  },
  {
    id: "caption-side",
    name: "Side caption",
    detail: "Headline first. Product on the left, context on the right.",
  },
  {
    id: "inset",
    name: "Inset card",
    detail: "A compact introduction overlaps the edge of the desktop.",
  },
  {
    id: "ribbon",
    name: "Ribbon",
    detail: "A slim headline above an offset product and a low caption.",
  },
] as const;
type Variant = (typeof variants)[number]["id"];
const query = new URLSearchParams(window.location.search);
const requested = query.get("hero");
const selected = ref<Variant>(
  variants.find((v) => v.id === requested)?.id ?? "briefing",
);
const hero = ref<HTMLElement | null>(null);
const inView = ref(true);
let visibility: IntersectionObserver | undefined;
onMounted(() => {
  visibility = new IntersectionObserver(([entry]) => {
    inView.value = entry.isIntersecting;
  });
  if (hero.value) visibility.observe(hero.value);
});
onBeforeUnmount(() => visibility?.disconnect());
const compare = import.meta.env.DEV || query.get("compare") === "1";
function select(id: Variant) {
  selected.value = id;
  const url = new URL(window.location.href);
  url.searchParams.set("hero", id);
  if (compare) url.searchParams.set("compare", "1");
  window.history.replaceState(null, "", url);
}
</script>
<template>
  <div
    v-if="compare && inView"
    class="hero-comparison"
    aria-label="Hero layout comparison"
  >
    <div class="variant-buttons" role="group" aria-label="Choose hero layout">
      <button
        v-for="(variant, index) in variants"
        :key="variant.id"
        type="button"
        :aria-pressed="selected === variant.id"
        @click="select(variant.id)"
      >
        <span>{{ index + 1 }}</span> {{ variant.name }}
      </button>
    </div>
    <p>{{ variants.find((v) => v.id === selected)?.detail }}</p>
  </div>
  <section
    ref="hero"
    class="hero hero-variants wrap"
    :class="`hero-${selected}`"
  >
    <div class="hero-heading">
      <p class="eyebrow">
        <span class="signal-dot"></span>Voice for your coding agent
      </p>
      <h1>Less typing.<br />{{ " " }}<em>More conversation.</em></h1>
    </div>
    <div class="hero-copy">
      <p>
        Hear what matters. Answer naturally. Keep your attention on the work.
      </p>
      <div class="hero-actions">
        <a class="button primary" href="#install"
          >Give your agent a voice <span aria-hidden="true">↗</span></a
        ><span>Claude Code · Codex preview</span>
      </div>
    </div>
    <div class="hero-desktop"><HeroSceneG /></div>
  </section>
</template>
<style scoped>
.hero-variants {
  --scene-width: min(100%, 940px, calc((100svh - 260px) * 1.5789));
  display: grid;
  gap: 24px 40px;
  padding-block: 24px 36px;
}
.hero-heading {
  grid-area: heading;
  min-width: 0;
}
.hero-heading h1 {
  font-size: clamp(34px, 3.4vw, 50px);
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
  width: var(--scene-width);
  min-width: 0;
}
.hero-briefing h1 em, .hero-caption-side h1 em, .hero-ribbon h1 em { margin-left: .15em; }
/* A shallow, left-aligned introduction leaves the first screen to the product. */
.hero-briefing {
  grid-template-columns: 1fr 340px;
  grid-template-areas: "heading copy" "scene scene";
  align-items: start;
}
.hero-briefing .hero-heading h1 br {
  display: none;
}
.hero-briefing .hero-desktop {
  justify-self: center;
}
.hero-briefing .hero-copy > p {
  display: none;
}
.hero-briefing .hero-actions {
  margin-top: 0;
  align-items: flex-end;
}
/* Both columns start at the same baseline; the scene is deliberately bounded. */
.hero-top-aligned {
  grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.5fr);
  grid-template-areas: "heading scene" "copy scene";
  grid-template-rows: auto 1fr;
  padding-top: 54px;
  row-gap: 24px;
}
.hero-top-aligned .hero-desktop {
  --scene-width: min(100%, 780px, calc((100svh - 190px) * 1.5789));
  justify-self: end;
}
/* Separate headline, then an asymmetric product-and-caption row. */
.hero-caption-side {
  grid-template-columns: minmax(0, 1.6fr) minmax(240px, 0.65fr);
  grid-template-areas: "heading heading" "scene copy";
}
.hero-caption-side .hero-heading h1 br {
  display: none;
}
.hero-caption-side .hero-copy {
  align-self: end;
  padding-bottom: 24px;
}
.hero-caption-side .hero-desktop {
  --scene-width: min(100%, 850px, calc((100svh - 240px) * 1.5789));
}
/* The card crosses the frame's edge; the live companion lives on its right. */
.hero-inset {
  grid-template-columns: 280px 100px minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  grid-template-areas: "heading heading scene" "copy copy scene";
  gap: 0;
  align-items: start;
  padding-top: 44px;
}
.hero-inset .hero-heading,
.hero-inset .hero-copy {
  position: relative;
  z-index: 2;
  background: var(--bg1, #202226);
  max-width: none;
  padding: 24px;
  border: 1px solid var(--line-strong);
}
.hero-inset .hero-heading {
  margin-top: 32px;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
  padding-bottom: 14px;
}
.hero-inset .hero-copy {
  border-top: 0;
  border-radius: 0 0 16px 16px;
}
.hero-inset .hero-desktop {
  grid-column: 2/4;
  grid-row: 1/3;
  justify-self: start;
  --scene-width: min(100%, 850px, calc((100svh - 180px) * 1.5789));
}
/* A narrow title ribbon and a low caption create an L-shaped composition. */
.hero-ribbon {
  grid-template-columns: 280px minmax(0, 1fr);
  grid-template-areas: "heading heading" "copy scene";
  border-top: 1px solid var(--line);
}
.hero-ribbon .hero-heading {
  display: flex;
  align-items: baseline;
  gap: 32px;
}
.hero-ribbon .eyebrow {
  max-width: 160px;
  flex: none;
}
.hero-ribbon h1 {
  font-size: clamp(32px, 3vw, 44px);
}
.hero-ribbon h1 br {
  display: none;
}
.hero-ribbon .hero-copy {
  align-self: end;
  padding-bottom: 24px;
}
.hero-ribbon .hero-desktop {
  --scene-width: min(100%, 820px, calc((100svh - 245px) * 1.5789));
  justify-self: end;
}
.hero-comparison {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 100;
  width: 190px;
  padding: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: #1b1d21f5;
  box-shadow: 0 8px 30px #0005;
}
.variant-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.variant-buttons button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg1);
  color: var(--muted);
  font: 11px var(--sans);
  cursor: pointer;
}
.variant-buttons button span {
  color: var(--amber);
}
.variant-buttons button[aria-pressed="true"] {
  color: var(--ink);
  border-color: var(--violet);
  background: #34323a;
}
.hero-comparison p {
  font-size: 10px;
  margin-top: 8px;
}
@media (max-width: 1000px) {
  .hero-heading h1 {
    font-size: 36px;
  }
  .hero-briefing {
    grid-template-columns: 1fr 240px;
  }
  .hero-inset {
    grid-template-columns: 240px 50px minmax(0, 1fr);
  }
  .hero-ribbon {
    grid-template-columns: 230px minmax(0, 1fr);
  }
  .hero-ribbon .hero-heading {
    display: block;
  }
}
@media (max-width: 700px) {
  .hero-variants {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-block: 20px 28px;
  }
  .hero-heading h1 {
    font-size: 36px;
  }
  .hero-variants .hero-desktop {
    width: 100%;
    max-width: 100%;
    order: 2;
  }
  .hero-copy {
    max-width: 100%;
    order: 3;
  }
  .hero-briefing .hero-actions {
    align-items: flex-start;
  }
  .hero-variants .hero-actions {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  .hero-inset .hero-heading,
  .hero-inset .hero-copy {
    padding: 0;
    border: 0;
    margin: 0;
    background: none;
  }
  .hero-ribbon .hero-heading {
    display: block;
  }
  .hero-caption-side .hero-copy,
  .hero-ribbon .hero-copy {
    align-self: auto;
    padding: 0;
  }
  .hero-comparison {
    width: 165px;
  }
  .hero-comparison p {
    display: none;
  }
}
</style>
