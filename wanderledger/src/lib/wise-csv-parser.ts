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

// Wise category → app category mapping
const CATEGORY_MAP: Record<string, string> = {
  'Eating out': 'food',
  'Restaurants': 'food',
  'Groceries': 'food',
  'Food & Drink': 'food',
  'Bars & Nightlife': 'drinks',
  'Entertainment': 'activities',
  'Transport': 'transport_local',
  'Flights': 'transport_intercity',
  'Travel': 'transport_intercity',
  'Trips': 'transport_intercity',
  'Hotels & Accommodation': 'accommodation',
  'Accommodation': 'accommodation',
  'Shopping': 'shopping',
  'Health & Medical': 'health',
  'Health': 'health',
  'Bills': 'other',
  'General': 'other',
  'Services': 'other',
  'Cash': 'other',
  'Transfers': '_skip',
  'Currency Conversion': '_skip',
};

function mapCategory(wiseCategory: string): string {
  return CATEGORY_MAP[wiseCategory] || 'other';
}

export function parseWiseCsv(csvText: string): ParsedExpense[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  return result.data.map((row): ParsedExpense => {
    // Map actual Wise CSV columns
    const id = row['ID'] || row['TransferWise ID'] || '';
    const status = row['Status'] || '';
    const direction = row['Direction'] || '';
    const createdOn = row['Created on'] || row['Date'] || '';
    const sourceAmount = row['Source amount (after fees)'] || row['Amount'] || '0';
    const sourceCurrency = row['Source currency'] || row['Currency'] || '';
    const targetAmount = row['Target amount (after fees)'] || '';
    const targetCurrency = row['Target currency'] || '';
    const targetName = row['Target name'] || row['Merchant'] || '';
    const reference = row['Reference'] || row['Payment Reference'] || '';
    const wiseCategory = row['Category'] || '';
    const amount = parseFloat(sourceAmount) || 0;

    // Determine skip reasons
    let skip = false;
    let skipReason: string | undefined;

    // Skip non-completed
    if (status && status !== 'COMPLETED') {
      skip = true;
      skipReason = `Status: ${status}`;
    }
    // Skip incoming / neutral (top-ups, internal transfers)
    else if (direction === 'IN' || direction === 'NEUTRAL') {
      skip = true;
      skipReason = direction === 'NEUTRAL' ? 'Internal transfer' : 'Incoming payment';
    }
    // Skip category-based
    else {
      const mapped = mapCategory(wiseCategory);
      if (mapped === '_skip') {
        skip = true;
        skipReason = `Skipped category: ${wiseCategory}`;
      }
    }

    const mappedCategory = mapCategory(wiseCategory);

    // Use target amount + currency as the "spent" amount (what was actually paid to merchant)
    // Fall back to source amount + currency if target isn't available
    const spentAmount = parseFloat(targetAmount) || amount;
    const spentCurrency = targetCurrency || sourceCurrency;

    // Build description from target name and reference
    const description = reference || targetName || '';
    const merchant = targetName || '';

    // Parse date — "2026-04-03 23:31:48" → "2026-04-03"
    const date = createdOn ? createdOn.split(' ')[0] : '';

    return {
      date,
      amount: Math.abs(spentAmount),
      currency: spentCurrency,
      sourceAmount: Math.abs(amount),
      sourceCurrency: sourceCurrency,
      category: mappedCategory === '_skip' ? 'other' : mappedCategory,
      subcategory: wiseCategory,
      description,
      merchant,
      wiseTxnId: id,
      source: 'wise_csv',
      skip,
      skipReason,
    };
  });
}
