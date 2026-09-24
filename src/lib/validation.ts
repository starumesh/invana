import { z } from "zod";

export const dateSchema = z.object({
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const timeSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  format: z.enum(["12h", "24h"]),
});

export const mapsUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => /google\.[^/]+\/maps|maps\.app\.goo\.gl|maps\.google|goo\.gl\/maps/i.test(value) || value.startsWith("http"),
    "Enter a valid maps or website URL",
  );

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, "Use country code, e.g. +919876543210");

export const rsvpSchema = z.object({
  guestName: z.string().trim().min(1, "Name is required").max(80),
  response: z.enum(["yes", "no", "maybe"]),
  partySize: z.number().int().min(1).max(20),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  dietary: z.string().optional(),
  message: z.string().max(400).optional(),
});

export function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  return digits.replace(/\D/g, "");
}

export function uniquePhones(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const phone = normalizePhone(value);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    result.push(phone);
  }
  return result;
}
