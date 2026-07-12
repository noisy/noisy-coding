import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { DaemonState } from "./useDaemonState";
import { useDaemonState } from "./useDaemonState";

const STATUS = {
  active_agent: "agent-a",
  agents: { "agent-a": 1, "agent-b": 1 },
  queued: 0,
};

function jsonResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}

function mountComposable(pollMs = 400): { state: DaemonState; unmount: () => void } {
  let state!: DaemonState;
  const Host = defineComponent({
    setup() {
      state = useDaemonState(pollMs);
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { state, unmount: () => wrapper.unmount() };
}

async function flush() {
  // Let the chained awaits inside tick() settle (fetch → json → assignment,
  // three sequential requests deep).
  for (let i = 0; i < 24; i++) await Promise.resolve();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useDaemonState", () => {
  it("polls status, utterances and character for the viewed agent", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/status")) return jsonResponse(STATUS);
      if (url.startsWith("/utterances")) return jsonResponse({ utterances: [{ id: 1 }] });
      return jsonResponse({ character: { voice: "altair" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { state, unmount } = mountComposable();
    await flush();

    expect(state.status.value?.active_agent).toBe("agent-a");
    expect(state.viewedAgent.value).toBe("agent-a"); // follows active until pinned
    expect(state.utterances.value).toEqual([{ id: 1 }]);
    expect(state.character.value?.voice).toBe("altair");
    expect(state.offline.value).toBe(false);
    unmount();
  });

  it("flips offline when the daemon is unreachable and back when it answers", async () => {
    let failing = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (failing) throw new TypeError("fetch failed");
        if (url.startsWith("/status")) return jsonResponse(STATUS);
        if (url.startsWith("/utterances")) return jsonResponse({ utterances: [] });
        return jsonResponse({ character: {} });
      }),
    );

    const { state, unmount } = mountComposable();
    await flush();
    expect(state.offline.value).toBe(true);

    failing = false;
    await vi.advanceTimersByTimeAsync(400);
    await flush();
    expect(state.offline.value).toBe(false);
    unmount();
  });

  it("selectAgent pins the viewed agent and posts the switch", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/status")) return jsonResponse({ ...STATUS, active_agent: "agent-a" });
      if (url.startsWith("/utterances")) return jsonResponse({ utterances: [] });
      return jsonResponse({ character: {} });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { state, unmount } = mountComposable();
    await flush();
    state.selectAgent("agent-b");

    expect(state.viewedAgent.value).toBe("agent-b");
    expect(fetchMock).toHaveBeenCalledWith("/active-agent", {
      method: "POST",
      body: JSON.stringify({ name: "agent-b" }),
    });

    // Next poll keeps the pin even though active_agent is still agent-a.
    await vi.advanceTimersByTimeAsync(400);
    await flush();
    expect(state.viewedAgent.value).toBe("agent-b");
    unmount();
  });
});
