import { useMemo } from "react";

export type ExpenseRow = {
  id: string;
  name: string;
  logoUrl?: string | null;
  dueAmount: number;
  isMissedPayment?: boolean;
};

export type DebtRow = {
  id: string;
  name: string;
  logoUrl?: string | null;
  dueAmount: number;
  isMissedPayment?: boolean;
};

export type PaymentsResponse = {
  budgetPlanId: string;
  year: number;
  month: number;
  expenses: ExpenseRow[];
  debts: DebtRow[];
};

export function usePaymentsSections(data: PaymentsResponse | null, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  const expenseRows: ExpenseRow[] = useMemo(() => {
    const rows = Array.isArray(data?.expenses) ? data.expenses : [];
    const out = rows
      .map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? "").trim(),
        logoUrl: typeof r.logoUrl === "string" ? r.logoUrl : null,
        dueAmount: Number(r.dueAmount ?? 0),
        isMissedPayment: r.isMissedPayment === true,
      }))
      .filter((r) => r.id && r.name)
      .filter((r) => (normalizedQuery ? r.name.toLowerCase().includes(normalizedQuery) : true));

    out.sort((a, b) => (Number.isFinite(b.dueAmount) ? b.dueAmount : 0) - (Number.isFinite(a.dueAmount) ? a.dueAmount : 0));
    return out;
  }, [data?.expenses, normalizedQuery]);

  const debtRows: DebtRow[] = useMemo(() => {
    const rows = Array.isArray(data?.debts) ? data.debts : [];
    const out = rows
      .map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? "").trim(),
        logoUrl: typeof r.logoUrl === "string" ? r.logoUrl : null,
        dueAmount: Number(r.dueAmount ?? 0),
        isMissedPayment: r.isMissedPayment === true,
      }))
      .filter((r) => r.id && r.name)
      .filter((r) => (normalizedQuery ? r.name.toLowerCase().includes(normalizedQuery) : true));

    out.sort((a, b) => (Number.isFinite(b.dueAmount) ? b.dueAmount : 0) - (Number.isFinite(a.dueAmount) ? a.dueAmount : 0));
    return out;
  }, [data?.debts, normalizedQuery]);

  const sections = useMemo(() => {
    const next: Array<{ title: string; data: Array<ExpenseRow | DebtRow> }> = [];
    if (expenseRows.length > 0) next.push({ title: "Expenses", data: expenseRows });
    if (debtRows.length > 0) next.push({ title: "Debts", data: debtRows });
    return next;
  }, [expenseRows, debtRows]);

  return {
    sections,
    expenseRows,
    debtRows,
  };
}
