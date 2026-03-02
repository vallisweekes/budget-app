import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    <View style={[s.wrap, containerStyle, !editable && s.disabled]}>
      <View style={s.currencyBox}>
        <Text style={s.currencyText}>{sym}</Text>
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
        placeholderTextColor={placeholderTextColor ?? s.placeholder.color}
        style={[s.input, inputStyle]}
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

      <View style={s.rightBox}>
        {showClear ? (
          <Pressable
            onPress={() => {
              setDisplay("");
              onChangeValue("");
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear amount"
            style={({ pressed }) => [s.clearBtn, pressed && s.clearBtnPressed]}
          >
            <Ionicons name="close" size={13} color={s.clearIcon.color as string} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 40,
    height: 40,
  },
  disabled: { opacity: 0.6 },
  currencyBox: {
    width: 34,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.card,
    borderRightWidth: 1,
    borderRightColor: T.border,
  },
  currencyText: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  placeholder: {
    color: T.textMuted,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 0,
    height: 40,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  rightBox: {
    width: 28,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 2,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  clearBtnPressed: { opacity: 0.75 },
  clearIcon: {
    color: T.textDim,
  },
});
