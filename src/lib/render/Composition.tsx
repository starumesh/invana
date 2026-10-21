import { useEffect, useId, useState } from "react";
import { mergedColors, resolveFields } from "@/lib/fields";
import { qrMatrix } from "@/lib/qr";
import { Decor } from "@/lib/render/Decor";
import { Motif } from "@/lib/render/motifs";
import { fitFontSize, wrapText } from "@/lib/render/text";
import type { ElementSpec, RenderInput, TemplateDefinition } from "@/types";

type Props = {
  template: TemplateDefinition;
  input: RenderInput;
  guestName?: string;
  className?: string;
};

export function Composition({ template, input, guestName, className }: Props) {
  const colors = mergedColors(template, input.theme);
  const values = resolveFields(template, input, guestName);
  const { width, height } = template.dimensions;
  const qrValue = values.qrUrl;
  const uid = useId().replace(/:/g, "");
  const [modules, setModules] = useState<boolean[][]>([]);

  useEffect(() => {
    let active = true;
    if (!qrValue) {
      setModules([]);
      return;
    }
    qrMatrix(qrValue).then((next) => {
      if (active) setModules(next);
    });
    return () => {
      active = false;
    };
  }, [qrValue]);

  // ── Custom full-SVG render for south-indian-wedding-royal ──
  if (template.id === "south-indian-wedding-royal") {
    return (
      <svg
        data-composition="true"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={template.name}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <SouthIndianWeddingRoyalSVG values={values} W={width} H={height} />
      </svg>
    );
  }

  return (
    <svg
      data-composition="true"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={template.name}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {template.background.type === "gradient" ? (
        <defs>
          <linearGradient id={`bg-${uid}-${template.id}`} x1="0" y1="0" x2="0" y2="1">
            {template.background.colors.map((color, index) => (
              <stop key={color} offset={`${(index / Math.max(1, template.background.colors.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      {template.elements.map((element) => (
        <ElementNode
          key={element.id}
          element={element}
          values={values}
          colors={colors}
          modules={modules}
          uid={uid}
        />
      ))}
    </svg>
  );
}

function ElementNode({
  element,
  values,
  colors,
  modules,
  uid,
}: {
  element: ElementSpec;
  values: Record<string, string>;
  colors: Record<string, string>;
  modules: boolean[][];
  uid: string;
}) {
  const fill = token(element.fill, colors);
  const stroke = token(element.stroke, colors);

  if (element.type === "rect") {
    return (
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill={fill}
        rx={element.rx}
        opacity={element.opacity}
      />
    );
  }
  if (element.type === "frame") {
    return (
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="none"
        stroke={stroke}
        strokeWidth={element.strokeWidth ?? 1}
        opacity={element.opacity}
      />
    );
  }
  if (element.type === "line") {
    return (
      <line
        x1={element.x}
        y1={element.y}
        x2={element.x + (element.width ?? 0)}
        y2={element.y}
        stroke={stroke}
        strokeWidth={element.strokeWidth ?? 1}
      />
    );
  }
  if (element.type === "circle") {
    return <circle cx={element.x} cy={element.y} r={(element.width ?? 10) / 2} fill={fill} />;
  }
  if (element.type === "motif" && element.motif) {
    return (
      <Motif
        kind={element.motif}
        x={element.x}
        y={element.y}
        width={element.width ?? 120}
        height={element.height ?? 40}
        fill={fill || colors.accent}
      />
    );
  }
  if (element.type === "decor" && element.decor) {
    return (
      <Decor
        kind={element.decor}
        x={element.x}
        y={element.y}
        width={element.width ?? 200}
        height={element.height ?? 80}
        color={fill || stroke || colors.accent}
      />
    );
  }
  if (element.type === "image") {
    const href = element.field ? values[element.field] : "";
    const x = element.x ?? 0;
    const y = element.y ?? 0;
    const w = element.width ?? 0;
    const h = element.height ?? 0;
    const rx = element.rx ?? 0;
    if (!href) {
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={colors.line} opacity="0.35" rx={rx} />
          <text
            x={x + w / 2}
            y={y + h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={colors.muted}
            fontSize="18"
            fontFamily="Inter, system-ui, sans-serif"
          >
            Photo
          </text>
        </g>
      );
    }
    return <CoverCropImage href={href} x={x} y={y} width={w} height={h} rx={rx} clipId={`img-clip-${uid}-${element.id}`} />;
  }
  if (element.type === "qr") {
    if (!modules.length) return null;
    const size = element.width ?? 120;
    const count = modules.length;
    const cell = size / (count + 8);
    const offset = cell * 4;
    return (
      <g transform={`translate(${element.x} ${element.y})`}>
        <rect width={size} height={size} fill="#fff" />
        {modules.flatMap((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect
                key={`${x}-${y}`}
                x={offset + x * cell}
                y={offset + y * cell}
                width={cell}
                height={cell}
                fill={colors.ink}
              />
            ) : null,
          ),
        )}
      </g>
    );
  }
  if (element.type === "text") {
    const raw =
      element.staticText ??
      (element.field
        ? values[element.field] ??
          (element.field === "primaryName" ? values.brideName : undefined) ??
          (element.field === "secondaryName" ? values.groomName : undefined) ??
          ""
        : "");
    if (!raw) return null;
    const transformed = element.textTransform === "uppercase" ? raw.toUpperCase() : raw;
    const maxWidth = element.width ?? 800;
    const fontSize = fitFontSize(transformed, maxWidth, element.fontSize ?? 24);
    const lines = wrapText(transformed, maxWidth, fontSize, element.letterSpacing ?? 0).slice(0, element.maxLines ?? 24);
    const lineHeight = fontSize * (element.lineHeight ?? 1.15);
    const anchor = element.textAnchor ?? "start";
    return (
      <text
        x={element.x}
        y={element.y}
        fill={fill}
        fontFamily={element.fontFamily}
        fontSize={fontSize}
        fontWeight={element.fontWeight ?? 500}
        letterSpacing={element.letterSpacing}
        textAnchor={anchor}
        xmlSpace="preserve"
      >
        {lines.map((line, index) => (
          <tspan key={`${index}-${line.slice(0, 12)}`} x={element.x} dy={index === 0 ? 0 : lineHeight}>
            {line || "\u00a0"}
          </tspan>
        ))}
      </text>
    );
  }
  return null;
}

/**
 * Cover-crop a photo into the template slot (CSS object-fit: cover).
 *
 * Always use frame-sized <image preserveAspectRatio="xMidYMid slice"> + clipPath.
 * Do NOT size from HTML Image naturalWidth with preserveAspectRatio="none":
 * browsers often report EXIF-oriented dimensions while SVG draws the raw bitmap,
 * which stretches or letterboxes phone photos in the slot.
 *
 * New uploads go through prepareImageForUpload (orientation baked into pixels),
 * so slice + clip fills correctly in builder, invite, and PNG/PDF export.
 */
function CoverCropImage({
  href,
  x,
  y,
  width,
  height,
  rx,
  clipId,
}: {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  clipId: string;
}) {
  return (
    <g>
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={x} y={y} width={width} height={height} rx={rx} ry={rx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={href}
          xlinkHref={href}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          data-cover-crop="true"
          data-cover-frame={`${x},${y},${width},${height}`}
        />
      </g>
    </g>
  );
}

function token(value: string | undefined, colors: Record<string, string>): string | undefined {
  if (!value) return value;
  return colors[value] ?? value;
}

// ─────────────────────────────────────────────────────────────────
// South-Indian Wedding Royal — fully hand-crafted SVG template
// Faithfully recreates the Telugu wedding arch invitation style:
// purple floral arch, gold pillars, script names, 3-column info boxes
// ─────────────────────────────────────────────────────────────────
function SouthIndianWeddingRoyalSVG({
  values,
  W,
  H,
}: {
  values: Record<string, string>;
  W: number;
  H: number;
}) {
  // ── Palette ──
  const BG = "#faf6f0";
  const PURPLE = "#3d1a6e";
  const MED_PURPLE = "#5b2d8e";
  const ARCH_PURPLE = "#7b4fa0";
  const LAVENDER = "#c8a4e0";
  const PALE_LAV = "#ede0fa";
  const GOLD = "#b8956a";
  const GOLD_BRIGHT = "#d4a848";
  const GREEN = "#4a7a4a";
  const WHITE_ROSE = "#fff8f4";
  const GRAY = "#6b5e7a";
  const INK = "#2d1a5e";

  // ── Fonts ──
  const SERIF = "'Playfair Display', Georgia, serif";
  const SCRIPT = "'Great Vibes', cursive";
  const CORM = "'Cormorant Garamond', Georgia, serif";

  // ── Field extraction ──
  const rawBlessing = values.blessingText || "Sri rastu\nSubhamastu\nAvighnamastu";
  const blessingLines = rawBlessing.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 3);

  const brideParentsRaw = values.brideParents || "";
  const brideParentsLines = brideParentsRaw
    ? brideParentsRaw.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 2)
    : [];

  const solicitation = values.solicitationMessage || values.invitationMessage || "";
  const solicitLines = solicitation ? wrapText(solicitation, 800, 25, 0).slice(0, 4) : [];

  const brideLine = values.brideFullLine || values.brideName || "";
  const brideQual = values.brideQualLine || "";
  const groomLine = values.groomFullLine || values.groomName || "";
  const groomQual = values.groomQualLine || "";

  const parentageRaw = values.groomParentage || "";
  const parentageText = parentageRaw ? `(${parentageRaw})` : "";
  const parentageLines = parentageText ? wrapText(parentageText, 800, 22, 0).slice(0, 3) : [];

  const ceremonyName = values.ceremonyName || "Sumuhurtham";
  const dateStr = values.formattedDate || "";
  const timeStr = values.formattedTime || "";
  const lagnam = values.auspiciousTime || "";

  const venueName = values.venueName || "";
  const venueLines = venueName ? wrapText(venueName, 250, 16, 0).slice(0, 3) : [];
  const cityLineRaw = values.cityLine || "";
  const cityLines = cityLineRaw ? wrapText(cityLineRaw, 250, 15, 0).slice(0, 2) : [];

  const dinnerTime = values.dinnerTime || "";
  const dinnerNote = values.dinnerNote || "At Venue";
  const complimentsFrom = values.complimentsFrom || "Near & Dear";

  // ── Arch geometry ──
  const archPath = `M 108 390 Q 108 20 ${W / 2} 20 Q ${W - 108} 20 ${W - 108} 390`;

  // ── Bell-flower positions along arch (top curve) ──
  const archFlowers: Array<[number, number, number, number, number]> = [
    // [x, y, scale, colorIdx(0=archPurp,1=medPurp,2=lav), rotateDeg]
    [108, 380, 1.1, 0, 10],
    [132, 316, 1.0, 1, 15],
    [162, 255, 1.1, 0, 20],
    [196, 196, 1.0, 2, 23],
    [238, 146, 1.1, 0, 26],
    [284, 106, 1.0, 1, 22],
    [334, 72, 1.1, 0, 18],
    [388, 46, 1.0, 2, 12],
    [444, 28, 1.1, 0, 6],
    [496, 21, 1.0, 1, 2],
    [540, 20, 1.2, 0, 0],
    [584, 21, 1.0, 2, -2],
    [636, 28, 1.1, 0, -6],
    [692, 46, 1.0, 1, -12],
    [746, 72, 1.1, 0, -18],
    [796, 106, 1.0, 2, -22],
    [842, 146, 1.1, 0, -26],
    [884, 196, 1.0, 1, -23],
    [918, 255, 1.1, 0, -20],
    [948, 316, 1.0, 2, -15],
    [972, 380, 1.1, 0, -10],
  ];
  const archFlowerColors = [ARCH_PURPLE, MED_PURPLE, LAVENDER];

  // ── Left/right column flower data ──
  const colFlowerYs = [118, 170, 218, 266, 316, 368, 418, 468, 518, 572, 630];
  const flowerVariants = ["bell", "round", "leaf", "bell", "round", "bell", "leaf", "round", "bell", "round", "bell"];

  return (
    <>
      {/* ── BACKGROUND ── */}
      <rect width={W} height={H} fill={BG} />

      {/* ── BORDERS ── */}
      <rect x={15} y={15} width={W - 30} height={H - 30} fill="none" stroke={GOLD} strokeWidth={2} />
      <rect x={25} y={25} width={W - 50} height={H - 50} fill="none" stroke={GOLD} strokeWidth={0.8} opacity={0.5} />

      {/* ── ARCH BACKGROUND GLOW ── */}
      <path d={archPath} fill="none" stroke={LAVENDER} strokeWidth={100} opacity={0.14} strokeLinecap="round" />
      <path d={archPath} fill="none" stroke={ARCH_PURPLE} strokeWidth={55} opacity={0.09} strokeLinecap="round" />

      {/* ── LEFT GOLD PILLAR ── */}
      <rect x={69} y={108} width={9} height={1296} fill={GOLD} opacity={0.65} rx={2} />
      <circle cx={73.5} cy={108} r={16} fill={GOLD} />
      <circle cx={73.5} cy={108} r={9} fill={GOLD_BRIGHT} />
      {[300, 600, 900, 1200].map((y) => (
        <rect key={y} x={62} y={y - 5} width={23} height={10} fill={GOLD} opacity={0.6} rx={2} />
      ))}
      {/* Hanging decorative knots on pillar */}
      {[230, 490, 750, 1010].map((y) => (
        <g key={y} transform={`translate(73.5 ${y})`}>
          <line x1={0} y1={-18} x2={0} y2={18} stroke={GOLD} strokeWidth={1.5} opacity={0.5} />
          <path d="M-9 18 Q0 28 9 18" fill={GOLD} opacity={0.55} />
          <ellipse cx={0} cy={-20} rx={7} ry={4} fill={GOLD} opacity={0.45} />
        </g>
      ))}
      <circle cx={73.5} cy={1404} r={16} fill={GOLD} />
      <circle cx={73.5} cy={1404} r={9} fill={GOLD_BRIGHT} />

      {/* ── RIGHT GOLD PILLAR ── */}
      <rect x={1002} y={108} width={9} height={1296} fill={GOLD} opacity={0.65} rx={2} />
      <circle cx={1006.5} cy={108} r={16} fill={GOLD} />
      <circle cx={1006.5} cy={108} r={9} fill={GOLD_BRIGHT} />
      {[300, 600, 900, 1200].map((y) => (
        <rect key={y} x={995} y={y - 5} width={23} height={10} fill={GOLD} opacity={0.6} rx={2} />
      ))}
      {[230, 490, 750, 1010].map((y) => (
        <g key={y} transform={`translate(1006.5 ${y})`}>
          <line x1={0} y1={-18} x2={0} y2={18} stroke={GOLD} strokeWidth={1.5} opacity={0.5} />
          <path d="M-9 18 Q0 28 9 18" fill={GOLD} opacity={0.55} />
          <ellipse cx={0} cy={-20} rx={7} ry={4} fill={GOLD} opacity={0.45} />
        </g>
      ))}
      <circle cx={1006.5} cy={1404} r={16} fill={GOLD} />
      <circle cx={1006.5} cy={1404} r={9} fill={GOLD_BRIGHT} />

      {/* ── ARCH BELL FLOWERS ── */}
      {archFlowers.map(([fx, fy, fs, ci, rot], idx) => {
        const c = archFlowerColors[ci];
        const s = fs;
        return (
          <g key={idx} transform={`translate(${fx} ${fy}) rotate(${rot})`}>
            <line x1={0} y1={0} x2={0} y2={-s * 16} stroke={GREEN} strokeWidth={s * 1.2} opacity={0.8} />
            <ellipse
              cx={s * 8} cy={-s * 8} rx={s * 4} ry={s * 9}
              fill={GREEN} opacity={0.72}
              transform={`rotate(28 ${s * 8} ${-s * 8})`}
            />
            <path
              d={`M${-s * 7} ${s * 2} Q${-s * 11} ${s * 12} 0 ${s * 18} Q${s * 11} ${s * 12} ${s * 7} ${s * 2} Z`}
              fill={c} opacity={0.88}
            />
            <path d={`M${-s * 5} ${s * 2} Q0 ${-s * 3} ${s * 5} ${s * 2}`} fill={GREEN} opacity={0.7} />
          </g>
        );
      })}

      {/* ── WHITE ROSES at arch mid-sides ── */}
      {[
        { cx: 135, cy: 345 },
        { cx: 945, cy: 345 },
      ].map(({ cx, cy }, ri) => (
        <g key={ri} transform={`translate(${cx} ${cy})`}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <ellipse
                key={a}
                cx={Math.cos(rad) * 13}
                cy={Math.sin(rad) * 13}
                rx={10} ry={13}
                fill={WHITE_ROSE} opacity={0.92}
                transform={`rotate(${a} ${Math.cos(rad) * 13} ${Math.sin(rad) * 13})`}
              />
            );
          })}
          <circle r={8} fill={WHITE_ROSE} />
          <circle r={4} fill="#ffe4b0" />
        </g>
      ))}

      {/* ── LEFT COLUMN FLOWERS ── */}
      {colFlowerYs.map((fy, fi) => {
        const fx = fi % 2 === 0 ? 96 : 118;
        const variant = flowerVariants[fi];
        const c = fi % 2 === 0 ? ARCH_PURPLE : LAVENDER;
        if (variant === "leaf") {
          return (
            <g key={fi} transform={`translate(${fx} ${fy})`}>
              <ellipse cx={-9} cy={0} rx={4} ry={12} fill={GREEN} opacity={0.74} transform="rotate(-24 -9 0)" />
              <ellipse cx={9} cy={0} rx={4} ry={12} fill={GREEN} opacity={0.74} transform="rotate(24 9 0)" />
            </g>
          );
        }
        if (variant === "round") {
          return (
            <g key={fi} transform={`translate(${fx} ${fy})`}>
              <circle r={10} fill={LAVENDER} opacity={0.68} />
              <circle r={6} fill={ARCH_PURPLE} opacity={0.85} />
              <circle r={2.5} fill={MED_PURPLE} />
            </g>
          );
        }
        return (
          <g key={fi} transform={`translate(${fx} ${fy}) rotate(${fi % 2 === 0 ? -12 : 12})`}>
            <path d="M-7 -12 Q-10 0 0 6 Q10 0 7 -12 Z" fill={c} opacity={0.88} />
            <line x1={0} y1={-12} x2={0} y2={-27} stroke={GREEN} strokeWidth={1.3} />
            <ellipse cx={-10} cy={-19} rx={4} ry={8} fill={GREEN} opacity={0.7} transform="rotate(-30 -10 -19)" />
          </g>
        );
      })}

      {/* ── RIGHT COLUMN FLOWERS ── */}
      {colFlowerYs.map((fy, fi) => {
        const fx = fi % 2 === 0 ? 984 : 962;
        const variant = flowerVariants[fi];
        const c = fi % 2 === 0 ? ARCH_PURPLE : LAVENDER;
        if (variant === "leaf") {
          return (
            <g key={fi} transform={`translate(${fx} ${fy})`}>
              <ellipse cx={-9} cy={0} rx={4} ry={12} fill={GREEN} opacity={0.74} transform="rotate(-24 -9 0)" />
              <ellipse cx={9} cy={0} rx={4} ry={12} fill={GREEN} opacity={0.74} transform="rotate(24 9 0)" />
            </g>
          );
        }
        if (variant === "round") {
          return (
            <g key={fi} transform={`translate(${fx} ${fy})`}>
              <circle r={10} fill={LAVENDER} opacity={0.68} />
              <circle r={6} fill={ARCH_PURPLE} opacity={0.85} />
              <circle r={2.5} fill={MED_PURPLE} />
            </g>
          );
        }
        return (
          <g key={fi} transform={`translate(${fx} ${fy}) rotate(${fi % 2 === 0 ? 12 : -12})`}>
            <path d="M-7 -12 Q-10 0 0 6 Q10 0 7 -12 Z" fill={c} opacity={0.88} />
            <line x1={0} y1={-12} x2={0} y2={-27} stroke={GREEN} strokeWidth={1.3} />
            <ellipse cx={10} cy={-19} rx={4} ry={8} fill={GREEN} opacity={0.7} transform="rotate(30 10 -19)" />
          </g>
        );
      })}

      {/* ── HANGING GARLANDS from arch top ── */}
      {[
        { x: 290, y0: 38, len: 155 },
        { x: 370, y0: 26, len: 200 },
        { x: 450, y0: 20, len: 238 },
        { x: 540, y0: 20, len: 264 },
        { x: 630, y0: 20, len: 238 },
        { x: 710, y0: 26, len: 200 },
        { x: 790, y0: 38, len: 155 },
      ].map(({ x, y0, len }, gi) => {
        const beads = Math.floor(len / 20);
        return (
          <g key={gi}>
            <line x1={x} y1={y0} x2={x} y2={y0 + len} stroke={GREEN} strokeWidth={1} opacity={0.55} />
            {Array.from({ length: beads }, (_, j) => (
              <circle
                key={j} cx={x} cy={y0 + j * 20 + 10}
                r={gi === 3 ? 4 : 3.5}
                fill={j % 3 === 0 ? LAVENDER : j % 3 === 1 ? PALE_LAV : "#f0e8f8"}
                opacity={0.82}
              />
            ))}
            <g transform={`translate(${x} ${y0 + len})`}>
              <circle r={7} fill={ARCH_PURPLE} opacity={0.7} />
              <circle r={3} fill={LAVENDER} />
            </g>
          </g>
        );
      })}

      {/* ── BOTTOM ROSE CLUSTERS ── */}
      {[{ cx: 100, cy: 1255 }, { cx: 980, cy: 1255 }].map(({ cx, cy }, ri) => (
        <g key={ri} transform={`translate(${cx} ${cy})`}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <ellipse
                key={a}
                cx={Math.cos(rad) * 14} cy={Math.sin(rad) * 14}
                rx={11} ry={14}
                fill={WHITE_ROSE} opacity={0.85}
                transform={`rotate(${a} ${Math.cos(rad) * 14} ${Math.sin(rad) * 14})`}
              />
            );
          })}
          <circle r={9} fill={WHITE_ROSE} />
          <circle r={4} fill="#ffe8c8" />
          {[{ x: -28, y: -22 }, { x: 28, y: -22 }, { x: -26, y: 22 }, { x: 26, y: 22 }].map(({ x, y }, pi) => (
            <g key={pi} transform={`translate(${x} ${y})`}>
              <circle r={8} fill={LAVENDER} opacity={0.75} />
              <circle r={4} fill={ARCH_PURPLE} opacity={0.9} />
            </g>
          ))}
          <ellipse cx={-36} cy={0} rx={4} ry={12} fill={GREEN} opacity={0.7} transform="rotate(-20 -36 0)" />
          <ellipse cx={36} cy={0} rx={4} ry={12} fill={GREEN} opacity={0.7} transform="rotate(20 36 0)" />
        </g>
      ))}

      {/* ── OIL LAMP (left side) ── */}
      <g transform="translate(73 1385)">
        <ellipse cx={0} cy={55} rx={28} ry={7} fill={GOLD} opacity={0.65} />
        <rect x={-4} y={12} width={8} height={44} fill={GOLD} opacity={0.78} rx={2} />
        <ellipse cx={0} cy={32} rx={12} ry={4} fill={GOLD} opacity={0.55} />
        <path d="M-24 12 Q-26 -12 0 -18 Q26 -12 24 12 Q12 20 0 20 Q-12 20 -24 12 Z" fill={GOLD} opacity={0.78} />
        <path d="M0 -18 Q-6 -33 0 -46 Q6 -33 0 -18" fill="#f97316" opacity={0.85} />
        <path d="M0 -22 Q-3 -34 0 -44 Q3 -34 0 -22" fill="#fef08a" opacity={0.92} />
      </g>

      {/* ── SMALL DIYA (right side) ── */}
      <g transform="translate(1007 1390)">
        <ellipse cx={0} cy={0} rx={22} ry={10} fill={GOLD} opacity={0.62} />
        <ellipse cx={0} cy={-5} rx={17} ry={7} fill={GOLD} opacity={0.52} />
        <path d="M0 -13 Q-4 -26 0 -36 Q4 -26 0 -13" fill="#f97316" opacity={0.8} />
        <path d="M0 -16 Q-2 -26 0 -34 Q2 -26 0 -16" fill="#fef08a" opacity={0.9} />
        <circle cx={10} cy={-3} r={4} fill={PALE_LAV} opacity={0.8} />
        <circle cx={-10} cy={-3} r={4} fill={PALE_LAV} opacity={0.8} />
      </g>

      {/* ── GANESHA CIRCLE ── */}
      <circle cx={W / 2} cy={130} r={52} fill={GOLD} opacity={0.12} />
      <circle cx={W / 2} cy={130} r={44} fill="none" stroke={GOLD} strokeWidth={1.8} opacity={0.7} />
      <circle cx={W / 2} cy={130} r={36} fill="none" stroke={GOLD} strokeWidth={0.8} opacity={0.38} />
      <g transform={`translate(${W / 2} 130)`} fill="none" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round">
        <path d="M-22 -6 Q-34 -20 -22 -30 Q-8 -36 0 -30 Q8 -36 22 -30 Q34 -20 22 -6" />
        <ellipse cx={0} cy={4} rx={15} ry={18} />
        <path d="M0 14 Q10 26 6 36 Q1 40 -6 32" />
        <circle cx={-6} cy={-2} r={2.2} fill={GOLD} stroke="none" />
        <circle cx={6} cy={-2} r={2.2} fill={GOLD} stroke="none" />
        <path d="M-9 8 Q0 14 9 8" />
        <path d="M-18 -10 C-20 0 -14 6 -10 2" />
        <path d="M18 -10 C20 0 14 6 10 2" />
        <circle cx={0} cy={-30} r={4} fill={GOLD} opacity={0.55} stroke="none" />
      </g>

      {/* ── BLESSING TEXT ── */}
      <text
        x={W / 2} y={220}
        textAnchor="middle"
        fill={MED_PURPLE}
        fontSize={23}
        fontFamily={CORM}
        fontStyle="italic"
        opacity={0.9}
      >
        {blessingLines.map((line, i) => (
          <tspan key={i} x={W / 2} dy={i === 0 ? 0 : 31}>{line}</tspan>
        ))}
      </text>

      {/* ── "WEDDING" heading ── */}
      <text
        x={W / 2} y={350}
        textAnchor="middle"
        fill={PURPLE}
        fontSize={84}
        fontFamily={SERIF}
        fontWeight={700}
        letterSpacing={16}
      >
        WEDDING
      </text>

      {/* ── "Invitation" script ── */}
      <text
        x={W / 2} y={436}
        textAnchor="middle"
        fill={PURPLE}
        fontSize={80}
        fontFamily={SCRIPT}
      >
        Invitation
      </text>
      {/* Heart accent to the right of script */}
      <text x={W / 2 + 164} y={422} fill={GOLD} fontSize={22} fontFamily={SERIF} textAnchor="middle">♡</text>

      {/* ── GOLD DIVIDER 1 ── */}
      <line x1={195} y1={467} x2={476} y2={467} stroke={GOLD} strokeWidth={1.5} />
      <line x1={604} y1={467} x2={885} y2={467} stroke={GOLD} strokeWidth={1.5} />
      <g transform={`translate(${W / 2} 467)`} fill="none" stroke={GOLD} strokeWidth={1.35}>
        <path d="M0 14 C-16 5 -20 -6 -7 -14 C-1 -5 1 -5 7 -14 C20 -6 16 5 0 14 Z" />
        <path d="M-19 8 C-25 -4 -13 -17 0 -8" />
        <path d="M19 8 C25 -4 13 -17 0 -8" />
        <circle r={2.5} fill={GOLD} stroke="none" />
      </g>

      {/* ── HOST NAMES ── */}
      {brideParentsLines.length > 0 ? (
        brideParentsLines.map((line, i) => (
          <text
            key={i}
            x={W / 2} y={528 + i * 48}
            textAnchor="middle"
            fill={PURPLE}
            fontSize={30}
            fontFamily={SERIF}
            fontWeight={700}
          >
            {line}
          </text>
        ))
      ) : brideParentsRaw ? (
        <text x={W / 2} y={528} textAnchor="middle" fill={PURPLE} fontSize={30} fontFamily={SERIF} fontWeight={700}>
          {brideParentsRaw}
        </text>
      ) : null}

      {/* ── SOLICITATION TEXT ── */}
      {solicitLines.length > 0 && (
        <text
          x={W / 2}
          y={brideParentsLines.length > 1 ? 636 : 604}
          textAnchor="middle"
          fill={GRAY}
          fontSize={24}
          fontFamily={CORM}
          fontStyle="italic"
        >
          {solicitLines.map((line, i) => (
            <tspan key={i} x={W / 2} dy={i === 0 ? 0 : 34}>{line}</tspan>
          ))}
        </text>
      )}

      {/* ── SMALL GOLD DIVIDER ── */}
      <line x1={360} y1={756} x2={492} y2={756} stroke={GOLD} strokeWidth={1} />
      <circle cx={W / 2} cy={756} r={4} fill={GOLD} />
      <line x1={588} y1={756} x2={720} y2={756} stroke={GOLD} strokeWidth={1} />

      {/* ── BRIDE NAME ── */}
      {brideLine && (
        <text x={W / 2} y={826} textAnchor="middle" fill={PURPLE} fontSize={74} fontFamily={SCRIPT}>
          {brideLine}
        </text>
      )}
      {brideQual && (
        <text x={W / 2} y={868} textAnchor="middle" fill={GRAY} fontSize={26} fontFamily={SERIF} fontWeight={500}>
          {brideQual}
        </text>
      )}

      {/* ── "With" ornamental ── */}
      <line x1={224} y1={920} x2={462} y2={920} stroke={GOLD} strokeWidth={1.2} />
      <text x={W / 2} y={934} textAnchor="middle" fill={GOLD} fontSize={48} fontFamily={SCRIPT}>
        With
      </text>
      <line x1={618} y1={920} x2={856} y2={920} stroke={GOLD} strokeWidth={1.2} />
      {/* Leaf accents beside "With" */}
      <g transform="translate(490 920)" fill={GOLD} opacity={0.48}>
        <path d="M-12 0 C-6 -8 6 -8 12 0 C6 8 -6 8 -12 0" />
      </g>
      <g transform="translate(590 920)" fill={GOLD} opacity={0.48}>
        <path d="M-12 0 C-6 -8 6 -8 12 0 C6 8 -6 8 -12 0" />
      </g>

      {/* ── GROOM NAME ── */}
      {groomLine && (
        <text x={W / 2} y={1002} textAnchor="middle" fill={PURPLE} fontSize={74} fontFamily={SCRIPT}>
          {groomLine}
        </text>
      )}
      {groomQual && (
        <text x={W / 2} y={1044} textAnchor="middle" fill={GRAY} fontSize={26} fontFamily={SERIF} fontWeight={500}>
          {groomQual}
        </text>
      )}

      {/* ── PARENTAGE ── */}
      {parentageLines.length > 0 && (
        <text x={W / 2} y={1086} textAnchor="middle" fill={GRAY} fontSize={22} fontFamily={CORM} fontStyle="italic">
          {parentageLines.map((line, i) => (
            <tspan key={i} x={W / 2} dy={i === 0 ? 0 : 30}>{line}</tspan>
          ))}
        </text>
      )}

      {/* ── DIVIDER BEFORE INFO BOXES ── */}
      <line x1={180} y1={1152} x2={900} y2={1152} stroke={GOLD} strokeWidth={1.5} />

      {/* ── INFO BOX BACKGROUNDS ── */}
      <rect x={48} y={1164} width={308} height={188} fill={PALE_LAV} rx={12} opacity={0.65} />
      <rect x={386} y={1164} width={308} height={188} fill={PALE_LAV} rx={12} opacity={0.65} />
      <rect x={724} y={1164} width={308} height={188} fill={PALE_LAV} rx={12} opacity={0.65} />

      {/* ── BOX 1: CEREMONY / SUMUHURTHAM ── */}
      {/* Calendar icon */}
      <circle cx={202} cy={1200} r={22} fill={LAVENDER} opacity={0.38} />
      <g transform="translate(202 1200)" fill="none" stroke={MED_PURPLE} strokeWidth={1.8}>
        <rect x={-13} y={-12} width={26} height={23} rx={2} />
        <line x1={-13} y1={-3} x2={13} y2={-3} />
        <line x1={-6} y1={-16} x2={-6} y2={-8} strokeWidth={2.5} />
        <line x1={6} y1={-16} x2={6} y2={-8} strokeWidth={2.5} />
        <circle cx={-6} cy={4} r={1.8} fill={MED_PURPLE} stroke="none" />
        <circle cx={0} cy={4} r={1.8} fill={MED_PURPLE} stroke="none" />
        <circle cx={6} cy={4} r={1.8} fill={MED_PURPLE} stroke="none" />
      </g>
      <text x={202} y={1248} textAnchor="middle" fill={MED_PURPLE} fontSize={20} fontFamily={SERIF} fontWeight={700} fontStyle="italic">
        {ceremonyName}
      </text>
      {dateStr && (
        <text x={202} y={1275} textAnchor="middle" fill={INK} fontSize={17} fontFamily={CORM}>{dateStr}</text>
      )}
      {timeStr && (
        <text x={202} y={1299} textAnchor="middle" fill={INK} fontSize={17} fontFamily={CORM}>{timeStr}</text>
      )}
      {lagnam && (
        <text x={202} y={1322} textAnchor="middle" fill={GRAY} fontSize={15} fontFamily={CORM} fontStyle="italic">{lagnam}</text>
      )}

      {/* ── BOX 2: VENUE ── */}
      {/* Map pin icon */}
      <circle cx={540} cy={1200} r={22} fill={LAVENDER} opacity={0.38} />
      <g transform="translate(540 1200)" fill="none" stroke={MED_PURPLE} strokeWidth={1.8}>
        <path d="M0 18 Q-16 2 -16 -7 A16 16 0 1 1 16 -7 Q16 2 0 18 Z" />
        <circle cx={0} cy={-7} r={5.5} fill={MED_PURPLE} stroke="none" />
      </g>
      <text x={540} y={1248} textAnchor="middle" fill={MED_PURPLE} fontSize={20} fontFamily={SERIF} fontWeight={700} fontStyle="italic">
        Venue
      </text>
      {venueLines.map((line, i) => (
        <text key={i} x={540} y={1272 + i * 24} textAnchor="middle" fill={INK} fontSize={16} fontFamily={CORM}>
          {line}
        </text>
      ))}
      {cityLines.map((line, i) => (
        <text
          key={i}
          x={540}
          y={1272 + venueLines.length * 24 + 4 + i * 22}
          textAnchor="middle"
          fill={GRAY}
          fontSize={15}
          fontFamily={CORM}
          fontWeight={600}
        >
          {line}
        </text>
      ))}

      {/* ── BOX 3: DINNER ── */}
      {/* Fork & knife icon */}
      <circle cx={878} cy={1200} r={22} fill={LAVENDER} opacity={0.38} />
      <g transform="translate(878 1200)" stroke={MED_PURPLE} strokeLinecap="round" fill="none">
        <line x1={-8} y1={-14} x2={-8} y2={14} strokeWidth={2} />
        <path d="M-13 -14 L-13 -4 Q-8 1 -3 -4 L-3 -14" strokeWidth={1.6} />
        <line x1={8} y1={-14} x2={8} y2={14} strokeWidth={2} />
        <path d="M4 -14 Q12 -8 12 -2 Q9 2 8 -2" strokeWidth={1.6} />
      </g>
      <text x={878} y={1248} textAnchor="middle" fill={MED_PURPLE} fontSize={20} fontFamily={SERIF} fontWeight={700} fontStyle="italic">
        Dinner
      </text>
      {dateStr && (
        <text x={878} y={1275} textAnchor="middle" fill={INK} fontSize={17} fontFamily={CORM}>{dateStr}</text>
      )}
      {dinnerTime && (
        <text x={878} y={1299} textAnchor="middle" fill={INK} fontSize={17} fontFamily={CORM}>{`at ${dinnerTime}`}</text>
      )}
      {dinnerNote && (
        <text x={878} y={1322} textAnchor="middle" fill={GRAY} fontSize={15} fontFamily={CORM} fontStyle="italic">{dinnerNote}</text>
      )}

      {/* ── DIVIDER AFTER BOXES ── */}
      <line x1={180} y1={1374} x2={900} y2={1374} stroke={GOLD} strokeWidth={1.5} />

      {/* ── BOTTOM LOTUS ── */}
      <g transform={`translate(${W / 2} 1408)`} fill="none" stroke={GOLD} strokeWidth={1.4}>
        <path d="M0 16 C-17 6 -21 -6 -8 -14 C-1 -5 1 -5 8 -14 C21 -6 17 6 0 16 Z" />
        <path d="M-21 8 C-27 -4 -13 -18 0 -7" />
        <path d="M21 8 C27 -4 13 -18 0 -7" />
        <circle r={2.8} fill={GOLD} stroke="none" />
      </g>

      {/* ── COMPLIMENTS LABEL ── */}
      <text x={W / 2} y={1448} textAnchor="middle" fill={GRAY} fontSize={22} fontFamily={CORM} fontStyle="italic">
        With best Compliments from :
      </text>

      {/* ── COMPLIMENTS FROM ── */}
      <text x={W / 2} y={1486} textAnchor="middle" fill={PURPLE} fontSize={28} fontFamily={CORM} fontWeight={700} fontStyle="italic">
        {complimentsFrom}
      </text>
    </>
  );
}
