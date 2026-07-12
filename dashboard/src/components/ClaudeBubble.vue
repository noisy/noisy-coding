<script setup lang="ts">
import { computed } from "vue";
import type { Utterance } from "../types";
import Bubble from "./Bubble.vue";
import { formatCost, formatTime, statusChip } from "./bubbleStatus";

const props = defineProps<{ utterance: Utterance }>();
defineEmits<{ replay: [utterance: Utterance] }>();

const chip = computed(() => statusChip(props.utterance.status));
const pending = computed(() => !props.utterance.text);
// Replay only settled speech: a card mid-synthesis/playback re-queues on
// its own, and an errored one has nothing worth repeating verbatim.
const replayable = computed(() => chip.value.kind === "done" && !!props.utterance.text);
</script>

<template>
  <Bubble
    side="right"
    accent="violet"
    who="CLAUDE"
    :text="utterance.text || 'rendering voice response…'"
    :status-kind="chip.kind"
    :status-label="chip.label"
    :time="formatTime(utterance.started_at)"
    :cost="formatCost(utterance.cost_usd)"
    :detail="utterance.detail"
    :pending="pending"
    :replayable="replayable"
    @replay="$emit('replay', utterance)"
  />
</template>
