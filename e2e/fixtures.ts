import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import type { Page } from "@playwright/test";
import {
  encodeQrPayload,
  EventService,
  MemoryEventRepository,
  type GuestInput,
  type MemorySnapshot,
  type RequestContext,
} from "../supabase/functions/_shared/event-core/index.ts";

export const DEMO_USER = { id: "demo-user", email: "you@local.demo", name: "You" };
export const DEMO_KEY = "invana.em.v1";

export function futureDate(days = 21): string {
  return new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
}

export function eventDetails(overrides: Record<string, unknown> = {}) {
  return {
    name: "Seeded Meetup",
    description: "Seeded for E2E",
    eventType: "Meetup",
    date: futureDate(),
    startTime: "18:00",
    timezone: "Asia/Kolkata",
    durationMinutes: 180,
    venueName: "T-Hub",
    address: "IIIT Campus, Gachibowli",
    city: "Hyderabad",
    country: "India",
    latitude: 17.4435,
    longitude: 78.3772,
    maxCapacity: 50,
    ...overrides,
  };
}

/** Build Demo Mode state with the real domain service (same rules as the Edge function). */
export async function seed(
  events: { details?: Record<string, unknown>; guests: GuestInput[]; publish?: boolean; cancelGuest?: string }[],
  base?: MemorySnapshot,
) {
  const repo = new MemoryEventRepository(base);
  const service = new EventService(repo);
  const ctx: RequestContext = { actor: { userId: DEMO_USER.id, email: DEMO_USER.email }, ip: "seed", requestId: "seed" };
  const out: { id: string; slug: string | null; name: string; passes: Record<string, { token: string; publicId: string; payload: string; passId: string }> }[] = [];
  for (const spec of events) {
    const detail = await service.createEvent(ctx, { details: eventDetails(spec.details), guests: spec.guests });
    await service.generatePasses(ctx, detail.event.id, { batchSize: 200 });
    const ev = spec.publish === false ? detail.event : await service.transitionEvent(ctx, detail.event.id, "PUBLISHED");
    const passes: (typeof out)[number]["passes"] = {};
    for (const g of (await service.getEventDetail(ctx, ev.id)).guests) {
      const s = await service.sharePass(ctx, ev.id, g.id);
      passes[g.name] = { token: s.passToken, publicId: s.passPublicId, payload: encodeQrPayload(ev.id, s.passToken), passId: g.pass!.id };
      if (spec.cancelGuest === g.name) await service.cancelPass(ctx, ev.id, g.pass!.id);
    }
    out.push({ id: ev.id, slug: ev.slug, name: ev.name, passes });
  }
  return { snapshot: repo.data, events: out };
}

export async function loadSnapshot(page: Page, snapshot: MemorySnapshot, user = DEMO_USER) {
  await page.goto("/");
  await page.evaluate(
    ([key, data, u]) => {
      localStorage.setItem(key, data);
      localStorage.setItem("invana.user", u);
    },
    [DEMO_KEY, JSON.stringify(snapshot), JSON.stringify(user)] as const,
  );
}

export async function setDemoUser(page: Page, user: { id: string; email: string; name: string }) {
  await page.evaluate((u) => localStorage.setItem("invana.user", u), JSON.stringify(user));
}

/**
 * Y4M video whose frames show a QR code — fed to Chromium as the fake camera so
 * the real getUserMedia → jsQR decode path runs in E2E.
 */
export async function qrCameraFile(payload: string): Promise<string> {
  const W = 640;
  const H = 480;
  const code = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = code.modules.size;
  const scale = Math.floor(Math.min(W, H) * 0.8 / (size + 8));
  const total = (size + 8) * scale;
  const ox = Math.floor((W - total) / 2);
  const oy = Math.floor((H - total) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let my = 0; my < size; my += 1) {
    for (let mx = 0; mx < size; mx += 1) {
      if (!code.modules.get(mx, my)) continue;
      for (let py = 0; py < scale; py += 1) {
        const row = (oy + (my + 4) * scale + py) * W;
        y.fill(16, row + ox + (mx + 4) * scale, row + ox + (mx + 5) * scale);
      }
    }
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);
  const frames = Array.from({ length: 10 }, () => frame);
  const dir = mkdtempSync(join(tmpdir(), "invana-qr-"));
  const file = join(dir, "qr.y4m");
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...frames]));
  return file;
}
