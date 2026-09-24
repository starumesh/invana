import { useState } from "react";
import { useRequireSignIn } from "@/auth/useRequireSignIn";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { OpenIcon, ShareIcon } from "@/components/ui/Icons";
import { inviteUrl } from "@/lib/url";
import { uniquePhones } from "@/lib/validation";
import { messaging } from "@/services";
import type { SendResult } from "@/types";

type Props = {
  slug: string;
  title: string;
  defaultMessage: string;
  published?: boolean;
};

export function SharePanel({ slug, title, defaultMessage, published = false }: Props) {
  const allowSignedInAction = useRequireSignIn();
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [results, setResults] = useState<SendResult[]>([]);
  const [busy, setBusy] = useState(false);
  const link = inviteUrl(slug);

  async function onShare() {
    if (!allowSignedInAction()) return;
    setBusy(true);
    try {
      const recipients = uniquePhones(phones.split(/[\n,;]+/));
      if (!recipients.length) {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${message}\n\n${link}`)}`, "_blank");
        return;
      }
      const next = await messaging.sendText(recipients, `${message}\n\n${link}`);
      setResults(next);
      next.forEach((result) => {
        if (result.url) window.open(result.url, "_blank");
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <div>
        <h3 className="font-serif text-xl">Share on WhatsApp</h3>
        <p className="mt-1 text-sm text-ink-muted">
          {published
            ? "Copy the link or open WhatsApp with a ready-to-send message."
            : "Publish first so guests can open your invitation page."}
        </p>
      </div>
      <div>
        <Label htmlFor="share-link">Invitation link</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="share-link" readOnly value={link} className="min-w-0 flex-1" />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!allowSignedInAction()) return;
              void navigator.clipboard.writeText(link);
            }}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!published}
            onClick={() => {
              if (!allowSignedInAction()) return;
              window.open(link, "_blank", "noopener,noreferrer");
            }}
          >
            <OpenIcon />
            Open
          </Button>
        </div>
      </div>
      <div>
        <Label htmlFor="share-phones">Guest phones (optional)</Label>
        <Textarea
          id="share-phones"
          placeholder={"+919876543210\n+14155550100"}
          value={phones}
          onChange={(e) => setPhones(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="share-message">Message</Label>
        <Textarea
          id="share-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <Button type="button" variant="gold" disabled={busy || !published} onClick={() => void onShare()}>
        <ShareIcon />
        {busy ? "Opening…" : `Share “${title}”`}
      </Button>
      {results.length ? (
        <ul className="space-y-1 text-sm text-ink-muted">
          {results.map((result) => (
            <li key={result.recipient}>
              {result.recipient}: {result.status}
              {result.url ? (
                <>
                  {" "}
                  —{" "}
                  <a className="underline" href={result.url} target="_blank" rel="noreferrer">
                    open
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
