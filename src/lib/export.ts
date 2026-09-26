import { jsPDF } from "jspdf";
import { urlToDataUrl } from "@/lib/mediaUrl";
import type { TemplateDefinition } from "@/types";

export type ImagePreset = "digital" | "high" | "print";

const SCALES: Record<ImagePreset, number> = {
  digital: 1,
  high: 2,
  print: 3,
};

const XLINK_NS = "http://www.w3.org/1999/xlink";

export async function waitForFonts(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

function readImageHref(image: SVGImageElement): string {
  return (
    image.getAttribute("href") ||
    image.getAttributeNS(XLINK_NS, "href") ||
    image.getAttribute("xlink:href") ||
    ""
  );
}

function writeImageHref(image: SVGImageElement, href: string) {
  image.setAttribute("href", href);
  image.setAttributeNS(XLINK_NS, "href", href);
  image.setAttribute("xlink:href", href);
}

/**
 * Embed remote/blob image hrefs as data URLs so SVG→canvas rasterization includes
 * photos (blob URLs and cross-origin Storage URLs fail inside a serialized SVG blob).
 */
async function inlineSvgImages(clone: SVGSVGElement): Promise<void> {
  const images = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    images.map(async (node) => {
      const image = node as SVGImageElement;
      const href = readImageHref(image);
      if (!href || href.startsWith("data:")) return;
      try {
        const dataUrl = await urlToDataUrl(href);
        writeImageHref(image, dataUrl);
      } catch {
        // Leave original href — export may still succeed for other layers.
      }
    }),
  );
}

/**
 * Prepare a live preview SVG for rasterization:
 * - absolute width/height
 * - xlink namespace + dual href/xlink:href on images
 * - images inlined as data URLs (photos survive PNG/PDF)
 * - clip-path attributes normalized so url(#id) resolves inside the blob SVG
 */
async function prepareSvgClone(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = Number(svg.viewBox.baseVal.width || svg.clientWidth || 1080);
  const height = Number(svg.viewBox.baseVal.height || svg.clientHeight || 1512);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", XLINK_NS);

  // Hoist nested <defs> clipPaths under a single top-level defs so references stay valid.
  const rootDefs =
    clone.querySelector(":scope > defs") ??
    (() => {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      clone.insertBefore(defs, clone.firstChild);
      return defs;
    })();

  clone.querySelectorAll("defs").forEach((defs) => {
    if (defs === rootDefs) return;
    Array.from(defs.childNodes).forEach((child) => {
      rootDefs.appendChild(child);
    });
    defs.remove();
  });

  clone.querySelectorAll("image").forEach((node) => {
    const image = node as SVGImageElement;
    const href = readImageHref(image);
    if (href) writeImageHref(image, href);
    // Ensure cover-crop survives rasterize even if natural-size layout wasn't ready.
    if (!image.getAttribute("preserveAspectRatio")) {
      image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    }
  });

  await inlineSvgImages(clone);

  // React may leave clipPath camelCase; blob SVG rasterizers expect clip-path.
  clone.querySelectorAll("[clipPath], [clip-path]").forEach((el) => {
    const value = el.getAttribute("clip-path") || el.getAttribute("clipPath");
    if (!value) return;
    el.setAttribute("clip-path", value);
    el.removeAttribute("clipPath");
  });

  return clone;
}

export async function rasterizeSvg(svg: SVGSVGElement, scale: number): Promise<HTMLCanvasElement> {
  await waitForFonts();
  const clone = await prepareSvgClone(svg);
  const width = Number(clone.getAttribute("width") || 1080);
  const height = Number(clone.getAttribute("height") || 1512);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportImage(
  svg: SVGSVGElement,
  preset: ImagePreset = "high",
  type: "image/png" | "image/jpeg" = "image/png",
): Promise<Blob> {
  const canvas = await rasterizeSvg(svg, SCALES[preset]);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.95));
  if (!blob) throw new Error("Unable to generate the image. Your design is safe — retry export.");
  return blob;
}

export async function exportPdf(svg: SVGSVGElement, template: TemplateDefinition): Promise<Blob> {
  const canvas = await rasterizeSvg(svg, 3);
  const { printWidth, printHeight, printUnit } = template.dimensions;
  const pdf = new jsPDF({
    orientation: printWidth > printHeight ? "landscape" : "portrait",
    unit: printUnit,
    format: [printWidth, printHeight],
    compress: true,
  });
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  pdf.addImage(dataUrl, "JPEG", 0, 0, printWidth, printHeight);
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to rasterize the invitation. Retry export."));
    image.src = url;
  });
}
