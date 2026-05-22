import { Redirect, useLocalSearchParams } from "expo-router";

export default function LoggedExpensesTabRoute() {
  const params = useLocalSearchParams();

  return <Redirect href={{ pathname: "/(tabs)/expenses/LoggedExpenses", params }} />;
}