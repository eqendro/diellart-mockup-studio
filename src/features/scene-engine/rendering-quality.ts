export const MAX_SCENE_RENDER_DPR = 3;
export const MAX_SCENE_BACKING_PIXELS = 4_000_000;

export function resolveSceneRenderDpr(devicePixelRatio: number | undefined): number {
  if (!Number.isFinite(devicePixelRatio) || !devicePixelRatio || devicePixelRatio < 1) return 1;
  return Math.min(MAX_SCENE_RENDER_DPR, devicePixelRatio);
}

export function resolveSceneBackingStore(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number | undefined,
) {
  const requestedDpr = resolveSceneRenderDpr(devicePixelRatio);
  const pixelBudgetDpr = Math.sqrt(MAX_SCENE_BACKING_PIXELS / Math.max(1, cssWidth * cssHeight));
  const effectiveDpr = Math.min(requestedDpr, pixelBudgetDpr);
  return {
    effectiveDpr,
    width: Math.max(1, Math.round(cssWidth * effectiveDpr)),
    height: Math.max(1, Math.round(cssHeight * effectiveDpr)),
  };
}
