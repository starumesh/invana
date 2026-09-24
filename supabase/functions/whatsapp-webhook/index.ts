// WhatsApp Cloud API webhook — verify + status callbacks → message_logs.
// Deploy: `supabase functions deploy whatsapp-webhook --no-verify-jwt`
// Secrets: WHATSAPP_WEBHOOK_VERIFY_TOKEN, SUPABASE_SERVICE_ROLE_KEY (auto)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

serve(async (req) => {
  const url = new URL(req.url);
  const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

  // Meta subscription verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Optional: verify X-Hub-Signature-256 when app secret is configured.
  const payload = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const statuses = extractStatuses(payload);
  for (const status of statuses) {
    await supabase.from("message_logs").insert({
      id: `log_${crypto.randomUUID()}`,
      provider_message_id: status.id,
      event_type: status.status,
      payload: status,
    });

    if (status.id) {
      await supabase
        .from("message_recipients")
        .update({
          status: mapStatus(status.status),
          updated_at: new Date().toISOString(),
        })
        .eq("provider_message_id", status.id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

function extractStatuses(payload: unknown): { id?: string; status?: string }[] {
  const root = payload as {
    entry?: { changes?: { value?: { statuses?: { id?: string; status?: string }[] } }[] }[];
  };
  const out: { id?: string; status?: string }[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        out.push(status);
      }
    }
  }
  return out;
}

function mapStatus(status?: string): string {
  switch (status) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}
