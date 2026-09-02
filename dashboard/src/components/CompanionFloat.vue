<script setup lang="ts">
/** The float button (#28), usable from anywhere in the dashboard.
 *
 * Self-contained on purpose: it owns the hidden companion and the PiP
 * plumbing, so dropping <CompanionFloat /> into a view is the whole
 * integration. The companion is invisible until it pops out - the dashboard
 * already shows the conversation, the widget is for when you are looking at
 * something else.
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

const host = ref<HTMLElement | null>(null);
const anchor = ref<HTMLElement | null>(null);
const { supported, open, popOut } = useDocumentPip(host, anchor);

/* Live = the user card still being composed. The state machine owns what
 * each status MEANS; the widget used to test the status text with a regex
 * of its own, which is how it disagreed with the dashboard. */
const { processed, pending, liveTail } = useConversationFeed(mine);
// Live = the composer's utterance, straight from the SHARED feed logic.
const liveText = computed(() => liveTail.value?.text ?? "");

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
  <div class="float-slot">
    <button
    v-if="supported"
    class="float-btn"
    :class="{ on: open }"
    :title="open ? 'The companion is floating' : 'Float the companion above every window'"
    @click="popOut"
  >
    {{ open ? "floating" : "float" }}
  </button>

    <!-- Parked off-screen until it pops out; the PiP window adopts this node. -->
    <div ref="anchor" class="float-anchor">
      <div ref="host" class="float-host">
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
    </div>
  </div>
</template>

<style scoped>
.float-slot {
  display: flex;
  align-items: center;
}
.float-btn {
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
}
.float-btn:hover {
  color: #fff;
  border-color: rgba(148, 163, 220, 0.7);
}
.float-btn.on {
  color: #3fd8ff;
  border-color: rgba(63, 216, 255, 0.6);
}

/* Hidden, but still laid out - a display:none subtree has no size, and the
   companion clamps its thread by pixel height. */
.float-anchor {
  position: fixed;
  left: -10000px;
  top: 0;
  width: 420px;
}
/* In the PiP window the host is the widget's only parent - it must span
   the window, or the fluid widget shrinks to content and false-triggers
   narrow mode. */
.float-host { width: 100%; }
</style>
