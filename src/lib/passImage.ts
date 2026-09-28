import { formatEventDate, formatEventTime, GUEST_ROLE_LABELS, type GuestPassView } from "@event-core";
import { downloadFile } from "@/lib/download";
import { qrMatrix } from "@/lib/qr";

const W = 1080;
const H = 1720;

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1)}…`;
    return kept;
  }
  return lines;
}

/** Standalone SVG of the pass (download / print). Mirrors the on-screen PassCard. */
export async function passSvg(view: GuestPassView): Promise<string> {
  const modules = await qrMatrix(view.qrPayload);
  const qrSize = 620;
  const qrX = (W - qrSize) / 2;
  const qrY = 820;
  const cell = qrSize / (modules.length + 4);
  const qrRects = modules
    .flatMap((row, y) =>
      row.map((on, x) =>
        on ? `<rect x="${(qrX + (x + 2) * cell).toFixed(2)}" y="${(qrY + (y + 2) * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>` : "",
      ),
    )
    .join("");
  const e = view.event;
  const nameLines = wrap(e.name, 26, 2);
  const venue = [e.venueName, e.city].filter(Boolean).join(", ");
  const text = (x: number, y: number, size: number, value: string, opts = "") =>
    `<text x="${x}" y="${y}" font-size="${size}" ${opts}>${esc(value)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif">
  <rect width="${W}" height="${H}" rx="48" fill="#faf7f2"/>
  <rect width="${W}" height="560" rx="48" fill="#1c1917"/>
  <rect y="500" width="${W}" height="60" fill="#1c1917"/>
  ${text(80, 120, 34, "INVANA · EVENT PASS", 'fill="#d4b896" letter-spacing="6"')}
  ${nameLines.map((l, i) => text(80, 220 + i * 78, 68, l, 'fill="#faf7f2" font-family="Georgia, serif"')).join("")}
  ${text(80, 400, 36, `${formatEventDate(e.startDatetime, e.timezone)} · ${formatEventTime(e.startDatetime, e.timezone)}`, 'fill="#e8dccb"')}
  ${text(80, 460, 32, venue.slice(0, 48), 'fill="#e8dccb" opacity="0.8"')}
  ${text(80, 650, 28, "GUEST", 'fill="#8c6d45" letter-spacing="4"')}
  ${text(80, 715, 56, view.guest.name.slice(0, 30), 'fill="#1c1917" font-weight="600"')}
  <rect x="${W - 80 - 280}" y="628" width="280" height="72" rx="36" fill="#b8956a"/>
  ${text(W - 80 - 140, 676, 32, GUEST_ROLE_LABELS[view.guest.role], 'fill="#1c1917" text-anchor="middle" font-weight="600"')}
  <rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" rx="24" fill="#ffffff" stroke="#e8dccb" stroke-width="4"/>
  <g fill="#1c1917">${qrRects}</g>
  ${text(W / 2, 1530, 44, view.pass.publicId, 'fill="#1c1917" text-anchor="middle" font-family="Menlo, monospace" font-weight="600"')}
  ${text(W / 2, 1600, 32, "Show this pass at entrance", 'fill="#57534e" text-anchor="middle"')}
</svg>`;
}

export async function downloadPassPng(view: GuestPassView): Promise<void> {
  const svg = await passSvg(view);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Unable to render the pass image. Try Print instead."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to render the pass image. Try Print instead.");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Unable to render the pass image. Try Print instead.");
    downloadFile(blob, `${view.pass.publicId}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
