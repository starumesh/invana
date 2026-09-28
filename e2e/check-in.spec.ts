import { expect, test } from "@playwright/test";
import { showQr } from "./camera";
import { loadSnapshot, seed, setDemoUser } from "./fixtures";

const guests = [
  { name: "Asha Rao", email: "asha@example.com", role: "Speaker" },
  { name: "Bala Krishna", phone: "+919848012345" },
  { name: "Chitra", email: "chitra@example.com" },
];

test.describe("check-in edge cases", () => {
  test("invalid QR shows Invalid Pass and records nothing", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests }]);
    await loadSnapshot(page, snapshot);
    await showQr("https://example.com/not-an-invana-pass");
    await page.goto(`/events/${events[0].id}/check-in`);
    const status = page.getByRole("status").filter({ hasText: "Invalid Pass" });
    await expect(status).toContainText("This pass could not be verified. Please scan a valid Invana event pass.", { timeout: 20_000 });

    await page.getByRole("button", { name: "Scan next guest" }).click();
    await page.getByRole("button", { name: "Pass ID" }).click();
    await page.getByLabel("Pass ID or scanned code").fill("INV-PASS-00000000");
    await page.getByRole("button", { name: "Verify & check in" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Invalid Pass" })).toBeVisible();
    await expect(page.getByText("0 checked in")).toBeVisible();
  });

  test("duplicate scan shows Already Checked In with the original time", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests }]);
    await loadSnapshot(page, snapshot);
    const pass = events[0].passes["Chitra"];
    await page.goto(`/events/${events[0].id}/check-in`);
    await page.getByRole("button", { name: "Pass ID" }).click();
    await page.getByLabel("Pass ID or scanned code").fill(pass.publicId);
    await page.getByRole("button", { name: "Verify & check in" }).click();
    const first = page.getByRole("status").filter({ hasText: "Checked In" });
    await expect(first).toContainText("Chitra");
    const time = (await first.getByText(/\d{1,2}:\d{2}/).first().textContent())!;

    await page.getByRole("button", { name: "Scan next guest" }).click();
    await page.getByRole("button", { name: "Pass ID" }).click();
    await page.getByLabel("Pass ID or scanned code").fill(pass.publicId.toLowerCase());
    await page.getByRole("button", { name: "Verify & check in" }).click();
    const dup = page.getByRole("status").filter({ hasText: "Already Checked In" });
    await expect(dup).toContainText("Originally checked in");
    await expect(dup).toContainText(time);
    await expect(page.getByText("1 checked in")).toBeVisible();
  });

  test("cancelled pass is rejected", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests, cancelGuest: "Bala Krishna" }]);
    await loadSnapshot(page, snapshot);
    await showQr(events[0].passes["Bala Krishna"].payload);
    await page.goto(`/events/${events[0].id}/check-in`);
    await expect(page.getByRole("status").filter({ hasText: "Pass Cancelled" })).toContainText("This pass is no longer valid.", { timeout: 20_000 });

    const pass = await page.context().newPage();
    await pass.goto(`/pass/${events[0].passes["Bala Krishna"].token}`);
    await expect(pass.getByRole("alert")).toContainText("This pass is no longer valid");
  });

  test("pass from another event is rejected as Wrong Event", async ({ page }) => {
    const { snapshot, events } = await seed([
      { guests, details: { name: "Event A" } },
      { guests: [{ name: "Zed Outsider" }], details: { name: "Event B" } },
    ]);
    await loadSnapshot(page, snapshot);
    await showQr(events[1].passes["Zed Outsider"].payload);
    await page.goto(`/events/${events[0].id}/check-in`);
    const status = page.getByRole("status").filter({ hasText: "Wrong Event" });
    await expect(status).toContainText("This pass does not belong to this event.", { timeout: 20_000 });
    await expect(status).not.toContainText("Zed Outsider");
  });

  test("unauthorized staff cannot open check-in or event data", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests }]);
    await loadSnapshot(page, snapshot);
    await setDemoUser(page, { id: "someone-else", email: "nosy@example.com", name: "Nosy" });
    await page.goto(`/events/${events[0].id}/check-in`);
    await expect(page.getByRole("alert")).toContainText("You don't have permission to access this event.");
    await page.goto(`/events/${events[0].id}/attendance`);
    await expect(page.getByRole("alert")).toContainText("You don't have permission to access this event.");
    await page.goto(`/events/${events[0].id}/guests`);
    await expect(page.getByRole("alert")).toContainText("You don't have permission to access this event.");
  });

  test("assigned staff can check in but not manage", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests }]);
    await loadSnapshot(page, snapshot);
    await page.goto(`/events/${events[0].id}/manage`);
    await page.getByLabel("Staff email").fill("door@example.com");
    await page.getByRole("button", { name: "Add staff" }).click();
    await expect(page.getByText("door@example.com")).toBeVisible();

    await setDemoUser(page, { id: "door-staff", email: "door@example.com", name: "Door" });
    await page.goto("/events");
    await expect(page.getByText("Staff access")).toBeVisible();
    await page.goto(`/events/${events[0].id}/check-in`);
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByLabel("Search by name, phone, email, or pass ID").fill("asha");
    await expect(page.getByText("a•••@example.com")).toBeVisible();
    await expect(page.getByText("asha@example.com")).toHaveCount(0);
    await page.getByRole("button", { name: "Check in Asha Rao" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Checked In" })).toContainText("Asha Rao");
    await page.goto(`/events/${events[0].id}/guests`);
    await expect(page.getByRole("alert")).toContainText("You don't have permission to access this event.");
  });
});

test.describe("mobile check-in", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("one-handed controls stay in the thumb zone and scan works", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests }]);
    await loadSnapshot(page, snapshot);
    await showQr(events[0].passes["Asha Rao"].payload);
    await page.goto(`/events/${events[0].id}/check-in`);
    const controls = page.getByRole("navigation", { name: "Check-in controls" });
    const box = (await controls.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(800);
    const scanButton = controls.getByRole("button", { name: "Scan QR" });
    expect((await scanButton.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expect(page.getByRole("status").filter({ hasText: "Checked In" })).toContainText("Asha Rao", { timeout: 20_000 });
    await expect(page.getByText("1 checked in")).toBeVisible();
    await page.getByRole("button", { name: "Scan next guest" }).tap();
    await expect(page.getByLabel("Camera viewfinder")).toBeVisible();
  });
});

test.describe("capacity", () => {
  test("blocks guests beyond max capacity", async ({ page }) => {
    const { snapshot, events } = await seed([{ guests: guests.slice(0, 2), details: { maxCapacity: 3 } }]);
    await loadSnapshot(page, snapshot);
    await page.goto(`/events/${events[0].id}/guests`);
    await expect(page.getByRole("heading", { name: "2 / 3 guests" })).toBeVisible();
    await page.getByRole("button", { name: "Import CSV" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "more.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Name,Email\nDev,dev@example.com\nEsha,esha@example.com\n"),
    });
    await expect(page.getByText("1 ready · 1 over capacity")).toBeVisible();
    await page.getByRole("button", { name: "Import 1 guest" }).click();
    await expect(page.getByRole("heading", { name: "3 / 3 guests" })).toBeVisible();
    await expect(page.getByText("Maximum event capacity has been reached.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add guest" })).toBeDisabled();
  });

  test("wizard shows specific required-field errors", async ({ page }) => {
    await page.goto("/events/create");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Event name is required.")).toBeVisible();
    await expect(page.getByText("Description is required.")).toBeVisible();
  });
});

test("public pages never expose other guests' passes", async ({ page }) => {
  const { snapshot, events } = await seed([{ guests }]);
  await loadSnapshot(page, snapshot);
  await page.goto(`/pass/${events[0].passes["Asha Rao"].token}`);
  await expect(page.getByText("Asha Rao")).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("Bala Krishna");
  expect(html).not.toContain("asha@example.com");
  await page.goto(`/pass/${"x".repeat(43)}`);
  await expect(page.getByRole("alert")).toContainText("This pass could not be found");
});
