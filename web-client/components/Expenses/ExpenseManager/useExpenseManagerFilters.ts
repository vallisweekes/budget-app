"use client";

import { useMemo, useState } from "react";
import type { ExpenseItem } from "@/types";
import type { ExpenseManagerProps, ExpenseStatusFilter } from "@/types/expenses-manager";

export type UseExpenseManagerFiltersResult = {
	searchQuery: string;
	setSearchQuery: (value: string) => void;
	statusFilter: ExpenseStatusFilter;
	setStatusFilter: (value: ExpenseStatusFilter) => void;
	minAmountFilter: number | null;
	setMinAmountFilter: (value: number | null) => void;

	collapsedCategories: Record<string, boolean>;
	toggleCategory: (categoryId: string) => void;

	categoryLookup: Record<string, ExpenseManagerProps["categories"][number]>;
	filteredExpenses: ExpenseItem[];
	uncategorized: ExpenseItem[];
	expensesByCategory: Record<string, ExpenseItem[]>;
};

export function useExpenseManagerFilters(args: {
	expenses: ExpenseItem[];
	categories: ExpenseManagerProps["categories"];
	initialOpenCategoryId?: string | null;
}): UseExpenseManagerFiltersResult {
	const { expenses, categories, initialOpenCategoryId } = args;

	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<ExpenseStatusFilter>("all");
	const [minAmountFilter, setMinAmountFilter] = useState<number | null>(null);
	const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
		const next: Record<string, boolean> = { uncategorized: true };
		if (initialOpenCategoryId === "uncategorized") {
			next.uncategorized = false;
		}
		if (initialOpenCategoryId && categories.some((c) => c.id === initialOpenCategoryId)) {
			next[initialOpenCategoryId] = false;
		}
		return next;
	});

	const toggleCategory = (categoryId: string) => {
		setCollapsedCategories((prev) => ({ ...prev, [categoryId]: !(prev[categoryId] ?? true) }));
	};

	const categoryLookup = useMemo(
		() =>
			categories.reduce(
				(acc, cat) => {
					acc[cat.id] = cat;
					return acc;
				},
				{} as Record<string, (typeof categories)[number]>
			),
		[categories]
	);

	const filteredExpenses = useMemo(() => {
		let result = expenses;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(expense) =>
					expense.name.toLowerCase().includes(query) ||
					expense.amount.toString().includes(query) ||
					(expense.categoryId && categoryLookup[expense.categoryId]?.name.toLowerCase().includes(query))
			);
		}

		if (statusFilter === "paid") result = result.filter((expense) => expense.paid);
		if (statusFilter === "unpaid") result = result.filter((expense) => !expense.paid);

		if (minAmountFilter != null) result = result.filter((expense) => expense.amount >= minAmountFilter);

		return result;
	}, [expenses, searchQuery, statusFilter, minAmountFilter, categoryLookup]);

	const uncategorized = useMemo(() => filteredExpenses.filter((e) => !e.categoryId), [filteredExpenses]);

	const expensesByCategory = useMemo(() => {
		const categorized = filteredExpenses.filter((e) => e.categoryId);
		return categorized.reduce((acc, e) => {
			if (!e.categoryId) return acc;
			if (!acc[e.categoryId]) acc[e.categoryId] = [];
			acc[e.categoryId].push(e);
			return acc;
		}, {} as Record<string, ExpenseItem[]>);
	}, [filteredExpenses]);

	return {
		searchQuery,
		setSearchQuery,
		statusFilter,
		setStatusFilter,
		minAmountFilter,
		setMinAmountFilter,
		collapsedCategories,
		toggleCategory,
		categoryLookup,
		filteredExpenses,
		uncategorized,
		expensesByCategory,
	};
}
