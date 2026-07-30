# Artwork Engine

## Status and scope

The Artwork Engine is stable for the v0.9.0 public preview. It is a
browser-local pipeline for preparing one uploaded artwork file for the Pocket
Paper Digital Proof. It does not create production-ready print files and does
not upload or persist customer artwork.

## Pipeline

`Upload → Artwork intake → Optional crop → Background removal → Transparent-margin crop → Monochrome conversion → Residual-noise cleanup → Fit engine → Renderer`

### 1. Upload

The upload feature validates one PNG, JPG/JPEG, WebP, or SVG file up to 10 MB.
It creates an object URL and an immutable `AcceptedLogo` containing the original
`File`, dimensions, aspect ratio, and file metadata. The original remains
available until it is replaced, removed, or the component unmounts.

SVG is displayed only as an image source through an object URL. Its markup is
not parsed or injected.

### 2. Artwork intake

`analyseArtwork` returns an `ArtworkIntakeResult`. Raster files are analysed on
a downsampled canvas and classified as `TransparentLogo`,
`LogoOnPlainBackground`, `Photograph`, `Screenshot`, `Document`, or `Unknown`.
The result selects automatic preparation, guided crop, or manual review. SVG
uses the supported no-raster-preparation route.

Input: `AcceptedLogo`.

Output: classification, confidence, diagnostic reasons and warnings, and a
recommended workflow.

### 3. Optional crop

`ArtworkCropper` and `createCroppedArtwork` let the customer isolate a logo
within a raster image. Displayed percentage coordinates are converted to the
natural source dimensions after subtracting letterbox offsets and are clamped
to the source boundary.

Input: original raster file and `CropSelection`.

Output: a browser-local cropped PNG, its object URL, and the natural-image crop
rectangle. The original remains unchanged.

### 4. Background removal

`prepareArtwork` decodes a raster and delegates pixel processing to
`prepareArtworkPixels`. The preparation code estimates a predominantly light,
uniform border and changes alpha only for eligible near-background pixels that
are connected to an image edge. Coloured, non-uniform, photographic, and
otherwise unsuitable backgrounds are not treated as safely removable.

Input: original or confirmed cropped raster artwork.

Output: prepared RGBA pixels plus background classification and diagnostics.

### 5. Transparent-margin crop

The preparation stage measures foreground from alpha, crops empty transparent
margins, and adds equal padding bounded by the preparation configuration. It
records both padded canvas dimensions and exact visible `foregroundBounds`.

Input: prepared RGBA pixels.

Output: a prepared PNG candidate with canvas geometry and visible foreground
geometry.

### 6. Monochrome conversion

`useMonochromeArtwork` decodes the selected printable candidate.
`detectDominantBrandColour` proposes a detected print colour, and
`createMonochromePixels` creates detected, black, blue, or green one-colour
artwork. The conversion preserves source alpha and protects enclosed
near-white negative spaces rather than filling counters.

Input: selected `PrintableArtwork` and print-colour selection.

Output: a browser-local monochrome PNG with the prepared geometry unchanged.

### 7. Residual-noise cleanup and artwork preservation

`cleanupResidualNoise` runs after monochrome conversion and before PNG
encoding. It uses 8-neighbour connected components and may set alpha to zero
only for a conclusively isolated, tiny component. Major, nearby, repeated,
aligned, oversized, and ambiguous components are retained. RGB values and the
alpha of retained pixels are unchanged.

The pass returns an unchanged copy when it is disabled, receives invalid or
ambiguous input, finds a single component, or encounters an error. This stage
is deliberately conservative so punctuation, apostrophes, letter dots, rays,
rules, thin lines, counters, and disconnected legitimate elements survive.

Input: monochrome RGBA pixels.

Output: same-size monochrome RGBA pixels and development-only diagnostics.

### 8. Fit engine

`calculateLogoFit`, `resolveArtworkGeometry`, and the placement utilities
resolve the Pocket Paper product bounds, printable surface, safe margins,
foreground aspect ratio, scale, and offsets. They preserve aspect ratio,
centre the recommended fit, and clamp manual movement to the configured safe
area.

Input: product configuration, displayed stage dimensions,
`PrintableArtwork`, and `ArtworkPlacement`.

Output: safe, proportional stage geometry.

### 9. Renderer

`MockupRenderer` composes the configured Pocket Paper master image and the
monochrome artwork in the browser. It consumes resolved geometry and rendering
configuration; it does not upload, classify, crop, or prepare artwork. Pointer
handling translates drag and pinch gestures into placement updates, while the
fit engine remains the final safety boundary.

Input: product mock-up configuration, monochrome `PrintableArtwork`, and
placement.

Output: responsive flat Digital Proof.

## Artwork state and fallback behaviour

The original object URL is immutable. Cropped, prepared, and monochrome URLs
are separately owned and revoked when replaced or unmounted. The workflow
commits a confirmed crop before attempting background preparation, so the crop
can remain available if preparation fails.

An `ArtworkAsset` records original, prepared, and printable URLs, original and
prepared dimensions, foreground bounds, and preparation status. A
`PrintableArtwork` is the renderer-facing selection. Failed automatic
plain-background preparation routes to assisted crop selection. Processing
failures preserve the best available original or confirmed cropped candidate
and expose a recoverable customer state.

## Alpha, topology, and renderer separation

Background removal is edge-connected to avoid deleting enclosed light regions.
Monochrome conversion preserves alpha, and residual cleanup only subtracts
alpha from components that satisfy strict isolation checks. The renderer never
mutates artwork pixels. Transparent padding is accounted for separately from
visible bounds, preventing it from distorting centring or scale.

## Regression fixtures

The repository contains release-critical development fixtures under
`tests/assets/logos`:

- DiellArt (`pdf-logo-diellart.png`) exercises transparent antialiasing and
  fine brand detail.
- EC Analytics (`EC.png`) exercises lettering and disconnected legitimate
  elements.
- Xh’Aura (`Xh'Aura.jpeg`) exercises light-background removal, counters, an
  apostrophe, and decorative rays.

These assets are already repository test fixtures. Unit and browser tests use
them to protect preparation, topology, aspect ratio, monochrome, and workflow
behaviour.

## Known limitations

- Automatic background removal targets suitable, predominantly plain light
  backgrounds; complex photographs, shadows, gradients, and hair are outside
  its deterministic scope.
- Transparent source antialiasing may remain visible because source RGB and
  alpha are intentionally preserved.
- Renderer blend, opacity, and diffusion effects are visual approximations and
  can affect perceived edges without changing prepared pixels.
- SVG bypasses raster background removal and manual raster cropping.
- Only Pocket Paper Product View is configured.
- The Digital Proof is not colour-calibrated, perspective-warped,
  print-production output.
- No artwork is persisted or sent to a backend.
