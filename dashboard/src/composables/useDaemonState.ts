/** Poll the daemon's REST API into reactive state (legacy cadence: 400 ms). */

import { onMounted, onUnmounted, ref, type Ref } from "vue";
import {
  getCharacter, getEvents, getStatus, getUtterances, setActiveAgent, type DaemonEvent,
} from "../api/client";
import type { Character, DaemonStatus, Utterance } from "../types";

const ERROR_LOG_SIZE = 20;

export interface DaemonState {
  status: Ref<DaemonStatus | null>;
  utterances: Ref<Utterance[]>; // the viewed agent's slice
  allUtterances: Ref<Utterance[]>; // every agent — feeds unread badges
  character: Ref<Character | null>;
  offline: Ref<boolean>;
  viewedAgent: Ref<string | null>;
  errors: Ref<DaemonEvent[]>; // newest last, errors only
  selectAgent: (name: string) => void;
}

export function useDaemonState(pollMs = 400): DaemonState {
  const status = ref<DaemonStatus | null>(null);
  const utterances = ref<Utterance[]>([]);
  const allUtterances = ref<Utterance[]>([]);
  const character = ref<Character | null>(null);
  const offline = ref(false);
  const viewedAgent = ref<string | null>(null);
  const errors = ref<DaemonEvent[]>([]);
  let lastEventSeq = 0;

  // Like the legacy dashboard: follow the active agent until the user pins
  // a tab by clicking it.
  let pinned = false;

  async function tick() {
    try {
      const s = await getStatus();
      status.value = s;
      offline.value = false;
      if (!pinned) viewedAgent.value = s.active_agent;
      if (viewedAgent.value && !(viewedAgent.value in s.agents)) {
        viewedAgent.value = s.active_agent;
        pinned = false;
      }
      const agent = viewedAgent.value ?? undefined;
      // One unfiltered fetch serves both the viewed log and the unread
      // badges on background tabs.
      const all = await getUtterances();
      allUtterances.value = all;
      utterances.value = agent ? all.filter((u) => u.agent === agent) : all;
      character.value = await getCharacter(agent);
      // Surface system failures (STT/TTS errors) that otherwise die
      // silently in the daemon's event log.
      const fresh = await getEvents(lastEventSeq);
      if (fresh.length) {
        lastEventSeq = fresh[fresh.length - 1].seq;
        const failures = fresh.filter((e) => e.kind.endsWith("_error"));
        if (failures.length) {
          errors.value = [...errors.value, ...failures].slice(-ERROR_LOG_SIZE);
        }
      }
    } catch {
      offline.value = true;
    }
  }

  function selectAgent(name: string) {
    pinned = true;
    viewedAgent.value = name;
    setActiveAgent(name).catch(() => {});
  }

  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    tick();
    timer = setInterval(tick, pollMs);
  });
  onUnmounted(() => clearInterval(timer));

  return { status, utterances, allUtterances, character, offline, viewedAgent, errors, selectAgent };
}
