import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import type { MoneyInputProps } from "@/types";
import { currencySymbol } from "@/lib/formatting";
import { formatGroupedNumber, parseMoney, sanitizeMoneyDraft, truncateTail } from "@/lib/domain/moneyInput";

export default function MoneyInput({
  currency,
  value,
  onChangeValue,
  variant = "default",
  placeholder = "0.00",
  keyboardType = "decimal-pad",
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  placeholderTextColor,
  editable = true,
  ...rest
}: MoneyInputProps) {
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
  const isLight = variant === "light";
  const resolvedPlaceholderColor =
    placeholderTextColor ?? (isLight ? (styles.placeholderLight.color as string) : (styles.placeholder.color as string));

  return (
    <View style={[styles.wrap, isLight && styles.wrapLight, containerStyle, !editable && styles.disabled]}>
      <View style={[styles.currencyBox, isLight && styles.currencyBoxLight]}>
        <Text style={[styles.currencyText, isLight && styles.currencyTextLight]}>{sym}</Text>
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
        placeholderTextColor={resolvedPlaceholderColor}
        style={[styles.input, isLight && styles.inputLight, inputStyle]}
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

      <View style={[styles.rightBox, isLight && styles.rightBoxLight]}>
        {showClear ? (
          <Pressable
            onPress={() => {
              setDisplay("");
              onChangeValue("");
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear amount"
            style={({ pressed }) => [styles.clearBtn, isLight && styles.clearBtnLight, pressed && styles.clearBtnPressed]}
          >
            <Ionicons name="close" size={13} color={isLight ? (styles.clearIconLight.color as string) : (styles.clearIcon.color as string)} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
