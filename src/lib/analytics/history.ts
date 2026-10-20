import { db, sqlite } from '@/db';
import { cities, countries, fixedCosts, itineraryLegs, itineraryLegTransports, savedPlans, userPreferences } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { planSnapshotSchema, type PlanSnapshot } from '@/lib/plan-snapshot';
import { getDailyCost } from '@/lib/cost-calculator';
import { getIntercityTransportTotal } from '@/lib/intercity-transport';
import { getMiscellaneousExpenseTotal } from '@/lib/miscellaneous-expenses';
import type { AccomTier, ActivitiesTier, DrinksTier, FoodTier } from '@/types';
import { analyticsContext } from './context';
import { accountAnalyticsId, enqueueEvent, makeEvent } from './service';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function currentPlanSnapshot(userId: string): PlanSnapshot {
  const preferences = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  const legs = db.select().from(itineraryLegs).where(eq(itineraryLegs.userId, userId)).orderBy(asc(itineraryLegs.sortOrder), asc(itineraryLegs.id)).all();
  const transports = legs.length ? db.select().from(itineraryLegTransports).where(inArray(itineraryLegTransports.legId, legs.map(leg => leg.id))).all() : [];
  return planSnapshotSchema.parse({ version: 1, groupSize: preferences?.plannerGroupSize ?? 2,
    legs: legs.map(leg => ({ ...leg, intercityTransports: transports.filter(t => t.legId === leg.id) })),
    fixedCosts: db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId)).all(),
  });
}
export function materializeHistoricalPlan(userId: string, snapshot: PlanSnapshot) {
  const ids = [...new Set(snapshot.legs.map(leg => leg.cityId))];
  const prices = ids.length ? db.select().from(cities).where(inArray(cities.id, ids)).all() : [];
  const cityMap = new Map(prices.map(city => [city.id, city]));
  let totalBudget = snapshot.fixedCosts.reduce((sum, cost) => sum + cost.amountAud, 0);
  for (const leg of snapshot.legs) {
    const city = cityMap.get(leg.cityId);
    if (!city) throw new Error('Cannot record plan history: a city is missing.');
    totalBudget += getDailyCost(city, leg.accomTier as AccomTier, leg.foodTier as FoodTier, leg.drinksTier as DrinksTier,
      leg.activitiesTier as ActivitiesTier, leg, snapshot.groupSize) * leg.nights
      + (leg.intercityTransports.length ? getIntercityTransportTotal(leg.intercityTransports) : leg.intercityTransportCost ?? 0)
      + getMiscellaneousExpenseTotal(leg.miscellaneousExpenses);
  }
  const prefs = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  const currency = prefs?.displayCurrency ?? 'AUD';
  const fx = currency === 'AUD' ? { date: null, rate: 1 } : sqlite.prepare("SELECT date,rate FROM exchange_rates WHERE from_currency='AUD' AND to_currency=? ORDER BY date DESC LIMIT 1").get(currency) ?? null;
  return { version: 1, calculationVersion: 'budget-v1', snapshot, prices,
    countries: db.select().from(countries).where(inArray(countries.id, [...new Set(prices.map(p => p.countryId))])).all(),
    displayCurrency: currency, lastCachedDisplayFx: fx,
    summary: { legCount: snapshot.legs.length, totalNights: snapshot.legs.reduce((sum, leg) => sum + leg.nights, 0),
      totalBudgetAud: Math.round(totalBudget * 100) / 100, groupSize: snapshot.groupSize },
  };
}
function appendRevision(userId: string, subject: string, action: string, snapshot: PlanSnapshot, deleted = false) {
  const historical = materializeHistoricalPlan(userId, snapshot);
  const result = sqlite.prepare(`INSERT INTO plan_revisions(user_id,subject_id,operation_id,action,created_at,snapshot_json,summary_json,deleted) VALUES (?,?,?,?,?,?,?,?)`)
    .run(userId, subject, analyticsContext.getStore()?.operationId ?? crypto.randomUUID(), action, new Date().toISOString(), JSON.stringify(historical), JSON.stringify(historical.summary), Number(deleted));
  if (action !== 'migration_baseline') enqueueEvent(makeEvent('mutation_committed', { action, revisionId: Number(result.lastInsertRowid), legCount: historical.summary.legCount, totalNights: historical.summary.totalNights, totalBudgetAud: historical.summary.totalBudgetAud }, { accountId: accountAnalyticsId(userId) }), userId);
  return historical;
}
export function withPlanRevision<T>(userId: string, action: string, mutate: (tx: Transaction) => T, subject = 'active'): T {
  return db.transaction(tx => {
    if (!sqlite.prepare('SELECT 1 FROM plan_revisions WHERE user_id=? AND subject_id=? LIMIT 1').get(userId, subject)) {
      const existing = subject === 'active' ? currentPlanSnapshot(userId) : db.select().from(savedPlans).where(eq(savedPlans.id, subject)).get();
      if (existing) appendRevision(userId, subject, 'migration_baseline', 'snapshotJson' in existing ? planSnapshotSchema.parse(JSON.parse(existing.snapshotJson)) : existing);
    }
    const previous = subject === 'active' ? null : db.select().from(savedPlans).where(eq(savedPlans.id, subject)).get();
    const result = mutate(tx);
    if (result instanceof Promise) throw new Error('Plan transactions must be synchronous.');
    const saved = subject === 'active' ? null : db.select().from(savedPlans).where(eq(savedPlans.id, subject)).get();
    const snapshot = subject === 'active' ? currentPlanSnapshot(userId) : planSnapshotSchema.parse(JSON.parse((saved ?? previous)!.snapshotJson));
    appendRevision(userId, subject, action, snapshot, subject !== 'active' && !saved);
    return result;
  });
}
export function recordNewSavedPlan(userId: string, subject: string, snapshot: PlanSnapshot) {
  return appendRevision(userId, subject, 'plan_saved', snapshot);
}
export function ensurePlanBaselines(userId: string) {
  db.transaction(() => {
    if (!sqlite.prepare("SELECT 1 FROM plan_revisions WHERE user_id=? AND subject_id='active'").get(userId)) appendRevision(userId, 'active', 'migration_baseline', currentPlanSnapshot(userId));
    for (const plan of db.select().from(savedPlans).where(eq(savedPlans.userId, userId)).all()) {
      if (!sqlite.prepare('SELECT 1 FROM plan_revisions WHERE user_id=? AND subject_id=?').get(userId, plan.id)) appendRevision(userId, plan.id, 'migration_baseline', planSnapshotSchema.parse(JSON.parse(plan.snapshotJson)));
    }
  });
}

/** Shared prices affect active itineraries and saved plans. Dependent revisions share the write transaction. */
export function withCityPriceRevisions<T>(cityIds: string[], mutate: (tx: Transaction) => T): T {
  return db.transaction(tx => {
    const affected = new Map<string, { userId: string; subject: string; snapshot: PlanSnapshot }>();
    const owners = db.select({ userId: itineraryLegs.userId }).from(itineraryLegs).where(inArray(itineraryLegs.cityId, cityIds)).all();
    for (const owner of owners) if (owner.userId) affected.set(owner.userId + ':active', { userId: owner.userId, subject: 'active', snapshot: currentPlanSnapshot(owner.userId) });
    for (const plan of db.select().from(savedPlans).all()) {
      const snapshot = planSnapshotSchema.parse(JSON.parse(plan.snapshotJson));
      if (snapshot.legs.some(leg => cityIds.includes(leg.cityId))) affected.set(plan.userId + ':' + plan.id, { userId: plan.userId, subject: plan.id, snapshot });
    }
    for (const row of affected.values()) if (!sqlite.prepare('SELECT 1 FROM plan_revisions WHERE user_id=? AND subject_id=? LIMIT 1').get(row.userId, row.subject)) appendRevision(row.userId, row.subject, 'migration_baseline', row.snapshot);
    const result = mutate(tx);
    if (result instanceof Promise) throw new Error('City price transactions must be synchronous.');
    for (const row of affected.values()) appendRevision(row.userId, row.subject, 'city_prices_changed', row.snapshot);
    return result;
  });
}
