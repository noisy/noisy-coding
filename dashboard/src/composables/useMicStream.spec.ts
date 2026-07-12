import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type Ref } from "vue";
import { useMicStream } from "./useMicStream";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

function mountStream() {
  let level!: Ref<number>;
  let recording!: Ref<boolean>;
  const Host = defineComponent({
    setup() {
      ({ level, recording } = useMicStream());
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { level: () => level.value, recording: () => recording.value, wrapper };
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("useMicStream", () => {
  it("subscribes to /stream/mic and tracks level and recording", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const { level, recording } = mountStream();

    const source = FakeEventSource.instances[0];
    expect(source.url).toBe("/stream/mic");
    source.onmessage!({ data: JSON.stringify({ level: 0.42, recording: true }) });

    expect(level()).toBeCloseTo(0.42);
    expect(recording()).toBe(true);
  });

  it("falls back to silence on stream errors and closes on unmount", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const { level, wrapper } = mountStream();
    const source = FakeEventSource.instances[0];

    source.onmessage!({ data: JSON.stringify({ level: 0.8 }) });
    source.onerror!();
    expect(level()).toBe(0);

    wrapper.unmount();
    expect(source.closed).toBe(true);
  });
});
