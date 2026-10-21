import { MAX_ALBUM_PHOTOS } from "@/lib/collageLayout";
import { prepareImageForUpload } from "@/lib/imageOptimize";
import { blobToDataUrl } from "@/lib/mediaUrl";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/services/api/edgeClient";
import { demoAddPhoto, demoListPhotos, demoRemovePhoto } from "@/services/gallery/demoStore";
import type { GalleryAlbum, GalleryOwnerKind, GalleryPhoto, GalleryUploadInput } from "@/services/gallery/types";

const TOKEN_KEY = "invana.gallery.tokens";

type RemotePhoto = {
  id: string;
  url: string;
  contributorName: string;
  contributorRole: "host" | "guest";
  createdAt: string;
};

function readTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeTokens(tokens: Record<string, string>) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function rememberDeleteToken(id: string, token: string) {
  const tokens = readTokens();
  tokens[id] = token;
  writeTokens(tokens);
}

function deleteTokenFor(id: string): string | undefined {
  return readTokens()[id];
}

function forgetDeleteToken(id: string) {
  const tokens = readTokens();
  delete tokens[id];
  writeTokens(tokens);
}

function newDeleteToken(): string {
  const a = crypto.randomUUID().replace(/-/g, "");
  const b = crypto.randomUUID().replace(/-/g, "");
  return `${a}${b}`;
}

function withLocalDelete(photo: RemotePhoto, canModerate: boolean): GalleryPhoto {
  return {
    ...photo,
    canDelete: canModerate || Boolean(deleteTokenFor(photo.id)),
  };
}

function remoteMode(): boolean {
  return isSupabaseConfigured();
}

export async function listGallery(ownerKind: GalleryOwnerKind, slug: string): Promise<GalleryAlbum> {
  if (!remoteMode()) {
    const photos = await demoListPhotos(ownerKind, slug, deleteTokenFor);
    return { photos, canModerate: false };
  }
  const data = await callEdgeFunction<{ photos: RemotePhoto[]; canModerate?: boolean }>({
    path: `gallery?ownerKind=${encodeURIComponent(ownerKind)}&slug=${encodeURIComponent(slug)}`,
    method: "GET",
    auth: true,
  });
  if (!data) {
    const fallbackPhotos = await demoListPhotos(ownerKind, slug, deleteTokenFor);
    return { photos: fallbackPhotos, canModerate: false };
  }
  const canModerate = Boolean(data.canModerate);
  return {
    canModerate,
    photos: (data.photos ?? []).map((photo) => withLocalDelete(photo, canModerate)),
  };
}

export async function addGalleryPhoto(input: GalleryUploadInput): Promise<GalleryPhoto> {
  const contributorName = input.contributorName.trim().slice(0, 60);
  if (!contributorName) throw new Error("Add your name so the hosts know who shared the photo.");
  const file = await prepareImageForUpload(input.file);

  if (!remoteMode()) {
    const deleteToken = newDeleteToken();
    const url = await blobToDataUrl(file);
    const photo = await demoAddPhoto({
      ownerKind: input.ownerKind,
      slug: input.slug,
      contributorName,
      url,
      deleteToken,
    });
    rememberDeleteToken(photo.id, deleteToken);
    return photo;
  }

  const contentBase64 = await fileToBase64(file);
  const data = await callEdgeFunction<{ photo: RemotePhoto; deleteToken: string }>({
    path: "gallery",
    method: "POST",
    auth: true,
    body: {
      ownerKind: input.ownerKind,
      slug: input.slug,
      contributorName,
      contentBase64,
      mimeType: file.type || "image/jpeg",
    },
  });
  if (!data?.photo?.url || !data.deleteToken) {
    throw new Error("Could not save that photo.");
  }
  rememberDeleteToken(data.photo.id, data.deleteToken);
  return withLocalDelete(data.photo, false);
}

export async function removeGalleryPhoto(ownerKind: GalleryOwnerKind, slug: string, photo: GalleryPhoto): Promise<void> {
  const deleteToken = deleteTokenFor(photo.id);
  if (!remoteMode()) {
    await demoRemovePhoto(photo.id, deleteToken);
    forgetDeleteToken(photo.id);
    return;
  }
  await callEdgeFunction({
    path: "gallery",
    method: "DELETE",
    auth: true,
    body: { ownerKind, slug, id: photo.id, deleteToken },
  });
  forgetDeleteToken(photo.id);
}

export { MAX_ALBUM_PHOTOS };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read that photo."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}
