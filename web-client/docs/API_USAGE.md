# API Usage Examples

Quick reference for using the database-backed APIs in your React components.

## Setup

All hooks are exported from the BFF API:

```typescript
import {
  // Categories
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  
  // Expenses
  useGetExpensesQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  
  // Income
  useGetIncomeQuery,
  useAddIncomeMutation,
  useUpdateIncomeMutation,
  useDeleteIncomeMutation,
  
  // Debts
  useGetDebtsQuery,
  useAddDebtMutation,
  useUpdateDebtMutation,
  useDeleteDebtMutation,
  useAddDebtPaymentMutation,
  
  // Goals
  useGetGoalsQuery,
  useAddGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
  
  // Settings
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} from '@/lib/redux/api/bffApi';
```

## Examples

### Expenses

```typescript
function ExpensesPage() {
  const { data: expenses, isLoading, error } = useGetExpensesQuery({
    month: 2,
    year: 2026
  });

  const [addExpense, { isLoading: isAdding }] = useAddExpenseMutation();
  const [updateExpense] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();

  const handleAdd = async () => {
    try {
      await addExpense({
        name: "New Expense",
        amount: 100,
        month: 2,
        year: 2026,
        categoryId: "some-category-id",
        paid: false
      }).unwrap();
      console.log("Expense added!");
    } catch (err) {
      console.error("Failed to add:", err);
    }
  };

  const handleUpdate = async (id: string) => {
    await updateExpense({
      id,
      name: "Updated Name",
      amount: 150,
      categoryId: "new-category-id"
    });
  };

  const handleDelete = async (id: string) => {
    await deleteExpense({ id });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading expenses</div>;

  return (
    <div>
      {expenses?.map(expense => (
        <div key={expense.id}>
          {expense.name}: ${expense.amount}
          <button onClick={() => handleUpdate(expense.id)}>Edit</button>
          <button onClick={() => handleDelete(expense.id)}>Delete</button>
        </div>
      ))}
      <button onClick={handleAdd} disabled={isAdding}>
        Add Expense
      </button>
    </div>
  );
}
```

### Analytics Overview (Income vs Expenses)

```typescript
type AnalyticsOverview = {
  year: number;
  budgetPlanId: string;
  months: Array<{
    monthKey: string;
    monthIndex: number; // 1-12
    incomeTotal: number;
    expenseTotal: number;
    expenseCount: number;
  }>;
  incomeGrandTotal: number;
  expenseGrandTotal: number;
};

async function loadOverview(year: number, budgetPlanId?: string) {
  const qp = new URLSearchParams();
  qp.set("year", String(year));
  if (budgetPlanId) qp.set("budgetPlanId", budgetPlanId);

  const res = await fetch(`/api/bff/analytics/overview?${qp.toString()}`);
  if (!res.ok) throw new Error("Failed to load analytics overview");
  return (await res.json()) as AnalyticsOverview;
}
```

### Categories

```typescript
function CategoriesPage() {
  const { data: categories } = useGetCategoriesQuery();
  const [addCategory] = useAddCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  return (
    <div>
      {categories?.map(category => (
        <div key={category.id} style={{ color: category.color }}>
          {category.icon} {category.name}
        </div>
      ))}
    </div>
  );
}
```

### Income

```typescript
function IncomePage() {
  // Get all income
  const { data: allIncome } = useGetIncomeQuery();
  
  // Or filter by month/year
  const { data: febIncome } = useGetIncomeQuery({ 
    month: 2, 
    year: 2026 
  });

  const [addIncome] = useAddIncomeMutation();

  const handleAdd = async () => {
    await addIncome({
      name: "Salary",
      amount: 5000,
      month: 2,
      year: 2026
    });
  };

  return <div>{/* Your UI */}</div>;
}
```

### Debts

```typescript
function DebtsPage() {
  const { data: debts } = useGetDebtsQuery();
  const [addDebt] = useAddDebtMutation();
  const [updateDebt] = useUpdateDebtMutation();
  const [addPayment] = useAddDebtPaymentMutation();

  const handleAddPayment = async (debtId: string) => {
    // This automatically updates the debt balance!
    await addPayment({
      debtId,
      amount: 100,
      paidAt: new Date().toISOString(),
      notes: "Monthly payment"
    });
  };

  return (
    <div>
      {debts?.map(debt => (
        <div key={debt.id}>
          <h3>{debt.name}</h3>
          <p>Balance: ${debt.currentBalance}</p>
          <p>Paid: ${debt.paidAmount}</p>
          
          {debt.payments?.map(payment => (
            <div key={payment.id}>
              ${payment.amount} on {new Date(payment.paidAt).toLocaleDateString()}
            </div>
          ))}
          
          <button onClick={() => handleAddPayment(debt.id)}>
            Add Payment
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Goals

```typescript
function GoalsPage() {
  const { data: goals } = useGetGoalsQuery();
  const [addGoal] = useAddGoalMutation();
  const [updateGoal] = useUpdateGoalMutation();
  const [deleteGoal] = useDeleteGoalMutation();

  const handleAdd = async () => {
    await addGoal({
      title: "Emergency Fund",
      type: "long_term",
      category: "emergency",
      description: "Build 6 months expenses",
      targetAmount: 30000,
      currentAmount: 0,
      targetYear: 2027
    });
  };

  const handleUpdateProgress = async (id: string, amount: number) => {
    await updateGoal({
      id,
      currentAmount: String(amount)
    });
  };

  return <div>{/* Your UI */}</div>;
}
```

### Settings

```typescript
function SettingsPage() {
  const { data: settings } = useGetSettingsQuery();
  const [updateSettings] = useUpdateSettingsMutation();

  const handleUpdate = async () => {
    await updateSettings({
      payDate: 15,
      monthlyAllowance: 500,
      budgetStrategy: "zeroBased"
    });
  };

  return (
    <div>
      <p>Pay Date: {settings?.payDate}</p>
      <p>Monthly Allowance: ${settings?.monthlyAllowance}</p>
      <p>Strategy: {settings?.budgetStrategy}</p>
    </div>
  );
}
```

## Auto-Refetching

Redux Toolkit Query automatically refetches data when:
- You navigate back to a component
- The window regains focus
- A mutation completes

You can also manually refetch:

```typescript
const { data, refetch } = useGetExpensesQuery({ month: 2, year: 2026 });

// Later...
await refetch();
```

## Error Handling

```typescript
const { data, error, isLoading, isError } = useGetExpensesQuery(args);

if (isLoading) return <Spinner />;
if (isError) {
  console.error(error);
  return <ErrorMessage />;
}
```

## Optimistic Updates

For instant UI feedback:

```typescript
const [updateExpense] = useUpdateExpenseMutation();

await updateExpense({
  id: "123",
  name: "Updated",
  amount: 200
}).unwrap(); // Use .unwrap() to handle errors
```

## Type Safety

All responses are fully typed:

```typescript
const { data } = useGetExpensesQuery(args);
// data is BffExpense[] | undefined

data?.forEach(expense => {
  // expense.id, expense.name, etc. are all typed
  console.log(expense.category?.name);
});
```
