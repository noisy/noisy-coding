# Accent palettes implementation plan

Goal: Compare Amber, Blue, Teal, Mint, Lavender and Rose in Storybook using shared app/website tokens.
Architecture: CSS palette attributes override semantic accent shades. Legacy amber variables alias the shared accent for compatibility. Storybook applies a global selection; website dev preview accepts the same selection. No daemon settings or publishing.
Tech stack: Vue, CSS custom properties, Storybook, Vite.

- [x] Add six palettes and semantic text/hover/surface/border shades; migrate fixed user bubble and website accent shades. Preserve neutral surfaces and status colors. Check builds and commit.
- [x] Add global Storybook palette control, comparison story and live website preview; inspect rendered Amber and alternate palettes, run relevant tests/typecheck and commit.
