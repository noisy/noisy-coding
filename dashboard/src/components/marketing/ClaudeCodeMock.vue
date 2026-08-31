<script setup lang="ts">
/* A mock Claude Code session in a macOS terminal window.
 *
 * Marketing prop only - nothing here is wired to anything. The transcript
 * is invented but shaped like a real session: a prompt, a few tool calls,
 * a short summary, a green test result. Tweak the TRANSCRIPT array to
 * change the scene.
 */
withDefaults(
  defineProps<{
    title?: string;
    /** Fill the parent completely - no radius or shadow of its own - so the
     *  terminal reads as the maximized window a shot is composed over. */
    fullBleed?: boolean;
    /** Startup art: the mascot alone (like a fresh session today) or the
     *  mascot plus the block-letter banner. */
    banner?: "mascot" | "both";
  }>(),
  { title: "claude - orderflow-api", fullBleed: false, banner: "mascot" },
);

// The little orange creature from the current startup screen.
const MASCOT = [
  " ▐▛███▜▌",
  "▝▜█████▛▘",
  "  ▘▘ ▝▝",
].join("\n");

// The first-run banner, like a fresh `claude` session.
const BANNER = [
  " ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗   ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝  ██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "██║     ██║     ███████║██║   ██║██║  ██║█████╗    ██║     ██║   ██║██║  ██║█████╗  ",
  "██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝    ██║     ██║   ██║██║  ██║██╔══╝  ",
  "╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗  ╚██████╗╚██████╔╝██████╔╝███████╗",
  " ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
].join("\n");

type Line =
  | { kind: "prompt"; text: string }
  | { kind: "tool"; tool: string; arg: string }
  | { kind: "detail"; text: string }
  | { kind: "text"; text: string }
  | { kind: "pass"; text: string }
  | { kind: "cursor" };

const TRANSCRIPT: Line[] = [
  { kind: "prompt", text: "the webhook retries forever when the signature check fails - fix it and prove it with a test" },
  { kind: "text", text: "A bad signature is a permanent failure, so retrying is wrong. I will make the handler drop the delivery and log it, then add a regression test." },
  { kind: "tool", tool: "Read", arg: "src/webhooks/handler.ts" },
  { kind: "tool", tool: "Edit", arg: "src/webhooks/handler.ts" },
  { kind: "detail", text: "raise NonRetryable on signature mismatch instead of returning 500" },
  { kind: "tool", tool: "Write", arg: "src/webhooks/handler.test.ts" },
  { kind: "tool", tool: "Bash", arg: "npm test -- handler" },
  { kind: "pass", text: "Tests: 2 passed, 0 failed (1.4s)" },
  { kind: "text", text: "Done. Bad signatures now return 401 and are never retried; valid deliveries are untouched. The new test covers both paths." },
  { kind: "cursor" },
];
</script>

<template>
  <div class="ccwin" :class="{ fullbleed: fullBleed }">
    <div class="ccbar">
      <span class="dot red" /><span class="dot yellow" /><span class="dot green" />
      <span class="cctitle">{{ title }}</span>
    </div>
    <div class="ccbody">
      <pre v-if="banner === 'both'" class="ccbanner">{{ BANNER }}</pre>
      <div class="cchello">
        <pre class="ccmascot">{{ MASCOT }}</pre>
        <div>
          <div class="ccline ccwelcome">Welcome back to Claude Code!</div>
          <div class="ccline ccdetail">cwd: ~/projects/orderflow-api</div>
        </div>
      </div>
      <div class="ccgap" />
      <template v-for="(line, i) in TRANSCRIPT" :key="i">
        <div v-if="line.kind === 'prompt'" class="ccline ccprompt">
          <span class="ccmark">&gt;</span> {{ line.text }}
        </div>
        <div v-else-if="line.kind === 'tool'" class="ccline cctool">
          <span class="ccbullet">*</span> {{ line.tool }}(<span class="ccarg">{{ line.arg }}</span>)
        </div>
        <div v-else-if="line.kind === 'detail'" class="ccline ccdetail">{{ line.text }}</div>
        <div v-else-if="line.kind === 'pass'" class="ccline ccpass">{{ line.text }}</div>
        <div v-else-if="line.kind === 'text'" class="ccline cctext">{{ line.text }}</div>
        <div v-else class="ccline ccprompt"><span class="ccmark">&gt;</span> <span class="cccursor" /></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ccwin {
  background: #16181f;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.ccbar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: #23262f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }
.cctitle {
  flex: 1; text-align: center; font-size: 12px; color: #9aa0ae;
  /* Balance the traffic lights so the title sits truly centered. */
  margin-right: 44px;
}
.ccwin.fullbleed {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
}
.ccwin.fullbleed .ccbody { flex: 1; overflow: hidden; }
/* Transcript hugs the left; the right side stays clear for the widget. */
.ccwin.fullbleed .ccbody > * { max-width: 58%; }
.ccbody { padding: 18px 22px 22px; font-size: 13px; line-height: 1.85; }
.ccbanner {
  font-family: inherit; font-size: 9px; line-height: 1.25;
  color: #d97757; margin: 4px 0 10px; white-space: pre;
}
.cchello { display: flex; align-items: center; gap: 14px; margin: 2px 0 6px; }
.ccmascot {
  font-family: inherit; font-size: 13px; line-height: 1.15;
  color: #d97757; white-space: pre;
}
.ccwelcome { color: #e6e8ee; }
.ccgap { height: 14px; }
.ccline { white-space: pre-wrap; }
.ccprompt { color: #e6e8ee; }
.ccmark { color: #7d8496; }
.cctext { color: #b8bdc9; margin: 6px 0; }
.cctool { color: #d5d9e2; }
.ccbullet { color: #d97757; }
.ccarg { color: #8ab4f8; }
.ccdetail { color: #7d8496; padding-left: 18px; font-size: 12px; }
.ccpass { color: #4ddf8b; }
.cccursor {
  display: inline-block; width: 8px; height: 15px;
  background: #e6e8ee; vertical-align: text-bottom;
}
</style>
