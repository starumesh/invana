import { describe, expect, it } from "vitest";
import { validatePersonalizeFileMeta } from "@/lib/personalize/validateContent";

describe("validatePersonalizeFileMeta", () => {
  it("accepts png and jpeg", () => {
    expect(validatePersonalizeFileMeta(new File(["x"], "a.png", { type: "image/png" })).ok).toBe(true);
    expect(validatePersonalizeFileMeta(new File(["x"], "a.jpg", { type: "image/jpeg" })).ok).toBe(true);
  });

  it("accepts pdf by mime", () => {
    const r = validatePersonalizeFileMeta(new File(["x"], "inv.pdf", { type: "application/pdf" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.kind).toBe("pdf");
  });

  it("rejects unsupported types", () => {
    const r = validatePersonalizeFileMeta(new File(["x"], "a.doc", { type: "application/msword" }));
    expect(r.ok).toBe(false);
  });
});
