<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { statusToState, timelineZone } from "../machines/chat";
import type { Utterance } from "../types";
import ActivityLine from "./ActivityLine.vue";
import FeedRow from "./FeedRow.vue";
import UserBubble from "./UserBubble.vue";

const props = withDefaults(
  defineProps<{
    utterances: Utterance[];
    playingId?: number;
    activity?: { text: string; at: number } | null;
  }>(),
  { playingId: 0, activity: null },
);
defineEmits<{ replay: [utterance: Utterance]; cancel: [utterance: Utterance] }>();

// Noise guard: utterances that never became real speech (empty, dropped)
// or were recalled would flood the log in a loud room and bury the actual
// conversation — hide them entirely. STT errors stay visible: that's real
// speech that got lost.
const NOISE_STATES = new Set(["empty", "dropped", "cancelled"]);
function isNoise(u: Utterance): boolean {
  return u.role === "user" && NOISE_STATES.has(statusToState("user", u.status) ?? "");
}

// Oldest first — the newest message lands at the BOTTOM, like a chat.
// Order = when a message ENTERED the conversation (committed_at): a Claude
// reply that arrived while the user was still composing sits ABOVE their
// finished message, iMessage style.
function commitTime(u: Utterance): number {
  return u.committed_at || u.started_at;
}

const ordered = computed(() =>
  props.utterances
    .filter((u) => !isNoise(u))
    .sort((a, b) => commitTime(a) - commitTime(b) || a.id - b.id),
);

// The in-progress user utterance renders in a RESERVED slot below the
// feed: it may still vanish (noise) or grow (live partials), and without
// its own space every appearance/disappearance shoves the whole log
// around. Once it settles into a real message it moves into the feed —
// visually the same spot.
const LIVE_STATES = new Set(["recording", "transcribing"]);
function isLiveUser(u: Utterance): boolean {
  return u.role === "user" && LIVE_STATES.has(statusToState("user", u.status) ?? "");
}

// The composer holds ANY in-progress user utterance — even when a Claude
// message arrived meanwhile and sorted after it. The reply belongs in the
// feed above; the composition stays pinned at the bottom until finished.
const liveTail = computed(() => {
  const live = ordered.value.filter(isLiveUser);
  return live.length ? live[live.length - 1] : null;
});

const settled = computed(() => ordered.value.filter((u) => !isLiveUser(u)));

// The virtual "processed line" (see timelineZone in machines/chat.ts): the
// feed reads past → present → future. History first (delivered, played,
// parked, failed — plus in-flight speech, which settles in place), then
// the busy row AS the line itself, then everything still waiting its turn.
// A card never renders below a zone it outranks, so a PLAYING reply can't
// dive under the user's AWAITING transcripts.
//
// Done is STICKY: a replayed card re-enters the pipeline (synthesizing →
// ready → playing), but it is history being re-heard, not future work — it
// must keep its chronological slot instead of sinking below newer cards
// and jumping back when finished. Keyed by id:started_at because a daemon
// restart reuses ids from 1.
const everDone = new Set<string>();
function zoneOf(u: Utterance): "done" | "active" | "pending" {
  if (u.role === "system") return "done";
  // Daemon speech rides the claude pipeline — same statuses, same zones.
  const zone = timelineZone(u.role === "user" ? "user" : "claude", u.status);
  const key = `${u.id}:${u.started_at}`;
  if (zone === "done") everDone.add(key);
  else if (everDone.has(key)) return "done";
  return zone;
}

const processed = computed(() => settled.value.filter((u) => zoneOf(u) !== "pending"));
const pending = computed(() => settled.value.filter((u) => zoneOf(u) === "pending"));

// The card being spoken renders right above the busy line — quoting the
// speech in the line too would double it (see ActivityLine).
const playingCardVisible = computed(
  () => props.playingId !== 0 && settled.value.some((u) => u.id === props.playingId),
);

const feed = ref<HTMLElement | null>(null);
const slot = ref<HTMLElement | null>(null);

// The composer floats OVER the feed's bottom padding instead of owning a
// dead strip below it: while you scroll, history flows through that area;
// only at the very bottom does the padding hold space for the overlay —
// and it grows with the bubble as live transcription lengthens it.
const SLOT_MIN_PX = 96; // one single-line bubble
const padBottom = ref(SLOT_MIN_PX);
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  if (typeof ResizeObserver !== "undefined" && slot.value) {
    resizeObserver = new ResizeObserver(() => {
      padBottom.value = Math.max(SLOT_MIN_PX, slot.value?.offsetHeight ?? 0);
    });
    resizeObserver.observe(slot.value);
  }
});
onUnmounted(() => resizeObserver?.disconnect());

function scrollToBottom() {
  if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
}

// Sticky-bottom, like every decent chat: we follow new content ONLY while
// you are at the bottom. Scrolled up to read something older? Nothing may
// move your view — new messages just light up the jump-down button.
const STICK_THRESHOLD_PX = 24;
const stickToBottom = ref(true);
function onFeedScroll() {
  const el = feed.value;
  if (!el) return;
  stickToBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - STICK_THRESHOLD_PX;
}
function jumpToBottom() {
  stickToBottom.value = true;
  scrollToBottom();
}

// Scrolled to the newest message by default, and kept there as new ones
// land — but only while sticking.
onMounted(scrollToBottom);
watch(
  () => {
    const last = ordered.value[ordered.value.length - 1];
    // The busy row appearing/changing also grows the feed's bottom.
    return `${last ? `${last.id}:${last.updated_at}` : ""}|${props.activity?.text ?? ""}`;
  },
  async () => {
    await nextTick();
    if (stickToBottom.value) scrollToBottom();
  },
);
</script>

<template>
  <div class="logroot">
    <div ref="feed" class="feed" :style="{ paddingBottom: padBottom + 'px' }" @scroll="onFeedScroll">
      <FeedRow
        v-for="utterance in processed"
        :key="utterance.id"
        :utterance="utterance"
        :playing="utterance.id === playingId"
        @replay="$emit('replay', $event)"
        @cancel="$emit('cancel', $event)"
      />
      <!-- The processed line: everything above already happened, everything
           below still waits its turn. -->
      <ActivityLine :activity="activity" :playing-card-visible="playingCardVisible" />
      <FeedRow
        v-for="utterance in pending"
        :key="utterance.id"
        :utterance="utterance"
        :playing="utterance.id === playingId"
        @replay="$emit('replay', $event)"
        @cancel="$emit('cancel', $event)"
      />
      <p v-if="!ordered.length" class="empty">NO TRANSMISSIONS YET — START TALKING</p>
    </div>
    <button
      v-if="!stickToBottom"
      class="jumpdown"
      :style="{ bottom: padBottom + 10 + 'px' }"
      title="Jump to the newest message and follow"
      @click="jumpToBottom"
    >▼</button>
    <div ref="slot" class="liveslot">
      <UserBubble v-if="liveTail" :utterance="liveTail" />
    </div>
  </div>
</template>

<style scoped>
.logroot {
  position: relative; /* anchors the .liveslot overlay */
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* fills the panel; ONLY .feed inside scrolls */
}
.feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
  padding-right: 4px;
}
.empty {
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-align: center;
  padding: 28px 0;
}
.liveslot {
  /* Overlay pinned to the bottom of the log: it renders over the feed's
     reserved bottom padding, so nothing reflows when a composition
     appears, grows, or vanishes — and scrolling has no dead strip. */
  position: absolute;
  left: 0;
  right: 4px; /* clear of the feed scrollbar */
  bottom: 0;
  display: flex;
  flex-direction: column;
}
.jumpdown {
  position: absolute;
  right: 28px; /* clear of the scrollbar with breathing room */
  z-index: 1;
  width: 28px;
  height: 28px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--cyan);
  background: rgba(4, 12, 20, 0.95);
  border: 1px solid var(--line-strong);
  cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
}
.jumpdown:hover { color: var(--cyan-hi); border-color: var(--cyan); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }

.liveslot :deep(.msg) {
  /* Solid backdrop: scrolled history may pass underneath. */
  background-color: rgba(4, 11, 19, 0.97);
}
</style>
