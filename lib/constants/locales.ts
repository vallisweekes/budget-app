export const SUPPORTED_CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
] as const;

export const SUPPORTED_COUNTRIES = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
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

// Helper to build locale string from language and country
export function buildLocale(language: string = DEFAULT_LANGUAGE, country: string = DEFAULT_COUNTRY): string {
  return `${language}-${country}`;
}

// Helper to get currency symbol
export function getCurrencySymbol(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol ?? "£";
}
