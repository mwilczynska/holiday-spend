import { z } from 'zod';

export const planSnapshotTransportSchema = z.object({
  id: z.number().int().optional(),
  legId: z.number().int().optional(),
  mode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  cost: z.number().default(0),
  sortOrder: z.number().int().nullable().optional(),
});

export const planSnapshotLegSchema = z.object({
  id: z.number().int().optional(),
  cityId: z.string().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  nights: z.number().int().min(1),
  accomTier: z.string().default('2star'),
  foodTier: z.string().default('mid'),
  drinksTier: z.string().default('moderate'),
  activitiesTier: z.string().default('mid'),
  accomOverride: z.number().nullable().optional(),
  foodOverride: z.number().nullable().optional(),
  drinksOverride: z.number().nullable().optional(),
  activitiesOverride: z.number().nullable().optional(),
  transportOverride: z.number().nullable().optional(),
  intercityTransportCost: z.number().optional(),
  intercityTransportNote: z.string().nullable().optional(),
  intercityTransports: z.array(planSnapshotTransportSchema).default([]),
  splitPct: z.number().default(50),
  sortOrder: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().default('planned'),
});

export const planSnapshotFixedCostSchema = z.object({
  id: z.number().int().optional(),
  description: z.string().min(1),
  amountAud: z.number().nonnegative(),
  category: z.string().nullable().optional(),
  countryId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  isPaid: z.number().default(0),
  notes: z.string().nullable().optional(),
});

export const planSnapshotSchema = z.object({
  version: z.number().int().default(1),
  name: z.string().optional(),
  exportedAt: z.string().optional(),
  groupSize: z.number().int().min(1).max(5).default(2),
  legs: z.array(planSnapshotLegSchema),
  fixedCosts: z.array(planSnapshotFixedCostSchema).default([]),
});

export type PlanSnapshot = z.infer<typeof planSnapshotSchema>;
