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
import { useMicStream } from "../composables/useMicStream";
import { useDocumentPip } from "../composables/useDocumentPip";

const { status, allUtterances, character, viewedAgent, selectAgent } = useDaemonState();
// Live mic level, so the spectrum follows the voice instead of looping.
const { level } = useMicStream();

const host = ref<HTMLElement | null>(null);
const anchor = ref<HTMLElement | null>(null);
const { supported, open, popOut } = useDocumentPip(host, anchor);

const DELIVERED = /delivered|cancelled|failed/i;
const liveText = computed(() => {
  const last = [...allUtterances.value].reverse().find((u) => u.role === "user");
  if (!last || DELIVERED.test(last.status)) return "";
  return last.text;
});

const feed = computed<CompanionMessage[]>(() =>
  allUtterances.value
    .filter((u) => u.committed_at > 0 && u.text.trim())
    .filter((u) => u.role === "user" || u.role === "claude")
    .filter((u) => !(u.role === "user" && u.text === liveText.value))
    .slice(-12)
    .map((u) => ({ role: u.role as "user" | "claude", text: u.text })),
);

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
      <div ref="host">
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
</style>
