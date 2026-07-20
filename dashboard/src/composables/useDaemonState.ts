/** Poll the daemon's REST API into reactive state (legacy cadence: 400 ms). */

import { onMounted, onUnmounted, ref, type Ref } from "vue";
import {
  getCharacter, getEvents, getStatus, getUtterances, setActiveAgent, dismissAgent as apiDismissAgent, type DaemonEvent,
} from "../api/client";
import { validStatusChange } from "../machines/chat";
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
  dismissAgent: (name: string) => void;
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

  // Assumption detector: every observed status change must be a path in
  // the chat machine (see machines/chat.ts). A change the model can't
  // explain means the daemon and the model disagree — surface it in the
  // error ticker instead of silently rendering nonsense. Keyed by
  // id:started_at because a daemon restart reuses ids from 1.
  const lastStatuses = new Map<string, string>();
  let violationSeq = 0;
  function auditTransitions(all: Utterance[]) {
    for (const u of all) {
      if (u.role !== "user" && u.role !== "claude") continue;
      const key = `${u.id}:${u.started_at}`;
      const prev = lastStatuses.get(key);
      lastStatuses.set(key, u.status);
      if (prev === undefined || prev === u.status) continue;
      if (validStatusChange(u.role, prev, u.status)) continue;
      const detail = `#${u.id} ${u.role}: "${prev}" → "${u.status}"`;
      console.warn(`[chat-machine] unexpected transition ${detail}`);
      errors.value = [
        ...errors.value,
        { seq: --violationSeq, ts: Date.now() / 1000, kind: "machine_violation", detail },
      ].slice(-ERROR_LOG_SIZE);
    }
  }

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
      auditTransitions(all);
      allUtterances.value = all;
      // System rows (mic switched, …) belong to every tab's timeline.
      utterances.value = agent
        ? all.filter((u) => u.agent === agent || u.role === "system")
        : all;
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

  function dismissAgent(name: string) {
    if (viewedAgent.value === name) viewedAgent.value = null;
    apiDismissAgent(name)
      .catch(() => {})
      .finally(() => tick());
  }

  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    tick();
    timer = setInterval(tick, pollMs);
  });
  onUnmounted(() => clearInterval(timer));

  return { status, utterances, allUtterances, character, offline, viewedAgent, errors, selectAgent, dismissAgent };
}
