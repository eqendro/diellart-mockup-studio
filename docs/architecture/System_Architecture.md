# System Architecture

## Overview

DiellArt Mockup Studio is a browser-based Next.js application. The current
public preview has no database, authentication, customer-file API, or
server-side artwork processing. Its implemented boundaries are:

`Customer interface → Upload and intake → Artwork preparation → Fit and placement → Mock-up renderer`

Product configuration supplies geometry and visual settings without depending
on customer-interface or upload state.

## Upload and intake

`src/features/upload` validates the file, reads browser metadata, and owns the
immutable original `File` and object URL.

`src/features/artwork-intake` performs deterministic raster analysis, selects a
workflow, manages the optional crop, and maps detailed processing state to the
customer-facing states `Empty`, `Analysing`, `SelectLogoArea`, `Preparing`,
`PreviewReady`, and `ErrorRecoverable`. It does not contain renderer or product
geometry.

## Artwork preparation

`src/features/logo-engine` owns prepared and monochrome derivatives.
`prepareArtworkPixels` performs eligible edge-connected background removal,
transparent-margin cropping, padding, and foreground measurement.
`createMonochromePixels` preserves alpha while applying the selected print
colour. `cleanupResidualNoise` provides a conservative post-monochrome
subtractive pass.

The original, cropped, prepared, and monochrome object URLs have separate
lifecycles. Preparation exposes `PrintableArtwork`, including padded canvas
dimensions and visible foreground bounds, as its renderer-facing contract.

## Fit engine and placement

`src/features/mockup-engine/utils` contains pure fit and artwork-geometry
resolution. `src/features/mockup-engine/placement` owns numeric scale and
offset rules plus gesture calculations. Product bounds, printable surface,
safe margins, artwork foreground aspect ratio, and stage dimensions determine
the final proportional fit.

This logic is independent of file selection and pixel preparation. Invalid
geometry returns an empty fit, and offsets are clamped to the safe area.

## Mock-up renderer

`MockupRenderer` receives a configured mock-up, `PrintableArtwork`, placement,
and placement callbacks. It composes the static product image and an artwork
image layer, applies configured visual print effects, and translates pointer
drag and pinch gestures into placement changes. It does not classify, crop,
recolour, or persist artwork.

## Product configuration

`src/config/products/pocket-paper.ts` defines physical dimensions, master-image
path and intrinsic size, product bounds, printable surface, safe margins,
orientation-aware fit usage, and rendering profile. React components do not
hard-code the product-image pixel coordinates.

Pocket Paper Product View is the only implemented product configuration.

## Customer interface

`PocketPaperPersonaliser` composes upload, intake, crop, preparation, colour,
placement, and rendering state. Presentation components expose the current
customer workflow without showing internal confidence or candidate-management
details. Approval records the selected artwork URL, colour, product, and
placement only in React state.

## Data flow and fallback

1. Upload produces an immutable `AcceptedLogo`.
2. Intake selects automatic preparation, optional crop, or recoverable review.
3. Preparation produces an `ArtworkAsset` and selected `PrintableArtwork`.
4. Monochrome processing derives the one-colour renderer input.
5. Fit logic combines artwork geometry, placement, and product configuration.
6. The renderer displays the proof.

Replacement invalidates derived artwork and resets placement. A confirmed crop
is stored before preparation. If a later stage fails, the workflow retains the
best safe candidate and routes the customer to adjustment or replacement
instead of coupling recovery to the renderer.
