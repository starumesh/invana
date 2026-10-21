import { getSupabase } from "@/lib/supabase/client";

export type PersonalizeUploadMeta = {
  documentId: string;
  fileName: string;
  kind: "image" | "pdf";
  width: number;
  height: number;
};

/**
 * Registers upload metadata when Supabase is configured (private storage + DB via Edge Function).
 * No-op in demo mode — editing stays fully client-side; original blob is never mutated.
 */
export async function registerPersonalizeUpload(meta: PersonalizeUploadMeta): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.functions.invoke("personalize", {
      body: {
        action: "register",
        ...meta,
      },
    });
  } catch {
    // Editing continues locally if the function is not deployed.
  }
}
