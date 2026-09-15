# Keyboard shortcut website mockup

Goal: implement the user's requested real-photo keyboard zoom with F16–F19 avatar overlays, in Storybook only.

Design: full keyboard, smooth zoom to numeric-keypad function keys, reveal four human portraits, highlight the selected conversation. Heading: Your agents. One key away. Compare animated and static assigned states. Place section below Crew in a contextual story. Reuse VoiceAvatar; no new animation dependency or daemon calls.

Implementation:
- Preserve the source photo and attribution; render a 2400px WebP derivative.
- Build KeyboardHotkeyDemo.vue with staged animation, manual selections, replay, reduced-motion and offscreen cleanup.
- Build HotkeySection.vue for responsive section typography and layout.
- Add standalone animation, complete section, reduced-motion/static, and below-Crew stories.
- Validate Storybook build and rendered desktop/mobile screenshots; verify replay and agent selection. Commit locally.

Asset: Apple iMac Keyboard A1243, Wiki637, CC BY 2.0. https://commons.wikimedia.org/wiki/File:Apple_iMac_Keyboard_A1243.png . Original preserved under tools/website-media/originals. Delivery conversion: cwebp -q 88 -resize 2400 0.
