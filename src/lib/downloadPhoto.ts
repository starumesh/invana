import { downloadBlob } from "@/lib/export";

/** Fetch a public HTTPS photo and trigger a browser download. */
export async function downloadPhotoFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download that photo.");
  const blob = await res.blob();
  downloadBlob(blob, filename);
}
