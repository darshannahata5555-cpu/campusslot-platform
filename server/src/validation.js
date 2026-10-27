import { z } from "zod";
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes.",
  );
export const registration = z
  .object({ name: z.string().trim().min(2).max(80), email, password })
  .strict();
export const login = z
  .object({
    email,
    password: z
      .string()
      .min(1)
      .max(72)
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes.",
      ),
  })
  .strict();
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid record ID.");
export const booking = z
  .object({
    equipment: objectId,
    purpose: z
      .string()
      .trim()
      .min(10, "Describe your project in at least 10 characters.")
      .max(1000),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
  })
  .strict();
export const actionInput = z
  .object({ note: z.string().trim().max(500).optional() })
  .strict();
export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function validateWindow(start, end, now = new Date()) {
  if (!Number.isFinite(+start) || !Number.isFinite(+end))
    fail(400, "Use valid pickup and return times.");
  if (start <= now) fail(400, "Pickup must be in the future.");
  if (end <= start) fail(400, "Return must be after pickup.");
  if (end - start > 7 * 86400000)
    fail(400, "Reservations can last at most seven days.");
  if (end - now > 90 * 86400000)
    fail(400, "Pickup and return must be within the next 90 days.");
}
