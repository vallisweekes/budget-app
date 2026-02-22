"use client";

import { useState, useTransition } from "react";
import { deleteCategory } from "./actions";
import { ConfirmModal } from "@/components/Shared";

interface DeleteCategoryButtonProps {
  categoryId: string;
  categoryName: string;
  hasExpenses: boolean;
  expenseCount: number;
}

export default function DeleteCategoryButton({ 
  categoryId, 
  categoryName, 
  hasExpenses, 
  expenseCount 
}: DeleteCategoryButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteClick = async () => {
    if (hasExpenses) {
      setError(`Cannot delete "${categoryName}" - it has ${expenseCount} expense${expenseCount !== 1 ? 's' : ''} linked to it.`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (!result.success && result.error) {
        setError(result.error);
        setTimeout(() => setError(null), 5000);
      }
    });
  };

  return (
    <div className="relative">
      <ConfirmModal
        open={confirmingDelete}
        title="Delete category?"
        description={`This will permanently delete \"${categoryName}\".`}
        tone="danger"
        confirmText="Delete"
        cancelText="Keep"
        isBusy={isPending}
        onClose={() => {
          if (!isPending) setConfirmingDelete(false);
        }}
        onConfirm={() => {
          confirmDelete();
          setConfirmingDelete(false);
        }}
      />
      <button
        onClick={handleDeleteClick}
        disabled={isPending}
        className={`p-2 rounded-lg transition-colors cursor-pointer ${
          hasExpenses 
            ? 'text-slate-500 hover:bg-slate-500/10 cursor-not-allowed' 
            : 'text-red-400 hover:bg-red-500/10'
        }`}
        title={hasExpenses 
          ? `Cannot delete - ${expenseCount} expense${expenseCount !== 1 ? 's' : ''} linked` 
          : "Delete category"
        }
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      
      {error && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm z-50 shadow-2xl backdrop-blur-sm">
          {error}
        </div>
      )}
    </div>
  );
}
