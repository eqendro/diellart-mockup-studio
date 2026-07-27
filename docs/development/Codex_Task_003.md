# Codex Task 003 — Client-Side Logo Upload Module

## Complete implementation brief

Implement Milestone 2 in the existing DiellArt Mockup Studio: a complete browser-based logo selection, validation, preview, replace, and removal workflow. Do not implement transformation, colour detection, monochrome conversion, background removal, mockup placement, perspective transformation, storage, APIs, authentication, databases, quotation submission, or server-side processing.

The visitor must be able to select by click or drag-and-drop, receive immediate feedback, preview an accepted logo, inspect basic metadata, replace or remove it, and continue without any file leaving the browser.

### Supported files and validation

Accept PNG, JPG/JPEG, WebP, and SVG using `image/png`, `image/jpeg`, `image/webp`, and `image/svg+xml`. Validate MIME type and `.png`, `.jpg`, `.jpeg`, `.webp`, or `.svg` extension. The shared maximum is 10 MB.

Reject unsupported MIME or extension, files over 10 MB, empty files, undecodable files, multiple selected or dropped files, and dropped non-file items. Never silently choose the first of multiple files. Show clear, persistent, accessible errors without exposing exceptions.

### Security and privacy

Never inject, parse, or manually render uploaded SVG markup and never use `dangerouslySetInnerHTML`. Preview SVG through an object URL in an image source. Revoke candidate and accepted URLs when invalid, replaced, removed, or unmounted. Do not convert to Base64, use an API or server action, upload, persist, or analyse the file.

### Architecture and state

Keep focused components, hooks, types, and upload-specific utilities under `src/features/upload`. Put only application-wide upload constants under `src/shared/constants`. The homepage and layout remain Server Components; only the interactive feature uses `"use client"`.

Represent idle, drag-active, validating, accepted, and error states with local React state. Do not add global state or upload, drag-and-drop, image-processing, icon, class-merging, or other runtime libraries.

Expose the accepted original `File`, filename, MIME type, extension, bytes, formatted size, natural width and height, aspect ratio, and preview object URL. Raster images must decode and provide dimensions. SVG intrinsic dimensions should be attempted through browser decoding, with “Not specified” shown if unavailable.

### Interface

Replace the visual-only upload preview with a real drop zone supporting click, keyboard, drag enter/over/leave/drop, nested drag stability, a matching `accept` attribute, one file only, visible focus and drag state, accessible instructions, and a hidden native file input. A Browse Files button and the drop zone may open the picker without double triggering.

While decoding, show “Checking your logo…” without artificial delay or processing claims. After acceptance show the contained, unstretched logo on a checkerboard or split-neutral background, filename, format, size, available pixel dimensions and ratio, browser-local readiness status, and clear Replace Logo and Remove Logo actions.

Preserve the header, hero, preview cards, and footer. Remove unavailable messaging, point the hero CTA to the upload section without client scrolling logic, keep one primary upload module, and state that mockup generation comes later.

### Accessibility and responsive behaviour

Provide an accessible input label and instructions, correct button semantics, visible focus, live errors and success status, meaningful preview alt text, hidden decorative icons, clear action labels, semantic headings, sufficient contrast, and state cues beyond colour.

At approximately 375, 768, and 1440 px, prevent overflow, wrap metadata and actions naturally, constrain preview height, maintain readable instructions, and keep touch targets around 44 px.

### Documentation and verification

Document the module in `docs/features/Logo_Upload.md`, expand only upload-related business workflow content, and minimally update README. With no existing test runner, add no framework; keep validation pure and document future cases.

Run lint, build, and development-server checks. Confirm no server upload, API route, environment variable, URL leak, SVG injection, first-file fallback, transformation, or unnecessary dependency. Confirm the same file can be selected after removal and placeholder mockup cards remain.

Do not commit or push. Report files, client boundaries, rules, metadata, dependencies, checks, assumptions, deviations, limitations, and recommended next milestone.
