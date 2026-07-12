import { afterEach, describe, expect, it, vi } from "vitest";
import { getCharacter, getStatus, getUtterances, setMode, setMuted } from "./client";

function stubFetch(json: unknown) {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(json) });
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("getStatus fetches /status and returns the parsed body", async () => {
    const mock = stubFetch({ listening: true, queued: 2 });

    const status = await getStatus();

    expect(mock).toHaveBeenCalledWith("/status");
    expect(status.queued).toBe(2);
  });

  it("getUtterances scopes to the agent and unwraps the list", async () => {
    const mock = stubFetch({ utterances: [{ id: 1 }] });

    const utterances = await getUtterances("agent a");

    expect(mock).toHaveBeenCalledWith("/utterances?agent=agent%20a");
    expect(utterances).toEqual([{ id: 1 }]);
  });

  it("getCharacter unwraps the character object", async () => {
    stubFetch({ character: { voice: "altair", speed: 1.1 } });

    const character = await getCharacter();

    expect(character.voice).toBe("altair");
  });

  it("setMuted POSTs the muted flag to /mute", async () => {
    const mock = stubFetch({ muted: true });

    await setMuted(true);

    expect(mock).toHaveBeenCalledWith("/mute", {
      method: "POST",
      body: JSON.stringify({ muted: true }),
    });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(setMode("live")).rejects.toThrow("HTTP 500");
  });
});
