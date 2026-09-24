import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRequireSignIn } from "@/auth/useRequireSignIn";
import { Button } from "@/components/ui/Button";
import { DownloadIcon, PdfIcon, PreviewIcon } from "@/components/ui/Icons";
import { trackDownload, trackPreview } from "@/lib/analytics";
import { downloadBlob, exportImage, exportPdf } from "@/lib/export";
import { Composition } from "@/lib/render/Composition";
import type { RenderInput, TemplateDefinition } from "@/types";

type Props = {
  template: TemplateDefinition;
  input: RenderInput;
  guestName?: string;
  filenameBase: string;
  maximized?: boolean;
  onMaximizedChange?: (open: boolean) => void;
  /** Flush builder draft before redirecting unsigned users to sign-in. */
  ensureSaved?: () => void | Promise<void>;
};

export function PreviewPanel({
  template,
  input,
  guestName,
  filenameBase,
  maximized: maximizedProp,
  onMaximizedChange,
  ensureSaved,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const maximized = maximizedProp ?? internalOpen;
  const allowSignedInAction = useRequireSignIn();

  function setMaximized(open: boolean) {
    onMaximizedChange?.(open);
    if (maximizedProp === undefined) setInternalOpen(open);
    if (!open) setZoom(1);
    if (open) {
      trackPreview({
        templateId: template.id,
        templateName: template.name,
        kind: template.kind,
        source: "builder",
      });
    }
  }

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close handler reads latest onMaximizedChange
  }, [maximized]);

  async function getSvg() {
    const root = maximized
      ? document.querySelector("[data-preview-modal='true'] svg[data-composition='true']")
      : ref.current?.querySelector("svg[data-composition='true']");
    const svg = root as SVGSVGElement | null;
    if (!svg) throw new Error("Preview is not ready yet. Wait a moment and try again.");
    return svg;
  }

  async function onPng() {
    if (!allowSignedInAction({ beforeRedirect: ensureSaved })) return;
    const svg = await getSvg();
    const blob = await exportImage(svg, "high", "image/png");
    downloadBlob(blob, `${filenameBase}.png`);
    trackDownload({
      templateId: template.id,
      templateName: template.name,
      kind: template.kind,
      format: "png",
      source: "builder",
    });
  }

  async function onPdf() {
    if (!allowSignedInAction({ beforeRedirect: ensureSaved })) return;
    const svg = await getSvg();
    const blob = await exportPdf(svg, template);
    downloadBlob(blob, `${filenameBase}.pdf`);
    trackDownload({
      templateId: template.id,
      templateName: template.name,
      kind: template.kind,
      format: "pdf",
      source: "builder",
    });
  }

  const modal =
    maximized && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-ink/90 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Full invitation preview"
            data-preview-modal="true"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-cream">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cream/60">Preview</p>
                <p className="font-serif text-xl">{template.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
                >
                  Zoom −
                </Button>
                <span className="min-w-[3.5rem] text-center text-sm text-cream/80">{Math.round(zoom * 100)}%</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
                >
                  Zoom +
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setZoom(1)}>
                  Fit
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void onPng()}>
                  <DownloadIcon />
                  PNG
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void onPdf()}>
                  <PdfIcon />
                  PDF
                </Button>
                <Button type="button" size="sm" variant="gold" onClick={() => setMaximized(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-4 md:p-8">
              <div
                className="w-full max-w-3xl origin-top transition-transform duration-200"
                style={{ transform: `scale(${zoom})`, marginBottom: zoom > 1 ? `${(zoom - 1) * 40}%` : undefined }}
              >
                <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-white/20">
                  <div className="aspect-[1080/1512] bg-cream-dark">
                    <Composition template={template} input={input} guestName={guestName} />
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-4">
      <div
        ref={ref}
        className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card"
      >
        <div className="aspect-[1080/1512] bg-cream-dark">
          <Composition template={template} input={input} guestName={guestName} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="gold" onClick={() => setMaximized(true)}>
          <PreviewIcon />
          Preview
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onPng()}>
          <DownloadIcon />
          Download PNG
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onPdf()}>
          <PdfIcon />
          Download PDF
        </Button>
      </div>
      {modal}
    </div>
  );
}
