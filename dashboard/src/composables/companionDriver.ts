import type { Ref } from "vue";
import type { CompanionAgent, CompanionMessage } from "../components/Companion.vue";

/** The seam between the Companion widget and whatever feeds it.
 *
 * Companion.vue is prop-driven and dumb; a driver owns the source of those
 * props. Today the glue in CompanionFloat/CompanionView (useDaemonState
 * polling + useMicStream) is the de-facto daemon driver; the marketing
 * site's scripted demo and the future Grok realtime browser session are
 * other drivers of the same shape. Swapping the conversation backend must
 * never touch the component - only which driver is handed to it.
 *
 * Contract notes:
 * - feed entries need monotonic stable ids (Companion keys bubbles by id),
 *   and a finalized turn gets zone "done".
 * - a driver with no multi-agent story returns agents [] and the rail
 *   simply shows the one active voice.
 */
export interface CompanionDriver {
  mode: Ref<"idle" | "user" | "claude">;
  feed: Ref<CompanionMessage[]>;
  liveText: Ref<string>;
  level: Ref<number>;
  activity: Ref<string | null>;
  agents: Ref<CompanionAgent[]>;
}
