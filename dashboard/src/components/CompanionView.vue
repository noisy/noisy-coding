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
import { statusChip } from "./bubbleStatus";
import { useConversationFeed } from "../composables/useConversationFeed";
import { useMicStream } from "../composables/useMicStream";
import { useDocumentPip } from "../composables/useDocumentPip";

/* Filter here rather than using the composable's `utterances`.
 *
 * That list is only reassigned inside the poll tick, so switching agent
 * waited up to a full poll before the thread caught up - the head changed
 * instantly, the conversation arrived a beat later. `allUtterances` already
 * holds every agent's messages in memory, so filtering it against the
 * selected agent switches in the same frame as the click. */
const { status, allUtterances, character, viewedAgent, selectAgent } = useDaemonState();

const mine = computed(() =>
  allUtterances.value.filter((u) => u.agent === viewedAgent.value),
);
// Live mic level, so the spectrum follows the voice instead of looping.
const { level } = useMicStream();

// The widget is a glance, not an archive: only committed lines, only the
// last handful, oldest first so the freshest sits at the bottom.
function toMessage(u: (typeof processed)["value"][number]): CompanionMessage {
  const chip = statusChip(u.status, u.role === "user" ? "user" : "claude");
  return {
    id: u.id,
    role: u.role as "user" | "claude",
    text: u.text,
    zone: u.role === "user" || u.role === "claude"
      ? (pending.value.includes(u) ? "pending" : "done")
      : "done",
    statusKind: chip.kind,
    statusLabel: chip.label,
  };
}
/* SAME logic as the dashboard's ConversationLog (useConversationFeed):
 * processed above the line, pending below, identical zones and chips -
 * only the compact styling differs. */
const feed = computed<CompanionMessage[]>(() =>
  [...processed.value, ...pending.value]
    .filter((u) => u.role === "user" || u.role === "claude")
    .filter((u) => u.text.trim())
    .slice(-12)
    .map(toMessage),
);

/* What the user is saying RIGHT NOW.
 *
 * A card is in flight until the daemon marks it delivered, and it is not
 * enough to look for committed_at === 0: the daemon stamps that as soon as
 * the utterance enters the conversation, while the text keeps growing for a
 * while afterwards. So take the newest user card and treat it as live until
 * it reaches a terminal status.
 */
/* Live = the user card still being composed. The state machine owns what
 * each status MEANS; the widget used to test the status text with a regex
 * of its own, which is how it disagreed with the dashboard. */
const { processed, pending, liveTail } = useConversationFeed(mine);
// Live = the composer's utterance, straight from the SHARED feed logic.
const liveText = computed(() => liveTail.value?.text ?? "");

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

/* Inside the desktop app the window IS the floating widget, so the button
 * that pops one out has nothing to do - it would open a picture-in-picture
 * copy of a window that already floats. */
const nativeShell =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Electron");

/* Hover on the WINDOW, not on any element: a frameless window needs to
 * advertise its own edges, and parts of it (padding, the gap beside the
 * rail) belong to no child at all. */
if (typeof window !== "undefined") {
  const mark = (on: boolean) => document.body.classList.toggle("hovering", on);
  window.addEventListener("mouseover", () => mark(true));
  // In a native shell the main process owns this (see watchHover): it can
  // see the cursor even over an OS drag region, which the page cannot.
  // These stay for the browser, where there is no drag region to hide in.
  // Browser only. In the native shell the main process owns the hover
  // state (see watchHover) - it can see the cursor over an OS drag region,
  // where the page's own events stop arriving.
  if (!nativeShell) {
    window.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) mark(false);
    });
  }
  window.addEventListener("blur", () => mark(false));
}

const host = ref<HTMLElement | null>(null);
const anchor = ref<HTMLElement | null>(null);
const { supported: pipSupported, open: pipOpen, popOut } = useDocumentPip(host, anchor);

/* Every conversation, in the dashboard's own tab order.
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
    // Offline agents stay: a tab Krzysztof still has open is a
    // conversation he still switches to, and hiding it makes heads appear
    // and vanish as sessions idle out.
    .sort((a, b) => (meta[a]?.activated_at ?? 0) - (meta[b]?.activated_at ?? 0))
    .map((name) => ({
      name,
      voice: s.agent_voices?.[name] ?? "rex",
      active: name === viewedAgent.value,
      unread: (queued[name] ?? 0) > 0,
      waiting: queued[name] ?? 0,
    }));
});

/* What this agent is doing between messages, straight from the daemon's
 * activity line - the same source and the same freshness window the
 * dashboard uses, so the two never disagree about who is working. */
const ACTIVITY_FRESH_S = 20;
const activity = computed(() => {
  const a = status.value?.activity?.[viewedAgent.value ?? ""];
  if (!a?.text) return null;
  return Date.now() / 1000 - a.at < ACTIVITY_FRESH_S ? a.text : null;
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
      :activity="activity"
      :agents="others"
      @select="selectAgent"
              />
    </div>
    <!-- The drag handle: a full-width bar, not a few dots. macOS owns the
         click inside an app-region (cursor included), so the handle has to
         announce itself by being big and obvious rather than by changing
         the pointer. Its whole width drags. -->
    <div class="drag-strip" title="Drag to move">
      <span /><span /><span /><span /><span /><span />
    </div>

    <button
      v-if="pipSupported && !pipOpen && !nativeShell"
      class="pop-out"
      title="Float above every window"
      @click="popOut"
    >
      float
    </button>
  </div>
</template>

<style>
/* Transparent-mode styling lives in Companion.vue, next to the component
   it dresses, so Storybook can show it too. */
html,
body,
#app {
  margin: 0;
  height: 100%;
}
</style>

<style>
</style>

<style scoped>
/* Hidden until wanted, like the outline: a permanent grip on a widget this
   small is one more thing competing for attention. */
.drag-strip {
  position: absolute;
  /* Flush with the window's own outline, so the bar has no left, right or
     top edge of its own - it REUSES the window's. Only its underside is
     drawn, as a divider. A box inside a box reads as accidental; a strip
     bounded by the frame reads like a title bar. */
  top: 2px;
  left: 2px;
  right: 2px;
  z-index: 200;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  opacity: 0;
  transition: opacity 140ms ease;
  background-image:
    repeating-linear-gradient(90deg, #fff 0 5px, #10151f 5px 10px);
  background-size: 100% 1px;
  background-position: 0 100%;
  background-repeat: no-repeat;
}
body.hovering .drag-strip { opacity: 1; }
/* The dots are the only solid thing left, so they carry both colours too:
   a white core inside a dark ring. Bigger, because a 3px dot with a border
   is mostly border. */
.drag-strip span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid #10151f;
  box-sizing: border-box;
}
.companion-window {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  /* The drag strip is the window's title bar (22px + 2px inset): content
     must never render under it, so the viewport starts below - with a few
     px of breathing room. */
  padding: 32px 8px 8px;
  box-sizing: border-box;
}
/* The widget is fluid (width: 100%), so every wrapper between it and the
   window must pass the width down - a shrink-to-fit host collapses the
   widget to its content and falsely triggers narrow mode. */
.companion-host { width: 100%; }

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
