import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryPhoto } from "@/services/gallery/types";

const remotePhoto: GalleryPhoto = {
  id: "gp_abc",
  url: "https://example.supabase.co/storage/v1/object/public/event-media/gallery/invitation/slug/a.jpg",
  contributorName: "Priya",
  contributorRole: "guest",
  createdAt: "2026-10-21T00:00:00.000Z",
  canDelete: true,
};

describe("gallery client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
      clear: () => mem.clear(),
    });
    class FakeFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.result = "data:image/jpeg;base64,ZmFrZQ==";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", FakeFileReader);
  });

  function mockDeps(opts: {
    callEdge: ReturnType<typeof vi.fn>;
    demoAdd?: ReturnType<typeof vi.fn>;
    demoList?: ReturnType<typeof vi.fn>;
    supabaseConfigured?: boolean;
  }) {
    class TestEdgeApiError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.name = "EdgeApiError";
        this.status = status;
      }
    }
    vi.doMock("@/lib/supabase/client", () => ({
      isSupabaseConfigured: () => opts.supabaseConfigured ?? true,
    }));
    vi.doMock("@/services/api/edgeClient", () => ({
      callEdgeFunction: opts.callEdge,
      EdgeApiError: TestEdgeApiError,
    }));
    vi.doMock("@/lib/imageOptimize", () => ({
      prepareImageForUpload: async (file: File) => file,
    }));
    vi.doMock("@/lib/mediaUrl", () => ({
      blobToDataUrl: async () => "data:image/jpeg;base64,ZmFrFr",
    }));
    vi.doMock("@/services/gallery/demoStore", () => ({
      demoAddPhoto: opts.demoAdd ?? vi.fn(),
      demoListPhotos: opts.demoList ?? vi.fn(),
      demoRemovePhoto: vi.fn(),
    }));
    return { EdgeApiError: TestEdgeApiError };
  }

  const file = { type: "image/jpeg", name: "memory.jpg" } as File;

  it("uses remote storage when Supabase is configured", async () => {
    const callEdge = vi.fn().mockResolvedValue({
      photo: { id: "gp_abc", url: remotePhoto.url, contributorName: "Priya", contributorRole: "guest", createdAt: remotePhoto.createdAt },
      deleteToken: "tok",
    });
    mockDeps({ callEdge, demoAdd: vi.fn() });

    const { addGalleryPhoto } = await import("@/services/gallery/client");
    const photo = await addGalleryPhoto({
      ownerKind: "invitation",
      slug: "satishkavya",
      contributorName: "Priya",
      file,
    });

    expect(photo.url).toContain("https://");
    expect(callEdge).toHaveBeenCalledWith(
      expect.objectContaining({ path: "gallery", method: "POST", auth: false }),
    );
  });

  it("does not fall back to local storage when remote upload fails", async () => {
    const callEdge = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const demoAdd = vi.fn();
    mockDeps({ callEdge, demoAdd });

    const { addGalleryPhoto, GalleryRemoteError } = await import("@/services/gallery/client");
    await expect(
      addGalleryPhoto({
        ownerKind: "invitation",
        slug: "satishkavya",
        contributorName: "Priya",
        file,
      }),
    ).rejects.toBeInstanceOf(GalleryRemoteError);
    expect(demoAdd).not.toHaveBeenCalled();
  });

  it("lists from remote with public GET", async () => {
    const callEdge = vi.fn().mockResolvedValue({ photos: [remotePhoto], canModerate: false });
    mockDeps({ callEdge });

    const { listGallery } = await import("@/services/gallery/client");
    const album = await listGallery("invitation", "satishkavya");
    expect(album.photos).toHaveLength(1);
    expect(callEdge).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", auth: false }),
    );
  });
});
