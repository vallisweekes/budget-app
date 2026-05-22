import { Redirect, useLocalSearchParams } from "expo-router";

export default function ExpensesRoute() {
  const params = useLocalSearchParams();

  return <Redirect href={{ pathname: "/(tabs)/expenses/ExpensesList", params }} />;
}