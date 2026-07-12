<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { Utterance } from "../types";
import ClaudeBubble from "./ClaudeBubble.vue";
import UserBubble from "./UserBubble.vue";

const props = defineProps<{ utterances: Utterance[] }>();

// Oldest first — the newest message lands at the BOTTOM, like a chat.
const ordered = computed(() => [...props.utterances].sort((a, b) => a.id - b.id));

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
  <div ref="feed" class="feed">
    <template v-for="utterance in ordered" :key="utterance.id">
      <UserBubble v-if="utterance.role === 'user'" :utterance="utterance" />
      <ClaudeBubble v-else :utterance="utterance" />
    </template>
    <p v-if="!ordered.length" class="empty">NO TRANSMISSIONS YET — START TALKING</p>
  </div>
</template>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 62vh;
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
</style>
