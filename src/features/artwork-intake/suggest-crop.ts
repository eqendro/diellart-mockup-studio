export type SuggestedCrop = { x: number; y: number; width: number; height: number };

export function suggestArtworkCrop(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): SuggestedCrop | null {
  if (width < 2 || height < 2 || data.length < width * height * 4) return null;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const background = [0, 1, 2, 3].map((channel) =>
    corners.reduce((sum, [x, y]) => sum + data[(y * width + x) * 4 + channel], 0) / corners.length,
  );
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foregroundCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const colourDifference = Math.hypot(
        data[index] - background[0],
        data[index + 1] - background[1],
        data[index + 2] - background[2],
      );
      const alphaDifference = Math.abs(data[index + 3] - background[3]);
      if (colourDifference < 48 && alphaDifference < 32) continue;
      foregroundCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (foregroundCount < width * height * 0.002 || maxX < minX || maxY < minY) return null;
  const paddingX = Math.max(2, Math.round((maxX - minX + 1) * 0.08));
  const paddingY = Math.max(2, Math.round((maxY - minY + 1) * 0.08));
  const left = Math.max(0, minX - paddingX);
  const top = Math.max(0, minY - paddingY);
  const right = Math.min(width, maxX + 1 + paddingX);
  const bottom = Math.min(height, maxY + 1 + paddingY);
  return {
    x: (left / width) * 100,
    y: (top / height) * 100,
    width: ((right - left) / width) * 100,
    height: ((bottom - top) / height) * 100,
  };
}
