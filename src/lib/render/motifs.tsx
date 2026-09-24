import type { MotifKind } from "@/types";

type Props = {
  kind: MotifKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

export function Motif({ kind, x, y, width, height, fill }: Props) {
  const cx = x;
  const cy = y;
  if (kind === "floral") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.4">
        <path d="M-70 0 C-40 -28, -20 -28, 0 0 C20 -28, 40 -28, 70 0" />
        <path d="M-70 0 C-40 28, -20 28, 0 0 C20 28, 40 28, 70 0" />
        <circle cx="0" cy="0" r="4" fill={fill} stroke="none" />
      </g>
    );
  }
  if (kind === "diamond") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.4">
        <path d="M-80 0 L0 -16 L80 0 L0 16 Z" />
        <path d="M-36 0 L0 -8 L36 0 L0 8 Z" />
      </g>
    );
  }
  if (kind === "lamp") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.5">
        <path d="M-18 18 Q0 34 18 18" />
        <path d="M-12 10 Q0 -18 12 10" />
        <circle cx="0" cy="-2" r="3" fill={fill} stroke="none" />
        <path d="M-48 28 H48" />
      </g>
    );
  }
  if (kind === "mandala") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.2">
        <circle r="22" />
        <circle r="10" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <circle key={i} cx={Math.cos(a) * 22} cy={Math.sin(a) * 22} r="5" />;
        })}
      </g>
    );
  }
  if (kind === "dots") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill={fill}>
        {[-60, -30, 0, 30, 60].map((dx) => (
          <circle key={dx} cx={dx} cy="0" r={dx === 0 ? 3.5 : 2.2} />
        ))}
      </g>
    );
  }
  if (kind === "sun") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.4">
        <circle r="12" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <line key={i} x1={Math.cos(a) * 18} y1={Math.sin(a) * 18} x2={Math.cos(a) * 28} y2={Math.sin(a) * 28} />;
        })}
      </g>
    );
  }
  if (kind === "lotus") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.35">
        <path d="M0 18 C-18 8 -22 -6 -8 -16 C-2 -6 2 -6 8 -16 C22 -6 18 8 0 18 Z" />
        <path d="M-22 10 C-28 -4 -14 -18 0 -8" />
        <path d="M22 10 C28 -4 14 -18 0 -8" />
        <circle cx="0" cy="-2" r="3" fill={fill} stroke="none" />
      </g>
    );
  }
  if (kind === "paisley") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.4">
        <path d="M-8 22 C-28 8 -24 -18 0 -24 C18 -20 26 -2 10 10 C4 16 -2 18 -8 22 Z" />
        <path d="M-2 8 C-10 0 -6 -12 4 -10 C10 -8 8 2 0 6" />
        <circle cx="2" cy="-4" r="2.5" fill={fill} stroke="none" />
      </g>
    );
  }
  if (kind === "om") {
    return (
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill={fill}
        fontSize={Math.min(width, height) * 0.72}
        fontFamily='"Noto Sans Devanagari", "Noto Serif Devanagari", Georgia, serif'
      >
        ॐ
      </text>
    );
  }
  if (kind === "ganesh") {
    // Simplified auspicious Ganesha mark (ears + crown + trunk)
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.6" strokeLinecap="round">
        <path d="M-22 -6 Q-34 -18 -22 -28 Q-8 -34 0 -28 Q8 -34 22 -28 Q34 -18 22 -6" />
        <ellipse cx="0" cy="2" rx="14" ry="16" />
        <path d="M0 10 Q8 22 4 30 Q0 34 -6 28" />
        <circle cx="-6" cy="-2" r="1.8" fill={fill} stroke="none" />
        <circle cx="6" cy="-2" r="1.8" fill={fill} stroke="none" />
        <path d="M-10 8 Q0 14 10 8" />
      </g>
    );
  }
  if (kind === "swastik") {
    // Traditional Hindu/Jain auspicious swastik (right-facing)
    const s = 10;
    return (
      <g transform={`translate(${cx} ${cy})`} fill={fill} stroke="none">
        <rect x={-s / 2} y={-s * 2.2} width={s} height={s * 4.4} />
        <rect x={-s * 2.2} y={-s / 2} width={s * 4.4} height={s} />
        <rect x={s / 2} y={-s * 2.2} width={s * 1.7} height={s} />
        <rect x={-s * 2.2} y={s / 2} width={s} height={s * 1.7} />
        <rect x={-s * 2.2 - s * 0.7} y={-s * 2.2} width={s * 1.7} height={s} />
        <rect x={s / 2} y={s * 1.2} width={s * 1.7} height={s} />
      </g>
    );
  }
  if (kind === "krishna") {
    // Peacock feather + flute suggestion
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round">
        <ellipse cx="0" cy="-10" rx="10" ry="16" />
        <ellipse cx="0" cy="-10" rx="5" ry="9" />
        <circle cx="0" cy="-12" r="2.5" fill={fill} stroke="none" />
        <path d="M0 6 L0 28" />
        <path d="M-22 8 H22" />
        <path d="M-18 8 Q-18 0 -10 2" />
        <path d="M18 8 Q18 0 10 2" />
        <circle cx="-14" cy="8" r="1.6" fill={fill} stroke="none" />
        <circle cx="-4" cy="8" r="1.6" fill={fill} stroke="none" />
        <circle cx="4" cy="8" r="1.6" fill={fill} stroke="none" />
        <circle cx="14" cy="8" r="1.6" fill={fill} stroke="none" />
      </g>
    );
  }
  if (kind === "cross") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill={fill} stroke="none">
        <rect x={-5} y={-28} width={10} height={56} rx={1} />
        <rect x={-18} y={-12} width={36} height={10} rx={1} />
      </g>
    );
  }
  if (kind === "crescent") {
    return (
      <g transform={`translate(${cx} ${cy})`} fill="none" stroke={fill} strokeWidth="2">
        <path d="M8 -22 A24 24 0 1 0 8 22 A16 16 0 1 1 8 -22" fill={fill} stroke="none" />
        <polygon
          points="18,-6 21,-14 24,-6 32,-6 25,-1 28,7 21,2 14,7 17,-1"
          fill={fill}
          stroke="none"
        />
      </g>
    );
  }
  return (
    <g transform={`translate(${cx} ${cy})`} stroke={fill} strokeWidth="1.2">
      <line x1={-width / 3} y1={0} x2={width / 3} y2={0} />
      <line x1={0} y1={-height / 4} x2={0} y2={height / 4} />
    </g>
  );
}
