export const SUPPORTED_CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  { code: "TTD", symbol: "$", name: "Trinidad and Tobago Dollar" },
  { code: "AUD", symbol: "$", name: "Australian Dollar" },
  { code: "NZD", symbol: "$", name: "New Zealand Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar" },
] as const;

export const SUPPORTED_COUNTRIES = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "IE", name: "Ireland" },
  { code: "NL", name: "Netherlands" },
  { code: "PT", name: "Portugal" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "it", name: "Italiano" },
] as const;

export const DEFAULT_COUNTRY = "GB";
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_CURRENCY = "GBP";

const EURO_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);

const COUNTRY_CURRENCY_OVERRIDES: Record<string, string> = {
  GB: "GBP",
  US: "USD",
  CA: "CAD",
  TT: "TTD",
  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  NG: "NGN",
  ZA: "ZAR",
  IN: "INR",
  JP: "JPY",
  SG: "SGD",
};

// Helper to build locale string from language and country
export function buildLocale(language: string = DEFAULT_LANGUAGE, country: string = DEFAULT_COUNTRY): string {
  return `${language}-${country}`;
}

// Helper to get currency symbol
export function getCurrencySymbol(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol ?? "£";
}

export function resolveCurrencyCodeForCountry(country: string | null | undefined, fallback: string = DEFAULT_CURRENCY): string {
  const normalized = String(country ?? "").trim().toUpperCase();
  if (!normalized) return fallback;
  if (COUNTRY_CURRENCY_OVERRIDES[normalized]) return COUNTRY_CURRENCY_OVERRIDES[normalized]!;
  if (EURO_COUNTRY_CODES.has(normalized)) return "EUR";
  return fallback;
}
