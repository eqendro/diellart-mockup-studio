# Codex Task 004 — Pocket Paper product template and first mockup rendering

## Objective

After a visitor uploads a valid logo, show it dynamically on the lower
printable area of the blank Pocket Paper Product View mockup. This is the first
working product-personalisation preview.

## Required implementation

- Copy `temp/mockup.png` to
  `public/mockups/pocket-paper/product-view.png` without changing the source.
- Introduce reusable application-wide product-template types and a
  configuration for Pocket Paper.
- Define the 100 mm × 200 mm physical product and its 100 mm × 130 mm lower
  printable panel using normalised coordinates: `x 0`, `y 0.35`, `width 1`,
  `height 0.65`.
- Configure 8% horizontal and vertical safe margins inside that panel.
- Configure a default logo scale of approximately 0.7.
- Build the browser-side renderer in `src/features/mockup-engine`, using the
  transparent static master and the accepted object URL as positioned layers.
- Provide a pure contain-fit utility accepting display size, surface, margins,
  aspect ratio, scale, and offsets, and returning `x`, `y`, `width`, and
  `height`.
- Preserve aspect ratio, centre the logo, prevent safe-area overflow, handle
  invalid dimensions safely, and update immediately on replace or remove.
- Support printable-panel, safe-area, and logo-bound debug overlays controlled
  by a local constant that is disabled by default and not public UI.
- Coordinate upload and renderer state in a small client-side personalisation
  component while keeping the page a Server Component and retaining one object
  URL.
- Preserve validation, replacement, removal, failed-replacement retention,
  accessible errors, same-file reselection, and URL cleanup.
- Before upload retain the neutral Product View placeholder; after upload show
  “Your Pocket Paper preview” with text explaining that print colour and final
  placement will be refined later.
- Keep Main Dish Setting and Dessert Setting as placeholders.
- Use meaningful accessible labelling, filename-based logo alt text, responsive
  proportional layout, and no horizontal overflow or mockup cropping.
- Document the renderer and update the product and README documentation.

## Constraints and non-goals

Use React, CSS, and native browser layout without new dependencies. Do not add
Canvas/image-processing/state-management/drag/geometry/UI libraries, APIs,
storage, accounts, server processing, background removal, colour conversion,
recolouring, cropping, texture or blend effects, opacity simulation,
perspective transforms, editor controls, downloads, high-resolution exports,
scene generation, product selection, saved state, limits, or analytics.

Do not hardcode product pixel coordinates in React components, modify the
source asset, create duplicate upload state or unnecessary object URLs, add
remote image domains, disable image optimisation globally, or expose a public
debug control.

## Verification and definition of done

Run lint, production build, and the development server. Verify wide, tall,
square, transparent PNG, white, JPG, and SVG logos; replacement, failed
replacement, removal, resizing, mobile layout, and both debug modes. Confirm
the configured normalised surface and margins, proportional safe fitting,
browser-only file handling, URL cleanup, unchanged scene placeholders, no API
or environment additions, and debug disabled by default.

Completion requires the asset, reusable configuration, renderer, pure fitting
logic, shared accepted-logo state, responsive Product View, preserved upload
behaviour, passing lint/build, and updated documentation. Do not commit or push.
