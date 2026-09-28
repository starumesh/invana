import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, REMINDER_OFFSETS } from "@/lib/calendar";
import { eventWhatsAppText, passWhatsAppText, whatsAppUrl } from "@/lib/eventShare";
import { lngLatToWorld, openInMapsUrl, worldToLngLat } from "@/lib/maps";

const event = {
  name: "Tech Meetup",
  startDatetime: "2027-03-10T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  durationMinutes: 150,
  venueName: "T-Hub",
  city: "Hyderabad",
};

describe("calendar", () => {
  const cal = {
    title: "Tech Meetup",
    description: "Talks; demos, and more",
    location: "T-Hub, Hyderabad",
    startIso: event.startDatetime,
    durationMinutes: 150,
    url: "https://invana.stream/events/tech-meetup",
    uid: "evt-1",
  };

  it("builds Google and Outlook links with UTC start/end", () => {
    expect(googleCalendarUrl(cal)).toContain("dates=20270310T123000Z%2F20270310T150000Z");
    const outlook = new URL(outlookCalendarUrl(cal));
    expect(outlook.searchParams.get("startdt")).toBe("2027-03-10T12:30:00.000Z");
    expect(outlook.searchParams.get("enddt")).toBe("2027-03-10T15:00:00.000Z");
  });

  it("emits an ICS with escaped text and 7d / 1d / 1h reminders", () => {
    const ics = buildIcs(cal, new Date("2027-01-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20270310T123000Z");
    expect(ics).toContain("DTEND:20270310T150000Z");
    expect(ics).toContain("SUMMARY:Tech Meetup");
    expect(ics).toContain("Talks\\; demos\\, and more");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(REMINDER_OFFSETS.length);
    for (const r of ["-P7D", "-P1D", "-PT1H"]) expect(ics).toContain(`TRIGGER:${r}`);
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });
});

describe("sharing", () => {
  it("WhatsApp event message has name, date, time, venue and URL", () => {
    const text = eventWhatsAppText(event, "https://invana.stream/events/tech-meetup");
    expect(text).toContain("Tech Meetup");
    expect(text).toMatch(/10 Mar,? 2027/);
    expect(text).toMatch(/6:00\s?pm/i);
    expect(text).toContain("T-Hub, Hyderabad");
    expect(text).toContain("https://invana.stream/events/tech-meetup");
  });

  it("pass message is addressed to the guest and targets their phone", () => {
    const text = passWhatsAppText(event, "Asha", "https://invana.stream/pass/abc");
    expect(text).toContain("Hi Asha");
    expect(whatsAppUrl(text, "+91 98480 12345")).toMatch(/^https:\/\/wa\.me\/919848012345\?text=/);
  });
});

describe("maps", () => {
  it("round-trips lat/lng through web-mercator pixels", () => {
    const p = { lat: 17.4435, lng: 78.3772 };
    const w = lngLatToWorld(p, 15);
    const back = worldToLngLat(w.x, w.y, 15);
    expect(back.lat).toBeCloseTo(p.lat, 4);
    expect(back.lng).toBeCloseTo(p.lng, 4);
  });

  it("opens maps at the pin", () => {
    expect(openInMapsUrl({ lat: 17.4, lng: 78.3 }, "T-Hub")).toBe(
      "https://www.google.com/maps/search/?api=1&query=17.4%2C78.3%20(T-Hub)",
    );
  });
});
