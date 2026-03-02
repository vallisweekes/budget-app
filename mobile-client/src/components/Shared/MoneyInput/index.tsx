import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import { currencySymbol } from "@/lib/formatting";
import { T } from "@/lib/theme";

function sanitizeMoneyDraft(text: string): string {
  // Keep digits and a single decimal point. Convert comma decimals to dot.
  const raw = String(text ?? "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");

  // Allow a single leading minus.
  const sign = raw.startsWith("-") ? "-" : "";
  const withoutSign = raw.replace(/\-/g, "");

  const parts = withoutSign.split(".");
  const intPart = (parts[0] ?? "").replace(/^0+(?=\d)/, "0");
  const decPart = parts.length > 1 ? (parts.slice(1).join("") ?? "") : "";
  return sign + intPart + (parts.length > 1 ? "." + decPart : "");
}

function parseMoney(text: string): number | null {
  const cleaned = sanitizeMoneyDraft(text);
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatGroupedNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncateTail(text: string, maxChars = 10): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

type Props = {
  currency?: string | null;
  value: string;
  onChangeValue: (next: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  containerStyle?: any;
  inputStyle?: any;
} & Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "keyboardType">;

export default function MoneyInput({
  currency,
  value,
  onChangeValue,
  placeholder = "0.00",
  keyboardType = "decimal-pad",
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  placeholderTextColor,
  editable = true,
  ...rest
}: Props) {
  const sym = useMemo(() => currencySymbol(currency), [currency]);
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState<string>(value ? value : "");

  useEffect(() => {
    if (focused) {
      setDisplay(value ?? "");
      return;
    }

    const parsed = parseMoney(value);
    if (parsed == null) {
      setDisplay(value ? sanitizeMoneyDraft(value) : "");
      return;
    }

    setDisplay(truncateTail(formatGroupedNumber(parsed)));
  }, [value, focused]);

  const showClear = editable && (value ?? "").trim().length > 0;

  return (
    <View style={[styles.wrap, containerStyle, !editable && styles.disabled]}>
      <View style={styles.currencyBox}>
        <Text style={styles.currencyText}>{sym}</Text>
      </View>

      <TextInput
        value={display}
        onChangeText={(t) => {
          const nextRaw = sanitizeMoneyDraft(t);
          setDisplay(nextRaw);
          onChangeValue(nextRaw);
        }}
        keyboardType={keyboardType}
        multiline={false}
        numberOfLines={1}
        allowFontScaling={false}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? styles.placeholder.color}
        style={[styles.input, inputStyle]}
        editable={editable}
        onFocus={(e) => {
          setFocused(true);
          setDisplay(value ?? "");
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          const parsed = parseMoney(value);
          if (parsed == null) {
            onChangeValue(value ? sanitizeMoneyDraft(value) : "");
          } else {
            onChangeValue(parsed.toFixed(2));
          }
          onBlur?.(e);
        }}
        {...rest}
      />

      <View style={styles.rightBox}>
        {showClear ? (
          <Pressable
            onPress={() => {
              setDisplay("");
              onChangeValue("");
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear amount"
            style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
          >
            <Ionicons name="close" size={13} color={styles.clearIcon.color as string} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
