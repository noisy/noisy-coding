# Keyboard photograph

`apple-keyboard-a1243.png`: Apple iMac Keyboard A1243 by Wiki637, https://commons.wikimedia.org/wiki/File:Apple_iMac_Keyboard_A1243.png , licensed CC BY 2.0 https://creativecommons.org/licenses/by/2.0/ .

Original remains unchanged. Website derivative: `cwebp -quiet -q 88 -resize 2400 0 tools/website-media/originals/apple-keyboard-a1243.png -o website/src/assets/optimized/apple-keyboard.webp`.

The preview scales/crops the photograph with CSS and overlays illustrated avatars. Retain attribution and license when publishing. This photo is prototype artwork; the map background is part of the original photograph.

# Current prototype: Apple Magic Keyboard MQ052

User-provided product photograph, source: https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/MQ052?wid=2000&hei=2000&fmt=jpeg&qlt=95

`apple-magic-keyboard-mq052.jpg` is the untouched 2000 × 2000 original. Apple product imagery, not the CC-licensed Wiki637 photo above.

Delivery copy: `cwebp -quiet -q 90 -crop 0 720 2000 560 tools/website-media/originals/apple-magic-keyboard-mq052.jpg -o website/src/assets/optimized/apple-magic-keyboard.webp`. The crop removes the large blank margins.

F16–F19 centers on that crop: (1667, 60), (1757, 60), (1847, 60), (1937, 60). Key outlines are approximately 80 × 78px. Portrait overlays are 82 × 80px in source coordinates, including a 1px bleed per edge to hide antialiasing at high zoom. Their 10% corner radius follows the keycaps; this slight stretch is local to the synthetic screenshot. Keep image and overlays in one transformed plane.
