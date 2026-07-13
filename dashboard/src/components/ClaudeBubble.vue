<script setup lang="ts">
import { computed } from "vue";
import { statusAllows } from "../machines/chat";
import type { Utterance } from "../types";
import Bubble from "./Bubble.vue";
import { formatCost, formatTime, statusChip } from "./bubbleStatus";

const props = withDefaults(
  defineProps<{ utterance: Utterance; playing?: boolean }>(),
  { playing: false },
);
defineEmits<{ replay: [utterance: Utterance] }>();

const chip = computed(() => statusChip(props.utterance.status, "claude"));
const pending = computed(() => !props.utterance.text);
// Replay = re-entering synthesis; the machine knows which cards allow that
// (played or parked UNHEARD — mid-synthesis re-queues on its own, an
// errored card has nothing worth repeating).
const replayable = computed(
  () => statusAllows("claude", props.utterance.status, "SYNTHESIZE") && !!props.utterance.text,
);
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
    :playing="playing"
    @replay="$emit('replay', utterance)"
  />
</template>
