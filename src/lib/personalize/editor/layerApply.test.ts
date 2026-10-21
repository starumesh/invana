import { describe, expect, it } from "vitest";
import { shouldApplyLayerOnCanvas } from "@/lib/personalize/editor/layerApply";
import type { TextEditLayer } from "@/lib/personalize/editor/types";
import { DEFAULT_LAYER_STYLE } from "@/lib/personalize/editor/types";

function layer(partial: Partial<TextEditLayer>): TextEditLayer {
  return {
    id: "l1",
    region: { x: 0, y: 0, w: 10, h: 10 },
    originalText: "Hello",
    text: "",
    style: { ...DEFAULT_LAYER_STYLE },
    showText: true,
    ...partial,
  };
}

describe("shouldApplyLayerOnCanvas", () => {
  it("keeps source visible when replacement is empty", () => {
    expect(shouldApplyLayerOnCanvas(layer({ text: "" }))).toBe(false);
  });

  it("keeps source visible when replacement matches original", () => {
    expect(shouldApplyLayerOnCanvas(layer({ text: "Hello" }))).toBe(false);
  });

  it("applies when replacement differs", () => {
    expect(shouldApplyLayerOnCanvas(layer({ text: "Hi" }))).toBe(true);
  });
});
