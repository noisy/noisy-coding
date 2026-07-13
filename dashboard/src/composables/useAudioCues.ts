/** Subtle audio cues on conversation events, with localStorage-backed
 * preferences (they are a per-browser matter, not daemon state). */

import { computed, ref, watch, type Ref } from "vue";
import type { DaemonStatus, Utterance } from "../types";
import { detectCues, snapshotUtterances, type CueName } from "./cueEvents";
import { playCue } from "./cueSounds";

const STORAGE_KEY = "noisy-coding.audio-cues";

export interface CuePrefs {
  enabled: boolean;
  cues: Record<CueName, boolean>;
}

export const CUE_LABELS: Record<CueName, string> = {
  committed: "YOUR MESSAGE TRANSCRIBED",
  delivered: "DELIVERED TO CLAUDE",
  claude: "CLAUDE'S MESSAGE ARRIVED",
  unheard: "PARKED WHILE MUTED",
  error: "SYSTEM ERROR",
};

function defaultPrefs(): CuePrefs {
  return {
    enabled: false, // opt-in — sounds are a taste, not a default
    cues: { committed: true, delivered: true, claude: true, unheard: true, error: true },
  };
}

function loadPrefs(): CuePrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    return { ...defaultPrefs(), ...stored, cues: { ...defaultPrefs().cues, ...stored.cues } };
  } catch {
    return defaultPrefs();
  }
}

export function useAudioCues(
  utterances: Ref<Utterance[]>,
  status: Ref<DaemonStatus | null>,
  errorCount: Ref<number>,
) {
  const prefs = ref<CuePrefs>(loadPrefs());
  watch(
    prefs,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // storage may be unavailable — cues just won't persist
      }
    },
    { deep: true },
  );

  function play(cue: CueName) {
    if (prefs.value.enabled && prefs.value.cues[cue]) playCue(cue);
  }

  let previous = snapshotUtterances([]);
  watch(utterances, (list) => {
    const cues = detectCues(previous, list, status.value?.voice_muted ?? false);
    previous = snapshotUtterances(list);
    cues.forEach(play);
  });

  watch(errorCount, (next, before) => {
    if (next > before) play("error");
  });

  const enabled = computed({
    get: () => prefs.value.enabled,
    set: (value: boolean) => {
      prefs.value.enabled = value;
      if (value) playCue("delivered"); // audible confirmation + unlocks WebAudio
    },
  });

  return { prefs, enabled };
}
