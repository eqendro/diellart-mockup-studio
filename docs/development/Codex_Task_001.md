# Codex Task 001 — Project Foundation

## Implementation brief

Create the initial foundation for a production-quality web application called **DiellArt Mockup Studio** in the existing empty repository, with `package.json` at the repository root.

The application will eventually allow prospective clients to upload a logo and preview it dynamically on personalised DiellArt paper products. The first supported product will be Pocket Paper. For this task, build only the project foundation and a simple placeholder interface. Do not implement image processing, logo upload functionality, mockup rendering, databases, accounts, or server-side storage.

### Technology requirements

- Use the current stable Next.js App Router, React, TypeScript, Tailwind CSS, ESLint, npm, and a `src` directory.
- Do not use a database, authentication, external UI component libraries, image-generation APIs, unnecessary dependencies, or experimental features.

### Required structure

- `docs/{business,architecture,products,development}`
- `assets/{products,mockups,logos,references}`
- `public/{brand,mockups,icons}`
- `src/app`
- `src/components/{layout,ui}`
- `src/features/{upload,logo-processing,product-config,rendering,mockup-gallery,quote-request}`
- `src/{config,lib,types,styles}`
- `tests/{unit,integration}`

Track otherwise-empty architecture folders, keep Next.js files only under `src/app`, keep source files out of the repository root, and keep business logic out of UI components.

### Initial page

Build a polished, responsive homepage with:

- “DiellArt Mockup Studio”
- “Visualise your brand before you print.”
- A short explanation of the future upload and personalised-product preview
- A prominent disabled or non-functional “Upload Logo” button
- “Pocket Paper — First product coming soon”
- Neutral placeholder cards for Product View, Main Dish Setting, and Dessert Setting
- A footer with DiellArt and the current year

The style should be clean, premium, modern, professional, spacious, predominantly white and warm neutral, suitable for a hygiene and paper-products company, and accessible at approximately 375 px, 768 px, and 1440 px. Do not build dark mode.

### Branding

Copy `/mnt/data/pdf-logo-diellart.png` to `public/brand/diellart-logo.png` and use it if it renders clearly. If unsuitable, keep branding replaceable and show DiellArt as accessible text.

### Documentation

Document the project purpose, MVP scope, stack, local development, build instructions, repository structure, and the fact that image processing and rendering are not implemented. Create draft product vision, workflow, architecture, and Pocket Paper documents without inventing dimensions or print coordinates.

### Code quality and verification

Use strict TypeScript, avoid `any`, keep components focused, avoid over-engineering, dead code, mock APIs, environment variables, analytics, and unnecessary test dependencies. Install dependencies, run the production build and lint, fix errors, confirm root `package.json`, confirm no environment variables are required, and confirm the implementation causes no browser console errors. Do not commit or push.

