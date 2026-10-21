import { createId } from "@/lib/id";
import { MAX_ALBUM_PHOTOS } from "@/lib/collageLayout";
import type { GalleryOwnerKind, GalleryPhoto } from "@/services/gallery/types";

const DB_NAME = "invana-gallery";
const STORE = "photos";

type GalleryRow = {
  id: string;
  ownerKind: GalleryOwnerKind;
  ownerKey: string;
  url: string;
  contributorName: string;
  contributorRole: "host" | "guest";
  createdAt: string;
  deleteToken: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the photo album."));
  });
}

function runTransaction<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = body(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not update the photo album."));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Could not update the photo album."));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("Could not update the photo album."));
        };
      }),
  );
}

function toPhoto(row: GalleryRow, token: string | undefined): GalleryPhoto {
  return {
    id: row.id,
    url: row.url,
    contributorName: row.contributorName,
    contributorRole: row.contributorRole,
    createdAt: row.createdAt,
    canDelete: Boolean(token && token === row.deleteToken),
  };
}

export async function demoListPhotos(
  ownerKind: GalleryOwnerKind,
  slug: string,
  tokenFor: (id: string) => string | undefined,
): Promise<GalleryPhoto[]> {
  const rows = await runTransaction<GalleryRow[]>("readonly", (store) => store.getAll());
  return rows
    .filter((row) => row.ownerKind === ownerKind && row.ownerKey === slug)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((row) => toPhoto(row, tokenFor(row.id)));
}

export async function demoAddPhoto(opts: {
  ownerKind: GalleryOwnerKind;
  slug: string;
  contributorName: string;
  url: string;
  deleteToken: string;
}): Promise<GalleryPhoto> {
  const existing = await runTransaction<GalleryRow[]>("readonly", (store) => store.getAll());
  const count = existing.filter((row) => row.ownerKind === opts.ownerKind && row.ownerKey === opts.slug).length;
  if (count >= MAX_ALBUM_PHOTOS) {
    throw new Error(`This album already has ${MAX_ALBUM_PHOTOS} photos.`);
  }
  const row: GalleryRow = {
    id: createId("photo"),
    ownerKind: opts.ownerKind,
    ownerKey: opts.slug,
    url: opts.url,
    contributorName: opts.contributorName,
    contributorRole: "guest",
    createdAt: new Date().toISOString(),
    deleteToken: opts.deleteToken,
  };
  await runTransaction("readwrite", (store) => store.add(row));
  return toPhoto(row, opts.deleteToken);
}

export async function demoRemovePhoto(id: string, deleteToken: string | undefined): Promise<void> {
  const row = await runTransaction<GalleryRow | undefined>("readonly", (store) => store.get(id));
  if (!row) return;
  if (!deleteToken || deleteToken !== row.deleteToken) {
    throw new Error("You can only remove photos added in this browser.");
  }
  await runTransaction("readwrite", (store) => store.delete(id));
}
