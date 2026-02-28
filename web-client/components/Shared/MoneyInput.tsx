"use client";

import { useEffect, useMemo, useState } from "react";

import { formatNumberPart, parseMoney, sanitizeMoneyDraft } from "@/lib/helpers/moneyInput";
import { getCurrencySymbol } from "@/lib/constants/locales";

type Props = {
  name?: string;
  id?: string;
  required?: boolean;
  currencyCode?: string;
  locale?: string;
  language?: string;
  country?: string;
  value: string;
  onChangeValue: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  ariaLabel?: string;
};

type SettingsPayload = { currency?: string | null; country?: string | null; language?: string | null };

let cachedSettings: { currency: string; country: string; language: string } | null = null;
let inflight: Promise<{ currency: string; country: string; language: string } | null> | null = null;

async function getCachedSettings(signal?: AbortSignal): Promise<{ currency: string; country: string; language: string } | null> {
  if (cachedSettings) return cachedSettings;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/bff/settings", { signal });
      if (!res.ok) return null;
      const body = (await res.json()) as SettingsPayload;
      const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "GBP";
      const country = typeof body?.country === "string" && body.country.trim() ? body.country.trim() : "GB";
      const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "en";
      cachedSettings = { currency, country, language };
      return cachedSettings;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export default function MoneyInput({
  name,
  id,
  required,
  currencyCode: currencyCodeProp,
  locale: localeProp,
  language: languageProp,
  country: countryProp,
  value,
  onChangeValue,
  placeholder = "0.00",
  disabled,
  className,
  inputClassName,
  autoFocus,
  inputMode = "decimal",
  ariaLabel,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState<{ currency: string; country: string; language: string } | null>(cachedSettings);

  useEffect(() => {
    if (currencyCodeProp && countryProp && languageProp) return;
    if (settings) return;

    const controller = new AbortController();
    void (async () => {
      const next = await getCachedSettings(controller.signal);
      if (next) setSettings(next);
    })();
    return () => controller.abort();
  }, [currencyCodeProp, countryProp, languageProp, settings]);

  const currencyCode = currencyCodeProp ?? settings?.currency ?? "GBP";
  const country = countryProp ?? settings?.country;
  const language = languageProp ?? settings?.language;
  const locale = localeProp;
  const symbol = useMemo(() => getCurrencySymbol(currencyCode), [currencyCode]);

  const hiddenValue = useMemo(() => {
    const parsed = parseMoney(value);
    return parsed == null ? "" : parsed.toFixed(2);
  }, [value]);

  const formatted = useMemo(() => {
    const parsed = parseMoney(value);
    if (parsed == null) return value ? sanitizeMoneyDraft(value) : "";
    return formatNumberPart(parsed, { currency: currencyCode, locale, language, country }).number;
  }, [value, currencyCode, locale, language, country]);

  const inputValue = focused ? draft : formatted;

  const showClear = !disabled && (value ?? "").trim().length > 0;

  return (
    <div
      className={
        "flex items-center overflow-hidden rounded-2xl border-2 border-white/10 bg-slate-950/30 " + (className ?? "")
      }
    >
      {name ? <input type="hidden" name={name} value={hiddenValue} disabled={disabled} /> : null}
      <div className="flex h-12 w-12 items-center justify-center border-r border-white/10 bg-slate-950/40 text-lg font-bold text-white">
        {symbol}
      </div>

      <input
        id={id}
        value={inputValue}
        onChange={(e) => {
          const nextRaw = sanitizeMoneyDraft(e.target.value);
          setDraft(nextRaw);
          onChangeValue(nextRaw);
        }}
        onFocus={() => {
          setFocused(true);
          setDraft(value || "");
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseMoney(draft);
          if (parsed == null) {
            onChangeValue(draft ? sanitizeMoneyDraft(draft) : "");
          } else {
            onChangeValue(parsed.toFixed(2));
          }
        }}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={
          "h-12 w-full bg-transparent px-3 text-lg font-semibold text-white placeholder:text-slate-500 focus:outline-none " +
          (inputClassName ?? "")
        }
      />

      <div className="flex h-12 w-12 items-center justify-center pr-2">
        {showClear ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onChangeValue("");
            }}
            aria-label="Clear amount"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/40 text-white"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
