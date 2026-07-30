# System Architecture

**Draft — to be expanded.**

The application is a browser-based Next.js interface with no database,
authentication, or server-side storage. Upload validation owns the immutable
original file URL. The logo engine derives and owns a prepared URL through
edge-connected background removal and cropping. The mockup engine receives only
printable artwork plus product/surface configuration, keeping upload UI and
product naming outside the renderer.

The Artwork Intake Engine sits between accepted upload and preparation. It
performs deterministic, downsampled pixel analysis and returns classification,
confidence, reasons, warnings, and a recommended workflow without depending on
the renderer or product configuration.

Workflow state owns intake classification, crop-required/open state,
normalised crop coordinates, cropped temporary artwork, preparation outcome,
candidate selection, errors, and retry actions. It remains separate from
placement and product geometry; the renderer still receives only selected
printable artwork.

A customer-state adapter sits above this workflow and collapses it to Empty,
Analysing, SelectLogoArea, Preparing, PreviewReady, or ErrorRecoverable. UI
components consume that adapter rather than exposing candidate confidence or
original/cropped/prepared lifecycle states.

Manual placement is its own geometry-driven state. The personalisation layer
owns it, the placement utilities resolve scale-dependent safe limits, and the
renderer receives only the final scale and offsets. Upload replacement and
artwork-version changes reset this state predictably.

Customer controls translate precise numeric placement into semantic size
labels and directional steps. Exact scale and offsets remain available in
state and are passed to the product-agnostic renderer.
