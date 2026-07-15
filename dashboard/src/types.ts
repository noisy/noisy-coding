/** Shapes of the listener daemon's HTTP API responses. */

export interface DaemonStatus {
  listening: boolean;
  muted: boolean;
  voice_muted: boolean;
  api_key_set: boolean;
  api_key_hint: string;
  stt_latency_ms: number | null;
  tts_latency_ms: number | null;
  recording: boolean;
  claude_speaking: boolean;
  playing_utterance_id: number;
  speaking_agents: string[];
  queued: number;
  session_cost_usd: { user: number; claude: number };
  usage: { stt_seconds: number; tts_chars: number };
  credits_usd: number | null;
  mode: "batch" | "live";
  tts_mode: "batch" | "live";
  end_silence_ms: number;
  /** Noise gate: 0 (needs a loud voice) … 100 (hair-trigger); 50 = default. */
  mic_sensitivity: number;
  smart_turn: number;
  smart_turn_mode: "soft" | "hard";
  detection_mode: "auto" | "ptt";
  ptt_held: boolean;
  input_device: string;
  /** Where Claude's voice plays: system speakers or the browser tab. */
  output_device: "system" | "browser";
  /** A browser tab currently holds the audio lease (WS bridge). */
  tab_audio: boolean;
  /** Live per-endpoint xAI check results — partial while checks run. */
  diagnostic_checks?: Record<string, { ok?: boolean; ms?: number; detail?: string; pending?: boolean }> | null;
  activity: Record<string, { text: string; at: number }>;
  language: string;
  agents: Record<string, number>;
  agent_labels: Record<string, string>;
  active_agent: string | null;
}

export interface Utterance {
  id: number;
  role: "user" | "claude" | "system";
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
  mic_sensitivity?: number;
  smart_turn?: number;
  smart_turn_mode?: "soft" | "hard";
  detection_mode?: "auto" | "ptt";
  input_device?: string;
  output_device?: "system" | "browser";
  language?: string;
}

export interface InputDevice {
  name: string;
  default: boolean;
  /** Wire value when it differs from the display name (virtual devices:
   * "THIS BROWSER TAB" → "browser"). */
  value?: string;
}
