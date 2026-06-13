import React, { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  setLoggedExpensesFooterSearchQuery,
  useLoggedExpensesFooterSearchQuery,
} from "@/lib/events/loggedExpensesFooterSearch";
import { T } from "@/lib/theme";
import { styles } from "./style";

export default function LoggedExpensesFooterSearch() {
  const query = useLoggedExpensesFooterSearchQuery();
  const inputRef = useRef<TextInput>(null);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.searchPill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Focus logged expenses search"
          hitSlop={8}
          onPress={() => inputRef.current?.focus()}
        >
          <Ionicons name="search" size={22} color={T.textDim} />
        </Pressable>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setLoggedExpensesFooterSearchQuery}
          placeholder="Search logged expenses"
          placeholderTextColor={T.textDim}
          returnKeyType="search"
          selectionColor={T.accent}
          style={styles.input}
        />
        {query.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear logged expenses search"
            hitSlop={8}
            onPress={() => setLoggedExpensesFooterSearchQuery("")}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color={T.textDim} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}