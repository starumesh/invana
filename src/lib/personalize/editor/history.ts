import type { EditorDocument } from "@/lib/personalize/editor/types";

export type DocumentHistory = {
  past: EditorDocument[];
  present: EditorDocument;
  future: EditorDocument[];
};

export function initHistory(doc: EditorDocument): DocumentHistory {
  return { past: [], present: doc, future: [] };
}

export function commitHistory(history: DocumentHistory, next: EditorDocument): DocumentHistory {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

export function undoHistory(history: DocumentHistory): DocumentHistory {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history: DocumentHistory): DocumentHistory {
  if (!history.future.length) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
