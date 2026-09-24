// Supabase Edge Function stub — WhatsApp Business Cloud API send path.
// Deploy: `supabase functions deploy whatsapp-send`
// Secrets (never VITE_*): WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//   WHATSAPP_BUSINESS_ACCOUNT_ID (optional for send), SUPABASE_SERVICE_ROLE_KEY (auto).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendBody = {
  type: "text" | "image" | "video" | "audio" | "document";
  recipients: string[];
  text: string;
  mediaUrl?: string;
};

type SendResult = {
  recipient: string;
  status: "pending" | "sent" | "failed" | "demo";
  error?: string;
  url?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!token || !phoneNumberId) {
      return json(
        {
          error:
            "WhatsApp Cloud API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Edge Function secrets.",
        },
        503,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Unauthorized." }, 401);
    }

    const body = (await req.json()) as SendBody;
    if (!body?.recipients?.length || !body.text) {
      return json({ error: "recipients and text are required." }, 400);
    }

    const results: SendResult[] = [];
    for (const recipient of body.recipients) {
      const to = recipient.replace(/\D/g, "");
      if (!to) {
        results.push({ recipient, status: "failed", error: "Invalid phone number." });
        continue;
      }

      const payload = buildPayload(phoneNumberId, to, body);
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        results.push({
          recipient,
          status: "failed",
          error: data?.error?.message ?? `Meta API HTTP ${res.status}`,
        });
        continue;
      }

      results.push({
        recipient,
        status: "sent",
      });
    }

    return json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function buildPayload(phoneNumberId: string, to: string, body: SendBody) {
  // Production sends for business-initiated chats typically require approved message templates.
  // This stub sends a session/text message when a conversation window is open, or text type
  // for development — replace with template payloads for cold outreach.
  void phoneNumberId;
  if (body.type === "text" || !body.mediaUrl) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.text },
    };
  }

  const mediaType = body.type === "document" ? "document" : body.type;
  return {
    messaging_product: "whatsapp",
    to,
    type: mediaType,
    [mediaType]: {
      link: body.mediaUrl,
      caption: body.text,
    },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
