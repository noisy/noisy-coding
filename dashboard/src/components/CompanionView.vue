<script setup lang="ts">
/** The companion (#28) wired to the live daemon.
 *
 * Served at /companion, meant to be opened as its own small window and
 * parked over the editor. The browser cannot make a window transparent or
 * pin it above other apps - that needs the native shell - but everything
 * below it is real: the same feed, the same portrait, the same rails, fed
 * by the daemon instead of Storybook fixtures.
 */
import { computed, ref } from "vue";
import Companion, { type CompanionAgent, type CompanionMessage } from "./Companion.vue";
import { useDaemonState } from "../composables/useDaemonState";
import { useMicStream } from "../composables/useMicStream";
import { useDocumentPip } from "../composables/useDocumentPip";

const { status, allUtterances, character, viewedAgent, selectAgent } = useDaemonState();
// Live mic level, so the spectrum follows the voice instead of looping.
const { level } = useMicStream();

// The widget is a glance, not an archive: only committed lines, only the
// last handful, oldest first so the freshest sits at the bottom.
const feed = computed<CompanionMessage[]>(() =>
  allUtterances.value
    .filter((u) => u.committed_at > 0 && u.text.trim())
    .filter((u) => u.role === "user" || u.role === "claude")
    .filter((u) => !(u.role === "user" && u.text === liveText.value))
    .slice(-12)
    .map((u) => ({ role: u.role as "user" | "claude", text: u.text })),
);

/* What the user is saying RIGHT NOW.
 *
 * A card is in flight until the daemon marks it delivered, and it is not
 * enough to look for committed_at === 0: the daemon stamps that as soon as
 * the utterance enters the conversation, while the text keeps growing for a
 * while afterwards. So take the newest user card and treat it as live until
 * it reaches a terminal status.
 */
const DELIVERED = /delivered|cancelled|failed/i;
const liveText = computed(() => {
  const last = [...allUtterances.value].reverse().find((u) => u.role === "user");
  if (!last || DELIVERED.test(last.status)) return "";
  return last.text;
});

/* Document Picture-in-Picture: the only way a browser gets a genuinely
 * always-on-top window. It hosts real DOM, so the live component moves into
 * it - no second render, no duplicated state. Chrome only, and only from a
 * click: browsers refuse to spawn a floating window without a user gesture.
 *
 * Styles do NOT follow the DOM into that window, so every stylesheet has to
 * be copied across by hand. Miss this and the widget arrives unstyled.
 */
// A native shell can ask for a see-through page: /companion?transparent=1
if (new URLSearchParams(window.location.search).has("transparent")) {
  document.body.classList.add("companion-transparent");
}

const host = ref<HTMLElement | null>(null);
const anchor = ref<HTMLElement | null>(null);
const { supported: pipSupported, open: pipOpen, popOut } = useDocumentPip(host, anchor);

/* The other conversations, in the dashboard's own tab order.
 *
 * Offline agents are dropped: the widget has room for a handful of heads,
 * and a tab you cannot talk to is not worth one of those slots. Unread is
 * anything waiting to be delivered there. */
const others = computed<CompanionAgent[]>(() => {
  const s = status.value;
  if (!s) return [];
  const meta = s.agents_meta ?? {};
  const queued = s.queued_by_agent ?? {};
  return Object.keys(s.agents ?? {})
    .filter((name) => name !== viewedAgent.value)
    .filter((name) => meta[name]?.online !== false)
    .sort((a, b) => (meta[a]?.activated_at ?? 0) - (meta[b]?.activated_at ?? 0))
    .map((name) => ({
      name,
      voice: s.agent_voices?.[name] ?? "rex",
      unread: (queued[name] ?? 0) > 0,
    }));
});

const mode = computed<"claude" | "user" | "idle">(() => {
  if (status.value?.claude_speaking) return "claude";
  // Holding push-to-talk counts as having the floor even before a word is
  // spoken - the dashboard says ON AIR at that moment, and the widget has to
  // agree with it. Waiting for `recording` leaves the rail dim while the
  // user is already live.
  if (status.value?.ptt_held || status.value?.recording) return "user";
  return "idle";
});
</script>

<template>
  <div ref="anchor" class="companion-window">
    <div ref="host" class="companion-host">
      <Companion
        :mode="mode"
        :voice="character?.voice ?? 'rex'"
        :feed="feed"
        :live-text="liveText"
        :max-height="220"
      :level="level"
      :agents="others"
      @select="selectAgent"
              />
    </div>
    <button
      v-if="pipSupported && !pipOpen"
      class="pop-out"
      title="Float above every window"
      @click="popOut"
    >
      float
    </button>
  </div>
</template>

<style>
/* Keep the HUD's dark backdrop from hud.css. The widget's colours are
   translucent - rgba surfaces and borders - so they are mixed with whatever
   is behind them. Over a browser's white page they wash out and stop
   matching Storybook, where stories render on that same dark chrome.
   Transparency is opt-in via ?transparent=1, for a native shell that can
   actually composite it; a plain browser paints white behind the page and
   would only break the colours again. */
html,
body,
#app {
  margin: 0;
  height: 100%;
}
</style>

<style>
/* Opt-in transparency, applied by CompanionView when asked for. */
body.companion-transparent,
body.companion-transparent #app {
  background: transparent !important;
}
body.companion-transparent::before {
  display: none;
}
</style>

<style scoped>
.companion-window {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

/* Out of the way until wanted: the widget is meant to be glanced at, and a
   permanent button in the corner is one more thing competing for attention. */
.pop-out {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 8px;
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #cbd5f5;
  background: rgba(15, 18, 32, 0.55);
  border: 1px solid rgba(148, 163, 220, 0.35);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease;
}
.companion-window:hover .pop-out {
  opacity: 1;
}
.pop-out:hover {
  color: #fff;
  border-color: rgba(148, 163, 220, 0.7);
}
</style>
