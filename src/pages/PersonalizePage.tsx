import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { InvitationVisualEditor } from "@/components/personalize/InvitationVisualEditor";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { downloadBlob } from "@/lib/export";
import { createEditorDocument } from "@/lib/personalize/editor/createDocument";
import { exportInvitation } from "@/lib/personalize/editor/export";
import type { DocumentHistory } from "@/lib/personalize/editor/history";
import { initHistory } from "@/lib/personalize/editor/history";
import type { EditorDocument } from "@/lib/personalize/editor/types";
import { prepareSourceFile } from "@/lib/personalize/prepareSource";
import { validatePersonalizeFile } from "@/lib/personalize/validateUpload";
import { registerPersonalizeUpload } from "@/services/personalize/client";
import { usePageMeta } from "@/seo/usePageMeta";

type Step = "upload" | "pdf-page" | "edit" | "export";

export function PersonalizePage() {
  usePageMeta({
    title: "Upload Invitation & Personalize | Invana",
    description:
      "Upload PNG, JPG, or PDF. Select text on the invitation, replace or remove it, preview live, and download — without OCR forms.",
    noIndex: true,
  });

  const [step, setStep] = useState<Step>("upload");
  const [history, setHistory] = useState<DocumentHistory | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMeta, setPendingMeta] = useState<{ kind: "image" | "pdf"; mime: string } | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [scaledNotice, setScaledNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportBlob, setExportBlob] = useState<{ blob: Blob; ext: string } | null>(null);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);
  const [rasterNote, setRasterNote] = useState(false);

  const openDocument = useCallback(
    async (file: File, kind: "image" | "pdf", mime: string, pageIndex: number, bytes: ArrayBuffer | null) => {
      setBusy(true);
      setError("");
      setStatus("Preparing canvas…");
      try {
        const { prepared, pdfBytes: pdfBuf, pdfPageCount: pages, pdfPageIndex: page } = await prepareSourceFile(
          file,
          kind,
          pageIndex,
          bytes ?? undefined,
          pdfPageCount,
        );
        setScaledNotice(prepared.scaledFromOriginal);
        const doc = createEditorDocument({
          sourceDataUrl: prepared.sourceDataUrl,
          source: {
            kind,
            mime,
            fileName: file.name,
            originalBlob: file,
            width: prepared.width,
            height: prepared.height,
            pdfPageCount: pages,
            pdfPageIndex: page,
            pdfBytes: pdfBuf,
          },
        });
        setHistory(initHistory(doc));
        setStep("edit");
        void registerPersonalizeUpload({
          documentId: doc.id,
          fileName: file.name,
          kind,
          width: prepared.width,
          height: prepared.height,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open that invitation.");
      } finally {
        setBusy(false);
        setStatus("");
      }
    },
    [pdfPageCount],
  );

  const onPickFile = async (file: File) => {
    setError("");
    setExportPreviewUrl(null);
    setExportBlob(null);
    const valid = await validatePersonalizeFile(file);
    if (!valid.ok) {
      setError(valid.message);
      return;
    }
    setPendingFile(file);
    setPendingMeta({ kind: valid.kind, mime: valid.mime });
    if (valid.kind === "pdf") {
      setBusy(true);
      try {
        const { inspectPdfFile } = await import("@/lib/personalize/prepareSource");
        const inspection = await inspectPdfFile(file);
        setPdfBytes(inspection.bytes);
        setPdfPageCount(inspection.pageCount);
        setPdfPageIndex(0);
        setStep(inspection.pageCount > 1 ? "pdf-page" : "edit");
        if (inspection.pageCount === 1) {
          await openDocument(file, valid.kind, valid.mime, 0, inspection.bytes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read PDF.");
      } finally {
        setBusy(false);
      }
      return;
    }
    await openDocument(file, valid.kind, valid.mime, 0, null);
  };

  const resetAll = () => {
    setHistory(null);
    setStep("upload");
    setPendingFile(null);
    setPendingMeta(null);
    setPdfBytes(null);
    setExportPreviewUrl(null);
    setExportBlob(null);
    setExportWarnings([]);
    setError("");
  };

  const runExport = async (doc: EditorDocument) => {
    setBusy(true);
    setError("");
    setExportWarnings([]);
    setStatus("Validating export…");
    try {
      const result = await exportInvitation(doc);
      if (!result.validation.ok) {
        setError(result.validation.errors.join(" ") || "Export validation failed.");
        return;
      }
      const url = URL.createObjectURL(result.blob);
      setExportPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setExportBlob({ blob: result.blob, ext: result.extension });
      setExportWarnings(result.validation.warnings);
      setRasterNote(result.rasterizedPdfPage);
      setStep("export");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const download = () => {
    if (!exportBlob || !history) return;
    const base = history.present.source.fileName.replace(/\.[^.]+$/, "") || "invitation";
    downloadBlob(exportBlob.blob, `invana-${base}-personalized.${exportBlob.ext}`);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">Personalize</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">Visual invitation editor</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
          Upload your artwork, draw a box around any text, remove the original lettering, and type replacement text with
          live preview. Unchanged areas stay on the source image — we never regenerate the whole card.
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {busy && status ? (
        <p className="mb-4 text-sm text-ink-muted" role="status">
          {status}
        </p>
      ) : null}

      {step === "upload" ? (
        <section className="max-w-xl rounded-2xl border border-stone-200 bg-white p-8 shadow-soft">
          <Label htmlFor="invite-file">Invitation file</Label>
          <Input
            id="invite-file"
            type="file"
            accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
            disabled={busy}
            className="mt-2"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickFile(file);
            }}
          />
          <p className="mt-3 text-xs text-ink-muted">PNG, JPG, JPEG, or PDF · max 10 MB · up to 20 PDF pages.</p>
        </section>
      ) : null}

      {step === "pdf-page" && pendingFile && pendingMeta ? (
        <section className="max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
          <h2 className="font-serif text-2xl">Choose PDF page</h2>
          <Label htmlFor="pdf-page">Page to edit (1–{pdfPageCount})</Label>
          <Input
            id="pdf-page"
            type="number"
            min={1}
            max={pdfPageCount}
            value={pdfPageIndex + 1}
            onChange={(e) => setPdfPageIndex(Math.max(0, Math.min(pdfPageCount - 1, Number(e.target.value) - 1)))}
          />
          <p className="text-xs text-ink-muted">
            Other pages are kept on export. The edited page is rasterized — vector text on that page may be flattened.
          </p>
          <Button
            type="button"
            variant="gold"
            disabled={busy}
            onClick={() => void openDocument(pendingFile, pendingMeta.kind, pendingMeta.mime, pdfPageIndex, pdfBytes)}
          >
            Open page in editor
          </Button>
        </section>
      ) : null}

      {step === "edit" && history ? (
        <div className="space-y-6">
          <InvitationVisualEditor
            history={history}
            onHistoryChange={setHistory}
            onReset={resetAll}
            scaledNotice={scaledNotice}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("upload")}>
              Change file
            </Button>
            <Button
              type="button"
              variant="gold"
              disabled={busy || history.present.layers.length === 0}
              onClick={() => void runExport(history.present)}
            >
              Preview export
            </Button>
          </div>
        </div>
      ) : null}

      {step === "export" && exportPreviewUrl && history ? (
        <section className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
          <h2 className="font-serif text-2xl">Final preview</h2>
          {rasterNote ? (
            <p className="text-sm text-amber-900">
              This PDF page was rasterized for editing. Selectable vector text on this page may not remain in the export;
              other pages are unchanged.
            </p>
          ) : null}
          {exportWarnings.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
              {exportWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {history.present.source.kind === "pdf" ? (
            <p className="text-sm text-ink-muted">Open the downloaded PDF to review all pages.</p>
          ) : (
            <img src={exportPreviewUrl} alt="Export preview" className="max-h-[480px] w-full rounded-xl object-contain" />
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("edit")}>
              Back to editor
            </Button>
            <Button type="button" variant="gold" onClick={download}>
              Download
            </Button>
            <Link to="/dashboard" className="self-center text-sm text-gold-dark underline-offset-2 hover:underline">
              My invitations
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
