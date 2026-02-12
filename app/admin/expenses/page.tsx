import { getAllExpenses } from "@/lib/expenses/store";
import { getCategories } from "@/lib/categories/store";
import ExpensesPageClient from "./ExpensesPageClient";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage() {
  const expenses = await getAllExpenses();
  const categories = await getCategories();
  
  return <ExpensesPageClient expenses={expenses} categories={categories} />;
}
