export type GalleryOwnerKind = "invitation" | "event";

export type GalleryPhoto = {
  id: string;
  url: string;
  contributorName: string;
  contributorRole: "host" | "guest";
  createdAt: string;
  canDelete: boolean;
};

export type GalleryAlbum = {
  photos: GalleryPhoto[];
  /** Signed-in owner of this invitation or event. */
  canModerate: boolean;
};

export type GalleryUploadInput = {
  ownerKind: GalleryOwnerKind;
  slug: string;
  contributorName: string;
  file: File;
};
