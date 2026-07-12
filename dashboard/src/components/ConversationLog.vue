<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { Utterance } from "../types";
import ClaudeBubble from "./ClaudeBubble.vue";
import UserBubble from "./UserBubble.vue";

const props = withDefaults(
  defineProps<{ utterances: Utterance[]; playingId?: number }>(),
  { playingId: 0 },
);
defineEmits<{ replay: [utterance: Utterance]; cancel: [utterance: Utterance] }>();

// Noise guard: utterances that never became real speech ("empty — no
// speech", "dropped — too short") would flood the log in a loud room and
// bury the actual conversation — hide them entirely. STT errors stay
// visible: that's real speech that got lost.
function isNoise(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("empty") || s.includes("dropped") || s.includes("cancelled");
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
    .filter((u) => !isNoise(u.status))
    .sort((a, b) => commitTime(a) - commitTime(b) || a.id - b.id),
);

// The in-progress user utterance renders in a RESERVED slot below the
// feed: it may still vanish (noise) or grow (live partials), and without
// its own space every appearance/disappearance shoves the whole log
// around. Once it settles into a real message it moves into the feed —
// visually the same spot.
function isLiveUser(u: Utterance): boolean {
  const s = u.status.toLowerCase();
  return u.role === "user" && (s.includes("recording") || s.includes("transcribing"));
}

const liveTail = computed(() => {
  const last = ordered.value[ordered.value.length - 1];
  return last && isLiveUser(last) ? last : null;
});

const settled = computed(() =>
  liveTail.value ? ordered.value.slice(0, -1) : ordered.value,
);

const feed = ref<HTMLElement | null>(null);

function scrollToBottom() {
  if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
}

// Scrolled to the newest message by default, and kept there as new ones land.
onMounted(scrollToBottom);
watch(
  () => {
    const last = ordered.value[ordered.value.length - 1];
    return last ? `${last.id}:${last.updated_at}` : "";
  },
  async () => {
    await nextTick();
    scrollToBottom();
  },
);
</script>

<template>
  <div class="logroot">
    <div ref="feed" class="feed">
      <template v-for="utterance in settled" :key="utterance.id">
        <UserBubble
          v-if="utterance.role === 'user'"
          :utterance="utterance"
          @cancel="$emit('cancel', $event)"
        />
        <ClaudeBubble
          v-else
          :utterance="utterance"
          :playing="utterance.id === playingId"
          @replay="$emit('replay', $event)"
        />
      </template>
      <p v-if="!ordered.length" class="empty">NO TRANSMISSIONS YET — START TALKING</p>
    </div>
    <div class="liveslot">
      <UserBubble v-if="liveTail" :utterance="liveTail" />
    </div>
  </div>
</template>

<style scoped>
.logroot {
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
  /* Reserved landing pad for the in-progress utterance: one full
     single-line bubble tall (head + text + foot ≈ 84px), so even a cough
     that appears and vanishes doesn't nudge the feed above. */
  min-height: 96px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
}
</style>
