import { useEffect, useState } from "react";
import { useRequireSignIn } from "@/auth/useRequireSignIn";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { PublishIcon } from "@/components/ui/Icons";
import { normalizeSlug, suggestSlug } from "@/lib/slug";
import { inviteUrl } from "@/lib/url";
import { activePersistence } from "@/services";

type Props = {
  eventId: string;
  titleParts: string[];
  currentSlug: string;
  status: "draft" | "published";
  onPublish: (slug: string) => Promise<void>;
};

export function PublishPanel({ eventId, titleParts, currentSlug, status, onPublish }: Props) {
  const allowSignedInAction = useRequireSignIn();
  const [slug, setSlug] = useState(() => currentSlug || suggestSlug(titleParts));
  const [taken, setTaken] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const partsKey = titleParts.join("|");

  useEffect(() => {
    void activePersistence().takenSlugs(eventId).then(setTaken);
  }, [eventId]);

  useEffect(() => {
    setSlug(currentSlug || suggestSlug(partsKey.split("|")));
  }, [currentSlug, partsKey]);

  const normalized = normalizeSlug(slug);
  const available = Boolean(normalized) && !taken.includes(normalized);

  async function publish() {
    if (!allowSignedInAction()) return;
    setError("");
    if (!available) {
      setError("That link is taken. Try another.");
      return;
    }
    setBusy(true);
    try {
      await onPublish(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <div>
        <h3 className="font-serif text-xl">Publish invitation site</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Guests open a public RSVP page. Status:{" "}
          <span className="font-medium text-ink">{status === "published" ? "Published" : "Saved"}</span>
        </p>
      </div>
      <div>
        <Label htmlFor="publish-slug">Invitation link name</Label>
        <Input
          id="publish-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="priya-rahul-wedding"
        />
        <p className="mt-2 break-all text-xs text-ink-muted">{inviteUrl(normalized || "your-link")}</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="button" disabled={busy || !available} onClick={() => void publish()}>
        <PublishIcon />
        {busy ? (status === "published" ? "Updating…" : "Publishing…") : status === "published" ? "Update" : "Publish"}
      </Button>
    </div>
  );
}
