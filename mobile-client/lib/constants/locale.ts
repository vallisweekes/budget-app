export type LocalePresetOption = {
  countryCode: string;
  countryLabel: string;
  currencyCode: string;
  currencyLabel: string;
};

export type LanguageOption = {
  code: string;
  label: string;
  nativeLabel: string;
};

export const DEFAULT_COUNTRY = "GB";
export const DEFAULT_LANGUAGE = "en";

export const LOCALE_PRESET_OPTIONS: LocalePresetOption[] = [
  {
    countryCode: "GB",
    countryLabel: "United Kingdom",
    currencyCode: "GBP",
    currencyLabel: "British pound",
  },
  {
    countryCode: "US",
    countryLabel: "United States",
    currencyCode: "USD",
    currencyLabel: "US dollar",
  },
  {
    countryCode: "CA",
    countryLabel: "Canada",
    currencyCode: "CAD",
    currencyLabel: "Canadian dollar",
  },
  {
    countryCode: "TT",
    countryLabel: "Trinidad and Tobago",
    currencyCode: "TTD",
    currencyLabel: "Trinidad and Tobago dollar",
  },
  {
    countryCode: "AU",
    countryLabel: "Australia",
    currencyCode: "AUD",
    currencyLabel: "Australian dollar",
  },
  {
    countryCode: "NZ",
    countryLabel: "New Zealand",
    currencyCode: "NZD",
    currencyLabel: "New Zealand dollar",
  },
  {
    countryCode: "DE",
    countryLabel: "Germany",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "FR",
    countryLabel: "France",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "ES",
    countryLabel: "Spain",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "IT",
    countryLabel: "Italy",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "IE",
    countryLabel: "Ireland",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "NL",
    countryLabel: "Netherlands",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "PT",
    countryLabel: "Portugal",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "AT",
    countryLabel: "Austria",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "BE",
    countryLabel: "Belgium",
    currencyCode: "EUR",
    currencyLabel: "Euro",
  },
  {
    countryCode: "CH",
    countryLabel: "Switzerland",
    currencyCode: "CHF",
    currencyLabel: "Swiss franc",
  },
  {
    countryCode: "NG",
    countryLabel: "Nigeria",
    currencyCode: "NGN",
    currencyLabel: "Nigerian naira",
  },
  {
    countryCode: "ZA",
    countryLabel: "South Africa",
    currencyCode: "ZAR",
    currencyLabel: "South African rand",
  },
  {
    countryCode: "IN",
    countryLabel: "India",
    currencyCode: "INR",
    currencyLabel: "Indian rupee",
  },
  {
    countryCode: "JP",
    countryLabel: "Japan",
    currencyCode: "JPY",
    currencyLabel: "Japanese yen",
  },
  {
    countryCode: "SG",
    countryLabel: "Singapore",
    currencyCode: "SGD",
    currencyLabel: "Singapore dollar",
  },
];

export const SUPPORTED_LANGUAGE_OPTIONS = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "fr", label: "French", nativeLabel: "Francais" },
  { code: "es", label: "Spanish", nativeLabel: "Espanol" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
] as const satisfies readonly LanguageOption[];

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGE_OPTIONS[number]["code"];

const SUPPORTED_LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGE_OPTIONS.map((option) => option.code));

const COUNTRY_LANGUAGE_DEFAULTS: Partial<Record<string, SupportedLanguageCode>> = {
  GB: "en",
  DE: "de",
  AT: "de",
  CH: "de",
  FR: "fr",
  ES: "es",
  IT: "it",
};

export function isSupportedLanguageCode(language: string | null | undefined): language is SupportedLanguageCode {
  const normalizedLanguage = String(language ?? "").trim().toLowerCase();
  return Boolean(normalizedLanguage) && SUPPORTED_LANGUAGE_CODES.has(normalizedLanguage);
}

export function resolveDefaultLanguageForCountry(
  country: string | null | undefined,
  fallback: SupportedLanguageCode = DEFAULT_LANGUAGE,
): SupportedLanguageCode {
  const normalizedCountry = String(country ?? "").trim().toUpperCase();
  if (!normalizedCountry) return fallback;
  return COUNTRY_LANGUAGE_DEFAULTS[normalizedCountry] ?? fallback;
}

export function normalizeSupportedLanguage(
  language: string | null | undefined,
  fallback: SupportedLanguageCode = DEFAULT_LANGUAGE,
): SupportedLanguageCode {
  const normalizedLanguage = String(language ?? "").trim().toLowerCase();
  return isSupportedLanguageCode(normalizedLanguage) ? normalizedLanguage : fallback;
}

export function getCountryLabel(country: string | null | undefined): string | null {
  const normalizedCountry = String(country ?? "").trim().toUpperCase();
  if (!normalizedCountry) return null;
  return LOCALE_PRESET_OPTIONS.find((option) => option.countryCode === normalizedCountry)?.countryLabel ?? normalizedCountry;
}

export function getLanguageLabel(language: string | null | undefined, mode: "native" | "english" = "native"): string {
  const normalizedLanguage = normalizeSupportedLanguage(language);
  const option = SUPPORTED_LANGUAGE_OPTIONS.find((candidate) => candidate.code === normalizedLanguage);
  if (!option) return normalizedLanguage;
  return mode === "english" ? option.label : option.nativeLabel;
}

export function buildAppLocale(
  language: string | null | undefined = DEFAULT_LANGUAGE,
  country: string | null | undefined = DEFAULT_COUNTRY,
): string {
  const normalizedLanguage = normalizeSupportedLanguage(language, DEFAULT_LANGUAGE);
  const normalizedCountry = String(country ?? "").trim().toUpperCase() || DEFAULT_COUNTRY;
  return `${normalizedLanguage}-${normalizedCountry}`;
}