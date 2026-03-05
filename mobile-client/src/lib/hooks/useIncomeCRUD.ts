import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { Alert, Keyboard } from "react-native";
import { apiFetch } from "@/lib/api";
import type { Income } from "@/lib/apiTypes";

type IncomeMutationMeta =
  | {
      type: "add";
      month: number;
      year: number;
      distributeMonths: boolean;
      distributeYears: boolean;
    }
  | {
      type: "edit" | "delete";
      month: number;
      year: number;
    };

interface Params {
  month: number;
  year: number;
  budgetPlanId: string;
  onReload: () => Promise<void>;
  onMutationSuccess?: (meta: IncomeMutationMeta) => void;
  /** Optional: enables optimistic updates for edits/adds. */
  setItems?: Dispatch<SetStateAction<Income[]>>;
}

export function useIncomeCRUD({ month, year, budgetPlanId, onReload, onMutationSuccess, setItems }: Params) {
  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [distributeMonths, setDistributeMonths] = useState(false);
  const [distributeYears, setDistributeYears] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    const amount = parseFloat(newAmount);
    if (!name) {
      Alert.alert("Missing name", "Please enter an income name.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount.");
      return;
    }
    try {
      setSaving(true);
      await apiFetch("/api/bff/income", {
        method: "POST",
        body: { name, amount, month, year, budgetPlanId, distributeMonths, distributeYears },
      });
      setNewName("");
      setNewAmount("");
      setDistributeMonths(false);
      setDistributeYears(false);
      setShowAddForm(false);
      Keyboard.dismiss();
      onMutationSuccess?.({
        type: "add",
        month,
        year,
        distributeMonths,
        distributeYears,
      });
      await onReload();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add income");
    } finally {
      setSaving(false);
    }
  }, [newName, newAmount, month, year, budgetPlanId, distributeMonths, distributeYears, onMutationSuccess, onReload]);

  const startEdit = useCallback((item: Income) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(parseFloat(item.amount ?? "0").toFixed(2));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditAmount("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const name = editName.trim();
    const amount = parseFloat(String(editAmount).replace(/,/g, ""));
    if (!name || isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid input", "Name and a valid amount are required.");
      return;
    }

    // Optimistic update: close immediately and update the list.
    // If the API call fails, revert the single item and show an error.
    let snapshot: Income | null = null;
    if (setItems) {
      setItems((prev) => {
        const existing = prev.find((i) => i.id === editingId) ?? null;
        snapshot = existing;
        return prev.map((i) =>
          i.id === editingId
            ? { ...i, name, amount: String(amount) }
            : i
        );
      });
    }

    cancelEdit();
    Keyboard.dismiss();
    try {
      setSaving(true);
      await apiFetch(`/api/bff/income/${editingId}`, {
        method: "PATCH",
        body: { name, amount },
      });
      onMutationSuccess?.({
        type: "edit",
        month,
        year,
      });
      await onReload();
    } catch (err: unknown) {
      if (setItems && snapshot) {
        setItems((prev) => prev.map((i) => (i.id === snapshot!.id ? snapshot! : i)));
      }
      Alert.alert("Error", err instanceof Error ? err.message : "Could not update income");
    } finally {
      setSaving(false);
    }
  }, [editingId, editName, editAmount, cancelEdit, month, onMutationSuccess, onReload, setItems, year]);

  const deleteIncome = useCallback(async (item: Income) => {
    try {
      setDeletingId(item.id);
      await apiFetch(`/api/bff/income/${item.id}`, { method: "DELETE" });
      onMutationSuccess?.({
        type: "delete",
        month,
        year,
      });
      await onReload();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeletingId(null);
    }
  }, [month, onMutationSuccess, onReload, year]);

  return {
    // Add form
    showAddForm,
    setShowAddForm,
    newName,
    setNewName,
    newAmount,
    setNewAmount,
    distributeMonths,
    setDistributeMonths,
    distributeYears,
    setDistributeYears,
    saving,
    handleAdd,
    // Edit
    editingId,
    editName,
    setEditName,
    editAmount,
    setEditAmount,
    startEdit,
    cancelEdit,
    handleSaveEdit,
    // Delete
    deleteIncome,
    deletingId,
  };
}
