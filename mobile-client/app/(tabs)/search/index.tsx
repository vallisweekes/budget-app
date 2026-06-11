import React, { useState } from "react";
import { Stack } from "expo-router";
import { useNavigation, useRoute } from "@react-navigation/native";

import LoggedExpensesScreen from "@/components/LoggedExpensesScreen";

export default function TabsSearchIndex() {
  const [query, setQuery] = useState("");
  const navigation = useNavigation();
  const route = useRoute();

  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />
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
