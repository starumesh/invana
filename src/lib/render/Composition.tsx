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

/** object-fit: cover — scale image to fill frame, center, crop overflow (no stretch / letterbox). */
function coverCropRect(
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
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let active = true;
    const img = new Image();
    // Allow canvas/export pipelines to read Storage URLs when CORS is configured.
    if (/^https?:/i.test(href)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (!active) return;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w > 0 && h > 0) setNatural({ w, h });
    };
    img.onerror = () => {
      if (active) setNatural(null);
    };
    img.src = href;
    return () => {
      active = false;
    };
  }, [href]);

  // Until natural size is known, fall back to SVG slice (cover). Once known, size
  // explicitly so clip + export rasterize stay consistent across browsers.
  const placed = natural ? coverCropRect(x, y, width, height, natural.w, natural.h) : null;

  return (
    <g>
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={x} y={y} width={width} height={height} rx={rx} ry={rx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {placed ? (
          <image
            href={href}
            xlinkHref={href}
            x={placed.x}
            y={placed.y}
            width={placed.width}
            height={placed.height}
            preserveAspectRatio="none"
            data-cover-crop="true"
          />
        ) : (
          <image
            href={href}
            xlinkHref={href}
            x={x}
            y={y}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
            data-cover-crop="true"
          />
        )}
      </g>
    </g>
  );
}

function token(value: string | undefined, colors: Record<string, string>): string | undefined {
  if (!value) return value;
  return colors[value] ?? value;
}
