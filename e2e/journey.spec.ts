import { expect, test, type Page } from "@playwright/test";
import { encodeQrPayload } from "../supabase/functions/_shared/event-core/index.ts";
import { showQr } from "./camera";
import { DEMO_KEY, futureDate } from "./fixtures";

/** Label text may carry a visual required "*" marker. */
const field = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`);

async function payloadFor(page: Page, guestName: string): Promise<string> {
  return page.evaluate(
    ([key, name]) => {
      const data = JSON.parse(localStorage.getItem(key) ?? "{}");
      const guest = data.guests.find((g: { name: string }) => g.name === name);
      const pass = data.passes.find((p: { guestId: string }) => p.guestId === guest.id);
      return JSON.stringify([pass.eventId, pass.secureToken]);
    },
    [DEMO_KEY, guestName] as const,
  ).then((raw) => {
    const [eventId, token] = JSON.parse(raw) as [string, string];
    return encodeQrPayload(eventId, token);
  });
}

test("Definition of Done: create → guests → passes → publish → share → pass → scan → attendance", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Events", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Create event", exact: true }).click();

  // 1. Details
  await page.getByLabel(field("Event name")).fill("Invana Launch Conference");
  await page.getByLabel(field("Event type")).selectOption("Conference");
  await page.getByLabel(field("Description")).fill("A day of talks about digital invitations.");
  await page.getByLabel(field("Date")).fill(futureDate(30));
  await page.getByLabel(field("Start time")).fill("09:00");
  await page.getByLabel(field("Duration hours")).fill("8");
  await page.getByRole("button", { name: "Continue" }).click();

  // 2. Venue + map pin
  await expect(page.getByRole("heading", { name: "Venue & map" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Pin the venue location on the map.")).toBeVisible();
  await page.getByLabel(field("Venue name")).fill("HICC");
  await page.getByLabel(field("Address")).fill("Novotel, Madhapur");
  await page.getByLabel(field("City")).fill("Hyderabad");
  await page.getByLabel(field("State")).fill("Telangana");
  await page.getByLabel(field("Country")).fill("India");
  await page.getByRole("application", { name: /Venue map/ }).click({ position: { x: 200, y: 140 } });
  await expect(page.getByText(/Pinned at/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Maps" })).toHaveAttribute("href", /google\.com\/maps/);
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Capacity
  await page.getByLabel(field("Maximum attendees")).fill("0");
  await expect(page.getByText("Maximum capacity must be at least 1.")).toBeVisible();
  await page.getByLabel(field("Maximum attendees")).fill("100");
  await expect(page.getByText("Maximum capacity: 100")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // 4. Timeline from template, then reorder + edit
  await page.getByRole("button", { name: /Start from the Conference template/ }).click();
  await expect(page.getByLabel(field("Title")).first()).toHaveValue("Registration & breakfast");
  await page.getByLabel(field("Title")).nth(1).fill("Keynote");
  await page.getByRole("button", { name: "+ Add entry" }).click();
  await page.getByLabel(field("Title")).last().fill("After party");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("End time must be within the event duration.")).toBeVisible();
  await page.getByRole("button", { name: "Delete After party" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 5. Guests: single + CSV with preview
  await expect(page.getByRole("heading", { name: "Guests", level: 2 })).toBeVisible();
  await page.getByLabel(field("Name")).fill("Asha Rao");
  await page.getByLabel(field("Role")).selectOption("SPEAKER");
  await page.getByLabel(field("Email")).fill("asha@example.com");
  await page.getByRole("button", { name: "Add guest" }).click();
  await page.getByLabel(field("Name")).fill("Bala Krishna");
  await page.getByLabel(field("Phone")).fill("+91 98480 12345");
  await page.getByRole("button", { name: "Add guest" }).click();
  await page.getByRole("tab", { name: "Import CSV" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "guests.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Email,Phone,Bio,Role\nChitra,chitra@example.com,,Door volunteer,Worker/Staff\nDup,ASHA@example.com,,,Guest\n,bad,,,\n"),
  });
  await expect(page.getByText("1 ready · 1 invalid · 1 duplicates")).toBeVisible();
  await page.getByRole("button", { name: "Import 1 guest" }).click();
  await expect(page.getByText("3 / 100 guests")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // 6. Review → Create (generates passes)
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await expect(page.getByText("Maximum capacity: 100")).toBeVisible();
  await expect(page.getByText("Keynote")).toBeVisible();
  await expect(page.getByText("Asha Rao")).toBeVisible();
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText(/Event created with 3 guest passes/)).toBeVisible();
  await expect(page.getByText("DRAFT", { exact: false }).or(page.getByText("Draft", { exact: true })).first()).toBeVisible();
  const eventUrl = page.url();
  const eventId = /\/events\/([^/]+)\/manage/.exec(eventUrl)![1];

  // 7. Publish → public URL + share
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/Published! Your public page is live/)).toBeVisible();
  const publicLink = page.locator('a[href*="/events/invana-launch-conference-"]').first();
  const publicUrl = await publicLink.getAttribute("href");
  expect(publicUrl).toMatch(/\/events\/invana-launch-conference-\d{4}-[a-z0-9]{4}$/);
  const wa = await page.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
  const waText = decodeURIComponent(wa!.split("text=")[1]);
  expect(waText).toContain("Invana Launch Conference");
  expect(waText).toContain("HICC, Hyderabad");
  expect(waText).toContain(publicUrl!);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Link copied.")).toBeVisible();

  // 8. Guest opens the public invite (no PII)
  const guestView = await context.newPage();
  await guestView.goto(publicUrl!);
  await expect(guestView.getByRole("heading", { name: "Invana Launch Conference" })).toBeVisible();
  await expect(guestView.getByText("Maximum capacity: 100")).toBeVisible();
  await expect(guestView.getByText("Keynote")).toBeVisible();
  await expect(guestView.getByText("Asha Rao")).toBeVisible();
  await expect(guestView.getByRole("link", { name: "Open in Maps" })).toBeVisible();
  expect(await guestView.content()).not.toContain("asha@example.com");
  expect(await guestView.content()).not.toContain("98480");
  await guestView.close();

  // 9. Organizer opens Asha's personal pass
  await page.getByRole("link", { name: "View Passes" }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open pass for Asha Rao" }).click();
  const pass = await popupPromise;
  await expect(pass).toHaveURL(/\/pass\/[A-Za-z0-9_-]{43}$/);
  await expect(pass.getByText("Asha Rao")).toBeVisible();
  await expect(pass.getByText("Speaker")).toBeVisible();
  await expect(pass.getByText("Show this pass at entrance")).toBeVisible();
  await expect(pass.getByRole("img", { name: /Entry QR code for Asha Rao, pass INV-PASS-[0-9A-F]{8}/ })).toBeVisible();
  await expect(pass.getByRole("link", { name: "Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com/);
  const downloadPromise = pass.waitForEvent("download");
  await pass.getByRole("button", { name: "Download" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^INV-PASS-[0-9A-F]{8}\.png$/);
  await pass.close();

  // 10. Staff scans the QR with the (fake) phone camera on a mobile viewport
  await showQr(await payloadFor(page, "Asha Rao"));
  const door = await context.newPage();
  await door.setViewportSize({ width: 390, height: 844 });
  await door.goto(`/events/${eventId}/check-in`);
  const result = door.getByRole("status").filter({ hasText: "Checked In" });
  await expect(result).toContainText("Asha Rao", { timeout: 20_000 });
  await expect(result).toContainText("Speaker");
  await expect(result).toContainText(/INV-PASS-[0-9A-F]{8}/);
  await expect(result).toContainText("Check-in time");

  // Duplicate scan: same QR again after resuming
  await door.getByRole("button", { name: "Scan next guest" }).click();
  await expect(door.getByRole("status").filter({ hasText: "Already Checked In" })).toContainText("Originally checked in", { timeout: 20_000 });

  // 11. Organizer sees attendance update (polling / cross-tab)
  await page.goto(`/events/${eventId}/attendance`);
  const checkedInCard = page.locator("div").filter({ has: page.getByText("Checked in", { exact: true }) }).filter({ hasText: /^Checked in\d+$/ });
  await expect(checkedInCard.first()).toContainText("1");
  await expect(page.getByRole("region", { name: "Recent check-ins" }).or(page.locator("section").filter({ hasText: "Recent check-ins" })).first()).toContainText("Asha Rao");
  await expect(page.getByText("33.3%")).toBeVisible();

  // Second guest checks in via staff search from the door phone; organizer view updates live
  await door.getByRole("button", { name: "Scan next guest" }).click();
  await door.getByRole("button", { name: "Search" }).click();
  await door.getByLabel(field("Search by name, phone, email, or pass ID")).fill("12345");
  await expect(door.getByText("•••• 2345")).toBeVisible();
  await door.getByRole("button", { name: "Check in Bala Krishna" }).click();
  await expect(door.getByRole("status").filter({ hasText: "Checked In" })).toContainText("Bala Krishna");
  await expect(page.getByText("66.7%")).toBeVisible({ timeout: 12_000 });
});
