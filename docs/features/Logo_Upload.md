# Logo Upload

## Purpose

The logo upload module lets a visitor select, validate, inspect, preview,
replace, and remove one logo without sending it anywhere. It is the
browser-local entry point to the Artwork Engine.

## Supported formats and size

- PNG (`image/png`, `.png`)
- JPG/JPEG (`image/jpeg`, `.jpg` or `.jpeg`)
- WebP (`image/webp`, `.webp`)
- SVG (`image/svg+xml`, `.svg`)
- Maximum size: 10 MB

Both the MIME type and filename extension must be supported.

## Validation

The module rejects unsupported MIME types, unsupported extensions, files over 10 MB, empty files, undecodable images, multiple files, and dropped items that are not files. Errors are presented in an accessible alert and remain until dismissed or replaced by a valid selection.

If an initial selection fails, the alert is headed “Logo not accepted.” If a replacement fails while a valid logo is already selected, the previous selection and its object URL are retained. The alert is headed “Replacement logo not accepted” and explicitly confirms that the previous logo has been kept.

Validation is a pure function in `utils/validate-logo-file.ts`. Unit coverage
includes supported types, MIME/extension mismatches, boundary sizes, empty
files, invalid image bytes, and missing extensions.

## Artwork lifecycle

The accepted `File` and original object URL remain immutable. The logo engine
creates a separate prepared PNG URL and exposes a printable-artwork view to the
renderer. Raster preparation removes only near-white pixels connected to an
edge, feathers the transition, and crops transparent margins with retained
padding. Transparent input remains transparent; non-uniform or coloured borders
remain unchanged. SVG is never parsed or injected and currently bypasses pixel
preparation.

The workflow can switch between cached original and prepared URLs internally
without reprocessing, but the standard customer interface selects the best
usable candidate automatically. Artwork changes reset placement to the
recommended centred fit. Preparation errors preserve the original and offer
guided crop recovery without exposing version-management controls.

Crop-required intake results create a separate browser-local cropped PNG only
after confirmation. That file passes through the same preparation pipeline;
there is no duplicate background remover. Medium-confidence results retain both
candidates internally while selecting the usable result automatically.
Retrying or replacing a crop revokes the previous cropped and prepared URLs.

The large proof area presents the single “Select logo area” recovery action.
After confirmation, the selected internal asset and renderer consume the same
printable URL; development builds assert this invariant.

## State model

- `idle`: ready for selection
- `drag-active`: a dragged item is over the drop zone
- `validating`: browser image decoding and metadata reading are in progress
- `accepted`: the selected file and preview metadata are ready
- `error`: the latest selection was rejected

Local React state is sufficient; no global state library is used.

## Browser-only privacy

The original `File` exists only in component memory. There is no form submission, server action, API route, Base64 conversion, analytics event, persistent storage, or network upload. Removing the logo clears the file metadata and preview from React state.

## Object URL lifecycle

Accepted files are previewed with `URL.createObjectURL`. A candidate URL is revoked immediately if decoding fails. The previous accepted URL is revoked when a replacement succeeds, when the logo is removed, and when the component unmounts. Generated prepared URLs are independently revoked when replaced, removed, or unmounted. The input value is reset after every selection so the same file can be chosen again.

## SVG security

SVG text is never parsed or injected into the DOM. The application does not use `dangerouslySetInnerHTML` or manually render uploaded SVG elements. SVG files are displayed only as the `src` of an `img` using a browser-generated object URL. No SVG content leaves the browser.

## Accepted metadata

The accepted model exposes the original `File`, filename, MIME type, extension, byte size, formatted size, natural width, natural height, aspect ratio, and preview object URL. Raster images require readable natural dimensions. SVG intrinsic dimensions are shown when browser decoding provides them; otherwise they display as “Not specified.”

## Preparation thresholds

Configuration is centralised in
`src/features/logo-engine/preparation/config.ts`. Analysis uses at most 1600 px
on the longest edge. Near-white channels must be at least 224; at least 88% of
opaque border samples must be near-white and 82% must be within colour distance
24 of the estimated background. Connected tolerance starts at 42, adapts to
three times measured border variation, and is capped at 72. Border colour is
estimated from eight border segments and combined with a median rather than
one global average. Only eligible pixels connected to an image edge have their
alpha changed. Cropping uses 3.5% padding subject to the bounds below.

Foreground bounds are measured after removal from pixels whose alpha is above
8. Cropping uses only those bounds, then applies equal 3.5% padding clamped
between 6px and 20px. The prepared asset retains both its padded canvas size
and its exact visible bounds so downstream fitting does not treat padding as
logo content.

Development builds log original/prepared sizes, bounds, coverage,
transparency, padding, and validation; production builds do not.

## Known limitations

- Complex shadows, gradients, hair, and photographic background extraction are
  outside the deterministic white-background algorithm's scope.
- SVG receives no raster background removal or cropping.
- Browser MIME reporting is required and may vary for unusually generated files.
- SVG intrinsic dimensions depend on information the browser can derive.
- The module does not persist a selection across navigation or refresh.

## Relationship to the logo engine

The accepted browser-local `File` passes to Artwork Intake and then, when
appropriate, to the logo engine for client-side preparation. Selection and
validation remain separate from pixel processing, and neither boundary
introduces server upload or persistence.
