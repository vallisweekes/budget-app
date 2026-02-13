import { DEFAULT_CURRENCY_CODE } from "@/lib/constants/money";
import { buildLocale, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "@/lib/constants/locales";

export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY_CODE,
  locale?: string,
  language?: string,
  country?: string
): string {
  // If explicit locale is provided, use it
  if (locale) {
    return value.toLocaleString(locale, { style: "currency", currency });
  }
  
  // Otherwise build locale from language and country
  const builtLocale = buildLocale(language ?? DEFAULT_LANGUAGE, country ?? DEFAULT_COUNTRY);
  return value.toLocaleString(builtLocale, { style: "currency", currency });
}
