/** Poll the daemon's REST API into reactive state (legacy cadence: 400 ms). */

import { onMounted, onUnmounted, ref, type Ref } from "vue";
import { getCharacter, getStatus, getUtterances, setActiveAgent } from "../api/client";
import type { Character, DaemonStatus, Utterance } from "../types";

export interface DaemonState {
  status: Ref<DaemonStatus | null>;
  utterances: Ref<Utterance[]>;
  character: Ref<Character | null>;
  offline: Ref<boolean>;
  viewedAgent: Ref<string | null>;
  selectAgent: (name: string) => void;
}

export function useDaemonState(pollMs = 400): DaemonState {
  const status = ref<DaemonStatus | null>(null);
  const utterances = ref<Utterance[]>([]);
  const character = ref<Character | null>(null);
  const offline = ref(false);
  const viewedAgent = ref<string | null>(null);

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
      utterances.value = await getUtterances(agent);
      character.value = await getCharacter(agent);
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

  return { status, utterances, character, offline, viewedAgent, selectAgent };
}
