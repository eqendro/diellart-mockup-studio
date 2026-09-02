# Scene Engine calibration audit

## Previous transformation chain

`PrintableArtwork` and the master `ArtworkPlacement` entered `calculateLogoFit`
inside each scene's independently measured axis-aligned `printableRectangle`.
The resolved artwork image was then placed inside a `scene-surface`, customer
rotation was applied to the image, and the entire scene surface received a
scene rotation plus a small `skewX`/`scaleY`. Opacity, multiply blending,
brightness, contrast, saturation, blur, and a drop shadow were applied last.

This preserved the placement state object, but not one physical projection.
The Steak and Dessert rectangles described differently cropped regions and an
affine rotate/skew could not follow their four non-parallel photographed edges.
Rotation around each rectangle's centre also shifted the effective paper face.
Safe margins were implicit in the rectangle rather than explicit physical data.

## Current transformation chain

The master placement is resolved once in a canonical `0..1 × 0..1` Pocket Paper
face with 8% physical safe margins and the Product View fit profile. Its four
corners, including transparent artwork padding and customer rotation, are then
projected through the scene's paper homography. A CSS `matrix3d` renders that
projected quadrilateral. Scene data changes the photograph projection and
conservative ink compositing only; it cannot change placement or artwork colour.

## Calibrated paper surfaces

All coordinates are normalized to the complete photograph canvas and ordered
top-left, top-right, bottom-right, bottom-left.

- Product View: `(0.160, 0.3704)`, `(0.792, 0.3704)`, `(0.792, 0.928)`, `(0.160, 0.928)`
- Main Dish — Steak local safe-print plane: `(0.180, 0.582)`, `(0.351, 0.604)`, `(0.409, 0.952)`, `(0.225, 0.987)`
- Dessert & Coffee: `(0.165, 0.532)`, `(0.357, 0.510)`, `(0.499, 0.883)`, `(0.182, 0.988)`

Fish remains registry-ready but has no final photograph in the repository, so
no paper quad is fabricated for it.

The earlier Steak calibration used the full lower-face extremes `(0.195,
0.588)`, `(0.314, 0.607)`, `(0.401, 0.927)`, `(0.252, 0.991)`. At 1536×1024
its full-surface top/bottom edge ratio was approximately `0.77`, with roughly
`22°` horizontal-edge divergence. The local safe-print calibration measures
about `0.96` and `4.5°` respectively for the synthetic QA artwork. This avoids
extrapolating outer-edge convergence across the small central printed region.

The canonical surface also preserves Product View's calibrated printable-face
aspect ratio (`~0.756:1`) instead of treating the physical paper coordinates as
a square.

## Deterministic QA

`tests/assets/logos/scene-calibration.svg` contains only an outer rectangle,
centre axes and marker, and four corner markers. The unit suite projects this
placement for wide, tall, square, text-heavy, and thin-line aspect ratios and
asserts identical normalized bounds across scenes and responsive stage sizes.
The Playwright QA test captures Product View, Steak, and Dessert to
`test-results/scene-calibration/`.
