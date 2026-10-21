import {
  COLLAGE_BANNER_HEIGHT,
  COLLAGE_BANNER_WIDTH,
  collageLayoutBanner,
  coverCrop,
} from "@/lib/collageLayout";

const BACKGROUND = "#f3ebe0";
const SLOT_RADIUS = 10;

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load a photo for the collage.");
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create the collage image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  slot: { x: number; y: number; width: number; height: number },
) {
  const crop = coverCrop(bitmap.width, bitmap.height, slot.width, slot.height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(slot.x, slot.y, slot.width, slot.height, SLOT_RADIUS);
  ctx.clip();
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, slot.x, slot.y, slot.width, slot.height);
  ctx.restore();
}

/** Draw photos into a 16:9 JPEG collage (for download). */
export async function renderCollage(urls: string[]): Promise<Blob> {
  const slots = collageLayoutBanner(urls.length);
  if (!slots.length) throw new Error("Choose at least one photo for the collage.");

  const canvas = document.createElement("canvas");
  canvas.width = COLLAGE_BANNER_WIDTH;
  canvas.height = COLLAGE_BANNER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the collage in this browser.");

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const url = urls[i];
    if (!slot || !url) continue;
    try {
      const bitmap = await loadBitmap(url);
      try {
        drawRoundedImage(ctx, bitmap, slot);
      } finally {
        bitmap.close();
      }
    } catch {
      ctx.fillStyle = "#e8dccb";
      ctx.beginPath();
      ctx.roundRect(slot.x, slot.y, slot.width, slot.height, SLOT_RADIUS);
      ctx.fill();
    }
  }

  return canvasToBlob(canvas);
}
