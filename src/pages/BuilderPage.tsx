import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { DynamicFields } from "@/components/editor/DynamicFields";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { ThemePicker } from "@/components/editor/ThemePicker";
import { Button } from "@/components/ui/Button";
import { PreviewIcon, SaveIcon } from "@/components/ui/Icons";
import { normalizeCardType } from "@/config/card-types";
import { getEvent, peekLocalDraft, saveEvent } from "@/api/events";
import { displayTitle } from "@/lib/fields";
import { requiredFieldsError } from "@/lib/validation";
import { fieldSpecsForInput } from "@/templates/fields";
import { getTemplate } from "@/templates/registry";
import { usePageMeta } from "@/seo/usePageMeta";
import { auth } from "@/services";
import type { StoredEvent, ThemeId } from "@/types";

const UNSAVED_LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

function normalizeBuilderEvent(found: StoredEvent): StoredEvent {
  const cardType = normalizeCardType(found.config.cardType) ?? found.config.cardType;
  return cardType !== found.config.cardType
    ? { ...found, config: { ...found.config, cardType } }
    : found;
}

export function BuilderPage() {
  const { id = "" } = useParams();
  const [event, setEvent] = useState<StoredEvent | null>(() => {
    const local = id ? peekLocalDraft(id) : null;
    return local ? normalizeBuilderEvent(local) : null;
  });
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  /** True after field/theme edits since last successful save (or page load). */
  const [dirty, setDirty] = useState(false);

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = UNSAVED_LEAVE_MESSAGE;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const builderMeta = useMemo(() => {
    if (error) {
      return {
        title: "Draft missing | Invana",
        description: "This draft could not be found. Start a new invitation or bio card.",
        noIndex: true,
      };
    }
    if (!event) return null;
    const name = displayTitle(event.config);
    const kind = event.config.kind === "card" ? "Bio Data card" : "invitation";
    return {
      title: `${name} — Editor | Invana`,
      description: `Edit your ${kind} “${name}” with live preview on Invana.`,
      noIndex: true,
    };
  }, [event, error]);

  usePageMeta(builderMeta);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setFormError("");
    setSavedAt(null);
    setPreviewOpen(false);
    setDirty(false);

    // Paint from localStorage synchronously so Use → Builder never flashes “missing”.
    const local = peekLocalDraft(id);
    if (local) {
      setEvent(normalizeBuilderEvent(local));
    } else {
      setEvent(null);
    }

    auth.ensureUser();
    void getEvent(id)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          // Only show missing if we still have nothing local (avoid races with in-flight create sync).
          if (!peekLocalDraft(id)) setError("This draft could not be found.");
          return;
        }
        setEvent(normalizeBuilderEvent(found));
      })
      .catch(() => {
        if (cancelled) return;
        if (!peekLocalDraft(id)) setError("This draft could not be found.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const template = event ? getTemplate(event.config.templateId) : undefined;

  const fieldSpecs = useMemo(() => {
    if (!event || !template) return [];
    return fieldSpecsForInput(event.config, template);
  }, [event, template]);

  const validateRequired = useCallback(
    (next: StoredEvent): string | null => {
      if (!template) return "Template missing.";
      const specs = fieldSpecsForInput(next.config, template);
      return requiredFieldsError(specs, next.config.fields);
    },
    [template],
  );

  const save = useCallback(
    async (next: StoredEvent) => {
      const missing = validateRequired(next);
      if (missing) {
        setFormError(missing);
        return null;
      }
      setFormError("");
      setSaving(true);
      try {
        const stored = await saveEvent({
          ...next,
          title: displayTitle(next.config),
          updatedAt: new Date().toISOString(),
        });
        setEvent(stored);
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString());
        return stored;
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Could not save. Please try again.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [validateRequired],
  );

  const ensureSaved = useCallback(async () => {
    if (!event) return;
    const missing = validateRequired(event);
    if (missing) {
      setFormError(missing);
      throw new Error(missing);
    }
    const stored = await save(event);
    if (!stored) throw new Error("Could not save. Please check required details.");
  }, [event, save, validateRequired]);

  function patchField(key: string, value: unknown) {
    if (!event) return;
    setFormError("");
    const next: StoredEvent = {
      ...event,
      config: {
        ...event.config,
        fields: { ...event.config.fields, [key]: value },
      },
    };
    setEvent(next);
    setDirty(true);
  }

  function patchTheme(theme: ThemeId) {
    if (!event) return;
    setEvent({ ...event, config: { ...event.config, theme } });
    setDirty(true);
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl">Draft missing</h1>
        <p className="mt-3 text-ink-muted">{error}</p>
        <Link to="/create" className="mt-6 inline-block text-gold-dark underline">
          Create invitation
        </Link>
      </main>
    );
  }

  if (!event || !template) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20">
        <div className="rounded-3xl border border-stone-200 bg-white/70 px-6 py-16 text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-gold/40 border-t-gold animate-soft-pulse" />
          <p className="mt-5 font-serif text-2xl text-ink">Opening builder</p>
          <p className="mt-2 text-sm text-ink-muted">Loading your draft…</p>
        </div>
      </main>
    );
  }

  const title = displayTitle(event.config);
  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "invitation";
  const leavePrompt =
    blocker.state === "blocked" ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-title"
        onClick={() => blocker.reset?.()}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-stone-200 bg-cream p-6 shadow-lift"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-gold-dark">Unsaved changes</p>
          <h2 id="unsaved-leave-title" className="mt-2 font-serif text-2xl text-ink">
            Leave without saving?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            You have edits that haven’t been saved. If you leave now, those changes will be lost.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={() => blocker.proceed?.()}>
              Leave without saving
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-12">
      {leavePrompt}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">
            {event.config.kind === "card" ? "Card builder" : "Invitation builder"}
          </p>
          <h1 className="mt-1 font-serif text-3xl md:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {template.name}
            {savedAt ? ` · Saved ${savedAt}` : ""}
            {event.status === "published" ? " · Published" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => void save(event)}>
            <SaveIcon />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {formError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="order-2 space-y-8 lg:order-1">
          <ThemePicker value={event.config.theme} onChange={patchTheme} />
          <DynamicFields
            fields={fieldSpecs}
            values={event.config.fields}
            eventType={event.config.eventType}
            eventId={event.id}
            onChange={patchField}
          />
          <p className="rounded-2xl border border-dashed border-stone-200 bg-white/60 px-4 py-3 text-sm text-ink-muted">
            {event.config.kind === "card" ? (
              <>
                Download PNG or PDF from the preview. Cards stay private — find them in{" "}
                <Link to="/dashboard" className="font-medium text-gold-dark underline">
                  My events
                </Link>
                .
              </>
            ) : (
              <>
                Ready to go live? Publish and share from{" "}
                <Link to="/dashboard" className="font-medium text-gold-dark underline">
                  My events
                </Link>
                .
              </>
            )}
          </p>
        </div>
        <div className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">
          <PreviewPanel
            template={template}
            input={event.config}
            filenameBase={filename}
            maximized={previewOpen}
            onMaximizedChange={setPreviewOpen}
            ensureSaved={ensureSaved}
            validateBeforeDownload={() => {
              const missing = validateRequired(event);
              if (missing) setFormError(missing);
              return missing;
            }}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-cream/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button type="button" className="flex-1" variant="secondary" disabled={saving} onClick={() => void save(event)}>
            <SaveIcon />
            Save
          </Button>
          <Button type="button" className="flex-1" variant="gold" onClick={() => setPreviewOpen(true)}>
            <PreviewIcon />
            Preview
          </Button>
        </div>
      </div>
    </main>
  );
}
