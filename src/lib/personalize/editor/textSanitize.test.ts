import { describe, expect, it } from "vitest";
import { sanitizeInvitationText } from "@/lib/personalize/editor/textSanitize";

describe("sanitizeInvitationText", () => {
  it("removes replacement chars and noise punctuation", () => {
    expect(sanitizeInvitationText("Keerthi | \uFFFD")).toBe("Keerthi");
  });

  it("keeps telugu letters", () => {
    expect(sanitizeInvitationText("శ్రీ")).toBe("శ్రీ");
  });
});
