import React, { useState } from "react";
import { Pressable } from "react-native";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import LoggedExpensesScreen from "@/components/LoggedExpensesScreen";
import { T } from "@/lib/theme";

export default function TabsSearchIndex() {
  const [query, setQuery] = useState("");
  const navigation = useNavigation();
  const route = useRoute();
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Search",
          headerLeft: () => (
            <Pressable
              onPress={() => {
                router.replace("/(tabs)/expenses/LoggedExpenses");
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to logged expenses"
              style={{ paddingRight: 6 }}
            >
              <Ionicons name="chevron-back" size={24} color={T.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.SearchBar
        placement="automatic"
        placeholder="Search logged expenses"
        autoFocus
        onChangeText={(event) => setQuery(event.nativeEvent.text ?? "")}
      />
      <LoggedExpensesScreen
        navigation={navigation as any}
        route={route as any}
        searchQueryOverride={query}
      />
    </>
  );
}
