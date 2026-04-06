import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const countries = sqliteTable('countries', {
  id: text('id').primaryKey(), // e.g. 'vietnam', 'japan'
  name: text('name').notNull(),
  currencyCode: text('currency_code').notNull(),
  region: text('region'), // 'se_asia', 'east_asia', 'europe', etc.
});

export const cities = sqliteTable('cities', {
  id: text('id').primaryKey(), // e.g. 'hanoi', 'tokyo'
  countryId: text('country_id').notNull().references(() => countries.id),
  name: text('name').notNull(),

  // ACCOMMODATION: per night, for 2 people, in AUD
  accomHostel: real('accom_hostel'),
  accomPrivateRoom: real('accom_private_room'),
  accom1star: real('accom_1star'),
  accom2star: real('accom_2star'),
  accom3star: real('accom_3star'),
  accom4star: real('accom_4star'),

  // FOOD: per day, for 2 people, in AUD
  foodStreet: real('food_street'),
  foodBudget: real('food_budget'),
  foodMid: real('food_mid'),
  foodHigh: real('food_high'),

  // DRINKS: unit prices in AUD
  drinkLocalBeer: real('drink_local_beer'),
  drinkImportBeer: real('drink_import_beer'),
  drinkWineGlass: real('drink_wine_glass'),
  drinkCocktail: real('drink_cocktail'),
  drinkCoffee: real('drink_coffee'),
  // Composed daily drink budgets
  drinksLight: real('drinks_light'),
  drinksModerate: real('drinks_moderate'),
  drinksHeavy: real('drinks_heavy'),

  // ACTIVITIES: per day, for 2 people, in AUD
  activitiesFree: real('activities_free').default(0),
  activitiesBudget: real('activities_budget'),
  activitiesMid: real('activities_mid'),
  activitiesHigh: real('activities_high'),

  // TRANSPORT: per day, for 2 people, in AUD
  transportLocal: real('transport_local'),

  // Metadata
  estimationSource: text('estimation_source'),
  estimatedAt: text('estimated_at'),
  estimationId: integer('estimation_id'),
  notes: text('notes'),
});

export const itineraryLegs = sqliteTable('itinerary_legs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cityId: text('city_id').notNull().references(() => cities.id),
  startDate: text('start_date'),
  endDate: text('end_date'),
  nights: integer('nights').notNull(),

  // Tier selections
  accomTier: text('accom_tier').default('2star'),
  foodTier: text('food_tier').default('mid'),
  drinksTier: text('drinks_tier').default('moderate'),
  activitiesTier: text('activities_tier').default('mid'),

  // Overrides (AUD per day for 2 people)
  accomOverride: real('accom_override'),
  foodOverride: real('food_override'),
  drinksOverride: real('drinks_override'),
  activitiesOverride: real('activities_override'),
  transportOverride: real('transport_override'),

  // Intercity travel
  intercityTransportCost: real('intercity_transport_cost').default(0),
  intercityTransportNote: text('intercity_transport_note'),

  splitPct: real('split_pct').default(50),
  sortOrder: integer('sort_order'),
  notes: text('notes'),
  status: text('status').default('planned'), // 'planned', 'active', 'completed'
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  amountAud: real('amount_aud'),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  description: text('description'),
  merchant: text('merchant'),
  legId: integer('leg_id').references(() => itineraryLegs.id),
  source: text('source').default('manual'),
  wiseTxnId: text('wise_txn_id').unique(),
  loggedBy: text('logged_by'),
  isExcluded: integer('is_excluded').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color'),
});

export const expenseTags = sqliteTable('expense_tags', {
  expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.expenseId, table.tagId] }),
]);

export const exchangeRates = sqliteTable('exchange_rates', {
  date: text('date').notNull(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').default('AUD'),
  rate: real('rate').notNull(),
}, (table) => [
  primaryKey({ columns: [table.date, table.fromCurrency, table.toCurrency] }),
]);

export const fixedCosts = sqliteTable('fixed_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  amountAud: real('amount_aud').notNull(),
  category: text('category'), // 'visa', 'insurance', 'flights', 'gear', 'other'
  countryId: text('country_id').references(() => countries.id),
  date: text('date'),
  isPaid: integer('is_paid').default(0),
  notes: text('notes'),
});

export const cityEstimates = sqliteTable('city_estimates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cityId: text('city_id').notNull().references(() => cities.id),
  estimatedAt: text('estimated_at').notNull(),
  source: text('source').notNull(),
  llmProvider: text('llm_provider'),
  llmModel: text('llm_model'),
  dataJson: text('data_json').notNull(),
  reasoning: text('reasoning'),
  confidence: text('confidence'),
  numbeoItems: text('numbeo_items'),
  xoteloData: text('xotelo_data'),
  isActive: integer('is_active').default(1),
});
