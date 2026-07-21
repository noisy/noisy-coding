<script setup lang="ts">
import { computed } from "vue";

// Footer version indicator. One quiet number when the UI build and the
// daemon agree; both versions plus the FIX for whichever side is stale
// when they don't (skew = someone's old artifact: a cached UI build or
// an old container).
const props = withDefaults(
  defineProps<{
    /** Daemon-reported version from /status (undefined until first poll). */
    daemonVersion?: string | null;
    /** UI build version; injectable for tests, defaults to the baked-in one. */
    uiVersion?: string;
  }>(),
  { daemonVersion: null, uiVersion: () => __APP_VERSION__ },
);

const skew = computed(() => {
  const daemon = props.daemonVersion;
  // "dev" = editable install without package metadata — nothing to compare.
  if (!daemon || daemon === "dev" || daemon === props.uiVersion) return null;
  const daemonNewer =
    daemon.localeCompare(props.uiVersion, undefined, { numeric: true }) > 0;
  return daemonNewer
    ? { action: "HARD-REFRESH THIS TAB (⌘⇧R)", hint: "The browser cached an older UI build." }
    : { action: "UPDATE THE CONTAINER (/noisy-coding:update)", hint: "The daemon runs an older release." };
});
</script>

<template>
  <span v-if="skew" class="verskew" :title="skew.hint">
    ⚠ UI v{{ uiVersion }} ≠ DAEMON v{{ daemonVersion }} — {{ skew.action }}
  </span>
  <span v-else class="ver" :title="`UI and daemon both v${uiVersion}`">v{{ uiVersion }}</span>
</template>

<style scoped>
.ver { color: var(--muted); letter-spacing: 0.14em; }
.verskew {
  color: var(--amber, #ffb454);
  letter-spacing: 0.1em;
  text-shadow: 0 0 8px rgba(255, 180, 84, 0.4);
  animation: ver-blink 1.6s step-end infinite;
}
@keyframes ver-blink { 50% { opacity: 0.55; } }
</style>
