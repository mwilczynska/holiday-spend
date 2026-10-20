import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/db', async () => (await import('./test-fixture')).analyticsTestDatabase());
import { db, sqlite } from '@/db';
import { cities, countries, itineraryLegs, savedPlans, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { currentPlanSnapshot, ensurePlanBaselines, withCityPriceRevisions, withPlanRevision } from './history';

beforeEach(() => {
  sqlite.exec('DELETE FROM analytics_outbox; DELETE FROM plan_revisions; DELETE FROM saved_plans; DELETE FROM itinerary_legs; DELETE FROM cities; DELETE FROM countries; DELETE FROM user;');
  db.insert(users).values({ id: 'owner' }).run();
  db.insert(countries).values({ id: 'pt', name: 'Portugal', currencyCode: 'EUR' }).run();
  db.insert(cities).values({ id: 'porto', countryId: 'pt', name: 'Porto', accom2star: 100, foodMid: 40, drinksModerate: 20, activitiesMid: 10 }).run();
  db.insert(itineraryLegs).values({ userId: 'owner', cityId: 'porto', nights: 3, accomTier: '2star', foodTier: 'mid', drinksTier: 'moderate', activitiesTier: 'mid' }).run();
});
afterAll(() => sqlite.close());
describe('private plan history', () => {
  it('captures a labelled baseline and one committed revision with frozen prices and canonical totals', () => {
    withPlanRevision('owner', 'leg_updated', tx => tx.update(itineraryLegs).set({ nights: 4 }).where(eq(itineraryLegs.userId, 'owner')).run());
    const rows = sqlite.prepare('SELECT * FROM plan_revisions ORDER BY id').all() as Array<{ action: string; snapshot_json: string }>;
    expect(rows.map(r => r.action)).toEqual(['migration_baseline', 'leg_updated']);
    const state = JSON.parse(rows[1].snapshot_json);
    expect(state.summary.totalBudgetAud).toBe(680);
    db.update(cities).set({ accom2star: 1000 }).run();
    expect(JSON.parse(rows[1].snapshot_json).prices[0].accom2star).toBe(100);
  });
  it('rolls back the mutation and baseline if history cannot be persisted', () => {
    sqlite.exec("CREATE TRIGGER reject_history BEFORE INSERT ON plan_revisions WHEN NEW.action='leg_updated' BEGIN SELECT RAISE(ABORT,'history unavailable'); END;");
    expect(() => withPlanRevision('owner', 'leg_updated', tx => tx.update(itineraryLegs).set({ nights: 9 }).run())).toThrow('history unavailable');
    expect(db.select().from(itineraryLegs).get()?.nights).toBe(3);
    expect(sqlite.prepare('SELECT count(*) AS n FROM plan_revisions').get()).toEqual({ n: 0 });
    sqlite.exec('DROP TRIGGER reject_history');
  });
  it('continues history after opt-out and suppresses behavioral outbox records', () => {
    sqlite.prepare('INSERT INTO analytics_preferences VALUES (?,0,?)').run('owner', new Date().toISOString());
    withPlanRevision('owner', 'leg_updated', tx => tx.update(itineraryLegs).set({ nights: 5 }).run());
    expect(sqlite.prepare('SELECT count(*) AS n FROM plan_revisions').get()).toEqual({ n: 2 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM analytics_outbox').get()).toEqual({ n: 0 });
    sqlite.exec('DELETE FROM analytics_preferences');
  });
  it('creates migration baselines only once', () => {
    ensurePlanBaselines('owner'); ensurePlanBaselines('owner');
    expect(sqlite.prepare('SELECT count(*) AS n FROM plan_revisions').get()).toEqual({ n: 1 });
  });
  it('records saved-plan renames and retains the final state after deletion', () => {
    db.insert(savedPlans).values({ id: 'saved', userId: 'owner', name: 'Original', snapshotJson: JSON.stringify(currentPlanSnapshot('owner')) }).run();
    withPlanRevision('owner', 'plan_renamed', tx => tx.update(savedPlans).set({ name: 'Updated' }).where(eq(savedPlans.id, 'saved')).run(), 'saved');
    withPlanRevision('owner', 'plan_deleted', tx => tx.delete(savedPlans).where(eq(savedPlans.id, 'saved')).run(), 'saved');
    const rows = sqlite.prepare("SELECT action,snapshot_json,deleted FROM plan_revisions WHERE subject_id='saved' ORDER BY id").all() as Array<{ action: string; snapshot_json: string; deleted: number }>;
    expect(rows.map(row => JSON.parse(row.snapshot_json).snapshot.name)).toEqual(['Original', 'Updated', 'Updated']);
    expect(rows[2].deleted).toBe(1);
  });
  it('records shared city-price changes without rewriting earlier budgets', () => {
    withCityPriceRevisions(['porto'], tx => tx.update(cities).set({ accom2star: 200 }).where(eq(cities.id, 'porto')).run());
    const rows = sqlite.prepare('SELECT action,summary_json FROM plan_revisions ORDER BY id').all() as Array<{ action: string; summary_json: string }>;
    expect(rows.map(row => row.action)).toEqual(['migration_baseline', 'city_prices_changed']);
    expect(rows.map(row => JSON.parse(row.summary_json).totalBudgetAud)).toEqual([510, 810]);
  });
});
