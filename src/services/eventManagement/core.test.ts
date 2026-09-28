import { describe, expect, it } from "vitest";
import {
  canTransitionEvent,
  canTransitionPass,
  decodeQrPayload,
  encodeQrPayload,
  EVENT_PUBLIC_ID_PATTERN,
  eventPublicId,
  eventSlug,
  isWellFormedToken,
  normalizePassPublicId,
  parseCsv,
  PASS_PUBLIC_ID_PATTERN,
  passPublicId,
  previewGuestCsv,
  secureToken,
  timelineTimeToIso,
  toCsv,
  utcToZoned,
  validateCapacity,
  validateEventDetails,
  validateGuest,
  validateTimeline,
  zonedToUtcIso,
} from "@event-core";

const baseDetails = {
  name: "Asha & Rohan Wedding",
  description: "Join us",
  eventType: "Wedding",
  date: "2027-02-14",
  startTime: "18:00",
  timezone: "Asia/Kolkata",
  durationMinutes: 300,
  venueName: "Taj Krishna",
  address: "Road No. 1, Banjara Hills",
  city: "Hyderabad",
  state: "Telangana",
  country: "India",
  latitude: 17.41,
  longitude: 78.44,
  maxCapacity: 200,
};

describe("event validation", () => {
  it("accepts complete details and converts to UTC", () => {
    const r = validateEventDetails(baseDetails);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.startDatetime).toBe("2027-02-14T12:30:00.000Z");
  });

  it("reports each missing required field", () => {
    const r = validateEventDetails({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const key of ["name", "description", "date", "startTime", "durationMinutes", "venueName", "address", "city", "country", "location", "maxCapacity"]) {
        expect(r.errors[key], key).toBeTruthy();
      }
    }
  });

  it("rejects invalid dates, times and non-positive duration", () => {
    const r = validateEventDetails({ ...baseDetails, date: "2027-02-30", startTime: "25:00", durationMinutes: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.date).toMatch(/valid date/);
      expect(r.errors.startTime).toMatch(/valid start time/);
      expect(r.errors.durationMinutes).toMatch(/positive/);
    }
  });

  it("rejects past events when a future date is required", () => {
    const r = validateEventDetails(baseDetails, { requireFuture: true, now: new Date("2028-01-01T00:00:00Z") });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range map coordinates", () => {
    const r = validateEventDetails({ ...baseDetails, latitude: 123 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.location).toBeTruthy();
  });
});

describe("capacity validation", () => {
  it.each([
    [0, /at least 1/],
    [-5, /at least 1/],
    [2.5, /whole number/],
    ["", /required/],
    [10_001, /cannot exceed 10,000/],
  ])("rejects %s", (value, msg) => {
    expect(validateCapacity(value)).toMatch(msg);
  });

  it("accepts positive integers up to the configured limit", () => {
    expect(validateCapacity(1)).toBeNull();
    expect(validateCapacity("250")).toBeNull();
    expect(validateCapacity(500, 500)).toBeNull();
    expect(validateCapacity(501, 500)).toMatch(/500/);
  });
});

describe("timeline validation", () => {
  const window = { startDatetime: "2027-02-14T12:30:00.000Z", durationMinutes: 300 };

  it("accepts entries within the event window", () => {
    const r = validateTimeline(
      [
        { title: "Baraat", startTime: "2027-02-14T12:30:00.000Z", endTime: "2027-02-14T13:30:00.000Z" },
        { title: "Dinner", startTime: "2027-02-14T15:00:00.000Z", endTime: "2027-02-14T17:30:00.000Z" },
      ],
      window,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map((v) => v.sortOrder)).toEqual([0, 1]);
  });

  it("rejects end before start and entries outside the duration", () => {
    const r = validateTimeline(
      [
        { title: "Backwards", startTime: "2027-02-14T14:00:00.000Z", endTime: "2027-02-14T13:00:00.000Z" },
        { title: "Too late", startTime: "2027-02-14T17:00:00.000Z", endTime: "2027-02-14T18:00:00.000Z" },
        { title: "", startTime: "2027-02-14T11:00:00.000Z", endTime: "2027-02-14T13:00:00.000Z" },
      ],
      window,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].endTime).toMatch(/after the start/);
      expect(r.errors[1].endTime).toMatch(/within the event duration/);
      expect(r.errors[2].title).toBeTruthy();
      expect(r.errors[2].startTime).toMatch(/within the event duration/);
    }
  });

  it("rolls times after midnight to the next day", () => {
    expect(timelineTimeToIso("2027-02-14T12:30:00.000Z", "Asia/Kolkata", "01:00")).toBe("2027-02-14T19:30:00.000Z");
    expect(timelineTimeToIso("2027-02-14T12:30:00.000Z", "Asia/Kolkata", "19:00")).toBe("2027-02-14T13:30:00.000Z");
  });
});

describe("timezone helpers", () => {
  it("round-trips wall-clock time across DST", () => {
    const iso = zonedToUtcIso("2027-07-04", "09:30", "America/New_York")!;
    expect(iso).toBe("2027-07-04T13:30:00.000Z");
    expect(utcToZoned(iso, "America/New_York")).toEqual({ date: "2027-07-04", time: "09:30" });
  });
});

describe("guest validation", () => {
  it("normalizes email, phone and role labels", () => {
    const r = validateGuest({ name: " Ravi ", email: "RAVI@Example.com ", phone: "+91 98480-12345", role: "Worker/Staff" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Ravi", email: "ravi@example.com", phone: "+919848012345", bio: "", role: "STAFF" },
    });
  });

  it("allows optional email and phone but validates when present", () => {
    expect(validateGuest({ name: "Only name" }).ok).toBe(true);
    const bad = validateGuest({ name: "", email: "nope", phone: "12", role: "Pilot" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["email", "name", "phone", "role"]);
  });
});

describe("guest CSV import", () => {
  it("parses quoted fields and CRLF", () => {
    expect(parseCsv('Name,Bio\r\n"Doe, Jane","Says ""hi"""\r\n')).toEqual([
      ["Name", "Bio"],
      ["Doe, Jane", 'Says "hi"'],
    ]);
  });

  it("previews valid, invalid, duplicate and over-capacity rows", () => {
    const csv = [
      "Name,Email,Phone,Bio,Role",
      "Asha,asha@example.com,9800000001,,Guest",
      ",missing@example.com,,,Guest",
      "Asha Again,ASHA@example.com,,,VIP",
      "Existing,old@example.com,,,Guest",
      "Bala,,9800000002,,Speaker",
      "Chitra,,9800000003,,Guest",
    ].join("\n");
    const preview = previewGuestCsv(csv, {
      existing: [{ name: "Existing", email: "old@example.com", phone: "" }],
      remainingCapacity: 2,
    });
    expect(preview.rows.map((r) => r.status)).toEqual(["VALID", "INVALID", "DUPLICATE", "DUPLICATE", "VALID", "OVER_CAPACITY"]);
    expect(preview.valid.map((g) => g.name)).toEqual(["Asha", "Bala"]);
    expect(preview.rows[1].line).toBe(3);
  });

  it("requires a Name header", () => {
    expect(previewGuestCsv("Email\nx@y.com", { existing: [], remainingCapacity: 10 }).headerError).toMatch(/Name/);
  });

  it("guards against spreadsheet formula injection on export", () => {
    expect(toCsv(["Name", "Phone"], [["=HYPERLINK(1)", "+919800000001"]])).toBe("Name,Phone\n'=HYPERLINK(1),+919800000001\n");
  });
});

describe("pass identifiers and tokens", () => {
  it("generates unique, well-formed secure tokens", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => secureToken()));
    expect(tokens.size).toBe(500);
    for (const t of tokens) expect(isWellFormedToken(t)).toBe(true);
  });

  it("formats public ids without sequential numbers", () => {
    const ids = Array.from({ length: 50 }, () => eventPublicId(2026));
    for (const id of ids) expect(id).toMatch(EVENT_PUBLIC_ID_PATTERN);
    expect(new Set(ids).size).toBeGreaterThan(45);
    expect(passPublicId()).toMatch(PASS_PUBLIC_ID_PATTERN);
    expect(normalizePassPublicId(" inv-pass-8f72a91c ")).toBe("INV-PASS-8F72A91C");
    expect(normalizePassPublicId("8f72a91c")).toBe("INV-PASS-8F72A91C");
    expect(normalizePassPublicId("INV-PASS-XYZ")).toBeNull();
  });

  it("builds human-readable slugs", () => {
    expect(eventSlug("Asha & Rohan's Wedding!", "2027-02-14T12:30:00.000Z")).toMatch(/^asha-rohan-s-wedding-2027-[a-z2-9]{4}$/);
  });
});

describe("QR payload", () => {
  const eventId = "5b1f0c1e-8f5d-4c61-9d34-2c1c4b0f6a11";

  it("encodes only the event id and pass token", () => {
    const token = secureToken();
    const payload = JSON.parse(encodeQrPayload(eventId, token));
    expect(Object.keys(payload).sort()).toEqual(["eventId", "passToken", "v"]);
    expect(decodeQrPayload(encodeQrPayload(eventId, token))).toEqual({ eventId, passToken: token });
  });

  it("accepts pass URLs and rejects garbage", () => {
    const token = secureToken();
    expect(decodeQrPayload(`https://invana.stream/pass/${token}`)).toEqual({ eventId: null, passToken: token });
    for (const bad of ["", "hello", "{}", '{"v":1,"eventId":"x","passToken":"y"}', `{"v":2,"eventId":"${eventId}","passToken":"${token}"}`, 42]) {
      expect(decodeQrPayload(bad)).toBeNull();
    }
  });
});

describe("status transitions", () => {
  it("follows Draft → Publish → Complete and blocks terminal states", () => {
    expect(canTransitionEvent("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionEvent("PUBLISHED", "DRAFT")).toBe(true);
    expect(canTransitionEvent("PUBLISHED", "COMPLETED")).toBe(true);
    expect(canTransitionEvent("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransitionEvent("CANCELLED", "PUBLISHED")).toBe(false);
    expect(canTransitionEvent("COMPLETED", "DRAFT")).toBe(false);
  });

  it("allows pass check-in only from ISSUED", () => {
    expect(canTransitionPass("ISSUED", "CHECKED_IN")).toBe(true);
    expect(canTransitionPass("CHECKED_IN", "CHECKED_IN")).toBe(false);
    expect(canTransitionPass("CANCELLED", "CHECKED_IN")).toBe(false);
    expect(canTransitionPass("CANCELLED", "ISSUED")).toBe(true);
  });
});
