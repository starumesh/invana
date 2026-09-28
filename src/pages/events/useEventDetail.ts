import { useCallback, useEffect, useState } from "react";
import type { EventDetail } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

export function useEventDetail(eventId: string | undefined) {
  const { ready, signedIn } = useAuthSession();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!eventId) return;
    try {
      const next = await eventsApi.get(eventId);
      setDetail(next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Unable to load this event. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (ready && signedIn) void reload();
  }, [ready, signedIn, reload]);

  return { ready, signedIn, detail, setDetail, error, setError, loading, reload };
}
