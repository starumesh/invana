import { useRef, useState } from "react";
import { useRequireSignIn } from "@/auth/useRequireSignIn";
import { Button } from "@/components/ui/Button";
import { DownloadIcon, PdfIcon } from "@/components/ui/Icons";
import { trackDownload } from "@/lib/analytics";
import { displayTitle } from "@/lib/fields";
import { downloadBlob, exportImage, exportPdf } from "@/lib/export";
import { Composition } from "@/lib/render/Composition";
import { getTemplate } from "@/templates/registry";
import type { StoredEvent } from "@/types";

type Props = {
  event: StoredEvent;
};

export function DashboardDownloadPanel({ event }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const allowSignedInAction = useRequireSignIn();
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [error, setError] = useState("");

  const template = getTemplate(event.config.templateId);
  if (!template) {
    return <p className="text-sm text-red-700">Template missing for this event.</p>;
  }

  const filenameBase =
    displayTitle(event.config).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "invana";

  async function getSvg() {
    const svg = ref.current?.querySelector("svg[data-composition='true']") as SVGSVGElement | null;
    if (!svg) throw new Error("Preview is still preparing. Try again in a moment.");
    return svg;
  }

  async function onPng() {
    if (!allowSignedInAction()) return;
    setBusy("png");
    setError("");
    try {
      const svg = await getSvg();
      const blob = await exportImage(svg, "high", "image/png");
      downloadBlob(blob, `${filenameBase}.png`);
      trackDownload({
        templateId: template.id,
        templateName: template.name,
        kind: template.kind,
        format: "png",
        source: "dashboard",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onPdf() {
    if (!allowSignedInAction()) return;
    setBusy("pdf");
    setError("");
    try {
      const svg = await getSvg();
      const blob = await exportPdf(svg, template!);
      downloadBlob(blob, `${filenameBase}.pdf`);
      trackDownload({
        templateId: template.id,
        templateName: template.name,
        kind: template.kind,
        format: "pdf",
        source: "dashboard",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-dark">Download</p>
          <h3 className="mt-1 font-serif text-xl text-ink">PNG or PDF</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Export a high-quality file of this design to save or share offline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="gold" size="sm" disabled={Boolean(busy)} onClick={() => void onPng()}>
            <DownloadIcon />
            {busy === "png" ? "Preparing…" : "PNG"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => void onPdf()}>
            <PdfIcon />
            {busy === "pdf" ? "Preparing…" : "PDF"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {/* Off-screen render target for export */}
      <div
        ref={ref}
        className="pointer-events-none absolute -left-[9999px] top-0 h-[1px] w-[1px] overflow-hidden opacity-0"
        aria-hidden
      >
        <Composition template={template} input={event.config} />
      </div>
    </div>
  );
}
