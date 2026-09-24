import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DynamicFields } from "@/components/editor/DynamicFields";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { ThemePicker } from "@/components/editor/ThemePicker";
import { Button } from "@/components/ui/Button";
import { PreviewIcon, SaveIcon } from "@/components/ui/Icons";
import { normalizeCardType } from "@/config/card-types";
import { loadDraftForBuilder, persistEvent } from "@/lib/drafts";
import { displayTitle } from "@/lib/fields";
import { cardFields, invitationFields, withTemplatePhotoFields } from "@/templates/fields";
import { getTemplate } from "@/templates/registry";
import { usePageMeta } from "@/seo/usePageMeta";
import { auth } from "@/services";
import type { StoredEvent, ThemeId } from "@/types";

export function BuilderPage() {
  const { id = "" } = useParams();
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    setEvent(null);
    setError("");
    setSavedAt(null);
    setPreviewOpen(false);
    auth.ensureUser();
    void loadDraftForBuilder(id)
      .then((found) => {
        if (cancelled) return;
        if (!found) setError("This draft could not be found.");
        else {
          const cardType = normalizeCardType(found.config.cardType) ?? found.config.cardType;
          setEvent(
            cardType !== found.config.cardType
              ? { ...found, config: { ...found.config, cardType } }
              : found,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setError("This draft could not be found.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const template = event ? getTemplate(event.config.templateId) : undefined;

  const fieldSpecs = useMemo(() => {
    if (!event || !template) return [];
    if (template.kind === "card" && event.config.cardType) return cardFields(event.config.cardType);
    if (event.config.eventType) {
      return withTemplatePhotoFields(invitationFields(event.config.eventType), template);
    }
    return withTemplatePhotoFields(template.fields, template);
  }, [event, template]);

  const save = useCallback(async (next: StoredEvent) => {
    setSaving(true);
    try {
      const stored = await persistEvent({
        ...next,
        title: displayTitle(next.config),
        updatedAt: new Date().toISOString(),
      });
      setEvent(stored);
      setSavedAt(new Date().toLocaleTimeString());
      return stored;
    } finally {
      setSaving(false);
    }
  }, []);

  const ensureSaved = useCallback(async () => {
    if (!event) return;
    await save(event);
  }, [event, save]);

  function patchField(key: string, value: unknown) {
    if (!event) return;
    const next: StoredEvent = {
      ...event,
      config: {
        ...event.config,
        fields: { ...event.config.fields, [key]: value },
      },
    };
    setEvent(next);
  }

  function patchTheme(theme: ThemeId) {
    if (!event) return;
    setEvent({ ...event, config: { ...event.config, theme } });
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-12">
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="order-2 space-y-8 lg:order-1">
          <ThemePicker value={event.config.theme} onChange={patchTheme} />
          <DynamicFields
            fields={fieldSpecs}
            values={event.config.fields}
            eventType={event.config.eventType}
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
