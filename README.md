# DiellArt Mockup Studio

> Visualise your brand before you print.

DiellArt Mockup Studio is the foundation for a product-personalisation experience where prospective customers will be able to upload a logo and preview it on personalised DiellArt paper products. Pocket Paper is the first planned product.

## Current MVP scope

The application now supports browser-local logo selection, validation, preview, replacement, and removal. No file is uploaded or persisted. Image processing, mockup rendering, accounts, databases, APIs, and server-side storage are intentionally not implemented yet.

The interface now includes a small design-system foundation with central CSS tokens and reusable primitives for buttons, badges, cards, layout, section headings, placeholders, and the visual-only future upload area. See [`docs/design/Design_System.md`](docs/design/Design_System.md).

## Technology stack

- Next.js 16 App Router
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- ESLint
- npm

## Local development

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run lint
npm run build
npm start
```

No environment variables are required for this milestone.

## Repository structure

```text
assets/             Source product, mockup, logo, and reference assets
docs/               Business, architecture, product, and development notes
public/             Web-ready brand, mockup, and icon assets
src/app/            App Router entry points and global styles
src/components/     Shared layout and UI components
src/features/       Feature boundaries for future product capabilities
src/config/         Application configuration
src/lib/            Shared framework-independent utilities
src/shared/         Small reusable constants, hooks, and utility functions
src/styles/         Reserved shared style resources
src/types/          Shared TypeScript types
tests/              Unit and integration test locations
```

Image-processing and mockup-rendering features are not yet implemented. See [`docs/features/Logo_Upload.md`](docs/features/Logo_Upload.md) for the current selection and preview workflow.
