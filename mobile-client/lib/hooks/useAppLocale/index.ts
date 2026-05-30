import { useCallback, useMemo } from "react";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { buildAppLocale } from "@/lib/constants";
import { formatAppDate, translateExpenseCategoryName } from "@/lib/i18n";

function buildMonthNames(language: string | null | undefined, country: string | null | undefined, month: "short" | "long") {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const value = formatAppDate(new Date(2000, monthIndex, 1), {
      language,
      country,
      options: { month },
    });
    return month === "short" ? value.replace(/\.$/u, "") : value;
  });
}

export function useAppLocale() {
  const { settings } = useBootstrapData();
  const language = settings?.language ?? null;
  const country = settings?.country ?? null;

  const locale = useMemo(() => buildAppLocale(language, country), [country, language]);
  const monthNamesShort = useMemo(() => buildMonthNames(language, country, "short"), [country, language]);
  const monthNamesLong = useMemo(() => buildMonthNames(language, country, "long"), [country, language]);

  const formatDate = useCallback(
    (value: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      if (value == null || value === "") return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return formatAppDate(date, { language, country, options });
    },
    [country, language],
  );

  const translateCategoryName = useCallback(
    (name: string | null | undefined) => translateExpenseCategoryName(name, language),
    [language],
  );

  return {
    country,
    formatDate,
    language,
    locale,
    monthNamesLong,
    monthNamesShort,
    translateCategoryName,
  };
}