# Codex Task 002 — Design System Foundation

## Complete implementation brief

Implement Milestone 1.5, **Design System Foundation**, in the existing DiellArt Mockup Studio Next.js application. Do not implement logo uploading, image processing, product configuration, mockup rendering, storage, APIs, authentication, databases, or quotation functionality.

### Primary objective

Create a small, maintainable design system that standardises the visual language of DiellArt Mockup Studio and refactor the existing homepage to use it. It should support the future upload flow, mockup gallery, editor controls, and product-personalisation experience without over-engineering the current application.

### Design direction

Keep the interface clean, premium, modern, understated, spacious, professional, predominantly white and warm neutral, and appropriate for a hygiene and paper-products business. Avoid bright colours, excessive gradients, glassmorphism, large shadows, overly rounded components, dark mode, animation libraries, external UI libraries, and decorative complexity.

### Architecture

- Rename `src/features/logo-processing` to `src/features/logo-engine`.
- Rename `src/features/rendering` to `src/features/mockup-engine`.
- Add `src/features/editor`.
- Add `src/config/app`, `src/config/products`, and `src/config/theme`.
- Add `src/shared/constants`, `src/shared/hooks`, and `src/shared/utils`.
- Do not duplicate utilities. Document `src/lib` as the home of framework-independent services or technical helpers and `src/shared/utils` as the home of small reusable utilities.
- Avoid moving working files unnecessarily.

### Design tokens and typography

Create central Tailwind-compatible CSS custom properties for colours, typography, spacing, radii, borders, shadows, content widths, useful breakpoints, and transition durations. Avoid repeated hardcoded values.

Provide semantic colour roles for background, surface, surface-muted, text-primary, text-secondary, text-muted, border, border-strong, accent, accent-hover, focus-ring, error, and success. Use restrained neutrals and a quiet accent.

Define reusable hierarchy styles for display, page, section, and card headings; body and supporting text; labels; and eyebrow text. Scale typography responsively without wrapper components for every element.

### UI components

Create focused components under `src/components/ui`:

- `Button`: primary, secondary, and ghost variants; small, medium, and large sizes; disabled and loading states; native button attributes; visible focus; no `any` or class-merging dependency.
- `Badge`: neutral and subtle accent variants with compact semantics.
- `Card`: a reusable container with optional interactive styling and default padding.
- `Container`: central responsive width and page padding.
- `Section`: standard vertical space and optional accessible heading relationship.
- `SectionHeader`: optional eyebrow, heading, description, and centred alignment.
- `PlaceholderPanel`: accessible, neutral Product View, Main Dish Setting, and Dessert Setting placeholder.
- `UploadDropzonePreview`: visual only, with simple local SVG, “Upload your logo”, supported file summary, disabled visual action, and clear coming-soon status. It must not open a picker or contain upload logic.

Keep components small, focused, and free of business logic. Do not add Storybook, component-documentation frameworks, styling dependencies, or an icon library. Prefer composition, Server Components, and direct imports.

### Homepage

Refactor the existing homepage to use the design system while preserving the DiellArt Mockup Studio header, Pocket Paper badge, “Visualise your brand before you print.” headline, supporting copy, unavailable upload call to action, three named preview cards, and footer. Add the visual-only upload preview without materially redesigning the experience.

### Responsive and accessibility requirements

Verify approximately 375 px, 768 px, and 1440 px layouts: no horizontal overflow, readable type, usable space, naturally stacking cards, adequate touch targets, clear header/footer, and readable upload preview.

Use correct heading hierarchy, keyboard-visible focus, native disabled controls, adequate contrast, accessible SVG handling, more than colour alone to communicate state, and reduced-motion support.

### Documentation and verification

Create `docs/design/Design_System.md`; update this task document and only the necessary README content. Document principles, tokens, typography, spacing, components, responsive and accessibility rules, and exclusions.

Install dependencies if needed, run `npm run lint` and `npm run build`, fix all errors, confirm no unnecessary dependencies, browser console errors, real upload implementation, obsolete feature folders, environment-variable requirements, external UI or icon libraries, or broken imports, and confirm `npm run dev` still starts.

Do not commit or push. Report renamed and added folders, components, modified files, dependency changes, lint/build results, assumptions, deviations, and the recommended next milestone.
