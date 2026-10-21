import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import {
  clampRegion,
  normalizeDragRect,
  regionToLocalDisplay,
  screenToImageWithScroll,
} from "@/lib/personalize/editor/coordinates";
import { assessRestorationQuality, compositeDocument } from "@/lib/personalize/editor/composite";
import { measureInkBoundsFromSource } from "@/lib/personalize/editor/inkMetrics";
import {
  extractFontStyleFromRegion,
  type FontExtractionResult,
} from "@/lib/personalize/editor/extractFontStyle";
import type { DocumentHistory } from "@/lib/personalize/editor/history";
import { commitHistory, redoHistory, undoHistory } from "@/lib/personalize/editor/history";
import { shouldApplyLayerOnCanvas } from "@/lib/personalize/editor/layerApply";
import {
  DEFAULT_LAYER_STYLE,
  FONT_SUGGESTIONS,
  type EditorDocument,
  type RegionRect,
  type TextEditLayer,
} from "@/lib/personalize/editor/types";
import { colorToHex } from "@/lib/personalize/editor/colorToHex";
import { sanitizeInvitationText } from "@/lib/personalize/editor/textSanitize";
import { createId } from "@/lib/id";
import { cn } from "@/lib/cn";

type Props = {
  history: DocumentHistory;
  onHistoryChange: (h: DocumentHistory) => void;
  onReset: () => void;
  scaledNotice?: boolean;
};

export function InvitationVisualEditor({ history, onHistoryChange, onReset, scaledNotice }: Props) {
  const doc = history.present;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(640);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [pendingRegion, setPendingRegion] = useState<RegionRect | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [draftLayer, setDraftLayer] = useState<TextEditLayer | null>(null);
  /** Applied in preview but not committed until the user confirms. */
  const [awaitingConfirm, setAwaitingConfirm] = useState<TextEditLayer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fontExtract, setFontExtract] = useState<FontExtractionResult | null>(null);
  const [pendingSelectedText, setPendingSelectedText] = useState("");
  const [pendingTextLoading, setPendingTextLoading] = useState(false);
  const draftUndoStack = useRef<TextEditLayer[]>([]);
  const pendingTextEdited = useRef(false);
  const [draftUndoDepth, setDraftUndoDepth] = useState(0);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;

  const editInProgress = Boolean(draftLayer);
  const selectionBlocked = editInProgress || Boolean(awaitingConfirm);
  const previewLayer = draftLayer ?? awaitingConfirm;

  const displayHeight = (displayWidth / doc.source.width) * doc.source.height;

  const scaledDisplayWidth = displayWidth * zoom;
  const scaledDisplayHeight = displayHeight * zoom;

  const resetCanvasView = useCallback(() => {
    setZoom(1);
    requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (el) {
        el.scrollLeft = 0;
        el.scrollTop = 0;
      }
    });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDisplayWidth(el.clientWidth));
    ro.observe(el);
    setDisplayWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const canvas = await compositeDocument(doc, { previewLayer });
          const url = canvas.toDataURL("image/png");
          if (!cancelled) {
            setPreviewUrl((prev) => {
              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
              return url;
            });
          }
        } catch {
          if (!cancelled) setPreviewUrl(doc.sourceDataUrl);
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, previewLayer, doc.sourceDataUrl]);

  const commitDoc = useCallback(
    (next: EditorDocument) => {
      onHistoryChange(commitHistory(history, next));
    },
    [history, onHistoryChange],
  );

  const patchDraft = useCallback((next: TextEditLayer) => {
    setDraftLayer((prev) => {
      if (prev) {
        draftUndoStack.current = [...draftUndoStack.current.slice(-50), prev];
        setDraftUndoDepth(draftUndoStack.current.length);
      }
      return next;
    });
  }, []);

  const performUndo = useCallback(() => {
    if (draftUndoStack.current.length) {
      const stack = draftUndoStack.current;
      const prev = stack[stack.length - 1];
      draftUndoStack.current = stack.slice(0, -1);
      setDraftUndoDepth(draftUndoStack.current.length);
      setDraftLayer(prev);
      return;
    }
    if (history.past.length) {
      draftUndoStack.current = [];
      setDraftUndoDepth(0);
      const next = undoHistory(history);
      onHistoryChange(next);
      if (activeLayerId) {
        const layer = next.present.layers.find((l) => l.id === activeLayerId);
        if (layer) setDraftLayer({ ...layer });
        else {
          setActiveLayerId(null);
          setDraftLayer(null);
          setFontExtract(null);
        }
      }
    }
  }, [history, onHistoryChange, activeLayerId]);

  const performRedo = useCallback(() => {
    if (history.future.length) {
      draftUndoStack.current = [];
      setDraftUndoDepth(0);
      onHistoryChange(redoHistory(history));
    }
  }, [history, onHistoryChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        performRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [performUndo, performRedo]);

  const pointerToImage = useCallback(
    (clientX: number, clientY: number) => {
      const el = viewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return screenToImageWithScroll(
        clientX,
        clientY,
        rect,
        el.scrollLeft,
        el.scrollTop,
        doc.source.width,
        displayWidth,
        zoom,
      );
    },
    [doc.source.width, displayWidth, zoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (selectionBlocked) return;
    const p = pointerToImage(e.clientX, e.clientY);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    setPendingRegion(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointerToImage(e.clientX, e.clientY);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const region = clampRegion(
      normalizeDragRect(drag.x0, drag.y0, drag.x1, drag.y1),
      doc.source.width,
      doc.source.height,
    );
    setDrag(null);
    if (region.w < 12 || region.h < 10) return;
    pendingTextEdited.current = false;
    setPendingRegion(region);
    setActiveLayerId(null);
    setDraftLayer(null);
  };

  const runFontExtraction = useCallback(
    async (region: RegionRect, knownText?: string): Promise<FontExtractionResult | null> => {
      try {
        return await extractFontStyleFromRegion(
          doc.sourceDataUrl,
          region,
          doc.source.width,
          doc.source.height,
          setStatus,
          knownText ? sanitizeInvitationText(knownText) : undefined,
        );
      } catch {
        return null;
      }
    },
    [doc.sourceDataUrl, doc.source.width, doc.source.height],
  );

  useEffect(() => {
    if (!pendingRegion) {
      setPendingSelectedText("");
      pendingTextEdited.current = false;
      return;
    }
    let cancelled = false;
    setPendingTextLoading(true);
    void runFontExtraction(pendingRegion).then((extracted) => {
      if (cancelled) return;
      if (!pendingTextEdited.current) {
        setPendingSelectedText(extracted?.detectedText ?? "");
      }
      setFontExtract(extracted);
      setPendingTextLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingRegion, runFontExtraction]);

  const beginReplace = async () => {
    if (!pendingRegion) return;
    setBusy(true);
    setError("");
    setStatus("Analyzing selected text…");
    try {
      const inkBounds = await measureInkBoundsFromSource(doc.sourceDataUrl, pendingRegion);
      if (!inkBounds) {
        setError("No letter ink found in this box. Draw around the text line — empty area in the box is not edited.");
        return;
      }
      const corrected = sanitizeInvitationText(pendingSelectedText);
      const extracted = await runFontExtraction(pendingRegion, corrected || undefined);
      setFontExtract(extracted);
      const originalText = corrected || extracted?.detectedText || "";
      const layer: TextEditLayer = {
        id: createId("layer"),
        region: pendingRegion,
        inkBounds,
        originalText,
        text: "",
        style: extracted ? { ...DEFAULT_LAYER_STYLE, ...extracted.style } : { ...DEFAULT_LAYER_STYLE },
        showText: true,
      };
      draftUndoStack.current = [];
      setDraftUndoDepth(0);
      setDraftLayer(layer);
      setActiveLayerId(layer.id);
      setPendingRegion(null);
      setPendingSelectedText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start text replacement.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const redetectFont = async () => {
    if (!draftLayer) return;
    setBusy(true);
    setError("");
    try {
      const corrected = sanitizeInvitationText(draftLayer.originalText);
      const extracted = await runFontExtraction(draftLayer.region, corrected || undefined);
      if (!extracted) {
        setError("Could not analyze font in this region.");
        return;
      }
      setFontExtract(extracted);
      patchDraft({
        ...draftLayer,
        originalText: corrected || draftLayer.originalText,
        style: { ...extracted.style },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Font detection failed.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const beginRemove = async () => {
    if (!pendingRegion) return;
    setBusy(true);
    setError("");
    try {
      const inkBounds = await measureInkBoundsFromSource(doc.sourceDataUrl, pendingRegion);
      if (!inkBounds) {
        setError("No letter ink found in this box. Draw around the text you want removed.");
        return;
      }
      const quality = await assessRestorationQuality(doc, pendingRegion, inkBounds);
      if (!quality.ok) {
        setError(quality.message ?? "Could not remove text cleanly.");
        return;
      }
      const layer: TextEditLayer = {
        id: createId("layer"),
        region: pendingRegion,
        inkBounds,
        originalText: pendingSelectedText,
        text: "",
        style: { ...DEFAULT_LAYER_STYLE },
        showText: false,
      };
      setAwaitingConfirm(layer);
      setPendingRegion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that text.");
    } finally {
      setBusy(false);
    }
  };

  const saveDraftLayer = async () => {
    if (!draftLayer) return;
    const next = sanitizeInvitationText(draftLayer.text);
    const orig = sanitizeInvitationText(draftLayer.originalText);
    if (!next) {
      setError("Enter the new text you want in this spot.");
      return;
    }
    if (orig && next === orig) {
      setError("New text must be different from the selected text on the invitation.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Checking this region…");
    try {
      const quality = await assessRestorationQuality(doc, draftLayer.region, draftLayer.inkBounds);
      if (!quality.ok) {
        setError(quality.message ?? "Could not replace text cleanly in this box. Tighten the selection.");
        return;
      }
      setAwaitingConfirm(draftLayer);
      draftUndoStack.current = [];
      setDraftUndoDepth(0);
      setDraftLayer(null);
      setActiveLayerId(draftLayer.id);
      setFontExtract(null);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const cancelDraft = () => {
    draftUndoStack.current = [];
    setDraftUndoDepth(0);
    setDraftLayer(null);
    setActiveLayerId(null);
    setFontExtract(null);
  };

  const confirmAwaitingEdit = () => {
    if (!awaitingConfirm) return;
    const exists = doc.layers.some((l) => l.id === awaitingConfirm.id);
    const layers = exists
      ? doc.layers.map((l) => (l.id === awaitingConfirm.id ? awaitingConfirm : l))
      : [...doc.layers, awaitingConfirm];
    commitDoc({ ...doc, layers });
    setAwaitingConfirm(null);
    setActiveLayerId(null);
    setError("");
  };

  const discardAwaitingEdit = () => {
    setAwaitingConfirm(null);
    setActiveLayerId(null);
  };

  const adjustAwaitingEdit = () => {
    if (!awaitingConfirm) return;
    draftUndoStack.current = [];
    setDraftUndoDepth(0);
    setDraftLayer({ ...awaitingConfirm });
    setAwaitingConfirm(null);
  };

  const removeConfirmedLayer = (layerId: string) => {
    commitDoc({ ...doc, layers: doc.layers.filter((l) => l.id !== layerId) });
    if (activeLayerId === layerId) setActiveLayerId(null);
  };

  const adjustConfirmedLayer = (layer: TextEditLayer) => {
    commitDoc({ ...doc, layers: doc.layers.filter((l) => l.id !== layer.id) });
    draftUndoStack.current = [];
    setDraftUndoDepth(0);
    setDraftLayer({ ...layer });
    setActiveLayerId(layer.id);
    setAwaitingConfirm(null);
  };

  const draftRect = drag
    ? clampRegion(normalizeDragRect(drag.x0, drag.y0, drag.x1, drag.y1), doc.source.width, doc.source.height)
    : null;

  const imgSrc = previewUrl ?? doc.sourceDataUrl;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}>
            Zoom in
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>
            Zoom out
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={resetCanvasView}>
            Reset view
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!history.past.length && draftUndoDepth === 0}
            onClick={performUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!history.future.length}
            onClick={performRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onReset}>
            Reset all
          </Button>
        </div>

        {scaledNotice ? (
          <p className="text-xs text-amber-900">
            Large file scaled to fit the editor. Export uses the working resolution shown here. Exact pixel-perfect preservation
            is not guaranteed for very large uploads.
          </p>
        ) : null}

        {awaitingConfirm && !editInProgress ? (
          <p className="text-xs text-amber-900">
            Review the preview, then confirm this change to save it and edit another line — or keep editing / discard.
          </p>
        ) : null}
        {editInProgress ? (
          <p className="text-xs text-gold-dark">Finish or cancel this text change before selecting another region.</p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="text-sm text-ink-muted" role="status">
            {status}
          </p>
        ) : null}

        <div
          ref={viewportRef}
          className={cn(
            "relative overflow-auto overscroll-contain rounded-xl border border-stone-200 bg-stone-100",
            !selectionBlocked ? "cursor-crosshair" : "cursor-not-allowed",
          )}
          style={{ maxHeight: 520 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={(e) => {
            const el = viewportRef.current;
            if (!el) return;

            const overflowY = el.scrollHeight > el.clientHeight + 2;
            const overflowX = el.scrollWidth > el.clientWidth + 2;
            const pinchOrZoom = e.ctrlKey || e.metaKey;
            const shouldScroll =
              !pinchOrZoom && (overflowY || overflowX) && (Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0);

            if (shouldScroll) {
              return;
            }

            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;
            const sx = cursorX + el.scrollLeft;
            const sy = cursorY + el.scrollTop;
            const z = zoomRef.current;
            const nextZoom = Math.max(0.4, Math.min(3, z - e.deltaY * 0.001));
            const base = displayWidth / doc.source.width;
            const scale0 = base * z;
            const scale1 = base * nextZoom;
            const ix = scale0 > 0 ? sx / scale0 : 0;
            const iy = scale0 > 0 ? sy / scale0 : 0;
            setZoom(nextZoom);
            requestAnimationFrame(() => {
              const box = viewportRef.current;
              if (!box) return;
              box.scrollLeft = Math.max(0, ix * scale1 - cursorX);
              box.scrollTop = Math.max(0, iy * scale1 - cursorY);
            });
          }}
        >
          <div
            className="relative"
            style={{
              width: scaledDisplayWidth,
              height: scaledDisplayHeight,
            }}
          >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `scale(${zoom})`,
            }}
          >
            <img src={imgSrc} alt="Invitation editor canvas" className="block w-full select-none" draggable={false} />
            {draftRect ? (
              <div
                className="pointer-events-none absolute border-2 border-gold bg-gold/10"
                style={regionToLocalDisplay(
                  draftRect,
                  doc.source.width,
                  doc.source.height,
                  displayWidth,
                  displayHeight,
                )}
              />
            ) : null}
            {pendingRegion ? (
              <div
                className="pointer-events-none absolute border-2 border-amber-600 bg-amber-200/10"
                style={regionToLocalDisplay(
                  pendingRegion,
                  doc.source.width,
                  doc.source.height,
                  displayWidth,
                  displayHeight,
                )}
              >
                {(pendingSelectedText || pendingTextLoading) && (
                  <span className="absolute -top-6 left-0 max-w-full truncate rounded bg-amber-950/90 px-2 py-0.5 text-[10px] text-white shadow">
                    {pendingTextLoading ? "Reading…" : pendingSelectedText}
                  </span>
                )}
              </div>
            ) : null}
            {draftLayer ? (
              <>
                <div
                  className="pointer-events-none absolute border border-dashed border-stone-400/70"
                  style={regionToLocalDisplay(
                    draftLayer.region,
                    doc.source.width,
                    doc.source.height,
                    displayWidth,
                    displayHeight,
                  )}
                />
                {draftLayer.inkBounds ? (
                  <div
                    className="pointer-events-none absolute border-2 border-gold bg-gold/5"
                    style={regionToLocalDisplay(
                      draftLayer.inkBounds,
                      doc.source.width,
                      doc.source.height,
                      displayWidth,
                      displayHeight,
                    )}
                  >
                    {draftLayer.originalText ? (
                      <span className="absolute -top-6 left-0 max-w-full truncate rounded bg-gold-dark/95 px-2 py-0.5 text-[10px] text-white shadow">
                        Text ink: {draftLayer.originalText}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            {doc.layers.map((layer) => (
              <div
                key={layer.id}
                className="pointer-events-none absolute border-2 border-emerald-700/60"
                style={regionToLocalDisplay(
                  layer.inkBounds ?? layer.region,
                  doc.source.width,
                  doc.source.height,
                  displayWidth,
                  displayHeight,
                )}
              />
            ))}
            {awaitingConfirm && !draftLayer ? (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-amber-600"
                style={regionToLocalDisplay(
                  awaitingConfirm.inkBounds ?? awaitingConfirm.region,
                  doc.source.width,
                  doc.source.height,
                  displayWidth,
                  displayHeight,
                )}
              />
            ) : null}
          </div>
          </div>
        </div>

        {pendingRegion ? (
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
            <p className="text-sm font-medium">Selected region</p>
            <p className="mt-1 text-xs text-ink-muted">
              This box finds the line. Only detected letter ink is changed — background in the box stays as-is.
            </p>
            <Label htmlFor="pending-selected-text">Selected text on invitation</Label>
            <Input
              id="pending-selected-text"
              className="mt-1 font-medium"
              value={pendingSelectedText}
              placeholder={pendingTextLoading ? "Reading…" : "Type exactly what this box shows on the card"}
              onChange={(e) => {
                pendingTextEdited.current = true;
                setPendingSelectedText(e.target.value);
              }}
            />
            {fontExtract?.ocrConfidence === "low" ? (
              <p className="text-xs text-amber-900">Reading was partial — correct the line above so font matching uses the right letters.</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="gold" size="sm" disabled={busy} onClick={() => void beginReplace()}>
                Replace this text
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void beginRemove()}>
                Remove this text
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPendingRegion(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
        <div>
          <h2 className="font-serif text-xl">Your text changes</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {doc.layers.length
              ? `${doc.layers.length} confirmed · only selected boxes are modified`
              : "Confirm each edit, then draw the next region"}
          </p>
        </div>

        {doc.layers.length ? (
          <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
            {doc.layers.map((layer, index) => (
              <li key={layer.id} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
                <p className="font-medium text-emerald-950">Edit {index + 1}</p>
                {layer.showText ? (
                  <p className="mt-1 truncate text-emerald-900" title={layer.text}>
                    {layer.originalText ? `${layer.originalText} → ${layer.text}` : layer.text}
                  </p>
                ) : (
                  <p className="mt-1 text-emerald-900">Text removed</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => adjustConfirmedLayer(layer)}>
                    Adjust
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => removeConfirmedLayer(layer.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {awaitingConfirm && !draftLayer ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm">
            <p className="font-medium text-amber-950">Confirm this edit?</p>
            {awaitingConfirm.showText ? (
              <>
                <p className="text-xs text-amber-900">
                  <span className="font-medium">Was:</span> {awaitingConfirm.originalText || "—"}
                </p>
                <p className="text-xs text-amber-900">
                  <span className="font-medium">Now:</span> {awaitingConfirm.text}
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-900">Text will be removed in the selected box.</p>
            )}
            <div className="flex flex-col gap-2">
              <Button type="button" variant="gold" size="sm" onClick={confirmAwaitingEdit}>
                Confirm &amp; edit next line
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={adjustAwaitingEdit}>
                Keep editing
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={discardAwaitingEdit}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        {!draftLayer && !awaitingConfirm && doc.layers.length === 0 ? (
          <p className="text-xs text-ink-muted">Select a region on the canvas to begin.</p>
        ) : null}
        {!draftLayer && !awaitingConfirm && doc.layers.length > 0 ? (
          <p className="text-xs text-ink-muted">Select another region to add the next change.</p>
        ) : null}

        {draftLayer && draftLayer.showText ? (
          <div className="space-y-3 border-t border-stone-100 pt-3">
            <Label htmlFor="draft-original-text">Selected text on invitation</Label>
            <Input
              id="draft-original-text"
              className="font-medium"
              value={draftLayer.originalText}
              onChange={(e) => patchDraft({ ...draftLayer, originalText: e.target.value })}
            />
            <p className="text-xs text-ink-muted">
              Dashed outline = locate line; gold outline = letter ink only. New wording replaces those pixels on apply.
            </p>
            {fontExtract ? (
              <div className="space-y-1 text-xs text-ink-muted">
                <p>
                  Detected size:{" "}
                  <span className="font-medium text-ink">{fontExtract.detectedFontSize}px</span>
                  {fontExtract.measuredCapHeight ? ` (ink height ${fontExtract.measuredCapHeight}px in selection)` : null}
                </p>
                <p>{fontExtract.note}</p>
              </div>
            ) : null}

            {fontExtract && fontExtract.suggestions.length ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">Font suggestions</p>
                <ul className="max-h-36 space-y-1 overflow-y-auto">
                  {fontExtract.suggestions.slice(0, 6).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs transition hover:bg-cream-dark/50",
                          draftLayer.style.fontFamily === s.fontFamily ? "border-gold bg-gold/5" : "border-stone-200",
                        )}
                        onClick={() =>
                          patchDraft({
                            ...draftLayer,
                            style: { ...draftLayer.style, fontFamily: s.fontFamily },
                          })
                        }
                      >
                        <span>{s.label}</span>
                        <span className="text-ink-muted">{s.score}% match</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button type="button" variant="secondary" size="sm" className="w-full" disabled={busy} onClick={() => void redetectFont()}>
              Re-detect font from source
            </Button>

            <Label htmlFor="layer-text">New text (replacement)</Label>
            <Textarea
              id="layer-text"
              value={draftLayer.text}
              placeholder="Type the new line exactly as it should appear…"
              onChange={(e) => patchDraft({ ...draftLayer, text: e.target.value })}
              rows={3}
            />
            {draftLayer.text.trim() && shouldApplyLayerOnCanvas(draftLayer) ? (
              <p className="text-xs text-gold-dark">Live preview shows your new text in the selected box only.</p>
            ) : null}
            <Label htmlFor="layer-font">Font</Label>
            <Select
              id="layer-font"
              value={draftLayer.style.fontFamily}
              onChange={(e) =>
                patchDraft({
                  ...draftLayer,
                  style: { ...draftLayer.style, fontFamily: e.target.value },
                })
              }
            >
              {FONT_SUGGESTIONS.map((f) => (
                <option key={f.id} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="layer-size">Size</Label>
                <Input
                  id="layer-size"
                  type="number"
                  min={8}
                  max={120}
                  value={draftLayer.style.fontSize}
                  onChange={(e) =>
                    patchDraft({
                      ...draftLayer,
                      style: { ...draftLayer.style, fontSize: Number(e.target.value) || 16 },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="layer-color">Color</Label>
                <Input
                  id="layer-color"
                  type="color"
                  value={colorToHex(draftLayer.style.color)}
                  onChange={(e) =>
                    patchDraft({
                      ...draftLayer,
                      style: { ...draftLayer.style, color: e.target.value },
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="layer-align">Align</Label>
                <Select
                  id="layer-align"
                  value={draftLayer.style.align}
                  onChange={(e) =>
                    patchDraft({
                      ...draftLayer,
                      style: { ...draftLayer.style, align: e.target.value as CanvasTextAlign },
                    })
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="layer-rotation">Rotation (°)</Label>
                <Input
                  id="layer-rotation"
                  type="number"
                  value={draftLayer.style.rotation}
                  onChange={(e) =>
                    patchDraft({
                      ...draftLayer,
                      style: { ...draftLayer.style, rotation: Number(e.target.value) || 0 },
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="layer-lh">Line spacing</Label>
                <Input
                  id="layer-lh"
                  type="number"
                  step={0.05}
                  min={0.8}
                  max={2}
                  value={draftLayer.style.lineHeight}
                  onChange={(e) =>
                    patchDraft({
                      ...draftLayer,
                      style: { ...draftLayer.style, lineHeight: Number(e.target.value) || 1.2 },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="layer-weight">Weight</Label>
                <Select
                  id="layer-weight"
                  value={String(draftLayer.style.fontWeight)}
                  onChange={(e) =>
                    patchDraft({
                      ...draftLayer,
                      style: { ...draftLayer.style, fontWeight: Number(e.target.value) },
                    })
                  }
                >
                  <option value="400">Regular</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                </Select>
              </div>
            </div>
            <Button type="button" variant="gold" size="sm" className="w-full" disabled={busy} onClick={() => void saveDraftLayer()}>
              Preview &amp; confirm
            </Button>
            <Button type="button" variant="secondary" size="sm" className="w-full" onClick={cancelDraft}>
              Cancel edit
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
