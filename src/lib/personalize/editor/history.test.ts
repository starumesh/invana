import { describe, expect, it } from "vitest";
import { commitHistory, initHistory, redoHistory, undoHistory } from "@/lib/personalize/editor/history";
import type { EditorDocument } from "@/lib/personalize/editor/types";

function doc(layers: number): EditorDocument {
  return {
    id: "d1",
    sourceDataUrl: "data:image/png;base64,aa",
    source: {
      kind: "image",
      mime: "image/png",
      fileName: "a.png",
      originalBlob: new Blob(),
      width: 100,
      height: 100,
    },
    layers: Array.from({ length: layers }, (_, i) => ({
      id: `l${i}`,
      region: { x: 0, y: 0, w: 10, h: 10 },
      originalText: "x",
      text: "x",
      style: {
        fontFamily: "serif",
        fontSize: 12,
        fontWeight: 400,
        color: "#000",
        align: "center" as const,
        lineHeight: 1.2,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      },
      showText: true,
    })),
  };
}

describe("document history", () => {
  it("supports undo and redo", () => {
    const h0 = initHistory(doc(0));
    const h1 = commitHistory(h0, doc(1));
    const h2 = commitHistory(h1, doc(2));
    const u1 = undoHistory(h2);
    expect(u1.present.layers.length).toBe(1);
    const r1 = redoHistory(u1);
    expect(r1.present.layers.length).toBe(2);
  });
});
