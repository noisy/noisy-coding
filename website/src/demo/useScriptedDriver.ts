/** The phase-1 driver behind TRY IT LIVE: a scripted conversation played
 *  through the CompanionDriver seam.
 *
 *  It implements the same contract the future useRealtimeDriver (Grok
 *  realtime session) will implement, so phase 2 swaps drivers without
 *  touching the section. It is also the permanent fallback when the live
 *  endpoint is down - see demo/live-demo-architecture.md.
 */
import { onBeforeUnmount, ref, type Ref } from "vue";
import type { CompanionDriver } from "@dashboard/composables/companionDriver";
import type { CompanionAgent, CompanionMessage } from "@dashboard/components/Companion.vue";

/* Voice names must come from voiceSprites.ts so portraits resolve. */
export const DEMO_VOICE = "eve";

interface Step {
  role: "user" | "claude";
  text: string;
  holdMs: number;   // pause before this step starts
  speakMs?: number; // user only: how long the live transcript runs
}
const SCRIPT: Step[] = [
  { role: "claude", holdMs: 600, text: "Hey - I'm the web demo of the noisy-coding companion. Talk to me like you'd talk to your agent." },
  { role: "user", holdMs: 1800, speakMs: 1400, text: "can you fix my code?" },
  { role: "claude", holdMs: 900, text: "Not from here - in this demo I have no Claude Code attached, so I can't touch a repo. I'm the voice layer only." },
  { role: "claude", holdMs: 2600, text: "In the real app this exact conversation drives a live Claude Code session - it fixes the bug while you talk." },
  { role: "user", holdMs: 2400, speakMs: 1500, text: "so what are you for, then?" },
  { role: "claude", holdMs: 900, text: "To let you feel the loop: speak, get an answer, keep working. When you like it, install the app and plug me into your terminal." },
];

/* Opening line when the floating widget spawns, and the beats the agent
 * answers with after the visitor actually speaks into their mic. The
 * "no Claude Code attached" moment is beat one - the first thing a real
 * visitor earns by talking. */
const GREETING =
  "Hey - I'm the noisy-coding companion. Your mic should be opening right now - say something: this is what your terminal sounds like with a voice.";
const BEATS = [
  "I hear you. In the real app that would have gone straight to Claude Code mid-task - here in the browser I have no agent attached, so I'm just listening.",
  "That's the whole loop: you talk, your agent keeps working. Download the app and this exact widget sits over your terminal.",
  "Still here - still no Claude Code on this page. The real one is a two-minute install, says the section above me.",
];

export interface ScriptedDriver extends CompanionDriver {
  started: Ref<boolean>;
  playing: Ref<boolean>;
  /** Play the full canned conversation (fallback when there is no mic). */
  start: () => void;
  /** Reset the thread to the spawn greeting (floating widget open). */
  greet: () => void;
  /** The visitor spoke into their real mic - answer with the next beat. */
  agentBeat: () => void;
  /** A finalized transcript phrase from the stopgap SpeechRecognition:
   *  commit it as a user bubble and answer with the next beat. */
  userSaid: (text: string) => void;
}

export interface ScriptedDriverOptions {
  /** Called for every agent line as its bubble appears; key is a stable
   *  per-line id (greet, beat-1.., script-1..) matching the demo-voice
   *  clip filenames. Wire the audible voice here. */
  onAgentLine?: (key: string, text: string) => void;
}

export function useScriptedDriver(options: ScriptedDriverOptions = {}): ScriptedDriver {
  const mode = ref<"idle" | "user" | "claude">("idle");
  const feed = ref<CompanionMessage[]>([]);
  const liveText = ref("");
  const level = ref(0);
  const activity = ref<string | null>(null);
  const agents = ref<CompanionAgent[]>([
    { name: "web-demo", voice: DEMO_VOICE, active: true },
  ]);

  const started = ref(false);
  const playing = ref(false);

  let timers: number[] = [];
  let jitter: number | undefined;
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  function clearAll() {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
    if (jitter) window.clearInterval(jitter);
    jitter = undefined;
  }
  onBeforeUnmount(clearAll);

  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pushMessage(role: "user" | "claude", text: string) {
    feed.value = [...feed.value, { id: feed.value.length + 1, role, text, zone: "done" }];
  }

  /** Agent bubble + the audible line (keyed to a demo-voice clip). */
  function say(key: string, text: string) {
    pushMessage("claude", text);
    options.onAgentLine?.(key, text);
  }

  /** Type the visitor's line into the live transcript word by word, with
   *  the mic spectrum jittering, then commit it as a bubble. */
  function speakAsUser(text: string, speakMs: number, done: () => void) {
    mode.value = "user";
    const words = text.split(" ");
    const perWord = speakMs / words.length;
    words.forEach((_, i) =>
      at(perWord * (i + 1), () => (liveText.value = words.slice(0, i + 1).join(" "))),
    );
    level.value = 0.4;
    jitter = window.setInterval(() => (level.value = 0.25 + Math.random() * 0.55), 140);
    at(speakMs + 250, () => {
      if (jitter) window.clearInterval(jitter);
      jitter = undefined;
      level.value = 0;
      pushMessage("user", liveText.value || text);
      liveText.value = "";
      done();
    });
  }

  function start() {
    if (playing.value) return;
    started.value = true;
    playing.value = true;
    feed.value = [];
    liveText.value = "";
    clearAll();

    if (reducedMotion()) {
      // No choreography: the whole conversation lands at once, readable.
      SCRIPT.forEach((s) => pushMessage(s.role, s.text));
      mode.value = "idle";
      playing.value = false;
      return;
    }

    let cursor = 0;
    const next = (i: number) => {
      if (i >= SCRIPT.length) {
        at(800, () => {
          mode.value = "idle";
          activity.value = null;
          playing.value = false;
        });
        return;
      }
      const s = SCRIPT[i];
      cursor += s.holdMs;
      if (s.role === "user") {
        at(cursor, () => speakAsUser(s.text, s.speakMs ?? 1400, () => next(i + 1)));
        cursor += (s.speakMs ?? 1400) + 250;
      } else {
        at(cursor, () => {
          mode.value = "claude";
          activity.value = null;
          say(`script-${i + 1}`, s.text);
        });
        next(i + 1);
      }
    };
    mode.value = "claude";
    activity.value = "connecting demo agent";
    at(500, () => (activity.value = null));
    next(0);
  }

  function greet() {
    clearAll();
    started.value = true;
    playing.value = false;
    beat = 0;
    feed.value = [];
    liveText.value = "";
    mode.value = "claude";
    say("greet", GREETING);
    at(1200, () => (mode.value = "idle"));
  }

  let beat = 0;
  function agentBeat() {
    if (playing.value) return;
    mode.value = "claude";
    const n = Math.min(beat, BEATS.length - 1);
    say(`beat-${n + 1}`, BEATS[n]);
    beat += 1;
    at(1400, () => (mode.value = "idle"));
  }

  function userSaid(text: string) {
    if (playing.value) return;
    liveText.value = "";
    pushMessage("user", text);
    agentBeat();
  }

  return { mode, feed, liveText, level, activity, agents, started, playing, start, greet, agentBeat, userSaid };
}
