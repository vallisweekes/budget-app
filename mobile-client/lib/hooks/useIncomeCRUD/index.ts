import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { Alert, Keyboard } from "react-native";
import type { Income } from "@/lib/apiTypes";
import {
  getMobileApiErrorMessage,
  useCreateIncomeMutation,
  useDeleteIncomeMutation,
  useUpdateIncomeMutation,
} from "@/store/api";

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
  const [createIncome] = useCreateIncomeMutation();
  const [updateIncome] = useUpdateIncomeMutation();
  const [deleteIncomeMutation] = useDeleteIncomeMutation();
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

    const optimisticId = `temp-income-${Date.now()}`;
    if (setItems) {
      setItems((prev) => ([
        ...prev,
        {
          id: optimisticId,
          name,
          amount: String(amount),
          month,
          year,
          budgetPlanId,
        },
      ]));
    }

    try {
      setSaving(true);
      const created = await createIncome({
        name,
        amount,
        month,
        year,
        budgetPlanId,
        distributeMonths,
        distributeYears,
      }).unwrap();
      if (setItems) {
        const optimistic: Income = {
          id: String(created?.id ?? `${Date.now()}`),
          name: String(created?.name ?? name),
          amount: String(created?.amount ?? amount),
          month: Number(created?.month ?? month),
          year: Number(created?.year ?? year),
          budgetPlanId: String(created?.budgetPlanId ?? budgetPlanId),
        };
        setItems((prev) => {
          const withoutTemp = prev.filter((item) => item.id !== optimisticId);
          if (withoutTemp.some((item) => item.id === optimistic.id)) return withoutTemp;
          return [...withoutTemp, optimistic];
        });
      }
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
      void onReload().catch(() => {
        // Background refresh failed; optimistic/local state already updated.
      });
    } catch (err: unknown) {
      if (setItems) {
        setItems((prev) => prev.filter((item) => item.id !== optimisticId));
      }
      Alert.alert("Error", getMobileApiErrorMessage(err, "Could not add income"));
    } finally {
      setSaving(false);
    }
  }, [budgetPlanId, createIncome, distributeMonths, distributeYears, month, newAmount, newName, onMutationSuccess, onReload, setItems, year]);

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
      await updateIncome({
        id: editingId,
        changes: { name, amount },
      }).unwrap();
      onMutationSuccess?.({
        type: "edit",
        month,
        year,
      });
      void onReload().catch(() => {
        // Background refresh failed; optimistic/local state already updated.
      });
    } catch (err: unknown) {
      if (setItems && snapshot) {
        setItems((prev) => prev.map((i) => (i.id === snapshot!.id ? snapshot! : i)));
      }
      Alert.alert("Error", getMobileApiErrorMessage(err, "Could not update income"));
    } finally {
      setSaving(false);
    }
  }, [cancelEdit, editAmount, editName, editingId, month, onMutationSuccess, onReload, setItems, updateIncome, year]);

  const deleteIncome = useCallback(async (item: Income) => {
    let removedSnapshot: Income | null = null;
    if (setItems) {
      setItems((prev) => {
        const target = prev.find((row) => row.id === item.id) ?? null;
        removedSnapshot = target;
        return prev.filter((row) => row.id !== item.id);
      });
    }

    try {
      setDeletingId(item.id);
      await deleteIncomeMutation({ id: item.id }).unwrap();
      onMutationSuccess?.({
        type: "delete",
        month,
        year,
      });
      void onReload().catch(() => {
        // Background refresh failed; optimistic/local state already updated.
      });
    } catch (err: unknown) {
      if (setItems && removedSnapshot) {
        setItems((prev) => {
          if (prev.some((row) => row.id === removedSnapshot!.id)) return prev;
          return [...prev, removedSnapshot!];
        });
      }
      Alert.alert("Error", getMobileApiErrorMessage(err, "Could not delete"));
    } finally {
      setDeletingId(null);
    }
  }, [deleteIncomeMutation, month, onMutationSuccess, onReload, setItems, year]);

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
