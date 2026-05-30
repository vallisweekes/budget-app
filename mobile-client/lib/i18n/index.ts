import { buildAppLocale, DEFAULT_LANGUAGE, normalizeSupportedLanguage, type SupportedLanguageCode } from "@/lib/constants";

type TranslationParams = Record<string, string | number>;

const englishTranslations = {
  "common.cancel": "Cancel",
  "common.edit": "Edit",
  "common.save": "Save",
  "common.tryAgain": "Please try again.",
  "tabs.home": "Home",
  "tabs.expenses": "Expenses",
  "tabs.debts": "Debts",
  "tabs.income": "Income",
  "tabs.goals": "Goals",
  "tabs.logged": "Logged",
  "tabs.log": "Log",
  "tabs.projection": "Projection",
  "tabs.month": "Month",
  "tabs.year": "Year",
  "settings.locale.sectionTitle": "Locale",
  "settings.locale.countryLabel": "Locale",
  "settings.locale.languageLabel": "Language",
  "settings.locale.currencyLabel": "Currency",
  "settings.locale.detectedCountry": "Detected country: {country}",
  "settings.locale.unknownCountry": "Unknown",
  "settings.locale.useDetectedCountry": "Use detected country",
  "settings.locale.hint": "Changing locale updates the display symbol and money formatting across the app. It does not convert your saved balances.",
  "settings.locale.sheetTitle": "Regional settings",
  "settings.locale.sheetCountryPicker": "Country",
  "settings.locale.sheetLanguagePicker": "Language",
  "settings.locale.sheetPreview": "Display preview",
  "settings.locale.sheetCurrencyDerived": "Currency follows the selected country in this version.",
  "settings.locale.sheetPreviewLocale": "Locale",
  "settings.locale.sheetPreviewLanguage": "Language",
  "settings.locale.sheetPreviewCurrency": "Currency",
  "settings.locale.requiredTitle": "Locale required",
  "settings.locale.requiredMessage": "Please choose a country before saving.",
  "settings.locale.saveErrorTitle": "Could not save locale",
} as const;

export type AppTranslationKey = keyof typeof englishTranslations;

type TranslationDictionary = Partial<Record<AppTranslationKey, string>>;

// English is the canonical source of meaning; other languages override only the keys they translate.
const translationsByLanguage: Partial<Record<SupportedLanguageCode, TranslationDictionary>> = {
  de: {
    "common.cancel": "Abbrechen",
    "common.edit": "Bearbeiten",
    "common.save": "Speichern",
    "common.tryAgain": "Bitte versuche es erneut.",
    "tabs.home": "Start",
    "tabs.expenses": "Ausgaben",
    "tabs.debts": "Schulden",
    "tabs.income": "Einkommen",
    "tabs.goals": "Ziele",
    "tabs.logged": "Erfasst",
    "tabs.log": "Buchen",
    "tabs.projection": "Prognose",
    "tabs.month": "Monat",
    "tabs.year": "Jahr",
    "settings.locale.sectionTitle": "Sprache & Region",
    "settings.locale.countryLabel": "Land",
    "settings.locale.languageLabel": "Sprache",
    "settings.locale.currencyLabel": "Wahrung",
    "settings.locale.detectedCountry": "Erkanntes Land: {country}",
    "settings.locale.unknownCountry": "Unbekannt",
    "settings.locale.useDetectedCountry": "Erkanntes Land verwenden",
    "settings.locale.hint": "Eine Anderung der Region aktualisiert Symbol und Zahlenformat im ganzen App-Bereich. Bereits gespeicherte Betrage werden nicht umgerechnet.",
    "settings.locale.sheetTitle": "Regionale Einstellungen",
    "settings.locale.sheetCountryPicker": "Land",
    "settings.locale.sheetLanguagePicker": "Sprache",
    "settings.locale.sheetPreview": "Vorschau",
    "settings.locale.sheetCurrencyDerived": "Die Wahrung folgt in dieser Version dem ausgewahlten Land.",
    "settings.locale.sheetPreviewLocale": "Region",
    "settings.locale.sheetPreviewLanguage": "Sprache",
    "settings.locale.sheetPreviewCurrency": "Wahrung",
    "settings.locale.requiredTitle": "Region erforderlich",
    "settings.locale.requiredMessage": "Bitte wahle vor dem Speichern ein Land aus.",
    "settings.locale.saveErrorTitle": "Region konnte nicht gespeichert werden",
  },
};

const expenseCategoryTranslationsByLanguage: Partial<Record<SupportedLanguageCode, Record<string, string>>> = {
  de: {
    "business trip": "Geschaftsreise",
    carnival: "Karneval",
    childcare: "Kinderbetreuung",
    custom: "Individuell",
    entertainment: "Freizeit",
    "food & dining": "Essen & Trinken",
    holiday: "Urlaub",
    housing: "Wohnen",
    insurance: "Versicherung",
    investments: "Investitionen",
    "personal care": "Korperpflege",
    savings: "Ersparnisse",
    subscriptions: "Abonnements",
    transport: "Transport",
    utilities: "Nebenkosten",
    "fees & charges": "Gebuhren & Kosten",
    activities: "Aktivitaten",
    tours: "Touren",
    "spending money": "Taschengeld",
    accommodation: "Unterkunft",
    flights: "Fluge",
    rental: "Miete",
    costumes: "Kostume",
    "events tickets": "Eventtickets",
    "jouvert package": "Jouvert-Paket",
    "drinks and food": "Getranke und Essen",
    other: "Sonstiges",
  },
};

export function normalizeAppLanguage(language: string | null | undefined): SupportedLanguageCode {
  return normalizeSupportedLanguage(language, DEFAULT_LANGUAGE);
}

export function translateAppText(
  language: string | null | undefined,
  key: AppTranslationKey,
  params?: TranslationParams,
): string {
  const normalizedLanguage = normalizeAppLanguage(language);
  const template = translationsByLanguage[normalizedLanguage]?.[key] ?? englishTranslations[key] ?? key;

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(params[token] ?? `{${token}}`));
}

export function formatAppDate(
  date: Date,
  params?: {
    language?: string | null;
    country?: string | null;
    options?: Intl.DateTimeFormatOptions;
  },
): string {
  const locale = buildAppLocale(params?.language, params?.country);
  const options = params?.options ?? { day: "numeric", month: "short" };

  try {
    const parts = new Intl.DateTimeFormat(locale, options).formatToParts(date);
    const day = parts.find((part) => part.type === "day")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    if (day && month && options.day === "numeric" && options.month) {
      return `${day} ${month.replace(/\.$/u, "")}`;
    }
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }
}

export function translateExpenseCategoryName(
  name: string | null | undefined,
  language: string | null | undefined,
): string {
  const rawName = String(name ?? "").trim();
  if (!rawName) return rawName;
  const normalizedLanguage = normalizeAppLanguage(language);
  const normalizedName = rawName.toLowerCase();
  return expenseCategoryTranslationsByLanguage[normalizedLanguage]?.[normalizedName] ?? rawName;
}