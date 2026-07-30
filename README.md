# DiellArt Mockup Studio

> Visualise your brand before you print.

DiellArt Mockup Studio is a public-preview, browser-based
product-personalisation application. It prepares customer artwork and displays
a one-colour Digital Proof on the currently supported DiellArt Pocket Paper
product.

## Current functionality

The current preview accepts one PNG, JPG/JPEG, WebP, or SVG file up to 10 MB.
Selection, validation, raster analysis, cropping, artwork preparation, colour
conversion, and proof composition occur locally in the browser. Customer files
are not uploaded to a server or persisted across a refresh.

The Pocket Paper workflow provides:

- artwork selection by file picker, drag and drop, or a camera-enabled mobile
  input;
- artwork intake and classification;
- guided crop selection when the browser cannot safely isolate the logo;
- edge-connected near-white background removal for suitable raster artwork;
- transparent-margin cropping and prepared-artwork generation;
- dominant colour detection and detected, black, blue, or green one-colour
  output;
- a responsive proof with safe-area fitting, scale controls, directional
  movement, direct dragging, touch dragging, and pinch scaling;
- replace, remove, reset, edit, and browser-memory approval controls.

SVG files are validated and previewed through browser object URLs. Their markup
is not parsed or injected, and they bypass raster background removal and manual
raster cropping.

At a high level, raster artwork follows:

`Upload → intake → optional crop → background removal → transparent-margin crop → monochrome conversion → residual preservation/cleanup → safe-area fit → renderer`

See [Artwork Engine](docs/ArtworkEngine.md) for the stage-by-stage contract.

## Local development

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available commands

```bash
npm run dev        # Start the development server
npm run lint       # Run ESLint
npm run typecheck  # Check TypeScript without emitting files
npm test           # Run the Vitest test suite
npm run test:e2e   # Run Playwright browser tests
npm run build      # Create a production build
npm start          # Serve a completed production build
```

No environment variables are required for this preview.

## Current limitations

- Pocket Paper Product View is the only functional product proof.
- Background removal is deterministic and intended for suitable,
  predominantly plain light backgrounds. It is not a general-purpose
  photographic background-removal service.
- SVG files do not receive raster background removal or manual raster cropping.
- The proof is a flat browser composition. It does not provide perspective
  warping, calibrated production colour, print-ready artwork, or export.
- Approval exists only in browser memory. There is no account, backend
  persistence, quotation submission, CRM integration, or production order.

## Planned functionality

Planned work includes a deployed standalone Pocket Paper preview, main-dish and
dessert lifestyle scenes, a contact page, quotation requests, a lightweight
Sales Engine, a product catalogue, and multi-product previews. These features
are not implemented in the current public preview.

See [Roadmap](docs/Roadmap.md) for milestone status.

## Repository structure

```text
assets/             Source product, mock-up, logo, and reference assets
docs/               Business, architecture, product, and development notes
public/             Web-ready brand, mock-up, and icon assets
src/app/            App Router entry points and global styles
src/components/     Shared layout and UI components
src/features/       Upload, artwork, personalisation, and renderer boundaries
src/config/         Application and product configuration
src/lib/            Shared framework-independent utilities
src/shared/         Reusable constants, hooks, and utility functions
src/styles/         Shared style resources
src/types/          Shared TypeScript types
tests/              Unit, integration, fixture, and browser coverage
```

Further documentation:

- [System Architecture](docs/architecture/System_Architecture.md)
- [Artwork Intake](docs/features/Artwork_Intake.md)
- [Logo Upload](docs/features/Logo_Upload.md)
- [Pocket Paper Rendering](docs/features/Pocket_Paper_Rendering.md)
- [Pocket Paper product](docs/products/Pocket_Paper.md)
