import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import { currencySymbol } from "@/lib/formatting";
import { formatGroupedNumber, parseMoney, sanitizeMoneyDraft, truncateTail } from "@/lib/domain/moneyInput";
import { T } from "@/lib/theme";

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
