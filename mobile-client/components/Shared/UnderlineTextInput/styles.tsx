import { StyleSheet } from "react-native";
import { flatInput, flatInputDisabled } from "@/lib/ui";

export const styles = StyleSheet.create({
  input: {
    ...flatInput,
  },
  disabled: {
    ...flatInputDisabled,
  },
});
