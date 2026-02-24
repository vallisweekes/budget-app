import { useState, useCallback } from "react";
import { Alert, Keyboard } from "react-native";
import { apiFetch } from "@/lib/api";
import type { Income } from "@/lib/apiTypes";

interface Params {
  month: number;
  year: number;
  budgetPlanId: string;
  onReload: () => Promise<void>;
}

export function useIncomeCRUD({ month, year, budgetPlanId, onReload }: Params) {
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
      await onReload();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add income");
    } finally {
      setSaving(false);
    }
  }, [newName, newAmount, month, year, budgetPlanId, distributeMonths, distributeYears, onReload]);

  const startEdit = useCallback((item: Income) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(String(parseFloat(item.amount ?? "0")));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditAmount("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const name = editName.trim();
    const amount = parseFloat(editAmount);
    if (!name || isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid input", "Name and a valid amount are required.");
      return;
    }
    try {
      setSaving(true);
      await apiFetch(`/api/bff/income/${editingId}`, {
        method: "PATCH",
        body: { name, amount },
      });
      cancelEdit();
      Keyboard.dismiss();
      await onReload();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not update income");
    } finally {
      setSaving(false);
    }
  }, [editingId, editName, editAmount, cancelEdit, onReload]);

  const deleteIncome = useCallback(async (item: Income) => {
    try {
      setDeletingId(item.id);
      await apiFetch(`/api/bff/income/${item.id}`, { method: "DELETE" });
      await onReload();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeletingId(null);
    }
  }, [onReload]);

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
