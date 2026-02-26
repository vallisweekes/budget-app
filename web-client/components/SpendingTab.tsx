"use client";

import { useState, useTransition } from "react";
import { addSpendingAction, removeSpendingAction } from "@/lib/spending/actions";
import { useRouter } from "next/navigation";
import { DeleteConfirmModal, SelectDropdown } from "@/components/Shared";
import SpendingEntriesList from "@/components/SpendingEntriesList";
import SpendingAllowancePotFields from "@/components/SpendingAllowancePotFields";

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
  type: "credit_card" | "store_card" | "loan" | "mortgage" | "hire_purchase" | "other";
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
      <DeleteConfirmModal
        open={entryPendingDelete != null}
        title="Delete spending entry?"
        description={
          entryPendingDelete
            ? `This will permanently delete \"${entryPendingDelete.description}\".`
            : undefined
        }
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
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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

      {source === "allowance" ? (
        <SpendingAllowancePotFields
          pots={pots}
          selectedPotId={selectedPotId}
          onSelectedPotIdChange={setSelectedPotId}
        />
      ) : null}
          
          <button
            type="submit"
            disabled={isPending}
            className="h-10 px-6 bg-[var(--cta)] text-white rounded-lg hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] transition-colors font-medium shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Add Spending
          </button>
        </form>
      </div>
      
      <div className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">Spending This Month</h2>
      <SpendingEntriesList spending={spending} pots={pots} isPending={isPending} onRemoveClick={handleRemoveClick} />
      </div>
    </div>
  );
}
