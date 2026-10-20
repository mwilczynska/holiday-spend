export const DISPLAY_CURRENCIES = {
  AUD: 'Australian Dollar', USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', NZD: 'New Zealand Dollar',
  CAD: 'Canadian Dollar', CHF: 'Swiss Franc', CNY: 'Chinese Yuan', JPY: 'Japanese Yen', MXN: 'Mexican Peso',
  BRL: 'Brazilian Real', CZK: 'Czech Koruna', DKK: 'Danish Krone', HKD: 'Hong Kong Dollar', HUF: 'Hungarian Forint',
  IDR: 'Indonesian Rupiah', ILS: 'Israeli Shekel', INR: 'Indian Rupee', ISK: 'Icelandic Krona', KRW: 'South Korean Won',
  MYR: 'Malaysian Ringgit', NOK: 'Norwegian Krone', PHP: 'Philippine Peso', PLN: 'Polish Zloty', RON: 'Romanian Leu',
  SEK: 'Swedish Krona', SGD: 'Singapore Dollar', THB: 'Thai Baht', TRY: 'Turkish Lira', ZAR: 'South African Rand',
} as const;
export type DisplayCurrency = keyof typeof DISPLAY_CURRENCIES;
export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && Object.hasOwn(DISPLAY_CURRENCIES, value);
}
export interface DisplayCurrencyState {
  currency: DisplayCurrency;
  /** Selected currency units per AUD. Null means unavailable, never parity. */
  rate: number | null;
  asOf: string | null;
  error: string | null;
}
export const DEFAULT_CURRENCY_STATE: DisplayCurrencyState = { currency: 'AUD', rate: 1, asOf: null, error: null };
export function validDisplayRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
const formatters = new Map<string, Intl.NumberFormat>();
export function formatDisplayMoney(amountAud: number, state: DisplayCurrencyState, digits = 0): string {
  if (!Number.isFinite(amountAud) || !validDisplayRate(state.rate) || !Number.isFinite(amountAud * state.rate)) return '—';
  const key = state.currency + ':' + digits;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: state.currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(key, formatter);
  }
  return formatter.format(amountAud * state.rate);
}
export function displayToAud(amount: number, rate: number | null): number {
  if (!Number.isFinite(amount) || !validDisplayRate(rate)) throw new Error('A current exchange rate is required.');
  const converted = amount / rate;
  if (!Number.isFinite(converted)) throw new Error('The converted amount is too large.');
  return converted;
}
export function parseCurrencyState(value: unknown): DisplayCurrencyState {
  const data = value as Partial<DisplayCurrencyState> | null;
  if (!data || !isDisplayCurrency(data.currency) || !(data.rate === null || validDisplayRate(data.rate))
    || !(data.asOf === null || (typeof data.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.asOf)
      && Number.isFinite(Date.parse(data.asOf)) && new Date(data.asOf).toISOString().slice(0, 10) === data.asOf))
    || !(data.error === null || typeof data.error === 'string') || (data.currency === 'AUD' && data.rate !== 1)
    || (data.currency !== 'AUD' && data.rate !== null && data.asOf === null)) throw new Error('The server returned invalid currency settings.');
  return data as DisplayCurrencyState;
}
