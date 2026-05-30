import React, { useId } from "react";
import { InputAccessoryView, Platform, TextInput, View } from "react-native";

import type { NumericInputProps } from "@/types";

export default function NumericInput({
  keyboardType = "number-pad",
  returnKeyType,
  onSubmitEditing,
  ...rest
}: NumericInputProps) {
  const hiddenAccessoryBaseId = useId().replace(/:/g, "");
  const usesNumericKeyboard = keyboardType === "decimal-pad" || keyboardType === "number-pad";
  const hiddenAccessoryId = Platform.OS === "ios" && usesNumericKeyboard
    ? `numeric-input-hidden-accessory-${hiddenAccessoryBaseId}`
    : undefined;

  return (
    <>
      <TextInput
        keyboardType={keyboardType}
        inputAccessoryViewID={hiddenAccessoryId}
        returnKeyType={usesNumericKeyboard ? undefined : returnKeyType}
        onSubmitEditing={usesNumericKeyboard ? undefined : onSubmitEditing}
        {...rest}
      />

      {hiddenAccessoryId ? (
        <InputAccessoryView nativeID={hiddenAccessoryId} backgroundColor="transparent">
          <View style={{ height: 1 }} />
        </InputAccessoryView>
      ) : null}
    </>
  );
}