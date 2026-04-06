# Wanderledger — Travel Budget Planner & Tracker

## Technical Specification & Claude Code Build Plan

---

## 1. Project Overview

**What:** A mobile-first web application for planning and tracking spending across a 12–14 month multi-continent trip for two people.

**Core problems solved:**

1. **Prospective estimation** — Model total trip cost by mixing/matching cities, accommodation tiers, food levels, activity budgets, and travel costs. Answer "how much will 14 months cost us?"
2. **Actual spend tracking** — Import Wise CSV exports (with optional API integration) and manually log cash/other transactions. Categorise and tag against your itinerary.
3. **Planned vs. actual dashboard** — See where you're over/under budget per country, per category, and overall. Project forward: "at this burn rate, will we run out?"

**Users:** You + partner. You manage the system; partner has read access + can log expenses via mobile.

**Display currency:** AUD (all estimates and totals normalised to AUD).

---

## 2. Itinerary Sketch (Seed Data)

| Region | Duration | Approx. Dates | Daily Cost Range (AUD, 2 ppl) |
|---|---|---|---|
| Vietnam | 6 weeks | Already underway | $80–$180 |
| Laos | 2 weeks | TBD | $60–$140 |
| Cambodia | 2 weeks | TBD | $60–$150 |
| Philippines | 5 weeks | TBD | $80–$180 |
| South Korea | 2 weeks | TBD | $150–$350 |
| Japan | 3 weeks | TBD | $180–$400 |
| Eastern Europe (multiple) | ~8–12 weeks | TBD | $120–$300 |
| UK | 1–2 weeks | TBD | $200–$450 |
| Italy | 1–2 weeks | TBD | $180–$400 |
| Greece | 1–2 weeks | TBD | $140–$320 |
| Mexico | 2–3 weeks | TBD | $80–$200 |
| Return SE Asia | 2–4 weeks | TBD | $70–$170 |

*Ranges reflect hostel/street-food floor to mid-range-hotel/restaurant ceiling for two people.*

---

## 3. Architecture

### 3.1 Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | SSR for fast mobile loads, API routes for backend, single deployable |
| **Language** | TypeScript | Type safety across the full stack — you'll thank yourself at month 8 |
| **Database** | SQLite via Drizzle ORM | Zero infrastructure — single file on your VPS, trivially backupable, more than sufficient for 2 users |
| **Styling** | Tailwind CSS + shadcn/ui | Mobile-first responsive, consistent component library |
| **Charts** | Recharts or Chart.js | Lightweight, React-native charting |
| **Auth** | Simple token-based (env var) | Two users, no need for full auth system. PIN or shared secret via HTTPS. |
| **Deployment** | Docker → VPS (IP, self-signed TLS) | Single `docker-compose up`, nginx reverse proxy. Domain + Let's Encrypt later if needed. |
| **Currency** | Exchange rate API (frankfurter.app, free) | Daily rates, AUD base. Cache locally. |

### 3.2 Why These Choices

**SQLite over PostgreSQL:** You have two users and ≤50K rows over the whole trip. SQLite eliminates an entire service dependency — the DB is a single file you can `scp` off your VPS for backup. Drizzle ORM gives you type-safe queries and easy migration path to Postgres if you ever need it.

**Next.js over a SPA + separate API:** Deploying one thing instead of two. API routes live alongside the frontend. SSR means the mobile experience is fast even on patchy SE Asian wifi.

**No dedicated auth system:** A shared secret/PIN in an env var is fine for two trusted users on a personal tool. The app sits behind self-signed TLS on a VPS IP — not publicly discoverable. If you want per-user identity later (to track who logged what), add a simple username selector — no passwords needed.

### 3.3 System Diagram

```
┌─────────────────────────────────────────────────┐
│                    VPS (Docker)                  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           Next.js Application             │   │
│  │                                           │   │
│  │  ┌─────────────┐   ┌──────────────────┐  │   │
│  │  │  React UI   │   │  API Routes      │  │   │
│  │  │  (Mobile +  │   │                  │  │   │
│  │  │   Desktop)  │   │  /api/itinerary  │  │   │
│  │  │             │   │  /api/expenses   │  │   │
│  │  │  Planning   │   │  /api/import     │  │   │
│  │  │  Tracking   │   │  /api/rates      │  │   │
│  │  │  Dashboard  │   │  /api/estimates  │  │   │
│  │  └─────────────┘   └───────┬──────────┘  │   │
│  │                            │              │   │
│  │                    ┌───────▼──────────┐   │   │
│  │                    │  SQLite (Drizzle) │   │   │
│  │                    │  /data/travel.db  │   │   │
│  │                    └──────────────────┘   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────┐  ┌─────────────┐                  │
│  │  nginx   │  │  Wise CSV   │                  │
│  │  proxy   │  │  uploads    │                  │
│  └──────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────┘
         │                          │
    HTTPS/TLS              External APIs:
    (self-signed             - frankfurter.app (exchange rates)
     initially)              - Anthropic API (city cost estimation)
                             - Xotelo (hotel prices, free)
                             - Numbeo (optional, paid)
                             - Wise API (optional, AU account)
```

---

## 4. Data Model

### 4.1 Core Tables

```sql
-- Countries and cities with base cost estimates
CREATE TABLE countries (
  id            TEXT PRIMARY KEY,       -- e.g. 'vietnam', 'japan'
  name          TEXT NOT NULL,
  currency_code TEXT NOT NULL,          -- e.g. 'VND', 'JPY'
  region        TEXT                    -- 'se_asia', 'east_asia', 'europe', etc.
);

CREATE TABLE cities (
  id              TEXT PRIMARY KEY,     -- e.g. 'hanoi', 'tokyo'
  country_id      TEXT NOT NULL REFERENCES countries(id),
  name            TEXT NOT NULL,

  -- ACCOMMODATION: per night, for 2 people, in AUD
  accom_hostel    REAL,  -- dorm bed × 2 or private hostel room
  accom_1star     REAL,  -- guesthouse / budget hotel
  accom_2star     REAL,  -- decent hotel / good Airbnb
  accom_3star     REAL,  -- mid-range hotel / nice Airbnb
  accom_4star     REAL,  -- boutique / upscale hotel

  -- FOOD: per day, for 2 people, in AUD
  food_street     REAL,  -- street food / market stalls all day
  food_budget     REAL,  -- cheap local restaurants
  food_mid        REAL,  -- mix of local + some nicer restaurants
  food_high       REAL,  -- mostly sit-down restaurants

  -- DRINKS: per day, for 2 people, in AUD
  -- Unit prices stored separately for flexible composition
  drink_local_beer   REAL,  -- price of 1 local beer (500ml draught or bottle)
  drink_import_beer  REAL,  -- price of 1 imported beer
  drink_wine_glass   REAL,  -- price of 1 glass of wine (restaurant)
  drink_cocktail     REAL,  -- price of 1 cocktail
  drink_coffee       REAL,  -- price of 1 coffee (for reference)
  -- Composed daily drink budgets (auto-calculated or manually set)
  drinks_light    REAL,  -- ~2 local beers per day
  drinks_moderate REAL,  -- ~4 drinks mixed (beers + wine/cocktails)
  drinks_heavy    REAL,  -- ~6+ drinks, cocktails included

  -- ACTIVITIES: per day, for 2 people, in AUD
  activities_free     REAL DEFAULT 0,  -- walking, beaches, free museums
  activities_budget   REAL,  -- 1 cheap activity (temple entry, local tour)
  activities_mid      REAL,  -- 1 mid-range activity (cooking class, day tour)
  activities_high     REAL,  -- multiple activities or premium (diving, canyoning)

  -- TRANSPORT: per day, for 2 people, in AUD
  transport_local REAL,  -- daily local transport (Grab, bus, metro)

  -- Metadata
  estimation_source TEXT,  -- summary: 'llm', 'numbeo+llm', 'xotelo+llm', 'manual', etc.
  estimated_at      TEXT,  -- ISO timestamp of active estimate
  estimation_id     INTEGER REFERENCES city_estimates(id),  -- link to active estimate record
  notes             TEXT
);

-- Your actual itinerary: which cities, when, how long, what tier
CREATE TABLE itinerary_legs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id         TEXT NOT NULL REFERENCES cities(id),
  start_date      TEXT,                 -- ISO date, nullable for unplanned legs
  end_date        TEXT,
  nights          INTEGER NOT NULL,
  -- Tier selections (reference column suffixes in cities table)
  accom_tier      TEXT DEFAULT '2star', -- 'hostel', '1star', '2star', '3star', '4star'
  food_tier       TEXT DEFAULT 'mid',   -- 'street', 'budget', 'mid', 'high'
  drinks_tier     TEXT DEFAULT 'moderate', -- 'light', 'moderate', 'heavy'
  activities_tier TEXT DEFAULT 'mid',   -- 'free', 'budget', 'mid', 'high'
  -- Override any city default (in AUD per day for 2 people)
  accom_override      REAL,
  food_override       REAL,
  drinks_override     REAL,
  activities_override REAL,
  transport_override  REAL,
  -- Intercity travel cost to GET to this city (flights, buses, etc.)
  intercity_transport_cost REAL DEFAULT 0,
  intercity_transport_note TEXT,        -- e.g. 'VietJet flight HAN→SGN'
  split_pct           REAL DEFAULT 50,  -- your share as %, default 50/50
  sort_order      INTEGER,              -- manual ordering
  notes           TEXT,
  status          TEXT DEFAULT 'planned' -- 'planned', 'active', 'completed'
);

-- Actual expenses (from Wise CSV or manual entry)
-- ALL fields are fully editable post-import
CREATE TABLE expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,         -- ISO date
  amount          REAL NOT NULL,         -- in original currency
  currency        TEXT NOT NULL,
  amount_aud      REAL,                  -- converted amount
  category        TEXT NOT NULL,         -- 'accommodation', 'food', 'drinks',
                                         -- 'activities', 'transport_local',
                                         -- 'transport_intercity', 'shopping',
                                         -- 'health', 'comms', 'other'
  subcategory     TEXT,                  -- freeform: 'hostel', 'pho', 'grab', etc.
  description     TEXT,
  merchant        TEXT,                  -- from Wise data
  leg_id          INTEGER REFERENCES itinerary_legs(id),  -- link to itinerary
  source          TEXT DEFAULT 'manual', -- 'manual', 'wise_csv', 'wise_api'
  wise_txn_id     TEXT UNIQUE,           -- dedup on import
  logged_by       TEXT,                  -- 'you' or 'partner'
  is_excluded     INTEGER DEFAULT 0,     -- soft-delete: exclude from totals without removing
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Tags for expenses (many-to-many)
-- Lightweight tagging system for ad-hoc grouping and sum calculation
CREATE TABLE tags (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,  -- e.g. 'vietnam-transport', 'flights', 'splurge'
  color           TEXT                   -- hex color for UI display
);

CREATE TABLE expense_tags (
  expense_id      INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, tag_id)
);

-- Exchange rates cache
CREATE TABLE exchange_rates (
  date            TEXT NOT NULL,
  from_currency   TEXT NOT NULL,
  to_currency     TEXT DEFAULT 'AUD',
  rate            REAL NOT NULL,
  PRIMARY KEY (date, from_currency, to_currency)
);

-- One-off / fixed costs (visas, insurance, gear, flights home, etc.)
CREATE TABLE fixed_costs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  description     TEXT NOT NULL,
  amount_aud      REAL NOT NULL,
  category        TEXT,                  -- 'visa', 'insurance', 'flights', 'gear', 'other'
  country_id      TEXT REFERENCES countries(id),
  date            TEXT,
  is_paid         INTEGER DEFAULT 0,
  notes           TEXT
);
```

### 4.2 Key Design Decisions

**Granular tier system:** Each city stores 5 accommodation tiers (hostel → 4-star), 4 food tiers (street → high-end), 3 drinks tiers (light → heavy) plus individual drink unit prices, and 4 activity tiers (free → high). When you add a leg to your itinerary, you pick a tier per category. The estimate for that leg is: `(nights × daily_cost_at_tier) + intercity_transport`. You can also override any value for a specific leg.

**Individual drink prices:** The drinks tiers are composed from unit prices (beer, wine, cocktail). This lets you see "a beer in Hanoi costs ~$1.50 AUD" and reason about daily spend. The composed tiers (light/moderate/heavy) are pre-calculated defaults but can be overridden.

**Tagging system:** Tags are intentionally lightweight — a many-to-many join table with a tag name and colour. The purpose is ad-hoc grouping for quick sums (e.g., tag all transport-related expenses as "transport" to see a total), not comprehensive categorisation. This acknowledges that in cash-heavy Asia, most transactions won't be tagged. Tags complement rather than replace the main category field. The UI surfaces tag sums in a secondary panel — "view by tag" — not on the main dashboard.

**Full expense editability:** Every field on every expense is editable, including Wise-imported ones. You can change the category, amount, date, description, tags, or leg assignment. You can also soft-delete (exclude from totals) without removing the record.

**AUD normalisation:** All estimates are stored in AUD. Actual expenses store both original currency and AUD (converted at the daily rate). This means totals and comparisons are always apples-to-apples.

**Leg-expense linking:** Each expense can be linked to an itinerary leg. This is what powers the planned-vs-actual comparison. Auto-linking by date range is the default; manual reassignment is available.

---

## 5. Feature Specification

### 5.1 Planning Mode

**Itinerary Builder**
- List of legs in order, each showing city, dates, nights, selected tiers
- Drag-and-drop reordering (or sort_order arrows on mobile)
- Add/remove/edit legs
- Per-leg tier selectors:
  - Accommodation: hostel / 1-star / 2-star / 3-star / 4-star
  - Food: street food / budget / mid-range / high-end
  - Drinks: light / moderate / heavy (with unit prices visible for reference)
  - Activities: free / budget / mid / high
- Per-leg override fields (collapsed by default, expand to fine-tune)
- Intercity transport cost per leg
- Running total updates in real-time as you adjust
- **"Estimate this city" button** — triggers LLM-powered cost estimation for any new city (see §5.5)

**Cost Estimation Panel**
- Total trip cost (sum of all legs + fixed costs)
- Breakdown by country
- Breakdown by category (accommodation, food, drinks, activities, transport, fixed)
- Monthly average burn rate
- "What if" mode: duplicate the itinerary, change tiers, compare totals

**Fixed Costs Manager**
- Visas, insurance, international flights, gear purchases
- Per-country or general
- Mark as paid/unpaid

### 5.2 Tracking Mode

**Quick Add Expense**
- Mobile-optimised form: amount, currency (auto-detect from current leg), category dropdown, optional description
- One-tap category buttons for the most common entries
- "Split" toggle for items shared with partner vs. individual
- Auto-links to current active leg by date
- Optional tag selector (type-ahead with existing tags, or create new)

**Expense List & Editor**
- Full list view with filters: by date range, category, leg, tag, source (manual/Wise)
- Every expense is fully editable: tap to open edit view
- Editable fields: date, amount, currency, category, subcategory, description, tags, leg assignment
- Bulk actions: multi-select → add tag, change category, exclude from totals
- Soft-delete (exclude) toggle: greys out the expense and removes from totals without deleting data
- Hard delete available via confirmation dialog

**Tagging**
- Tags are freeform text with optional colour (e.g., "flights" = blue, "splurge-meals" = red)
- Tag panel: select a tag → see all expenses with that tag + sum in AUD
- Useful for: totalling transport costs, tracking specific spending themes, flagging expenses to revisit
- Not a primary navigation — accessible from expense list filter and a dedicated "Tags" sub-tab
- Tags are additive (multiple per expense) and removable

**Wise CSV Import**
- Upload CSV file from Wise statement export
- Parser maps Wise columns to expense schema
- Auto-categorise based on merchant category codes (Wise provides these)
- Review screen: see all parsed transactions, adjust categories, add tags, confirm import
- Deduplication by Wise transaction ID
- Re-import safe: existing transactions are skipped, new ones added

**Wise API Import (stretch goal)**
- Personal token auth (stored encrypted in env)
- Australian-registered account: no PSD2 restriction, Balance Statement API is accessible via personal token
- API can pull transactions as JSON, CSV, or XLSX for any balance
- Polling: manual trigger ("Sync from Wise") rather than automatic
- CSV upload always remains the primary and guaranteed path regardless of API status

### 5.3 Dashboard

**Summary Cards (top of dashboard)**
- Total budget vs. total spent vs. projected total
- Days elapsed / days remaining
- Daily burn rate (last 7 days, last 30 days, trip average)
- Budget health indicator (on track / over / under)

**Planned vs. Actual Chart**
- Stacked bar chart: each country as a segment
- Two bars per country: planned (from tiers) and actual (from expenses)
- Colour-coded over/under

**Category Breakdown**
- Donut/pie chart of actual spend by category
- Compared to planned allocation

**Burn Rate Projection**
- Line chart: cumulative spend over time
- Projected line extending to trip end based on recent burn rate
- Budget ceiling line
- Confidence interval based on variance in daily spend (you'll appreciate this one)

**Country Comparison**
- Per-country daily average (actual) vs. estimate
- Helps calibrate future estimates

### 5.4 Mobile UX Priorities

The mobile UI is the primary interface while travelling. Design priorities:

1. **Quick Add is the hero screen** — accessible from a persistent bottom nav button. Must be completable in <10 seconds.
2. **Dashboard is swipeable cards** — summary at top, scroll for details. No tiny charts.
3. **Planning mode is secondary on mobile** — functional but the main planning work happens on desktop.
4. **Offline tolerance** — queue manual entries in localStorage if offline, sync when back online. This matters in rural Laos and the Philippines.

### 5.5 City Cost Estimation Engine

When you add a new city, you need cost estimates across ~25 price points. The app provides a pluggable multi-source estimation system. Each source is a module that can be enabled/disabled via env vars.

#### Source 1: LLM Estimation (primary — provider-agnostic)

The app calls an LLM with a structured prompt to estimate all city costs. The prompt provides the city/country, the exact tier structure, few-shot reference prices from already-estimated cities, and instructions to return JSON with AUD prices for 2 people and reasoning.

**Provider abstraction:**

```typescript
// lib/llm-providers.ts
interface LLMProvider {
  name: string;
  estimate(city: string, country: string, referenceData: CityEstimate[]): Promise<CityEstimate>;
}

// Implementations:
// - AnthropicProvider (claude-sonnet-4-20250514) — ~$0.01-0.03 AUD/call
// - OpenAIProvider (gpt-4o-mini or gpt-4o) — ~$0.01-0.05 AUD/call
// - GoogleProvider (gemini-2.0-flash) — free tier available
// - OllamaProvider (local model) — free, runs on your VPS if you have the VRAM

// Selected via env var: LLM_PROVIDER=anthropic|openai|google|ollama
// API key via: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_KEY, OLLAMA_URL
```

All providers receive the same structured prompt and are expected to return the same JSON schema. The prompt includes:
- The exact tier structure (hostel/1-star/2-star/3-star/4-star, etc.)
- 2-3 reference cities with known prices for calibration
- Instruction to return reasoning alongside prices
- `currency: "AUD"` and `people: 2` as constraints

**Cost per estimation:** Anthropic/OpenAI ~$0.01-0.05 AUD, Google Gemini Flash has a free tier, Ollama is free (local).

#### Source 2: Numbeo API (optional enrichment — paid)

Numbeo's `city_prices` endpoint returns crowdsourced per-item prices. Relevant item mappings:

| Numbeo Item | item_id | Maps to |
|---|---|---|
| Meal, Inexpensive Restaurant | 1 | food_budget (÷2, then ×3 meals ×2 ppl) |
| Meal for 2, Mid-range Restaurant | 2 | food_mid (partial — one meal of the day) |
| Domestic Beer (0.5l draught) | 4 | drink_local_beer |
| Imported Beer (0.33l bottle) | 5 | drink_import_beer |
| Cappuccino (regular) | 114 | drink_coffee |
| One-way Ticket (Local Transport) | 20 | transport_local (×2 ppl ×2 trips) |
| Apartment (1 bedroom) City Centre | 26 | rough proxy for accommodation tiers |

**What Numbeo does NOT cover:** hostel prices, hotel star tiers, street food, cocktails, wine, activity costs. It covers ~30% of your tier matrix — useful for grounding, not as a standalone source.

**Requires paid API key** (`NUMBEO_API_KEY` env var). If not configured, this source is simply skipped.

#### Source 3: Xotelo Hotel Price API (free — real-time accommodation data)

Xotelo pulls real hotel/hostel prices from TripAdvisor listings. Free, JSON, no auth required.

```
GET https://data.xotelo.com/api/list?location_key=LOCATION_KEY&limit=30
```

Returns properties with `price_ranges.minimum` and `price_ranges.maximum`, `accommodation_type` (Hotel, Hostel, etc.), and star ratings. This can populate accommodation tiers with actual market data.

**Limitation:** Prices are real-time (date-specific), so the app queries a representative near-future date range and averages. Results vary by season and availability.

**Implementation:** Query the location, bucket results by type/star rating, compute median prices per bucket → map to `accom_hostel`, `accom_1star`, etc.

#### Source 4: Own Historical Data (self-calibrating — free)

Once you've visited a few cities, your actual expenses become calibration data. The app can:
- Auto-compute what you *actually* spent per day in each category for completed legs
- Offer "estimate based on similar completed cities" (e.g., "Phnom Penh is similar to HCMC but ~15% cheaper")
- Show planned vs. actual delta to indicate estimation accuracy

This gets better over time and is the most trustworthy source for your specific travel style.

#### Source 5: Manual Entry (always available)

Every field is always manually editable. You can add a city with all zeroes and fill in from personal research, Reddit, travel blogs, or asking other travellers.

#### Estimation Orchestration

When you hit "Estimate this city":

```typescript
// POST /api/cities/estimate
// Request: { cityName: "Hanoi", country: "Vietnam", sources: ["llm", "numbeo", "xotelo"] }

async function estimateCity(city: string, country: string, sources: string[]) {
  const results: Partial<CityEstimate>[] = [];

  // 1. LLM provides full coverage (all 25+ fields)
  if (sources.includes('llm')) {
    results.push(await llmProvider.estimate(city, country, getReferenceData()));
  }

  // 2. Numbeo provides ground-truth for items it covers
  if (sources.includes('numbeo') && process.env.NUMBEO_API_KEY) {
    results.push(await numbeoClient.getCityPrices(city, country));
  }

  // 3. Xotelo provides real accommodation prices
  if (sources.includes('xotelo')) {
    results.push(await xoteloClient.getAccommodationPrices(city, country));
  }

  // 4. Merge: prefer Numbeo/Xotelo for fields they cover, LLM for the rest
  const merged = mergeEstimates(results, {
    priority: ['xotelo', 'numbeo', 'llm'],  // highest priority first per-field
  });

  // 5. Store with full provenance metadata
  return saveCityEstimate(city, country, merged);
}
```

The UI shows a "sources" badge per field: 🤖 LLM, 📊 Numbeo, 🏨 Xotelo, ✋ Manual, 📈 Historical. You can see where each number came from and override any of them.

#### Estimation Cache / History

Every estimation is stored with full metadata:

```sql
CREATE TABLE city_estimates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id         TEXT NOT NULL REFERENCES cities(id),
  estimated_at    TEXT NOT NULL,          -- ISO timestamp
  source          TEXT NOT NULL,          -- 'llm', 'numbeo', 'xotelo', 'manual', 'historical'
  llm_provider    TEXT,                   -- 'anthropic', 'openai', 'google', 'ollama' (if source=llm)
  llm_model       TEXT,                   -- 'claude-sonnet-4-20250514', 'gpt-4o-mini', etc.
  -- Full snapshot of estimated values at this point in time
  data_json       TEXT NOT NULL,          -- JSON blob of all estimated fields
  reasoning       TEXT,                   -- LLM's reasoning/citations (if applicable)
  confidence      TEXT,                   -- 'high', 'medium', 'low' (self-assessed by LLM)
  numbeo_items    TEXT,                   -- JSON of raw Numbeo item data (if used)
  xotelo_data     TEXT,                   -- JSON of raw Xotelo response (if used)
  is_active       INTEGER DEFAULT 1       -- 1 = current estimate, 0 = superseded
);
```

This gives you:
- Full audit trail of every estimation (when, how, what data)
- Ability to re-estimate and compare to previous values
- Raw source data preserved for debugging
- Historical tracking of price changes (e.g., re-estimate Tokyo in 3 months, compare)

When you re-estimate a city, the old estimate is marked `is_active = 0` and the new one becomes active. The cities table always reflects the active estimate's values (denormalised for query performance).

---

## 6. Seed Data Strategy

The app ships with pre-populated cost estimates for all cities on your initial itinerary:

1. **Your existing Vietnam spreadsheet** — daily USD estimates converted to AUD and mapped to the tier structure
2. **Batch LLM estimation** — all ~30 initial cities estimated in one batch during setup
3. **Xotelo enrichment** — real accommodation prices pulled for each city to ground the hotel tiers
4. **Manual calibration** — you review and adjust based on your actual experience in cities you've already visited

For any new city added mid-trip, the "Estimate this city" button runs the orchestration pipeline. You can also add a city with all-zero costs and fill in manually.

**Configuration (env vars):**
```
LLM_PROVIDER=anthropic          # or openai, google, ollama
ANTHROPIC_API_KEY=sk-...        # if using Anthropic
OPENAI_API_KEY=sk-...           # if using OpenAI
GOOGLE_AI_KEY=...               # if using Google
OLLAMA_URL=http://localhost:11434  # if using local model
NUMBEO_API_KEY=...              # optional, for Numbeo enrichment
```

---

## 7. Wise CSV Import Specification

Wise CSV exports typically include these columns:

```
TransferWise ID, Date, Amount, Currency, Description,
Payment Reference, Running Balance, Exchange From,
Exchange To, Buy Amount, Fee, Merchant, Category
```

**Parser requirements:**
- Map `Date` → `expenses.date`
- Map `Amount` (negative = debit) → `expenses.amount`
- Map `Currency` → `expenses.currency`
- Map `Merchant` → `expenses.merchant`
- Map `Category` → auto-suggest `expenses.category` (Wise categories like "Restaurants" → "food", "Transportation" → "transport_local", etc.)
- Map `TransferWise ID` → `expenses.wise_txn_id` for dedup
- Convert to AUD using `exchange_rates` table
- Filter: skip transfers between own accounts, currency conversions (internal), top-ups

**Category mapping (Wise → app):**

| Wise Category | App Category |
|---|---|
| Restaurants | food |
| Groceries | food |
| Bars & Nightlife | drinks |
| Entertainment | activities |
| Transport | transport_local |
| Flights | transport_intercity |
| Hotels & Accommodation | accommodation |
| Shopping | shopping |
| Health & Medical | health |
| Transfers (between own accounts) | SKIP |
| Currency Conversion | SKIP |
| *Other/Unknown* | other |

---

## 8. API Routes

```
GET    /api/countries              — list all countries + cities
POST   /api/countries              — add country
POST   /api/cities                 — add city with cost estimates
PUT    /api/cities/:id             — edit city cost estimates
POST   /api/cities/estimate        — LLM-powered cost estimation for a new city

GET    /api/itinerary              — full itinerary (ordered legs with computed costs)
POST   /api/itinerary/legs         — add leg
PUT    /api/itinerary/legs/:id     — update leg (tiers, dates, overrides)
DELETE /api/itinerary/legs/:id     — remove leg
PUT    /api/itinerary/reorder      — reorder legs

GET    /api/expenses?leg=&cat=&tag=&from=&to=  — list expenses (filterable)
POST   /api/expenses               — add expense (manual)
PUT    /api/expenses/:id           — edit expense (all fields editable)
DELETE /api/expenses/:id           — hard delete expense
PATCH  /api/expenses/:id/exclude   — toggle soft-delete (exclude from totals)
POST   /api/expenses/import/csv    — upload + parse Wise CSV
POST   /api/expenses/bulk          — bulk action (add tags, change category, etc.)

GET    /api/tags                   — list all tags with expense counts + sums
POST   /api/tags                   — create tag
PUT    /api/tags/:id               — edit tag (name, color)
DELETE /api/tags/:id               — delete tag (removes from all expenses)
GET    /api/tags/:id/expenses      — list expenses for a tag with sum
POST   /api/expenses/:id/tags      — add tags to expense
DELETE /api/expenses/:id/tags/:tagId — remove tag from expense

GET    /api/fixed-costs            — list fixed costs
POST   /api/fixed-costs            — add fixed cost
PUT    /api/fixed-costs/:id        — update
DELETE /api/fixed-costs/:id        — delete

GET    /api/dashboard/summary      — computed summary stats
GET    /api/dashboard/planned-vs-actual — per-country comparison data
GET    /api/dashboard/burn-rate    — time series + projection
GET    /api/rates/:currency/:date  — get/cache exchange rate
```

---

## 9. Deployment

### Docker Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data          # SQLite DB persists here
      - ./uploads:/app/uploads     # Wise CSV uploads
    environment:
      - APP_SECRET=your-shared-secret
      - DATABASE_URL=file:/app/data/travel.db
      # LLM estimation (required — pick one provider)
      - LLM_PROVIDER=anthropic         # anthropic|openai|google|ollama
      - ANTHROPIC_API_KEY=sk-...       # if LLM_PROVIDER=anthropic
      # - OPENAI_API_KEY=sk-...        # if LLM_PROVIDER=openai
      # - GOOGLE_AI_KEY=...            # if LLM_PROVIDER=google
      # - OLLAMA_URL=http://host.docker.internal:11434  # if LLM_PROVIDER=ollama
      # Optional data sources
      - NUMBEO_API_KEY=               # optional, for Numbeo enrichment
      - WISE_API_TOKEN=               # optional, for Wise API import
    restart: unless-stopped

  # Optional: nginx handled externally or via companion container
```

### Backup Strategy

```bash
# Cron job on VPS — daily backup of the SQLite file
0 3 * * * cp /path/to/data/travel.db /path/to/backups/travel_$(date +\%Y\%m\%d).db
```

SQLite's single-file nature makes this trivial. You could also push to a cloud storage bucket if you want off-site backup.

---

## 10. Build Phases

### Phase 1: Core Planning (Day 1–2)
- [ ] Project scaffold (Next.js + TypeScript + Tailwind + shadcn/ui + Drizzle)
- [ ] Database schema + migrations (including city_estimates table)
- [ ] LLM estimation engine with provider abstraction (Anthropic first, add others later)
- [ ] Xotelo hotel price integration (free, no auth)
- [ ] Estimation orchestrator (merge multi-source results)
- [ ] Seed data: batch-estimate all ~30 initial cities
- [ ] Itinerary builder UI (add/edit/remove/reorder legs)
- [ ] Granular tier selector per leg with real-time cost calculation
- [ ] Summary panel: total cost, per-country breakdown
- [ ] Responsive layout (mobile + desktop)

### Phase 2: Expense Tracking (Day 2–3)
- [ ] Quick-add expense form (mobile-optimised)
- [ ] Expense list view with filters (category, leg, date range)
- [ ] Full expense editor (all fields editable)
- [ ] Tagging system (create tags, add/remove from expenses, tag sums)
- [ ] Soft-delete / exclude from totals
- [ ] Wise CSV import + parser
- [ ] Auto-categorisation from Wise merchant data
- [ ] Exchange rate fetching + caching
- [ ] AUD conversion on import

### Phase 3: Dashboard & Comparison (Day 3–4)
- [ ] Summary cards (budget vs spent, burn rate, days remaining)
- [ ] Planned vs. actual bar chart by country
- [ ] Category breakdown chart
- [ ] Burn rate projection with confidence interval
- [ ] Country comparison table
- [ ] Tag sums panel

### Phase 4: Polish & Deploy (Day 4–5)
- [ ] Docker configuration
- [ ] Deploy to VPS
- [ ] TLS via Let's Encrypt / nginx config
- [ ] Offline queue for manual expenses
- [ ] Fixed costs manager
- [ ] Bulk actions on expenses
- [ ] Data export (full trip as CSV/JSON)
- [ ] Additional LLM providers (OpenAI, Google, Ollama)
- [ ] Historical self-calibration (estimate from own expense data)
- [ ] Wise API integration (stretch — AU account, no PSD2 restriction)
- [ ] Numbeo enrichment (stretch — if API key available)

---

## 11. Resolved Design Decisions

1. **Wise account:** Registered in Australia — no PSD2 restriction, so both API and CSV import are viable. **CSV upload is the primary and always-available path.** Wise API is a stretch-goal convenience layer on top, never required.

2. **Expense tracking:** Pooled as couple spending. No per-person tracking needed. Single expense pool, single total.

3. **Deployment:** VPS IP with self-signed cert initially. No domain name. Docker + nginx reverse proxy. Can add a domain + Let's Encrypt later if desired.

4. **Existing data:** There will be Wise CSV exports and possibly spreadsheet data from the Vietnam leg to import. The CSV importer must handle this cleanly as a "backfill" operation (importing historical data, not just current). The app should also support a one-time spreadsheet import for any manually tracked expenses.

5. **Cost splitting:** Default assumption is 50/50 even split between the two of you. Add a configurable split percentage per leg or per expense (e.g., 60/40 if one person pays more for accommodation on a specific leg). This is a secondary feature — most expenses will just be pooled at 50%.

6. **LLM provider:** Anthropic preferred (claude-sonnet-4-20250514). Build the provider abstraction from Day 1 but ship with Anthropic as the default. Add OpenAI/Google/Ollama in Phase 4.

---

## 12. Files to Generate in Claude Code

When you're ready to build, the Claude Code session should produce:

```
wanderledger/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout + nav
│   │   ├── page.tsx                  # Dashboard (home)
│   │   ├── plan/
│   │   │   └── page.tsx              # Itinerary builder
│   │   ├── track/
│   │   │   ├── page.tsx              # Expense list + editor
│   │   │   ├── add/page.tsx          # Quick-add form
│   │   │   ├── import/page.tsx       # CSV import
│   │   │   └── tags/page.tsx         # Tag management + sums
│   │   ├── settings/
│   │   │   ├── page.tsx              # Fixed costs, preferences
│   │   │   └── cities/page.tsx       # City cost editor + estimation
│   │   └── api/
│   │       ├── itinerary/
│   │       ├── expenses/
│   │       ├── tags/
│   │       ├── cities/
│   │       │   └── estimate/route.ts # Claude API city estimation
│   │       ├── dashboard/
│   │       ├── rates/
│   │       └── fixed-costs/
│   ├── components/
│   │   ├── ui/                       # shadcn components
│   │   ├── itinerary/
│   │   │   ├── LegCard.tsx
│   │   │   ├── TierSelector.tsx      # Granular tier dropdowns
│   │   │   └── CostSummary.tsx
│   │   ├── expenses/
│   │   │   ├── QuickAdd.tsx
│   │   │   ├── ExpenseList.tsx
│   │   │   ├── ExpenseEditor.tsx     # Full field editor
│   │   │   ├── TagSelector.tsx       # Type-ahead tag picker
│   │   │   ├── TagSummary.tsx        # Tag sums panel
│   │   │   ├── BulkActions.tsx
│   │   │   └── CsvImporter.tsx
│   │   ├── cities/
│   │   │   ├── CityEstimator.tsx     # LLM estimation UI
│   │   │   └── CostEditor.tsx        # Manual cost editing grid
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── PlannedVsActual.tsx
│   │   │   ├── BurnRateChart.tsx
│   │   │   └── CategoryBreakdown.tsx
│   │   └── layout/
│   │       ├── MobileNav.tsx
│   │       └── DesktopSidebar.tsx
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema (all tables)
│   │   ├── index.ts                  # DB connection
│   │   └── seed.ts                   # City cost data
│   ├── lib/
│   │   ├── wise-csv-parser.ts
│   │   ├── exchange-rates.ts
│   │   ├── cost-calculator.ts        # Tier → AUD daily cost logic
│   │   ├── estimation/
│   │   │   ├── orchestrator.ts       # Multi-source merge logic
│   │   │   ├── llm-provider.ts       # Provider interface + factory
│   │   │   ├── providers/
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── openai.ts
│   │   │   │   ├── google.ts
│   │   │   │   └── ollama.ts
│   │   │   ├── numbeo-client.ts      # Optional Numbeo API client
│   │   │   ├── xotelo-client.ts      # Free hotel price API client
│   │   │   ├── historical.ts         # Self-calibration from own expenses
│   │   │   └── prompt.ts             # Shared LLM prompt template
│   │   └── burn-rate.ts              # Projection math + CI
│   └── types/
│       └── index.ts
├── data/                             # SQLite DB (gitignored, volume-mounted)
└── seed-data/
    └── cities.json                   # Pre-populated cost estimates
```

---

*Spec version: 3.1 (final) — March 2026*
*All design decisions resolved. Ready for Claude Code execution.*
