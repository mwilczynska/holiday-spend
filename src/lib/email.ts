import { z } from 'zod';

const emailSchema = z.string().email();

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmailShape(raw: string): boolean {
  return emailSchema.safeParse(raw).success;
}
