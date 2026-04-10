import Papa from 'papaparse';

export interface ParsedExpense {
  date: string;
  amount: number;
  currency: string;
  sourceAmount?: number;
  sourceCurrency?: string;
  category: string;
  subcategory: string;
  description: string;
  merchant: string;
  wiseTxnId: string;
  source: 'wise_csv';
  skip: boolean;
  skipReason?: string;
  amountAud?: number | null;
}

const CATEGORY_MAP: Record<string, string> = {
  'Eating out': 'food',
  Restaurants: 'food',
  Groceries: 'food',
  'Food & Drink': 'food',
  'Bars & Nightlife': 'drinks',
  Entertainment: 'activities',
  Transport: 'transport_local',
  Flights: 'transport_intercity',
  Travel: 'transport_intercity',
  Trips: 'transport_intercity',
  'Hotels & Accommodation': 'accommodation',
  Accommodation: 'accommodation',
  Shopping: 'shopping',
  'Health & Medical': 'health',
  Health: 'health',
  Bills: 'other',
  General: 'other',
  Services: 'other',
  Cash: 'other',
  Transfers: '_skip',
  'Currency Conversion': '_skip',
};

const ACCOMMODATION_KEYWORDS = [
  'booking.com',
  'booking',
  'hostel',
  'guesthouse',
  'guest house',
  'hotel',
  'resort',
  'inn',
  'villa',
  'homestay',
  'airbnb',
];

const INTERCITY_TRANSPORT_KEYWORDS = [
  '12go',
  'airasia',
  'vietjet',
  'airlines',
  'flight',
  'airport transfer',
  'railway',
  'trainline',
  'ferry',
  'trip.com',
];

const LOCAL_TRANSPORT_KEYWORDS = [
  'grab',
  'loca taxi',
  'taxi',
  'uber',
  'lyft',
  'metro',
  'subway',
  'bus',
  'tram',
  'caltex',
  'shell',
  'petrol',
  'fuel',
];

const DRINKS_KEYWORDS = [
  'bar',
  'pub',
  'brew',
  'beer',
  'cocktail',
  'wine',
];

const FOOD_KEYWORDS = [
  'cafe',
  'coffee',
  'restaurant',
  'dosa',
  'kitchen',
  'bbq',
  'burger',
  'pizza',
  'bakery',
  'food',
  'mart',
  'market',
  'grocery',
  'eatery',
];

const ACTIVITY_KEYWORDS = [
  'klook',
  'getyourguide',
  'museum',
  'temple',
  'park ticket',
  'tour',
  'enterprise',
  'ticket',
  'attraction',
];

function mapCategory(wiseCategory: string): string {
  return CATEGORY_MAP[wiseCategory] || 'other';
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: string | undefined): string {
  if (!value) return '';

  const trimmed = value.trim();
  const datePart = trimmed.split(/[ T]/)[0];
  if (!datePart) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  const match = datePart.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return datePart;
}

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferCategory(params: {
  explicitCategory?: string;
  description?: string;
  merchant?: string;
  detailsType?: string;
}): string {
  const mappedExplicit = params.explicitCategory ? mapCategory(params.explicitCategory) : '';
  if (mappedExplicit) {
    return mappedExplicit;
  }

  const detailsType = (params.detailsType || '').toUpperCase();
  if (detailsType === 'ACCRUAL_CHARGE') {
    return 'other';
  }

  const text = `${params.description || ''} ${params.merchant || ''}`.toLowerCase();

  if (containsKeyword(text, ACCOMMODATION_KEYWORDS)) return 'accommodation';
  if (containsKeyword(text, INTERCITY_TRANSPORT_KEYWORDS)) return 'transport_intercity';
  if (containsKeyword(text, LOCAL_TRANSPORT_KEYWORDS)) return 'transport_local';
  if (containsKeyword(text, DRINKS_KEYWORDS)) return 'drinks';
  if (containsKeyword(text, FOOD_KEYWORDS)) return 'food';
  if (containsKeyword(text, ACTIVITY_KEYWORDS)) return 'activities';

  return 'other';
}

function isBalanceStatementRow(row: Record<string, string>): boolean {
  return Boolean(row['TransferWise ID'] && row['Date Time'] && row['Transaction Type']);
}

function parseTransactionHistoryRow(row: Record<string, string>): ParsedExpense {
  const id = firstNonEmpty(row['ID'], row['TransferWise ID']);
  const status = firstNonEmpty(row['Status']);
  const direction = firstNonEmpty(row['Direction']).toUpperCase();
  const createdOn = firstNonEmpty(row['Created on'], row['Date']);
  const sourceAmount = firstNonEmpty(row['Source amount (after fees)'], row['Amount']);
  const sourceCurrency = firstNonEmpty(row['Source currency'], row['Currency']);
  const targetAmount = firstNonEmpty(row['Target amount (after fees)']);
  const targetCurrency = firstNonEmpty(row['Target currency']);
  const targetName = firstNonEmpty(row['Target name'], row['Merchant']);
  const reference = firstNonEmpty(row['Reference'], row['Payment Reference']);
  const wiseCategory = firstNonEmpty(row['Category']);
  const amount = Math.abs(parseNumber(sourceAmount));

  let skip = false;
  let skipReason: string | undefined;

  if (status && status !== 'COMPLETED') {
    skip = true;
    skipReason = `Status: ${status}`;
  } else if (direction === 'IN' || direction === 'NEUTRAL') {
    skip = true;
    skipReason = direction === 'NEUTRAL' ? 'Internal transfer' : 'Incoming payment';
  } else {
    const mapped = mapCategory(wiseCategory);
    if (mapped === '_skip') {
      skip = true;
      skipReason = `Skipped category: ${wiseCategory}`;
    }
  }

  const spentAmount = Math.abs(parseNumber(targetAmount)) || amount;
  const spentCurrency = firstNonEmpty(targetCurrency, sourceCurrency);
  const description = firstNonEmpty(reference, targetName);
  const merchant = targetName;
  const mappedCategory = inferCategory({
    explicitCategory: wiseCategory,
    description,
    merchant,
  });

  return {
    date: normalizeDate(createdOn),
    amount: spentAmount,
    currency: spentCurrency,
    sourceAmount: amount,
    sourceCurrency,
    category: mappedCategory === '_skip' ? 'other' : mappedCategory,
    subcategory: wiseCategory,
    description,
    merchant,
    wiseTxnId: id,
    source: 'wise_csv',
    skip,
    skipReason,
  };
}

function parseBalanceStatementRow(row: Record<string, string>): ParsedExpense {
  const id = firstNonEmpty(row['TransferWise ID']);
  const transactionType = firstNonEmpty(row['Transaction Type']).toUpperCase();
  const detailsType = firstNonEmpty(row['Transaction Details Type']).toUpperCase();
  const description = firstNonEmpty(row['Description'], row['Payment Reference'], row['Merchant'], row['Payee Name']);
  const merchant = firstNonEmpty(row['Merchant'], row['Payee Name']);
  const baseAmount = parseNumber(row['Amount']);
  const baseCurrency = firstNonEmpty(row['Currency']);
  const exchangedAmount = Math.abs(parseNumber(row['Exchange To Amount']));
  const exchangedCurrency = firstNonEmpty(row['Exchange To']);
  const sourceAmount = Math.abs(baseAmount);
  const sourceCurrency = baseCurrency;
  const amount = exchangedAmount || sourceAmount;
  const currency = firstNonEmpty(exchangedCurrency, baseCurrency);

  let skip = false;
  let skipReason: string | undefined;

  if (transactionType === 'CREDIT') {
    skip = true;
    skipReason = detailsType === 'CARD' ? 'Incoming card credit or refund' : `Credit transaction: ${detailsType || 'unknown'}`;
  } else if (detailsType === 'MONEY_ADDED' || detailsType === 'CONVERSION') {
    skip = true;
    skipReason = `Internal balance movement: ${detailsType}`;
  } else if (sourceAmount === 0) {
    skip = true;
    skipReason = 'Zero amount';
  }

  const category = inferCategory({
    description,
    merchant,
    detailsType,
  });

  return {
    date: normalizeDate(firstNonEmpty(row['Date Time'], row['Date'])),
    amount,
    currency,
    sourceAmount,
    sourceCurrency,
    category,
    subcategory: firstNonEmpty(detailsType, transactionType),
    description,
    merchant,
    wiseTxnId: id,
    source: 'wise_csv',
    skip,
    skipReason,
  };
}

export function parseWiseCsv(csvText: string): ParsedExpense[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  return result.data.map((row) => {
    if (isBalanceStatementRow(row)) {
      return parseBalanceStatementRow(row);
    }

    return parseTransactionHistoryRow(row);
  });
}
