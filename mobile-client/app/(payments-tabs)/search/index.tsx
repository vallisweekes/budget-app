import React, { useState } from "react";
import { Stack } from "expo-router";

import PaymentsScreen from "@/components/PaymentsScreen";

export default function PaymentsTabsSearchIndex() {
  const [query, setQuery] = useState("");

  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />
      <Stack.SearchBar
        placement="automatic"
        placeholder="Search"
        autoFocus
        onChangeText={(event) => setQuery(event.nativeEvent.text ?? "")}
      />
      <PaymentsScreen query={query} />
    </>
  );
}
