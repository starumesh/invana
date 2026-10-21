import { COLLAGE_SIZE, collageLayout, coverCrop } from "@/lib/collageLayout";

const BACKGROUND = "#f3ebe0";

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load a photo for the collage.");
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the collage image."));
    }, "image/jpeg", 0.9);
  });
}

/** Draw the selected photo URLs into one square JPEG. */
export async function renderCollage(urls: string[]): Promise<Blob> {
  const slots = collageLayout(urls.length);
  if (!slots.length) throw new Error("Choose at least one photo for the collage.");

  const canvas = document.createElement("canvas");
  canvas.width = COLLAGE_SIZE;
  canvas.height = COLLAGE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the collage in this browser.");

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, COLLAGE_SIZE, COLLAGE_SIZE);

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const url = urls[i];
    if (!slot || !url) continue;
    try {
      const bitmap = await loadBitmap(url);
      try {
        const crop = coverCrop(bitmap.width, bitmap.height, slot.width, slot.height);
        ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, slot.x, slot.y, slot.width, slot.height);
      } finally {
        bitmap.close();
      }
    } catch {
      ctx.fillStyle = "#e8dccb";
      ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
    }
  }

  return canvasToBlob(canvas);
}
