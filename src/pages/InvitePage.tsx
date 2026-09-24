import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CountdownSection } from "@/components/invitation/CountdownSection";
import { InviteAtmosphere } from "@/components/invitation/InviteAtmosphere";
import { InviteBrandFooter } from "@/components/invitation/InviteBrandFooter";
import { InviteShareHint } from "@/components/invitation/InviteShareHint";
import { MapCtaSection } from "@/components/invitation/MapCtaSection";
import { ScheduleHighlightsSection } from "@/components/invitation/ScheduleHighlightsSection";
import { WhenWhereSection } from "@/components/invitation/WhenWhereSection";
import { isSectionEnabled } from "@/components/invitation/sectionVisibility";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { formatDate, formatTime, isDateValue, isTimeValue } from "@/lib/date";
import { createId } from "@/lib/id";
import { Composition } from "@/lib/render/Composition";
import { rsvpSchema } from "@/lib/validation";
import { usePageMeta } from "@/seo/usePageMeta";
import { getTemplate } from "@/templates/registry";
import { addPublicRsvp, resolveEventBySlug } from "@/services";
import type { Rsvp, RsvpResponse, StoredEvent } from "@/types";

function fieldText(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function InvitePage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const guest = params.get("guest") ?? undefined;
  const detailsRef = useRef<HTMLElement>(null);
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [missing, setMissing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    guestName: guest ?? "",
    response: "yes" as RsvpResponse,
    partySize: 1,
    phone: "",
    email: "",
    dietary: "",
    message: "",
  });

  const inviteMeta = useMemo(() => {
    if (missing) {
      return {
        title: "Invitation not found | Invana",
        description: "This invitation may be unpublished, or the link may have changed.",
      };
    }
    if (!event) return null;
    const title = event.title?.trim() || "You're Invited";
    return {
      title: `${title} | Invana`,
      description: `You're invited to ${title}. View details and RSVP online with Invana.`,
      type: "article" as const,
    };
  }, [event, missing]);

  usePageMeta(inviteMeta);
  useEffect(() => {
    setEvent(null);
    setMissing(false);
    setSubmitted(false);
    void resolveEventBySlug(slug)
      .then((found) => {
        if (!found || found.status !== "published") setMissing(true);
        else setEvent(found);
      })
      .catch(() => setMissing(true));
  }, [slug]);

  const template = event ? getTemplate(event.config.templateId) : undefined;

  function scrollToDetails() {
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError("");
    const parsed = rsvpSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    const rsvp: Rsvp = {
      id: createId("rsvp"),
      eventId: event.id,
      guestName: parsed.data.guestName,
      response: parsed.data.response,
      partySize: parsed.data.partySize,
      phone: parsed.data.phone || undefined,
      email: parsed.data.email || undefined,
      dietary: parsed.data.dietary || undefined,
      message: parsed.data.message || undefined,
      createdAt: new Date().toISOString(),
    };
    await addPublicRsvp(rsvp);
    setSubmitted(true);
  }

  if (missing) {
    return (
      <div className="min-h-screen bg-cream px-4 py-16 text-center text-ink">
        <h1 className="font-serif text-3xl">Invitation not found</h1>
        <p className="mt-3 text-ink-muted">This invitation may be unpublished, or the link may have changed.</p>
        <Link to="/" className="mt-6 inline-block text-gold-dark underline">
          Go to Invana
        </Link>
      </div>
    );
  }

  if (!event || !template) {
    return <div className="min-h-screen bg-cream px-4 py-16 text-center text-ink-muted">Loading invitation…</div>;
  }

  const fields = event.config.fields;
  const sections = event.config.sections;
  const dateValue = isDateValue(fields.eventDate) ? fields.eventDate : null;
  const timeValue = isTimeValue(fields.eventTime) ? fields.eventTime : null;
  const date = dateValue ? formatDate(dateValue, "weekday") : "";
  const time = timeValue ? formatTime(timeValue) : "";
  const venue = fieldText(fields, "venueName");
  const city = fieldText(fields, "city", "venueCity");
  const state = fieldText(fields, "state", "venueState");
  const addressParts = [fieldText(fields, "venueAddress"), city, state].filter(Boolean);
  const address = addressParts.join(", ");
  const maps = fieldText(fields, "locationUrl");
  const message = fieldText(fields, "invitationMessage");
  const hosts = fieldText(fields, "hosts");
  const dressCode = fieldText(fields, "dressCode");
  const additionalNote = fieldText(fields, "additionalNote");
  const rsvpNote = fieldText(fields, "rsvpNote");
  const rsvpPhone = fieldText(fields, "rsvpPhone");
  const gifts = fieldText(fields, "gifts");
  const hashtagRaw = fieldText(fields, "hashtag").replace(/^#/, "");
  const hashtag = hashtagRaw ? `#${hashtagRaw}` : "";

  const showCountdown =
    event.config.kind === "invitation" && isSectionEnabled(sections, "countdown") && Boolean(dateValue);
  const showMap =
    event.config.kind === "invitation" && isSectionEnabled(sections, "map") && Boolean(maps);
  const showRsvp =
    event.config.kind === "invitation" && isSectionEnabled(sections, "rsvp");
  const showDetails =
    event.config.kind === "invitation" && isSectionEnabled(sections, "details", true);
  const showWhenWhere =
    event.config.kind === "invitation" && Boolean(date || venue || address);

  const scheduleItems = [
    hosts ? { label: "Hosts", value: hosts } : null,
    dressCode ? { label: "Dress", value: dressCode } : null,
    additionalNote ? { label: "Note", value: additionalNote } : null,
    gifts ? { label: "Gifts", value: gifts } : null,
    hashtag ? { label: "Tag", value: hashtag } : null,
    !showRsvp && rsvpPhone ? { label: "RSVP", value: rsvpPhone } : null,
    !showRsvp && rsvpNote ? { label: "Kindly", value: rsvpNote } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const hasLowerContent =
    showCountdown ||
    showWhenWhere ||
    (showDetails && scheduleItems.length > 0) ||
    showMap ||
    showRsvp;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="relative z-10 border-b border-stone-200/80 bg-cream/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="font-serif text-xl transition hover:text-gold-dark">
            Invana
          </Link>
          <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">You&apos;re invited</span>
        </div>
      </header>

      <InviteAtmosphere tone="hero" className="border-b border-stone-200/70">
        <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:py-14">
          <div className="animate-fade-up overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-card">
            <div className="aspect-[1080/1512] bg-cream-dark">
              <Composition template={template} input={event.config} guestName={guest} />
            </div>
          </div>

          <div className="animate-fade-up space-y-7 lg:pt-4" style={{ animationDelay: "80ms" }}>
            <section>
              <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">
                {event.config.eventType?.replace(/-/g, " ") ?? "Invitation"}
              </p>
              <h1 className="mt-2 font-serif text-4xl leading-tight md:text-5xl">{event.title}</h1>
              {message ? (
                <p className="mt-4 text-lg leading-relaxed text-ink-muted">
                  {guest ? `Dear ${guest}, ${message}` : message}
                </p>
              ) : (
                <p className="mt-4 text-lg leading-relaxed text-ink-muted">
                  {guest ? `Dear ${guest}, you are warmly invited.` : "You are warmly invited to celebrate with us."}
                </p>
              )}
              <dl className="mt-6 space-y-2.5 text-sm">
                {date ? (
                  <div>
                    <dt className="inline text-ink-muted">When · </dt>
                    <dd className="inline">
                      {date}
                      {time ? ` · ${time}` : ""}
                    </dd>
                  </div>
                ) : null}
                {venue ? (
                  <div>
                    <dt className="inline text-ink-muted">Where · </dt>
                    <dd className="inline">
                      {venue}
                      {maps ? (
                        <>
                          {" "}
                          —{" "}
                          <a className="underline decoration-gold/50 underline-offset-2" href={maps} target="_blank" rel="noreferrer">
                            Map
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {/* HashRouter treats href="#…" as a route change — scroll via ref instead. */}
            <button
              type="button"
              onClick={scrollToDetails}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gold-dark transition hover:text-ink"
            >
              Continue below
              <span aria-hidden className="animate-soft-pulse">
                ↓
              </span>
            </button>
          </div>
        </main>
      </InviteAtmosphere>

      <InviteAtmosphere tone="band" className="border-b border-stone-200/60">
        <section
          id="invite-details"
          ref={detailsRef}
          className="mx-auto max-w-3xl scroll-mt-6 space-y-12 px-4 py-16 md:space-y-14 md:py-20"
          aria-label="Invitation details"
        >
          <header className="animate-fade-up text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-gold-dark">The invitation</p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight md:text-4xl">
              {hasLowerContent ? "Everything you need" : "With warm regards"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
              {hasLowerContent
                ? "Details, directions, and your reply — gathered below with care."
                : "Save this page and share it with anyone who should celebrate with you."}
            </p>
            <div className="mx-auto mt-5 h-px w-20 bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />
          </header>

          {showCountdown && dateValue ? <CountdownSection date={dateValue} time={timeValue} /> : null}

          {showWhenWhere ? (
            <WhenWhereSection date={date} time={time} venue={venue} address={address} mapsUrl={maps || undefined} />
          ) : null}

          {showDetails && scheduleItems.length > 0 ? <ScheduleHighlightsSection items={scheduleItems} /> : null}

          {showMap && maps ? <MapCtaSection venueName={venue} address={address} mapsUrl={maps} /> : null}

          {showRsvp ? (
            <section className="animate-fade-up overflow-hidden rounded-2xl border border-stone-200/70 bg-white/95 shadow-soft backdrop-blur-sm">
              <div className="border-b border-stone-200/60 bg-cream-dark/35 px-6 py-7 sm:px-8">
                <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">Reply</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight">RSVP</h2>
                {rsvpNote ? (
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{rsvpNote}</p>
                ) : (
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                    Let the hosts know if you can join.
                  </p>
                )}
                {rsvpPhone ? (
                  <p className="mt-3 text-xs text-ink-muted">
                    Or call{" "}
                    <a className="text-gold-dark underline-offset-2 hover:underline" href={`tel:${rsvpPhone.replace(/\s/g, "")}`}>
                      {rsvpPhone}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="px-6 py-7 sm:px-8 sm:py-8">
                {submitted ? (
                  <div className="py-4 text-center">
                    <p className="font-serif text-2xl text-ink">Thank you</p>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
                      Your response has been received. We look forward to celebrating with you.
                    </p>
                  </div>
                ) : (
                  <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
                    <div>
                      <Label htmlFor="guestName">Your name</Label>
                      <Input
                        id="guestName"
                        required
                        value={form.guestName}
                        onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="response">Response</Label>
                        <Select
                          id="response"
                          value={form.response}
                          onChange={(e) => setForm((f) => ({ ...f, response: e.target.value as RsvpResponse }))}
                        >
                          <option value="yes">Joyfully accept</option>
                          <option value="no">Respectfully decline</option>
                          <option value="maybe">Maybe</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="partySize">Party size</Label>
                        <Input
                          id="partySize"
                          type="number"
                          min={1}
                          max={20}
                          value={form.partySize}
                          onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="message">Note (optional)</Label>
                      <Textarea
                        id="message"
                        value={form.message}
                        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      />
                    </div>
                    {error ? <p className="text-sm text-red-700">{error}</p> : null}
                    <Button type="submit" variant="gold" className="min-w-[10rem]">
                      Send RSVP
                    </Button>
                  </form>
                )}
              </div>
            </section>
          ) : (
            <section className="animate-fade-up rounded-2xl border border-stone-200/70 bg-white/80 px-6 py-10 text-center shadow-soft backdrop-blur-sm sm:px-10">
              <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">With love</p>
              <h2 className="mt-3 font-serif text-3xl tracking-tight">We hope to see you there</h2>
              <div className="mx-auto mt-4 h-px w-14 bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-ink-muted">
                {rsvpPhone
                  ? `Please confirm with the hosts at ${rsvpPhone}.`
                  : rsvpNote || "Save the date and bring your warmest wishes."}
              </p>
            </section>
          )}

          <InviteShareHint eventTitle={event.title} />
        </section>
      </InviteAtmosphere>

      <InviteBrandFooter />
    </div>
  );
}
