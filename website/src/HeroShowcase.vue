<script setup lang="ts">
import { ref } from "vue";
import HeroSceneG from "./scenes/HeroSceneG.vue";
const variants = [
  {
    id: "centered",
    name: "Centered",
    detail: "A centered introduction above the live scene.",
  },
  {
    id: "left",
    name: "Text left",
    detail: "A compact introduction beside a larger product scene.",
  },
  {
    id: "right",
    name: "Text right",
    detail: "The product leads from the left; the introduction sits beside it.",
  },
  {
    id: "product-first",
    name: "Product first",
    detail: "The scene comes first, followed by the headline and action.",
  },
  {
    id: "editorial",
    name: "Wide stage",
    detail: "A single headline above the scene, with supporting copy below.",
  },
] as const;
type Variant = (typeof variants)[number]["id"];
const query = new URLSearchParams(window.location.search);
const requested = query.get("hero");
const selected = ref<Variant>(
  variants.find((v) => v.id === requested)?.id ?? "centered",
);
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
    v-if="compare"
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
  <section class="hero hero-variants wrap" :class="`hero-${selected}`">
    <div class="hero-intro">
      <div class="hero-heading">
        <div class="eyebrow">
          <span class="signal-dot"></span>Your voice, in the workflow
        </div>
        <h1>
          Less typing.<br />
          More <em>conversation.</em>
        </h1>
      </div>
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
    </div>
    <div class="hero-desktop"><HeroSceneG /></div>
  </section>
</template>
<style scoped>
.hero-comparison {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 100;
  width: 210px;
  padding: 12px;
  background: rgba(27, 29, 33, 0.96);
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  box-shadow: 0 8px 30px #0005;
}
.variant-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.variant-buttons button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg1);
  color: var(--muted);
  font: 12px var(--sans);
  cursor: pointer;
}
.variant-buttons button span {
  color: var(--amber);
  font: 10px var(--mono);
}
.variant-buttons button[aria-pressed="true"] {
  background: #34323a;
  border-color: var(--violet);
  color: var(--ink);
}
.hero-comparison p {
  font-size: 11px;
  margin-top: 7px;
}
.hero-variants {
  padding-top: 16px;
  width: min(1760px, calc(100% - 64px));
}
.hero-variants .hero-intro {
  margin-bottom: 24px;
}
.hero-variants .hero-desktop {
  width: 100%;
  min-width: 0;
}
.hero-variants h1 {
  font-size: clamp(36px, 3.8vw, 54px);
}
.hero-variants .hero-bottom > p {
  font-size: 14px;
}
.hero-variants .hero-actions {
  gap: 12px;
}
.hero-variants .eyebrow {
  font-size: 10px;
  margin-bottom: 12px;
}
/* 1: symmetry, a compact message, and the product directly below. */
.hero-centered {
  text-align: center;
}
.hero-centered .hero-intro {
  display: block;
}
.hero-centered .eyebrow,
.hero-centered .hero-actions {
  justify-content: center;
}
.hero-centered h1 br {
  display: none;
}
.hero-centered .hero-bottom > p {
  max-width: 640px;
  margin: 14px auto 0;
}
.hero-centered .hero-actions {
  margin-top: 14px;
}
.hero-centered .hero-desktop {
  max-width: min(100%, calc((100svh - 310px) * 1.5789));
  margin: auto;
}
/* 2 and 3: product and copy share the first screen instead of stacking. */
.hero-left,
.hero-right {
  display: grid;
  grid-template-columns: minmax(260px, 330px) minmax(0, 1fr);
  align-items: center;
  gap: 40px;
  min-height: calc(100svh - 110px);
}
.hero-left .hero-intro,
.hero-right .hero-intro {
  display: block;
  margin: 0;
}
.hero-left .hero-bottom,
.hero-right .hero-bottom {
  margin-top: 22px;
}
.hero-left .hero-actions,
.hero-right .hero-actions {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.hero-left .hero-actions > span,
.hero-right .hero-actions > span {
  max-width: none;
}
.hero-right {
  grid-template-columns: minmax(0, 1fr) minmax(260px, 330px);
}
.hero-right .hero-desktop {
  grid-column: 1;
  grid-row: 1;
}
.hero-right .hero-intro {
  grid-column: 2;
  grid-row: 1;
}
/* 4: open on the product; the caption below explains it. */
.hero-product-first {
  display: flex;
  flex-direction: column;
}
.hero-product-first .hero-desktop {
  order: -1;
  max-width: min(100%, calc((100svh - 245px) * 1.5789));
  margin: auto;
}
.hero-product-first .hero-intro {
  width: 100%;
  max-width: 1000px;
  margin: 25px auto 0;
  gap: 38px;
}
.hero-product-first h1 {
  font-size: 38px;
}
.hero-product-first .eyebrow {
  display: none;
}
/* 5: a wide scene with a quiet, single-line headline and an action beside it. */
.hero-editorial {
  display: grid;
  grid-template-columns: 1fr;
}
.hero-editorial .hero-intro {
  display: contents;
}
.hero-editorial .hero-heading {
  display: flex;
  justify-content: center;
  margin-bottom: 22px;
}
.hero-editorial .eyebrow {
  display: none;
}
.hero-editorial h1 {
  font-size: 36px;
}
.hero-editorial h1 br {
  display: none;
}
.hero-editorial .hero-desktop {
  max-width: min(100%, calc((100svh - 310px) * 1.5789));
  margin: auto;
}
.hero-editorial .hero-bottom {
  order: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  margin: 22px auto 0;
  width: 100%;
  max-width: 1000px;
}
.hero-editorial .hero-actions {
  margin: 0;
  flex: none;
}
.hero-editorial .hero-bottom > p {
  max-width: 490px;
  font-size: 13px;
}
@media (max-width: 900px) {
  .hero-left,
  .hero-right {
    gap: 24px;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1fr);
  }
  .hero-right {
    grid-template-columns: minmax(0, 1fr) minmax(230px, 0.8fr);
  }
  .hero-variants h1 {
    font-size: 38px;
  }
  .hero-editorial .hero-bottom {
    gap: 20px;
  }
  .hero-editorial .hero-actions {
    flex-direction: column;
    align-items: flex-start;
  }
  .hero-product-first .hero-intro {
    gap: 20px;
  }
  .hero-product-first h1 {
    font-size: 32px;
  }
}
@media (max-width: 600px) {
  .hero-comparison {
    padding-top: 5px;
  }
  .variant-buttons {
    gap: 5px;
  }
  .variant-buttons button {
    font-size: 10px;
    padding: 6px 8px;
  }
  .hero-variants {
    padding-top: 12px;
  }
  .hero-variants h1 {
    font-size: 36px;
  }
  .hero-centered h1 br,
  .hero-editorial h1 br {
    display: block;
  }
  .hero-variants .hero-desktop {
    max-width: 100%;
    width: 100%;
  }
  .hero-left,
  .hero-right {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 0;
    align-items: stretch;
  }
  .hero-right .hero-desktop {
    order: -1;
  }
  .hero-left .hero-bottom,
  .hero-right .hero-bottom {
    margin-top: 14px;
  }
  .hero-left .hero-actions,
  .hero-right .hero-actions {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
  .hero-product-first .hero-intro {
    display: block;
    margin-top: 20px;
  }
  .hero-product-first .hero-bottom {
    margin-top: 14px;
  }
  .hero-editorial .hero-bottom {
    display: block;
    margin-top: 18px;
  }
  .hero-editorial .hero-actions {
    margin-top: 14px;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
  .hero-centered .hero-actions {
    flex-wrap: wrap;
  }
  .hero-variants .hero-actions > span {
    max-width: none;
  }
}
</style>

<style scoped>
@media (max-width: 600px) {
  .hero-variants {
    width: calc(100% - 36px);
  }
  .hero-comparison {
    left: 8px;
    bottom: 8px;
    width: 180px;
    padding: 8px;
  }
  .hero-comparison p {
    display: none;
  }
}
</style>
