import { Redirect } from "expo-router";

export default function ExpensesRoute() {
  return <Redirect href="/(tabs)/expenses/ExpensesList" />;
}