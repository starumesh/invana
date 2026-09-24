import { requireSupabase } from "@/lib/supabase/client";
import type { MessagingProvider } from "@/services/types";
import type { SendResult } from "@/types";

type CloudSendBody = {
  type: "text" | "image" | "video" | "audio" | "document";
  recipients: string[];
  text: string;
  mediaUrl?: string;
};

async function invokeSend(body: CloudSendBody): Promise<SendResult[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke("whatsapp-send", { body });

  if (error) {
    return body.recipients.map((recipient) => ({
      recipient,
      status: "failed" as const,
      error:
        error.message ||
        "WhatsApp Cloud API Edge Function is not reachable. Deploy whatsapp-send and set secrets.",
    }));
  }

  const payload = data as { results?: SendResult[]; error?: string } | null;
  if (payload?.error) {
    return body.recipients.map((recipient) => ({
      recipient,
      status: "failed" as const,
      error: payload.error,
    }));
  }
  if (payload?.results?.length) return payload.results;

  return body.recipients.map((recipient) => ({
    recipient,
    status: "failed" as const,
    error: "Unexpected response from WhatsApp Edge Function.",
  }));
}

/**
 * Connected WhatsApp Cloud API adapter.
 * Never fabricates successful delivery — failures surface until Edge Function + Meta are configured.
 */
export const cloudMessaging: MessagingProvider = {
  async sendText(recipients, text) {
    return invokeSend({ type: "text", recipients, text });
  },
  async sendImage(recipients, text, imageUrl) {
    return invokeSend({ type: "image", recipients, text, mediaUrl: imageUrl });
  },
  async sendVideo(recipients, text, videoUrl) {
    return invokeSend({ type: "video", recipients, text, mediaUrl: videoUrl });
  },
  async sendAudio(recipients, text, audioUrl) {
    return invokeSend({ type: "audio", recipients, text, mediaUrl: audioUrl });
  },
  async sendDocument(recipients, text, documentUrl) {
    return invokeSend({ type: "document", recipients, text, mediaUrl: documentUrl });
  },
};
