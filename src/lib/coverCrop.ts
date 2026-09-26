/**
 * object-fit: cover — scale image to fill frame, center, crop overflow
 * (no stretch / letterbox). Pure math shared by Composition + tests.
 */
export function coverCropRect(
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; width: number; height: number } {
  if (naturalW <= 0 || naturalH <= 0 || frameW <= 0 || frameH <= 0) {
    return { x: frameX, y: frameY, width: frameW, height: frameH };
  }
  const scale = Math.max(frameW / naturalW, frameH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    x: frameX + (frameW - width) / 2,
    y: frameY + (frameH - height) / 2,
    width,
    height,
  };
}
