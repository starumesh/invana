import type { DecorKind } from "@/types";

type Props = {
  kind: DecorKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

/** Decorative design pieces — vines, scallops, lace, arches — drawn as real SVG geometry. */
export function Decor({ kind, x, y, width, height, color }: Props) {
  if (kind === "floral-vine-top") {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.5">
        <path d={`M0 ${height * 0.55} C ${width * 0.12} 0, ${width * 0.2} ${height}, ${width * 0.32} ${height * 0.45}`} />
        <path d={`M${width * 0.28} ${height * 0.5} C ${width * 0.4} ${height}, ${width * 0.48} 0, ${width * 0.6} ${height * 0.5}`} />
        <path d={`M${width * 0.56} ${height * 0.48} C ${width * 0.68} ${height}, ${width * 0.78} 0, ${width} ${height * 0.55}`} />
        {[0.12, 0.28, 0.44, 0.6, 0.76, 0.9].map((t, i) => (
          <g key={t} transform={`translate(${width * t} ${height * (i % 2 === 0 ? 0.22 : 0.62)})`}>
            <path d="M0 0 C-10 -14 10 -14 0 0 C-10 14 10 14 0 0" />
            <circle r="2.5" fill={color} stroke="none" />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "floral-vine-bottom") {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.5">
        <path d={`M0 ${height * 0.4} C ${width * 0.15} ${height}, ${width * 0.25} 0, ${width * 0.4} ${height * 0.5}`} />
        <path d={`M${width * 0.38} ${height * 0.48} C ${width * 0.52} 0, ${width * 0.62} ${height}, ${width * 0.76} ${height * 0.45}`} />
        <path d={`M${width * 0.74} ${height * 0.42} C ${width * 0.86} ${height}, ${width * 0.92} 0, ${width} ${height * 0.4}`} />
        {[0.1, 0.26, 0.42, 0.58, 0.74, 0.9].map((t, i) => (
          <g key={t} transform={`translate(${width * t} ${height * (i % 2 ? 0.25 : 0.65)}) rotate(${i % 2 ? 20 : -20})`}>
            <ellipse rx="9" ry="14" />
            <ellipse rx="6" ry="10" transform="rotate(45)" />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "scallop-frame") {
    const r = 18;
    const cols = Math.max(4, Math.floor(width / (r * 2)));
    const rows = Math.max(4, Math.floor(height / (r * 2)));
    const dx = width / cols;
    const dy = height / rows;
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.4">
        {Array.from({ length: cols + 1 }, (_, i) => (
          <path key={`t${i}`} d={`M${i * dx} 0 a ${r} ${r} 0 0 1 ${dx} 0`} />
        ))}
        {Array.from({ length: cols + 1 }, (_, i) => (
          <path key={`b${i}`} d={`M${i * dx} ${height} a ${r} ${r} 0 0 0 ${dx} 0`} />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <path key={`l${i}`} d={`M0 ${i * dy} a ${r} ${r} 0 0 0 0 ${dy}`} />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <path key={`r${i}`} d={`M${width} ${i * dy} a ${r} ${r} 0 0 1 0 ${dy}`} />
        ))}
      </g>
    );
  }

  if (kind === "corner-flourish") {
    const arm = Math.min(width, height) * 0.85;
    return (
      <g fill="none" stroke={color} strokeWidth="1.5">
        {[
          { tx: x, ty: y, rot: 0 },
          { tx: x + width, ty: y, rot: 90 },
          { tx: x + width, ty: y + height, rot: 180 },
          { tx: x, ty: y + height, rot: 270 },
        ].map((c) => (
          <g key={c.rot} transform={`translate(${c.tx} ${c.ty}) rotate(${c.rot})`}>
            <path d={`M0 0 Q ${arm * 0.35} ${arm * 0.08} ${arm * 0.7} 0`} />
            <path d={`M0 0 Q ${arm * 0.08} ${arm * 0.35} 0 ${arm * 0.7}`} />
            <path d={`M${arm * 0.15} ${arm * 0.15} Q ${arm * 0.4} ${arm * 0.05} ${arm * 0.55} ${arm * 0.25}`} />
            <path d={`M${arm * 0.12} ${arm * 0.12} C ${arm * 0.05} ${arm * 0.35} ${arm * 0.35} ${arm * 0.4} ${arm * 0.28} ${arm * 0.18}`} />
            <circle cx={arm * 0.22} cy={arm * 0.22} r="3" fill={color} stroke="none" />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "side-vine") {
    const drawVine = (flip: boolean) => (
      <g transform={flip ? `translate(${x + width} ${y}) scale(-1,1)` : `translate(${x} ${y})`}>
        <path
          d={`M24 0 C 48 ${height * 0.2}, 0 ${height * 0.35}, 24 ${height * 0.5} C 48 ${height * 0.65}, 0 ${height * 0.8}, 24 ${height}`}
          fill="none"
          stroke={color}
          strokeWidth="1.4"
        />
        {[0.15, 0.35, 0.55, 0.75, 0.9].map((t, i) => (
          <g key={t} transform={`translate(${i % 2 ? 8 : 40} ${height * t})`} fill="none" stroke={color} strokeWidth="1.4">
            <path d="M0 0 C-8 -12 8 -12 0 0 C-8 12 8 12 0 0" />
          </g>
        ))}
      </g>
    );
    return (
      <g>
        {drawVine(false)}
        {drawVine(true)}
      </g>
    );
  }

  if (kind === "lace-corners") {
    const s = Math.min(width, height) * 0.22;
    return (
      <g fill="none" stroke={color} strokeWidth="1.2">
        {[
          [x, y, 0],
          [x + width, y, 90],
          [x + width, y + height, 180],
          [x, y + height, 270],
        ].map(([tx, ty, rot], i) => (
          <g key={i} transform={`translate(${tx} ${ty}) rotate(${rot})`}>
            <circle r={s * 0.35} />
            <circle r={s * 0.2} />
            {Array.from({ length: 6 }, (_, j) => {
              const a = (j * Math.PI) / 6;
              return (
                <path
                  key={j}
                  d={`M0 0 Q ${Math.cos(a) * s * 0.5} ${Math.sin(a) * s * 0.5} ${Math.cos(a) * s} ${Math.sin(a) * s}`}
                />
              );
            })}
          </g>
        ))}
      </g>
    );
  }

  if (kind === "arch-top") {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.8">
        <path d={`M0 ${height} L0 ${height * 0.45} Q ${width / 2} ${-height * 0.15} ${width} ${height * 0.45} L${width} ${height}`} />
        <path d={`M24 ${height} L24 ${height * 0.48} Q ${width / 2} ${height * 0.05} ${width - 24} ${height * 0.48} L${width - 24} ${height}`} />
        <g transform={`translate(${width / 2} ${height * 0.28})`}>
          <path d="M0 0 C-16 -20 16 -20 0 0" />
          <path d="M-22 8 C-30 -8 -10 -18 0 -6" />
          <path d="M22 8 C30 -8 10 -18 0 -6" />
          <circle r="3" fill={color} stroke="none" />
        </g>
      </g>
    );
  }

  if (kind === "leaf-spray") {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.4">
        {[-50, -30, -10, 10, 30, 50].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d={`M0 0 Q ${8 + i} ${-28 - i * 2} 0 ${-48 - i * 3}`} />
            <ellipse cx="0" cy={-30 - i * 2} rx="5" ry="12" transform={`rotate(${deg / 3})`} />
          </g>
        ))}
        <circle r="3.5" fill={color} stroke="none" />
      </g>
    );
  }

  if (kind === "mehendi-band") {
    const count = Math.max(6, Math.floor(width / 70));
    const step = width / count;
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.3">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} />
        {Array.from({ length: count }, (_, i) => (
          <g key={i} transform={`translate(${step * i + step / 2} ${height / 2})`}>
            <circle r="8" />
            <path d="M0 -8 Q -10 -20 0 -28 Q 10 -20 0 -8" />
            <path d="M0 8 Q -10 20 0 28 Q 10 20 0 8" />
            <path d="M-8 0 Q -20 -8 -28 0 Q -20 8 -8 0" />
            <path d="M8 0 Q 20 -8 28 0 Q 20 8 8 0" />
            <circle r="2.5" fill={color} stroke="none" />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "peacock-fan") {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.4">
        {[-60, -40, -20, 0, 20, 40, 60].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M0 0 Q 8 -55 0 -95" />
            <ellipse cx="0" cy="-70" rx="10" ry="16" />
            <circle cx="0" cy="-72" r="4" />
            <circle cx="0" cy="-72" r="1.8" fill={color} stroke="none" />
          </g>
        ))}
        <circle r="5" fill={color} stroke="none" />
      </g>
    );
  }

  if (kind === "garland-top") {
    const blooms = 9;
    const step = width / (blooms - 1);
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.4">
        <path d={`M0 ${height * 0.65} Q ${width / 2} ${height * 0.05} ${width} ${height * 0.65}`} />
        {Array.from({ length: blooms }, (_, i) => {
          const px = step * i;
          const py = height * 0.65 - Math.sin((i / (blooms - 1)) * Math.PI) * height * 0.5;
          return (
            <g key={i} transform={`translate(${px} ${py})`}>
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <ellipse key={a} rx="5" ry="10" transform={`rotate(${a})`} />
              ))}
              <circle r="3" fill={color} stroke="none" />
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "section-ornament") {
    const mid = width / 2;
    const cy = height / 2;
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="1.25">
        <line x1="0" y1={cy} x2={mid - 36} y2={cy} />
        <line x1={mid + 36} y1={cy} x2={width} y2={cy} />
        <g transform={`translate(${mid} ${cy})`}>
          <path d="M-28 0 C-16 -14, -8 -14, 0 0 C8 -14, 16 -14, 28 0" />
          <path d="M-28 0 C-16 14, -8 14, 0 0 C8 14, 16 14, 28 0" />
          <path d="M0 -10 C-6 -2 6 -2 0 -10" />
          <path d="M0 10 C-6 2 6 2 0 10" />
          <circle r="3.2" fill={color} stroke="none" />
          <circle r="7" />
        </g>
        <path d={`M8 ${cy} q 6 -5 12 0`} />
        <path d={`M${width - 8} ${cy} q -6 -5 -12 0`} />
      </g>
    );
  }

  if (kind === "floral-corners") {
    const arm = Math.min(width, height) * 0.22;
    return (
      <g fill="none" stroke={color} strokeWidth="1.35">
        {[
          { tx: x, ty: y, rot: 0 },
          { tx: x + width, ty: y, rot: 90 },
          { tx: x + width, ty: y + height, rot: 180 },
          { tx: x, ty: y + height, rot: 270 },
        ].map((c) => (
          <g key={c.rot} transform={`translate(${c.tx} ${c.ty}) rotate(${c.rot})`}>
            <path d={`M0 ${arm} L0 0 L${arm} 0`} />
            <path d={`M0 ${arm * 0.55} Q ${arm * 0.18} ${arm * 0.18} ${arm * 0.55} 0`} />
            <path d={`M${arm * 0.12} ${arm * 0.12} C ${arm * 0.05} ${arm * 0.42} ${arm * 0.42} ${arm * 0.48} ${arm * 0.38} ${arm * 0.2}`} />
            <path d={`M${arm * 0.2} ${arm * 0.08} Q ${arm * 0.55} ${arm * 0.02} ${arm * 0.72} ${arm * 0.28}`} />
            <path d={`M${arm * 0.08} ${arm * 0.2} Q ${arm * 0.02} ${arm * 0.55} ${arm * 0.28} ${arm * 0.72}`} />
            <g transform={`translate(${arm * 0.28} ${arm * 0.28})`}>
              {[0, 45, 90, 135].map((a) => (
                <ellipse key={a} rx="4" ry="9" transform={`rotate(${a})`} />
              ))}
              <circle r="2.8" fill={color} stroke="none" />
            </g>
            <path d={`M${arm * 0.5} ${arm * 0.12} C ${arm * 0.62} ${arm * 0.05} ${arm * 0.78} ${arm * 0.18} ${arm * 0.7} ${arm * 0.32}`} />
          </g>
        ))}
      </g>
    );
  }

  // ornate-corners
  const o = Math.min(width, height) * 0.28;
  return (
    <g fill="none" stroke={color} strokeWidth="1.5">
      {[
        [x, y, 0],
        [x + width, y, 90],
        [x + width, y + height, 180],
        [x, y + height, 270],
      ].map(([tx, ty, rot], i) => (
        <g key={i} transform={`translate(${tx} ${ty}) rotate(${rot})`}>
          <path d={`M0 ${o} L0 0 L${o} 0`} />
          <path d={`M12 ${o * 0.85} Q 12 12 ${o * 0.85} 12`} />
          <path d={`M0 ${o * 0.45} Q ${o * 0.2} ${o * 0.2} ${o * 0.45} 0`} />
          <circle cx={o * 0.28} cy={o * 0.28} r="3.5" />
          <path d={`M${o * 0.45} ${o * 0.15} Q ${o * 0.7} ${o * 0.05} ${o * 0.85} ${o * 0.35}`} />
        </g>
      ))}
    </g>
  );
}
