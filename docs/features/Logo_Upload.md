# Logo Upload

## Purpose

The logo upload module lets a visitor select, validate, inspect, preview, replace, and remove one logo without sending it anywhere. It is the browser-local entry point for the future logo engine.

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

Validation is a pure function in `utils/validate-logo-file.ts`, making the rules suitable for focused unit tests when a test runner is introduced. Recommended future cases include all supported types, MIME/extension mismatches, boundary sizes, empty files, multiple files, invalid image bytes, and missing extensions.

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

Accepted files are previewed with `URL.createObjectURL`. A candidate URL is revoked immediately if decoding fails. The previous accepted URL is revoked when a replacement succeeds, when the logo is removed, and when the component unmounts. The input value is reset after every selection so the same file can be chosen again.

## SVG security

SVG text is never parsed or injected into the DOM. The application does not use `dangerouslySetInnerHTML` or manually render uploaded SVG elements. SVG files are displayed only as the `src` of an `img` using a browser-generated object URL. No SVG content leaves the browser.

## Accepted metadata

The accepted model exposes the original `File`, filename, MIME type, extension, byte size, formatted size, natural width, natural height, aspect ratio, and preview object URL. Raster images require readable natural dimensions. SVG intrinsic dimensions are shown when browser decoding provides them; otherwise they display as “Not specified.”

## Known limitations

- No pixel transformation, sanitisation, colour analysis, or print-readiness assessment occurs.
- Browser MIME reporting is required and may vary for unusually generated files.
- SVG intrinsic dimensions depend on information the browser can derive.
- The current project has no automated test runner; validation remains pure for later coverage.
- The module does not persist a selection across navigation or refresh.

## Relationship to the logo engine

A future milestone may pass the accepted browser-local `File` to the logo engine for explicit client-side processing. That work must remain separate from selection and validation and must not silently introduce server upload or persistence.
