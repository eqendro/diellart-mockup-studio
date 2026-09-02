# Scene Engine

The Scene Engine composes one browser-prepared `PrintableArtwork` and the master
Pocket Paper `ArtworkPlacement` into data-driven product and lifestyle proofs.
It does not prepare, extract, crop, recolour, or persist customer artwork.

## Contract and catalogue

Scene definitions live in `src/features/scene-engine/registry.ts` and satisfy the
contract in `types.ts`. A definition owns its background asset, aspect ratio,
four calibrated paper corners, physical safe margins, lighting, paper texture,
responsive framing, and fallback metadata.

The Version 1 catalogue contains `product-view`, `main-dish`, and `dessert`,
presented to customers as Product, Main Dish, and Dessert & Coffee.
Lifestyle scenes receive the same monochrome artwork object and master placement
used by Product View. Scale, offset, and rotation remain normalized physical-paper
coordinates; there is no independent lifestyle placement state.

## Physical mapping and blending

Artwork is first fitted in a canonical `0..1 × 0..1` physical Pocket Paper face,
including the same 8% safe margins and aspect-aware fit profile as Product View.
The complete artwork rectangle (including transparent padding) is then projected
through a homography onto the scene's calibrated four-corner paper surface.
Lighting and paper texture integrate the one-colour artwork without recolouring it.

## Replacing photography

Production assets are under `public/scenes/pocket-paper/final/`. Update only
`asset.path` in the scene definition when a replacement has the same composition
and aspect ratio.
If its printable paper moved, recalibrate the four points in `paperSurface`.
Renderer code does not change. Asset status and engine terminology are
not exposed in normal customer UI.

## Adding a fourth scene

Add the asset, localisation entry, and one validated `SceneDefinition` entry to
the registry. Choose a new string ID and localisation key, calibrate its quad and rendering/framing data,
and it will be rendered by the shared gallery/preview components. No customer or
scene-specific branches belong in the renderer.
