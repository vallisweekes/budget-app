import { Redirect, useLocalSearchParams } from "expo-router";

export default function TabsSearchIndex() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: "/(tabs)/expenses/LoggedExpenses", params }} />;
}
