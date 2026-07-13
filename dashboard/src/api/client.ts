/** Typed client for the listener daemon — the app's only fetch site.
 *
 * All URLs are relative: same-origin when the daemon serves the built app
 * at /next, proxied by Vite in development (see vite.config.ts).
 */

import type { Character, DaemonStatus, SettingsPatch, Utterance } from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`GET ${path} → HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function post(path: string, body: object): Promise<void> {
  const response = await fetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POST ${path} → HTTP ${response.status}`);
}

export function getStatus(): Promise<DaemonStatus> {
  return getJson<DaemonStatus>("/status");
}

export async function getUtterances(agent?: string): Promise<Utterance[]> {
  const query = agent ? `?agent=${encodeURIComponent(agent)}` : "";
  const body = await getJson<{ utterances: Utterance[] }>(`/utterances${query}`);
  return body.utterances;
}

export async function getCharacter(agent?: string): Promise<Character> {
  const query = agent ? `?agent=${encodeURIComponent(agent)}` : "";
  const body = await getJson<{ character: Character }>(`/character${query}`);
  return body.character;
}

export function setMuted(muted: boolean): Promise<void> {
  return post("/mute", { muted });
}

/** Speaker-side mute: Claude's speech parks silently as UNHEARD cards. */
export function setVoiceMuted(muted: boolean): Promise<void> {
  return post("/voice-mute", { muted });
}

export function saveApiKey(key: string): Promise<void> {
  return post("/credentials", { xai_api_key: key });
}

export function setMode(mode: "batch" | "live"): Promise<void> {
  return post("/mode", { mode });
}

export function setSettings(patch: SettingsPatch): Promise<void> {
  return post("/settings", patch);
}

export function setActiveAgent(name: string): Promise<void> {
  return post("/active-agent", { name });
}

export function setCharacter(patch: Partial<Character> & { agent?: string }): Promise<void> {
  return post("/character", patch);
}

/** Renew (held=true) or release (held=false) the push-to-talk lease. */
export function setPtt(held: boolean): Promise<void> {
  return post("/ptt", { held });
}

/** Recall a transcript that still waits in the queue (AWAITING CLAUDE). */
export function cancelTranscript(utteranceId: number): Promise<void> {
  return post("/cancel", { utterance_id: utteranceId });
}

/** Replay a spoken message: no new card in the log, the user's click
 * outranks whatever is playing, and source_id ties the playback back to
 * the original bubble (so it can offer STOP while playing). */
export function speakText(text: string, sourceId: number, agent?: string): Promise<void> {
  return post("/speak", {
    text,
    wait: false,
    card: false,
    interrupt: true,
    source_id: sourceId,
    ...(agent ? { agent } : {}),
  });
}

/** Stop whatever is on the speakers; queued speech continues on its own. */
export function stopPlayback(): Promise<void> {
  return post("/interrupt", {});
}
