import { callEdgeFunction, EdgeApiError } from "@/services/api/edgeClient";
import type { RenderInput, StoredEvent } from "@/types";

type InviteResponse = {
  invite: {
    id: string;
    slug: string;
    title: string;
    status: "published";
    config: RenderInput;
    createdAt: string;
    updatedAt: string;
  };
};

/** Public Invite Read API — returns null on 404 or when Edge is unavailable. */
export async function fetchPublicInviteBySlug(slug: string): Promise<StoredEvent | null> {
  try {
    const data = await callEdgeFunction<InviteResponse>({
      path: `invite?slug=${encodeURIComponent(slug)}`,
      method: "GET",
      auth: false,
    });
    if (!data?.invite) return null;
    const invite = data.invite;
    return {
      id: invite.id,
      // Public projection intentionally omits host user id.
      userId: "public",
      slug: invite.slug,
      title: invite.title,
      status: "published",
      config: invite.config,
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt,
    };
  } catch (err) {
    if (err instanceof EdgeApiError && err.status === 404) return null;
    throw err;
  }
}
