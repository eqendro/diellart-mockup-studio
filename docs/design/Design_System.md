# DiellArt Design System

## Principles

The DiellArt Mockup Studio interface is clean, premium, restrained, and practical. It uses generous space, warm neutrals, clear hierarchy, modest radii, and subtle depth. Components should support future product-personalisation work without turning the current application into a general-purpose component library.

## Design tokens

The source of truth is the `:root` token set in `src/app/globals.css`. Components consume semantic roles rather than raw values.

### Colour

| Token | Purpose |
| --- | --- |
| `--color-background` | Page canvas |
| `--color-surface` | Primary component surface |
| `--color-surface-muted` | Quiet secondary surface |
| `--color-text-primary` | Headings and high-emphasis content |
| `--color-text-secondary` | Body content |
| `--color-text-muted` | Supporting content |
| `--color-border` | Default dividers and outlines |
| `--color-border-strong` | Emphasised and dashed outlines |
| `--color-accent` | Restrained DiellArt action colour |
| `--color-accent-hover` | Active pointer state |
| `--color-focus-ring` | Keyboard focus indication |
| `--color-error` | Future validation errors |
| `--color-success` | Future completion states |

The error and success roles exist for future workflows but are not used decoratively.

### Typography

- Display heading: responsive hero statement
- Page heading: reserved for feature-level page titles
- Section heading: major content divisions
- Card heading: concise component titles
- Body: primary explanatory copy
- Supporting: captions and secondary details
- Label: controls and compact metadata
- Eyebrow: uppercase section context

Responsive sizes use `clamp()` so hierarchy scales without one-off breakpoint combinations. Manrope remains the application typeface.

### Spacing, shape, and layout

Spacing uses a compact 4 px-based scale and a responsive `--section-space`. Default and narrow content widths share one responsive `--page-padding`. Radii are deliberately modest, borders are quiet, and shadows are limited to subtle and raised roles.

Motion durations are tokenised. No animation library is used, and the reduced-motion media query suppresses transitions and smooth scrolling.

## Reusable components

- `Button`: primary, secondary, and ghost variants; three sizes; loading and disabled states
- `Badge`: neutral and subtle accent status treatments
- `Card`: a neutral container with optional interactive styling
- `Container`: shared responsive page width and gutters
- `Section`: consistent vertical rhythm with an optional heading relationship
- `SectionHeader`: eyebrow, heading, description, and alignment
- `PlaceholderPanel`: accessible neutral preview imagery
- `UploadDropzonePreview`: a clearly unavailable visual preview of the future upload experience

Components remain React Server Components. None require client-side state in this milestone.

## Responsive principles

- Begin with a single readable mobile column.
- Maintain responsive page gutters at 375 px, 768 px, and 1440 px.
- Allow preview cards to stack below 768 px.
- Keep controls at least 44 px high.
- Reflow the upload preview instead of shrinking its contents.
- Prevent decorative content from causing horizontal overflow.

## Accessibility

- Preserve one `h1` followed by semantic `h2` and `h3` headings.
- Use visible `:focus-visible` rings.
- Use native disabled controls and accompanying status text.
- Hide decorative SVG artwork from assistive technology.
- Give placeholder imagery accessible labels.
- Never communicate availability through colour alone.
- Maintain contrast between all text and surfaces.
- Respect `prefers-reduced-motion`.

## Intentionally excluded

This milestone does not include file selection, drag-and-drop behaviour, upload state, image processing, product configuration, mockup rendering, storage, APIs, authentication, databases, quote requests, dark mode, Storybook, third-party UI components, or icon libraries.

