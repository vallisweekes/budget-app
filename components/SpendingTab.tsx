"use client";

import { useState, useTransition } from "react";
import { addSpendingAction, removeSpendingAction } from "@/lib/spending/actions";
import { useRouter } from "next/navigation";
import { ConfirmModal, SelectDropdown } from "@/components/Shared";

interface SpendingEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  month: string;
  source: "card" | "savings" | "allowance";
  sourceId?: string;
  potId?: string;
}

interface Pot {
	id: string;
	name: string;
}

interface Debt {
  id: string;
  name: string;
  type: "credit_card" | "store_card" | "loan" | "mortgage" | "high_purchase" | "other";
}

interface SpendingTabProps {
  budgetPlanId: string;
  month: string;
  debts: Debt[];
  spending: SpendingEntry[];
	pots: Pot[];
}

export default function SpendingTab({ budgetPlanId, month, debts, spending, pots }: SpendingTabProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] = useState<SpendingEntry | null>(null);
	const [source, setSource] = useState<"card" | "savings" | "allowance">("card");
	const [selectedPotId, setSelectedPotId] = useState<string>("");
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await addSpendingAction(formData);
      if (result?.error) {
        setError(result.message || result.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleRemoveClick = (entry: SpendingEntry) => {
    setEntryPendingDelete(entry);
  };

  const confirmRemove = () => {
    const entry = entryPendingDelete;
    if (!entry) return;
    startTransition(() => {
      removeSpendingAction(budgetPlanId, entry.id);
    });
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={entryPendingDelete != null}
        title="Delete spending entry?"
        description={
          entryPendingDelete
            ? `This will permanently delete \"${entryPendingDelete.description}\".`
            : undefined
        }
        tone="danger"
        confirmText="Delete"
        cancelText="Keep"
        isBusy={isPending}
        onClose={() => {
          if (!isPending) setEntryPendingDelete(null);
        }}
        onConfirm={() => {
          confirmRemove();
          setEntryPendingDelete(null);
        }}
      />
      <div className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">Log Unplanned Spending</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="budgetPlanId" value={budgetPlanId} />
          <input type="hidden" name="month" value={month} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-300 mb-1">Description</span>
              <input
                id="spending-description"
                type="text"
                name="description"
                required
                placeholder="What did you buy?"
                className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-300 mb-1">Amount</span>
              <input
                id="spending-amount"
                type="number"
                name="amount"
                step="0.01"
                required
                placeholder="Amount (£)"
                className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-500"
              />
            </label>
          </div>
          
          <div className="flex gap-4">
            <label htmlFor="spending-source" className="block flex-1">
              <span className="block text-sm font-medium text-slate-300 mb-1">Payment Source</span>
              <SelectDropdown
                id="spending-source"
                name="source"
                value={source}
                onValueChange={(v) => {
										setSource(v as "card" | "savings" | "allowance");
										setSelectedPotId("");
									}}
                options={[
                  { value: "card", label: "Card" },
                  { value: "savings", label: "Savings" },
                  { value: "allowance", label: "Allowance" },
                ]}
                buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
                menuClassName="rounded-xl"
              />
            </label>
            
            <label htmlFor="spending-sourceId" className="block flex-1">
              <span className="block text-sm font-medium text-slate-300 mb-1">Card</span>
              <SelectDropdown
                id="spending-sourceId"
                name="sourceId"
                placeholder="Select Card (if applicable)"
                options={debts
                  .filter((d) => d.type === "credit_card")
                  .map((card) => ({ value: card.id, label: card.name }))}
                buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
                menuClassName="rounded-xl"
              />
            </label>
          </div>

      {source === "allowance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-300 mb-1">Allowance Pot</span>
            <SelectDropdown
              name="potId"
              value={selectedPotId}
              onValueChange={(v) => setSelectedPotId(v)}
              placeholder={pots.length ? "Select a pot" : "Create your first pot"}
              options={[
                ...pots.map((p) => ({ value: p.id, label: p.name })),
                { value: "__new__", label: "+ New pot" },
              ]}
              buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
              menuClassName="rounded-xl"
            />
          </label>

          {selectedPotId === "__new__" && (
            <label className="block">
              <span className="block text-sm font-medium text-slate-300 mb-1">New pot name</span>
              <input
                name="newPotName"
                required
                placeholder="e.g., Jayda, Personal, Kids"
                className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-500"
              />
            </label>
          )}
        </div>
      )}
          
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            Add Spending
          </button>
        </form>
      </div>
      
      <div className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">Spending This Month</h2>
        <ul className="space-y-2">
          {spending.length === 0 && <li className="text-slate-400">No spending logged yet.</li>}
          {spending.map(entry => (
            <li key={entry.id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-3">
              <div>
                <div className="text-white font-medium">{entry.description}</div>
							<div className="text-xs text-slate-400">
								£{entry.amount.toLocaleString()} • {entry.source.charAt(0).toUpperCase() + entry.source.slice(1)}
								{entry.source === "allowance" && entry.potId
									? ` • ${pots.find((p) => p.id === entry.potId)?.name ?? "Pot"}`
									: ""}
							</div>
              </div>
              <button
                onClick={() => handleRemoveClick(entry)}
                disabled={isPending}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
