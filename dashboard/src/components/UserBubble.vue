<script setup lang="ts">
import { computed } from "vue";
import type { Utterance } from "../types";
import Bubble from "./Bubble.vue";
import { formatCost, formatTime, statusChip } from "./bubbleStatus";

const props = defineProps<{ utterance: Utterance }>();
defineEmits<{ cancel: [utterance: Utterance] }>();

const chip = computed(() => statusChip(props.utterance.status));
const pending = computed(() => !props.utterance.text);
// Recall is possible only while the transcript still waits in the queue.
const cancelable = computed(() => props.utterance.status.includes("ready"));
</script>

<template>
  <Bubble
    side="left"
    accent="amber"
    who="YOU"
    :text="utterance.text || utterance.status"
    :status-kind="chip.kind"
    :status-label="chip.label"
    :time="formatTime(utterance.started_at)"
    :cost="formatCost(utterance.cost_usd)"
    :detail="utterance.detail"
    :live="chip.kind === 'rec'"
    :pending="pending"
    :cancelable="cancelable"
    @cancel="$emit('cancel', utterance)"
  />
</template>
