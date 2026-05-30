import React, { useEffect, useMemo, useRef, useState } from "react";
import { InputAccessoryView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import type { MoneyInputProps } from "@/types";
import { currencySymbol } from "@/lib/formatting";
import { formatGroupedNumber, parseMoney, sanitizeMoneyDraft, truncateTail } from "@/lib/domain/moneyInput";

export default function MoneyInput({
  currency,
  value,
  onChangeValue,
  variant = "underline",
  placeholder = "0.00",
  keyboardType = "decimal-pad",
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  placeholderTextColor,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  ...rest
}: MoneyInputProps) {
  const sym = useMemo(() => currencySymbol(currency), [currency]);
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState<string>(value ? value : "");
  const hiddenAccessoryIdRef = useRef(`money-input-hidden-accessory-${Math.random().toString(36).slice(2)}`);
  const usesNumericKeyboard = keyboardType === "decimal-pad" || keyboardType === "number-pad";
  const shouldHideSystemAccessory = Platform.OS === "ios" && usesNumericKeyboard;
  const hiddenAccessoryId = shouldHideSystemAccessory ? hiddenAccessoryIdRef.current : undefined;

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

    setDisplay(truncateTail(formatGroupedNumber(parsed, currency)));
  }, [currency, value, focused]);

  const showClear = editable && (value ?? "").trim().length > 0;
  const isLight = variant === "light";
  const isSheet = variant === "sheet";
  const isUnderline = variant === "underline";
  const resolvedPlaceholderColor =
    placeholderTextColor ?? (isLight
      ? (styles.placeholderLight.color as string)
      : isSheet
        ? (styles.placeholderSheet.color as string)
        : isUnderline
          ? (styles.placeholderUnderline.color as string)
        : (styles.placeholder.color as string));

  return (
    <View style={[styles.wrap, isLight && styles.wrapLight, isSheet && styles.wrapSheet, isUnderline && styles.wrapUnderline, containerStyle, !editable && styles.disabled]}>
      <View style={[styles.currencyBox, isLight && styles.currencyBoxLight, isSheet && styles.currencyBoxSheet, isUnderline && styles.currencyBoxUnderline]}>
        <Text style={[styles.currencyText, isLight && styles.currencyTextLight, isSheet && styles.currencyTextSheet, isUnderline && styles.currencyTextUnderline]}>{sym}</Text>
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
        style={[styles.input, isLight && styles.inputLight, isSheet && styles.inputSheet, isUnderline && styles.inputUnderline, inputStyle]}
        editable={editable}
        inputAccessoryViewID={hiddenAccessoryId}
        returnKeyType={usesNumericKeyboard ? undefined : returnKeyType}
        onSubmitEditing={usesNumericKeyboard ? undefined : onSubmitEditing}
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

      <View style={[styles.rightBox, isLight && styles.rightBoxLight, isSheet && styles.rightBoxSheet, isUnderline && styles.rightBoxUnderline]}>
        {showClear ? (
          <Pressable
            onPress={() => {
              setDisplay("");
              onChangeValue("");
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear amount"
            style={({ pressed }) => [styles.clearBtn, isLight && styles.clearBtnLight, isSheet && styles.clearBtnSheet, isUnderline && styles.clearBtnUnderline, pressed && styles.clearBtnPressed]}
          >
            <Ionicons
              name="close"
              size={13}
              color={isLight
                ? (styles.clearIconLight.color as string)
                : isSheet
                  ? (styles.clearIconSheet.color as string)
                  : isUnderline
                    ? (styles.clearIconUnderline.color as string)
                  : (styles.clearIcon.color as string)}
            />
          </Pressable>
        ) : null}
      </View>

      {hiddenAccessoryId ? (
        <InputAccessoryView nativeID={hiddenAccessoryId} backgroundColor="transparent">
          <View style={{ height: 1 }} />
        </InputAccessoryView>
      ) : null}
    </View>
  );
}
