# Changelog

All notable changes to this project are documented here in reverse
chronological order.

## Unreleased

## v0.9.0 — Artwork Engine Public Preview — 2026-07-30

### Added

- Added browser-local PNG, JPEG, WebP, and supported SVG artwork upload with
  file validation and object-URL lifecycle management.
- Added deterministic artwork intake and classification for transparent logos,
  plain-background logos, photographs, screenshots, documents, and unknown
  artwork.
- Added transparent PNG handling and an unchanged preparation path for SVG
  files, which are displayed through object URLs without parsing their markup.
- Added an optional manual crop workflow for raster artwork, including
  display-to-natural coordinate mapping, letterbox offsets, source-boundary
  clamping, and persisted cropped candidates.
- Added edge-connected near-white background removal for suitable raster
  artwork, followed by transparent-margin cropping and bounded padding.
- Added one-colour artwork conversion, dominant print-colour detection, and
  detected, black, blue, and green colour choices.
- Added original, cropped, prepared, printable, and monochrome artwork states
  with independently managed browser-local URLs.
- Added Pocket Paper safe-area fitting, drag positioning, semantic scale
  controls, directional movement, centring, and reset.
- Added touch dragging and pinch scaling with geometry-constrained placement.
- Added a responsive Pocket Paper proof workspace with mobile-specific colour
  controls and artwork interaction guidance.

### Improved

- Improved artwork topology preservation by restricting background removal to
  eligible pixels connected to the image edge.
- Improved preservation of letter counters, punctuation, apostrophes,
  decorative rays, thin lines, and disconnected legitimate artwork elements.
- Improved edge-contamination handling with adaptive border estimation,
  alpha-preserving monochrome conversion, and conservative removal of only
  conclusively isolated residual components.
- Improved centring and proportional fitting by measuring visible foreground
  bounds independently from transparent canvas padding.
- Improved renderer stability for wide, tall, square, invalid, and
  zero-dimension inputs.
- Improved mobile usability with a compact proof toolbar and direct
  manipulation inside the preview.
- Improved preparation fallback behaviour so originals and confirmed crops are
  preserved when automatic preparation cannot produce a usable candidate.
- Improved separation between upload and intake, artwork preparation,
  monochrome processing, fit and placement logic, product configuration, and
  rendering.

### Fixed

- Fixed incorrect crop-coordinate mapping caused by responsive display scaling
  and letterboxing.
- Fixed prepared-artwork workflow regressions where cropped files, object URLs,
  or selected candidates were not retained through preparation.
- Fixed transparent artwork incorrectly entering recoverable failure states.
- Fixed logo distortion and missing components caused by inconsistent canvas
  and foreground geometry.
- Fixed filled letter counters and lost internal negative spaces during
  preparation and monochrome conversion.
- Fixed preservation regressions affecting apostrophes, decorative details,
  thin marks, and disconnected artwork elements.
- Fixed incorrect placement caused by treating transparent padding as visible
  artwork.
- Fixed removable light-background remnants for supported plain-background
  artwork without claiming general-purpose photographic extraction.
- Fixed state transitions that could block accepted artwork in idle, uncertain
  review, crop, or preparation phases.
