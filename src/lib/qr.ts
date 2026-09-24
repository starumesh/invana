import QRCode from "qrcode";

export async function qrMatrix(value: string): Promise<boolean[][]> {
  if (!value) return [];
  const code = await QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = code.modules.size;
  const rows: boolean[][] = [];
  for (let y = 0; y < size; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x += 1) {
      row.push(code.modules.get(x, y) === 1);
    }
    rows.push(row);
  }
  return rows;
}

export function qrSvg(modules: boolean[][], size: number, color = "#1c1917"): string {
  if (!modules.length) return "";
  const count = modules.length;
  const cell = size / (count + 8);
  const offset = cell * 4;
  const rects = modules
    .flatMap((row, y) =>
      row.map((on, x) =>
        on
          ? `<rect x="${(offset + x * cell).toFixed(2)}" y="${(offset + y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${color}"/>`
          : "",
      ),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rects}</svg>`;
}
