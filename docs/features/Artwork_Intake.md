# Artwork Intake Engine

## Purpose

Artwork Intake is the first stage after browser-local upload. It analyses a
small downsampled raster and recommends a preparation workflow before the
existing logo engine runs. It does not render, persist, or upload artwork.

## Classifications

- `TransparentLogo`: meaningful existing transparency.
- `LogoOnPlainBackground`: opaque artwork with a consistent light border.
- `Photograph`: high colour diversity, luminance variation, and local detail.
- `Screenshot`: screen-like colour diversity and sharp structural edges.
- `Document`: a light page or slide-shaped canvas with structured edges.
- `Unknown`: insufficient evidence for the other categories.

Analysis uses transparency ratio, border uniformity and lightness, quantised
colour distribution, luminance variance, edge complexity, dimensions, and
aspect ratio. Images are analysed at no more than 640px on the longest edge.

## Confidence and workflow selection

High confidence is used for substantial transparency, exceptionally uniform
plain borders, or strongly photograph-like detail. Medium confidence covers
weaker transparent artwork, documents, screenshots, and moderately uniform
plain backgrounds. Unknown input receives low confidence.

| Classification | Workflow |
| --- | --- |
| TransparentLogo | NoPreparation |
| LogoOnPlainBackground | BackgroundRemoval |
| Photograph | CropRequired |
| Screenshot | CropRequired, then background preparation |
| Document | CropRequired, then background preparation |
| Unknown | ManualReview |

Transparent logos use their existing transparency without raster background
removal. `CropRequired` opens the guided crop workflow and preserves the
original.

## Guided crop and recovery

Photographs, screenshots, and documents open “Select your logo”
automatically. Responsive percentage coordinates are mapped to original image
dimensions on confirmation. `react-image-crop` supplies pointer, touch,
resize-handle, and keyboard interaction. The cropped browser-local PNG then
runs through the existing removal, foreground, margin, and padding pipeline.

Unknown or failed artwork retains the original and offers “Adjust selection”.
Plain-background logos prepare automatically and retain the same retry path.
Cancelling never replaces the original.

## Preparation outcomes

High-confidence candidates become ready immediately. Medium-confidence usable
candidates are selected internally and map to the same customer-facing
PreviewReady state. Candidate confidence and original/prepared switching are
not exposed in the normal customer journey.

The lifecycle is:

`Original → crop selection → cropped temporary asset → prepared candidate → printable artwork`

Original, cropped, and prepared URLs have independent ownership and are revoked
when replaced or unmounted.

The cropped asset is committed to workflow state before background preparation
starts. It therefore persists when the crop workspace closes. Successful
preparation replaces the printable candidate with the prepared URL. Failed
preparation preserves the cropped and original assets internally and offers
another selection attempt or file replacement.

Crop confirmation records the displayed crop and displayed image rectangle.
The mapping utility subtracts any displayed-image offset (including
letterboxing), scales by natural/displayed dimensions, and clamps the natural
rectangle to source bounds. Development diagnostics report both rectangles,
scale factors, canvas/Blob creation, and the cropped URL.

Processing has explicit terminal states: analysing, selecting, cropping,
preparing, ready, needs-review, and failed. The interface does not infer
progress from a stale preparation message.

## Customer-facing orchestration

The internal states above are mapped to six presentation states only:

- Empty
- Analysing
- SelectLogoArea
- Preparing
- PreviewReady
- ErrorRecoverable

Internal classifications, confidence, candidate versions, and review status are
not displayed. A usable high- or medium-confidence candidate maps directly to
PreviewReady. Crop-required input maps to one focused selection task. A failed
crop maps to two recovery actions: select the area again or choose another
image. An unprepared photograph is never mapped to PreviewReady.

The short post-upload `idle` phase maps to Analysing, not an error. Uncertain
or candidate-less review maps to SelectLogoArea. ErrorRecoverable is reserved
for an explicit failed phase; medium confidence and warnings do not invalidate
a usable candidate.

A usable candidate has a non-empty selected object URL, positive canvas
dimensions, and non-empty foreground bounds. TransparentLogo may use its valid
original or margin-cropped asset. Plain-background artwork requires a derived
candidate. Photograph, screenshot, document, and unknown originals are never
considered usable logo candidates.

PreviewReady exposes placement, reset, replace, remove, and approval only.
Approval stores the selected artwork URL and exact placement in browser memory;
Edit placement returns to the adjustable proof.

## Future inputs

The upload UI provides “Choose from device” and, on coarse-pointer mobile
devices, “Take a photo” through a camera-enabled input. Captures enter the same
accepted `File`, intake, crop, and preparation path. Future versions
may add PDF and EPS conversion, deeper SVG inspection, camera-specific
heuristics, and optional AI-assisted review. No network processing is used.
# Mobile photographs and prepared artwork

Artwork intake has two confidence-based paths. Prepared assets (transparent
PNG/SVG and simple marks on uniform light or dark backgrounds) are normalised,
analysed, and prepared automatically. Camera photographs, screenshots,
packaging, labels, and busy documents retain the original upload and enter a
region-selection plus assisted-separation path.

Raster files are decoded once into an upright, bounded PNG working copy. The
browser bitmap decoder is preferred and an object-URL-backed HTML image decoder
is the fallback. Object URLs remain alive until decoding finishes. The working
copy is limited to 3200 px on its longest side to avoid avoidable mobile memory
pressure; the original `File` remains separate.

After region selection, customers review extraction on a checkerboard. Both
dark-on-light and light/colour-on-dark polarity are supported. A crop is never
considered separated artwork by itself. Filled rectangular masks, near-total
foreground coverage, and missing foreground are rejected before the renderer,
leaving a recoverable adjustment path.

This deterministic browser-only workflow does not promise perfect extraction
from arbitrary photography. Complex imagery deliberately asks for customer
confirmation instead of silently generating a bad proof.

During local development, append `?debugUpload=1` to display the upload event
trace on the device itself. It records native control activation, input return,
captured file metadata, validation, preferred and fallback decoding,
normalisation, accepted upload state, analysis, routing, and precise internal
failures. The panel and trace recording are disabled in production builds.
The development-only `/dev/photo-intake` page also includes a plain native file
input outside the upload abstraction so Android event delivery can be tested in
isolation.
That page also shows a hydration status, interactive React click/text/file
probes, and early window, promise-rejection, and failed-script diagnostics.
For a local production-mode comparison, build with `ENABLE_DIAGNOSTICS=1`;
otherwise the diagnostic route remains unavailable in production.

The canonical raster decoder tries EXIF-aware `createImageBitmap`, retries
without optional parameters, then uses HTML image loading through an object URL
and finally a FileReader data URL. A successful `onload` remains usable if
`img.decode()` rejects. Object URLs are released only after canvas drawing and
pixel access. Canvas failures retry once at half the configured working size.
The “Decode this file” diagnostic invokes this exact decoder and reports its
path, dimensions, browser-orientation result, and first failing stage.
