<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useConversationFeed } from "../composables/useConversationFeed";
import type { Utterance } from "../types";
import ActivityLine from "./ActivityLine.vue";
import FeedRow from "./FeedRow.vue";
import UserBubble from "./UserBubble.vue";

const props = withDefaults(
  defineProps<{
    utterances: Utterance[];
    /** speaker -> palette color, straight from status.speaker_colors. */
    speakerColors?: Record<string, string>;
    /** speaker -> free bubble title, straight from status.speaker_labels. */
    speakerLabels?: Record<string, string>;
    playingId?: number;
    playbackPaused?: boolean;
    activity?: { text: string; at: number } | null;
  }>(),
  { playingId: 0, playbackPaused: false, activity: null },
);
defineEmits<{
  replay: [utterance: Utterance];
  cancel: [utterance: Utterance];
  pause: [utterance: Utterance];
  skip: [utterance: Utterance];
}>();

// One feed logic for every surface - see useConversationFeed.ts. The
// widget consumes the same composable; only styling may differ.
const utterancesRef = computed(() => props.utterances);
const { ordered, liveTail, settled, processed, pending } =
  useConversationFeed(utterancesRef);

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
        :tint="(speakerColors?.[utterance.speaker ?? ''] as 'normal'|'green'|'purple'|'red') ?? 'green'"
        :label="speakerLabels?.[utterance.speaker ?? ''] ?? ''"
        :key="utterance.id"
        :utterance="utterance"
        :playing="utterance.id === playingId"
        :paused="playbackPaused"
        @replay="$emit('replay', $event)"
        @cancel="$emit('cancel', $event)"
        @pause="$emit('pause', $event)"
        @skip="$emit('skip', $event)"
      />
      <!-- The processed line: everything above already happened, everything
           below still waits its turn. -->
      <ActivityLine :activity="activity" :playing-card-visible="playingCardVisible" />
      <FeedRow
        v-for="utterance in pending"
        :tint="(speakerColors?.[utterance.speaker ?? ''] as 'normal'|'green'|'purple'|'red') ?? 'green'"
        :label="speakerLabels?.[utterance.speaker ?? ''] ?? ''"
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
