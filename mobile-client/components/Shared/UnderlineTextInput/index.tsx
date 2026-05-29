import React from "react";
import { TextInput } from "react-native";

import type { UnderlineTextInputProps } from "@/types";
import { T } from "@/lib/theme";

import { styles } from "./styles";

const UnderlineTextInput = React.forwardRef<TextInput, UnderlineTextInputProps>(function UnderlineTextInput(
  {
    style,
    disabledStyle,
    placeholderTextColor = T.textMuted,
    selectionColor = T.accent,
    editable = true,
    ...rest
  },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      style={[styles.input, !editable && styles.disabled, !editable && disabledStyle, style]}
      placeholderTextColor={placeholderTextColor}
      selectionColor={selectionColor}
      editable={editable}
      {...rest}
    />
  );
});

export default UnderlineTextInput;
