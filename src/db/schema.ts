import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
});

export const accounts = sqliteTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
]);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

export const countries = sqliteTable('countries', {
  id: text('id').primaryKey(), // e.g. 'vietnam', 'japan'
  name: text('name').notNull(),
  currencyCode: text('currency_code').notNull(),
  region: text('region'), // 'se_asia', 'east_asia', 'europe', etc.
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  plannerGroupSize: integer('planner_group_size').notNull().default(2),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const savedPlans = sqliteTable('saved_plans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  groupSize: integer('group_size').notNull().default(2),
  legCount: integer('leg_count').notNull().default(0),
  totalNights: integer('total_nights').notNull().default(0),
  totalBudget: real('total_budget').notNull().default(0),
  fixedCostCount: integer('fixed_cost_count').notNull().default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
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
  drinksNone: real('drinks_none'),
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
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
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

  sortOrder: integer('sort_order'),
  notes: text('notes'),
  status: text('status').default('planned'), // 'planned', 'active', 'completed'
});

export const itineraryLegTransports = sqliteTable('itinerary_leg_transports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  legId: integer('leg_id').notNull().references(() => itineraryLegs.id, { onDelete: 'cascade' }),
  mode: text('mode'),
  note: text('note'),
  cost: real('cost').notNull().default(0),
  sortOrder: integer('sort_order'),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
  promptVersion: text('prompt_version'),
  dataJson: text('data_json').notNull(),
  anchorsJson: text('anchors_json'),
  metadataJson: text('metadata_json'),
  reasoning: text('reasoning'),
  confidence: text('confidence'),
  numbeoItems: text('numbeo_items'),
  xoteloData: text('xotelo_data'),
  sourcesJson: text('sources_json'),
  inputSnapshotJson: text('input_snapshot_json'),
  fallbackLogJson: text('fallback_log_json'),
  isActive: integer('is_active').default(1),
});

export const cityPriceInputs = sqliteTable('city_price_inputs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cityId: text('city_id').notNull().references(() => cities.id),
  capturedAt: text('captured_at').notNull(),
  sourceType: text('source_type').notNull(),
  sourceDetail: text('source_detail'),
  confidence: text('confidence'),
  accomHostel: real('accom_hostel'),
  accomPrivateRoom: real('accom_private_room'),
  accom1star: real('accom_1star'),
  accom2star: real('accom_2star'),
  accom3star: real('accom_3star'),
  accom4star: real('accom_4star'),
  streetMeal: real('street_meal'),
  cheapRestaurantMeal: real('cheap_restaurant_meal'),
  midRestaurantMeal: real('mid_restaurant_meal'),
  coffee: real('coffee'),
  localBeer: real('local_beer'),
  importBeer: real('import_beer'),
  wineGlass: real('wine_glass'),
  cocktail: real('cocktail'),
  publicTransitRide: real('public_transit_ride'),
  taxiShort: real('taxi_short'),
  activityBudget: real('activity_budget'),
  activityMid: real('activity_mid'),
  activityHigh: real('activity_high'),
  notes: text('notes'),
  isActive: integer('is_active').default(1),
});
