import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import VoiceSelector from "./VoiceSelector.vue";

describe("VoiceSelector", () => {
  it("shows the current voice uppercase with its gender", () => {
    const wrapper = mount(VoiceSelector, { props: { voice: "altair" } });

    expect(wrapper.find(".vname").text()).toBe("ALTAIR");
    expect(wrapper.find(".vg").text()).toBe("MALE");
    expect(wrapper.find(".voicegrid").exists()).toBe(false); // collapsed
  });

  it("picking a voice from the grid emits it and closes the grid", async () => {
    const wrapper = mount(VoiceSelector, { props: { voice: "altair" } });

    await wrapper.find(".voicecur").trigger("click");
    const rex = wrapper.findAll(".voicegrid b").find((b) => b.text() === "REX")!;
    await rex.trigger("click");

    expect(wrapper.emitted("change")).toEqual([["rex"]]);
    expect(wrapper.find(".voicegrid").exists()).toBe(false); // grid closes
  });

  it("re-picking the current voice closes without emitting", async () => {
    const wrapper = mount(VoiceSelector, { props: { voice: "rex" } });

    await wrapper.find(".voicecur").trigger("click");
    const rex = wrapper.findAll(".voicegrid b").find((b) => b.text() === "REX")!;
    await rex.trigger("click");

    expect(wrapper.emitted("change")).toBeUndefined();
  });
});
