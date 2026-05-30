import { useMemo } from "react";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import type { AppTranslationKey } from "@/lib/i18n";
import { normalizeAppLanguage, translateAppText } from "@/lib/i18n";

export function useAppTranslation(overrideLanguage?: string | null) {
  const { settings } = useBootstrapData();
  const language = normalizeAppLanguage(overrideLanguage ?? settings?.language);

  const t = useMemo(
    () => (key: AppTranslationKey, params?: Record<string, string | number>) => translateAppText(language, key, params),
    [language],
  );

  return { language, t };
}