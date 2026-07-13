/** Shapes of the listener daemon's HTTP API responses. */

export interface DaemonStatus {
  listening: boolean;
  muted: boolean;
  voice_muted: boolean;
  api_key_set: boolean;
  api_key_hint: string;
  recording: boolean;
  claude_speaking: boolean;
  playing_utterance_id: number;
  speaking_agents: string[];
  queued: number;
  session_cost_usd: { user: number; claude: number };
  credits_usd: number | null;
  mode: "batch" | "live";
  tts_mode: "batch" | "live";
  end_silence_ms: number;
  smart_turn: number;
  smart_turn_mode: "soft" | "hard";
  detection_mode: "auto" | "ptt";
  ptt_held: boolean;
  language: string;
  agents: Record<string, number>;
  agent_labels: Record<string, string>;
  active_agent: string | null;
}

export interface Utterance {
  id: number;
  role: "user" | "claude";
  status: string;
  text: string;
  detail: string;
  cost_usd: number;
  agent: string | null;
  started_at: number;
  updated_at: number;
  /** When the message entered the conversation (0 = still composing). */
  committed_at: number;
  /** Real audio duration in seconds (absent for older/mid-flight cards). */
  duration_s?: number;
}

export interface Character {
  humor: number;
  honesty: number;
  brevity: number;
  chatty: number;
  voice: string;
  speed: number;
}

export interface SettingsPatch {
  tts_mode?: "batch" | "live";
  end_silence_ms?: number;
  smart_turn?: number;
  smart_turn_mode?: "soft" | "hard";
  detection_mode?: "auto" | "ptt";
  language?: string;
}
