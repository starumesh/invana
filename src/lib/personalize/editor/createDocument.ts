import type { EditorDocument, EditorSourceAsset } from "@/lib/personalize/editor/types";
import { createId } from "@/lib/id";

export function createEditorDocument(input: {
  source: EditorSourceAsset;
  sourceDataUrl: string;
}): EditorDocument {
  return {
    id: createId("pedit"),
    source: input.source,
    sourceDataUrl: input.sourceDataUrl,
    layers: [],
  };
}
