export function publicOrigin(): string {
  if (import.meta.env.VITE_PUBLIC_SITE_URL) {
    return import.meta.env.VITE_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function inviteUrl(slug: string, guest?: string): string {
  const query = guest ? `?guest=${encodeURIComponent(guest)}` : "";
  return `${publicOrigin()}/invite/${encodeURIComponent(slug)}${query}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
