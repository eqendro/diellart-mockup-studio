# Pocket Paper

Pocket Paper is the first product supported by the DiellArt Mockup Studio.

## Dimensions

- Product width: 100 mm
- Product height: 200 mm
- Printable front panel: 100 mm × 130 mm
- Printable panel start: 70 mm from the top

The printable panel therefore occupies `x: 0`, `y: 0.35`, `width: 1`, and
`height: 0.65` in normalised product coordinates.

## Current mockup assumptions

The web-ready Product View master is
`public/mockups/pocket-paper/product-view.png` (1024 × 1536). The source remains
at `temp/mockup.png`.

The safe area removes 8% of printable-panel width from each horizontal edge and
8% of printable-panel height from each vertical edge. Logos use
orientation-aware safe-area usage: 88% width for wide artwork, 82% height for
tall artwork, and an 84% balanced fit for square artwork.

These values support the initial visual preview. Exact production tolerances
and calibration still require confirmation before print approval.
