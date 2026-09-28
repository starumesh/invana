import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { copyText, nativeShare, whatsAppUrl } from "@/lib/eventShare";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "@/lib/calendar";

export function ShareActions({
  url,
  title,
  whatsAppText,
  phone,
  compact,
}: {
  url: string;
  title: string;
  whatsAppText: string;
  phone?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState("");
  const size = compact ? "sm" : "md";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size={size}
          variant="secondary"
          onClick={async () => setStatus((await copyText(url)) ? "Link copied." : "Couldn't copy — select the link and copy it manually.")}
        >
          Copy link
        </Button>
        <a href={whatsAppUrl(whatsAppText, phone)} target="_blank" rel="noreferrer" className={buttonClassName("gold", size)}>
          WhatsApp
        </a>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
          <Button
            type="button"
            size={size}
            variant="secondary"
            onClick={async () => {
              const ok = await nativeShare({ title, text: whatsAppText.replace(url, "").trim(), url });
              if (!ok) setStatus("Sharing isn't available here — use Copy link instead.");
            }}
          >
            Share…
          </Button>
        ) : null}
      </div>
      <p className="mt-2 min-h-[1.25rem] text-xs text-ink-muted" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export function CalendarActions({ event, filename }: { event: CalendarEvent; filename: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Add to calendar">
      <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={buttonClassName("secondary", "sm")}>
        Google Calendar
      </a>
      <Button type="button" size="sm" variant="secondary" onClick={() => downloadIcs(event, filename)}>
        Apple / iCal
      </Button>
      <a href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer" className={buttonClassName("secondary", "sm")}>
        Outlook
      </a>
    </div>
  );
}
