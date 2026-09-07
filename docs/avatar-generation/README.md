# Voice avatar families

Six generated families cover the complete 28-voice `SUBAGENT_VOICE_POOL` in `src/noisy_coding/listener/http_api.py`:

- A / `editorial`: illustrated people
- B / `matte`: softly sculpted people
- C / `painted`: painted people
- D / `mineral`: mineral forms
- E / `animals`: distinctive animal portraits
- F / `blobs`: expressive blobs with eyes

The coverage audit includes [issue #44](https://github.com/noisy/noisy-coding/issues/44): Aurora and Liora were in the backend pool but absent from the frontend voice picker and old sprite mapping. Both are included in every new family. The pool and frontend catalog must match; `catalog.spec.ts` checks this independently of the hand-maintained artwork order. Other provider-specific or future unknown voices display a readable monogram and a development warning instead of disappearing.

## Assets and exact generation input

These images were generated with the built-in `image_gen` tool, not the fallback API/CLI. The exact prompt submitted for each production sheet is saved verbatim in `prompts/<set>.txt`. Generation does not guarantee pixel-identical results on a later run; use the accepted sheet as a visual reference when extending it.

The production PNGs live in `dashboard/src/assets/voice-avatars/`. Each sheet uses six columns and five rows. Cell indices are **zero-based**, row-major; the canonical ordering is `dashboard/src/avatars/voice-order.json`. Aurora and Liora occupy cells 26 and 27. Cells 28 and 29 are spare. Do not alphabetically reorder the artwork manifest: that would silently give existing voices different identities.

`VoiceAvatar.vue` clips the selected cell in CSS. Actual row boundaries are recorded in `dashboard/src/avatars/crop-metadata.json` because generated grids are not pixel-perfect. Re-measure those boundaries when an atlas changes, then inspect every row for adjacent-art bleed. It retains the original generated image, including any alpha, without destructive cropping. The same component is used by the dashboard, voice picker, conversation bubbles and companion. The selected family is saved in `noisy-coding.avatar-set` in localStorage, shared across same-origin windows. It is a device/browser preference, not an account preference. Separate origins have separate preferences. The generated sheets are explicit Vite assets, so `/next/` deployments and the website resolve them correctly.

## Adding another voice

1. Confirm the new voice ID and metadata in the backend pool or provider. Update the frontend voice list too.
2. Append the voice ID to the manifest; never change an existing voice's index. Write a distinctive profile or silhouette specification. Preserve the same identity across the three human styles, and a distinctive mineral, animal and blob identity for the three non-human styles.
3. For each of the six styles, use its exact saved prompt and accepted sheet as the reference. Generate/edit **only the next spare cell**, preserving all existing cells and the six-by-five grid. Save that complete edit prompt under `prompts/updates/` with the voice ID and date; do not overwrite the original prompt history.
4. If the grid is full, create a versioned atlas and explicitly migrate the grid metadata; do not squeeze in a new row without updating the renderer and testing every existing assignment.
5. Inspect the avatar at 44, 72 and 96 px in Storybook's Product / Voice avatars / All sets, check gender/profile where applicable, cell boundaries, dark-background contrast and distinction from neighboring voices. Review Aurora/Liora and the last row as well as the first row.
6. Run the coverage, fallback and preference tests plus dashboard/Storybook/website builds. Test switching families, reloading, cross-window synchronization and a missing image. Commit the asset, exact prompt and mapping together.

## Review

Use Settings → Appearance to choose a family, or the Storybook All sets and Choose set stories to compare them. Names remain visible in the voice picker; artwork is an identity cue, not the only accessible label. Unknown voices and failed image loads retain their monogram fallback.
