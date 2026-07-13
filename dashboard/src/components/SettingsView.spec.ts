import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SettingsView from "./SettingsView.vue";

describe("SettingsView", () => {
  it("shows the key status and the pricing/link guidance", () => {
    const wrapper = mount(SettingsView, { props: { apiKeyHint: "····kRc9" } });

    expect(wrapper.find(".keyhint").text()).toBe("SET ····kRc9");
    expect(wrapper.text()).toContain("$0.10 per hour of audio");
    const links = wrapper.findAll("a").map((a) => a.attributes("href"));
    expect(links).toContain("https://console.x.ai");
    expect(links).toContain("https://x.ai/api");
  });

  it("emits save with the entered key and hides the input again", async () => {
    const wrapper = mount(SettingsView, { props: { apiKeyHint: "····kRc9" } });

    await wrapper.find(".btn").trigger("click"); // REPLACE
    await wrapper.find(".keyinput").setValue("xai-new-key-123");
    await wrapper.find(".keyinput").trigger("keyup.enter");

    expect(wrapper.emitted("save")).toEqual([["xai-new-key-123"]]);
    expect(wrapper.find(".keyinput").exists()).toBe(false);
  });

  it("rejects obviously-not-a-key input without emitting", async () => {
    const wrapper = mount(SettingsView, { props: { apiKeyHint: "" } });

    await wrapper.find(".btn").trigger("click");
    await wrapper.find(".keyinput").setValue("abc");
    await wrapper.find(".keyinput").trigger("keyup.enter");

    expect(wrapper.emitted("save")).toBeUndefined();
  });
});
