# Pocket Paper Rendering

## Purpose

The Product View is the browser-rendered Pocket Paper Digital Proof. It
composes prepared browser-local artwork over a transparent static mockup
without uploading the artwork.

## Residual-noise cleanup

After monochrome conversion, the live browser pipeline runs a conservative
residual-noise cleanup before PNG encoding. It uses iterative 8-neighbour
connected-component analysis and may only set the alpha of a conclusively
isolated tiny component to zero. It never changes canvas dimensions, retained
RGBA bytes, placement, or renderer geometry.

Thresholds live in
`src/features/logo-engine/preparation/residual-noise-config.ts`. Major,
meaningful, nearby, repeated, aligned, oversized, and ambiguous components are
protected, including punctuation, letter dots, rays, rules, fine text,
disconnected symbols, and transparent counters. Disabled, empty,
single-component, invalid, ambiguous, or failed analysis returns an unchanged
copy, so cleanup cannot block preview generation.

Development builds report diagnostics only when a component is removed,
including geometry, area ratios, protected distance, and the removal reason.
Ambiguous specks are intentionally retained.

## Product and printable surface

- Product size: 100 mm × 200 mm.
- Printable front panel: 100 mm × 130 mm.
- The printable panel begins 70 mm from the top.
- Full-canvas product bounds: `x: 0.16`, `y: 0.092`, `width: 0.632`,
  `height: 0.836`.
- Calibrated surface within those bounds: `x: 0`, `y: 0.333`, `width: 1`,
  `height: 0.667`.
- Safe margins: 8% of printable width horizontally and 8% of printable height
  vertically, on both sides.
- Wide logo usage: up to 88% of safe-area width.
- Tall logo usage: up to 82% of safe-area height.
- Square logo usage: 84% of the balanced safe-area fit.

The physical 70/200 split is 0.35, but visual calibration places the supplied
master's fold at approximately 0.333 of its visible product height. The
calibrated fold is used so artwork follows the image rather than an idealised
uncalibrated canvas. The values live in
`src/config/products/pocket-paper.ts`; React components do not contain product
pixel coordinates.

## Coordinate hierarchy

The master image includes surrounding canvas that is not part of the physical
Pocket Paper. `productBounds` identifies the visible paper inside that full
canvas. Coordinates are resolved in this order:

1. Full mockup-image stage.
2. Actual product bounds within the stage.
3. Printable panel relative to the product bounds.
4. Safe area relative to the printable panel.
5. Centred, proportionally fitted logo.

The static image, product bounds, printable panel, safe area, and logo all
share one `position: relative` stage with the master's 2:3 aspect ratio. This
prevents card dimensions or `object-fit` letterboxing from becoming a second,
incorrect overlay coordinate system.

## Rendering and fitting

`MockupRenderer` uses a proportionally sized HTML stage, a Next.js `Image` for
the static master, and the printable artwork URL in a positioned `img` logo
layer. A `ResizeObserver` supplies the displayed dimensions to the pure
`calculateLogoFit` utility.

The utility first converts product bounds to stage pixels and then resolves the
surface within those bounds. It subtracts the configured margins, calculates a
contain fit from the logo aspect ratio, applies the clamped scale, and centres
the result. Optional offsets are clamped so the logo cannot leave the safe
area. Missing, zero, infinite, or invalid dimensions return an empty fit
instead of `NaN`. The returned `x/y` geometry is explicitly mapped to CSS
`left/top` by the renderer.

Prepared artwork supplies separate padded-canvas dimensions and visible
foreground bounds. Recommended fitting uses the foreground aspect ratio. The
image layer is expanded and offset by the padding ratios so the measured
foreground—not its invisible canvas—occupies the resolved safe-area fit.

## Print simulation

The renderer consumes a surface `renderingProfile` and has no product-name or
upload-control knowledge. White Pocket Paper uses matte paper with `multiply`,
opacity `0.92`, contrast and saturation `0.96`, and lightweight ink diffusion.
Very light artwork is detected
during preparation and switches to `normal` blending, minimum opacity `0.98`,
and contrast `1.08` so it remains visible on white paper. Texture influence is
deliberately subtle and adds no shadow, bevel, or sticker edge. The same
configuration shape supports future dark, coloured, kraft, and coated surfaces
without exposing those variants now.

## Manual placement

`ArtworkPlacement` is separate from upload data, prepared artwork, and product
geometry. Scale remains numeric internally and is clamped from 35% to 100% of
the orientation-aware safe maximum. The default is 0.88 internally and is
labelled “Recommended”; other values are presented as “Smaller” or “Larger”.
Horizontal and vertical limits are recalculated from
the current scale, artwork aspect ratio, intrinsic mockup size, product bounds,
printable surface, and safe margins. The fit utility remains the final safety
boundary and clamps offsets so artwork cannot be clipped.

Arrow buttons move by 12% of the currently available geometry-relative travel
per activation and are clamped after every step. Centre sets both offsets to
zero without changing size. Reset restores scale 0.88 and both offsets to
centre. New uploads, replacements, and original/prepared switches reset
placement. Raw percentages are not exposed to customers.

## Debug overlay

Set the local `SHOW_MOCKUP_DEBUG_OVERLAY` constant to `true` to display the
product bounds, printable surface, safe area, and fitted logo bounds. It is `false` by default,
is not exposed in the interface, and its elements are hidden from assistive
technology.

## Limitations and future improvements

This is a flat visual approximation. It does not perform perspective warping,
paper-displacement mapping, colour calibration, export, or server-side
processing. The current coordinates assume the supplied master
image corresponds to the configured product bounds. Production tolerances,
calibrated artwork placement, colour handling, and scene mockups remain future
work.
