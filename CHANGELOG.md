# Changelog

## Unreleased

- Fixed post-upload idle and uncertain review phases incorrectly entering
  ErrorRecoverable.
- Added classification-aware usable-candidate checks and a transparent-logo
  fast path around opaque-background validation.
- Changed failed automatic plain-background preparation to assisted selection.
- Added development-only orchestration routing diagnostics and real-fixture
  regressions for DiellArt, Xh’Aura, and EC Analytics.
- Added a six-state customer artwork adapter over the existing intake and
  preparation internals.
- Removed customer-facing artwork-version, confidence, metadata, and review
  decisions from the normal journey.
- Made crop mode a full-width focused task and reduced recovery to selecting
  again or choosing another image.
- Reduced PreviewReady controls to placement, reset, replace, remove, and
  browser-memory approval with Edit placement.
- Added customer-state regression coverage, including protection against
  rendering failed photographs.
- Fixed crop confirmation so the cropped File, Blob URL, and natural-image
  rectangle persist in workflow state before preparation.
- Added display-to-natural coordinate mapping with letterbox offsets and source
  boundary clamping.
- Added explicit selecting, cropping, preparing, ready, review, and failed
  states, plus proof-area “Select your logo” recovery.
- Preserved Cropped and Original candidates when post-crop preparation fails.
- Added a development invariant for checkerboard/renderer URL parity and an
  Xh’Aura cropped-preparation regression.
- Connected intake classifications to automatic preparation, guided crop,
  candidate review, and recovery.
- Added responsive touch and keyboard cropping using `react-image-crop`.
- Added non-destructive original/cropped/prepared URL ownership and cleanup.
- Added Original/Prepared review actions and a camera-enabled mobile input.
- Added workflow routing, candidate-confidence, and crop-coordinate tests.
- Added Artwork Intake Engine Version 1 with deterministic classification,
  confidence, reasons, warnings, and workflow recommendations.
- Added pre-preparation analysis messaging and crop-required guidance without
  implementing a crop tool.
- Added classification coverage for transparent logos, plain-background
  artwork, photographs, screenshots, documents, and unknown images.
- Added explicit post-removal foreground bounds, alpha-threshold cropping, and
  equal padding capped between 6px and 20px.
- Added foreground-only validation with at most one cleanup pass and
  development-only preparation diagnostics.
- Updated renderer geometry to fit measured foreground bounds instead of the
  padded prepared canvas.
- Added real-fixture coverage for Xh’Aura, EC Analytics, and DiellArt artwork.
- Replaced customer-facing size and position percentages with semantic
  Smaller/Recommended/Larger sizing and accessible directional controls.
- Set the balanced default to 88% of the orientation-aware safe maximum.
- Switched border estimation from one global mean to eight border segments and
  added one-pass residual light-field validation.
- Reduced neutral halo alpha from 150 to 24 and limited feathering to the local
  boundary.
- Made the checkerboard artwork preview show the selected prepared or original
  asset instead of always showing the original.
- Removed the duplicate hero upload button, updated the working-product copy,
  and reduced upload-panel and proof-stage whitespace.
- Added accessible size and position sliders with geometry-derived safe limits
  and a centred reset action.
- Strengthened light-background classification with adaptive border tolerance,
  neutral halo cleanup, and boundary colour decontamination.
- Added pale-artwork detection and a configuration-driven visibility fallback.
- Renamed the proof heading to “Your Design Preview” and separated the product
  label.
- Reworked the post-upload experience into an immediate, responsive Digital
  Proof workspace with a large Pocket Paper stage and compact artwork panel.
- Added a non-destructive original/prepared/printable artwork lifecycle with
  automatic object URL cleanup and an original-background override.
- Added browser-side edge-connected near-white background removal, feathering,
  transparent-margin cropping, and large-image analysis downsampling.
- Added configuration-driven paper print simulation and orientation-aware
  safe-area fitting.
- Added Vitest coverage for pixel preparation and wide, tall, and square fits.
