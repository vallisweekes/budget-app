"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OnboardingProfile = {
  mainGoal: "improve_savings" | "manage_debts" | "track_spending" | null;
  occupation: string | null;
  occupationOther: string | null;
  monthlySalary: string | number | null;
  expenseOneName: string | null;
  expenseOneAmount: string | number | null;
  expenseTwoName: string | null;
  expenseTwoAmount: string | number | null;
  hasAllowance: boolean | null;
  allowanceAmount: string | number | null;
  hasDebtsToManage: boolean | null;
  debtAmount: string | number | null;
  debtNotes: string | null;
};

type OnboardingPayload = {
  required: boolean;
  completed: boolean;
  profile: OnboardingProfile | null;
  occupations: readonly string[];
};

export default function OnboardingWizard({
  username,
  initial,
}: {
  username: string;
  initial: OnboardingPayload;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [mainGoal, setMainGoal] = useState<"improve_savings" | "manage_debts" | "track_spending">(
    (initial.profile?.mainGoal as "improve_savings" | "manage_debts" | "track_spending" | null) ?? "improve_savings"
  );
  const [occupation, setOccupation] = useState(initial.profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(initial.profile?.occupationOther ?? "");
  const [salary, setSalary] = useState(String(initial.profile?.monthlySalary ?? ""));
  const [expenseOneName, setExpenseOneName] = useState(initial.profile?.expenseOneName ?? "Rent");
  const [expenseOneAmount, setExpenseOneAmount] = useState(String(initial.profile?.expenseOneAmount ?? ""));
  const [expenseTwoName, setExpenseTwoName] = useState(initial.profile?.expenseTwoName ?? "Utilities");
  const [expenseTwoAmount, setExpenseTwoAmount] = useState(String(initial.profile?.expenseTwoAmount ?? ""));
  const [hasAllowance, setHasAllowance] = useState<boolean>(Boolean(initial.profile?.hasAllowance));
  const [allowanceAmount, setAllowanceAmount] = useState(String(initial.profile?.allowanceAmount ?? ""));
  const [hasDebts, setHasDebts] = useState<boolean>(Boolean(initial.profile?.hasDebtsToManage));
  const [debtAmount, setDebtAmount] = useState(String(initial.profile?.debtAmount ?? ""));
  const [debtNotes, setDebtNotes] = useState(initial.profile?.debtNotes ?? "");

  const goals = useMemo(
    () => [
      { id: "improve_savings" as const, label: "Improve savings" },
      { id: "manage_debts" as const, label: "Manage debts better" },
      { id: "track_spending" as const, label: "Keep general track of spending" },
    ],
    []
  );

  const payload = {
    mainGoal,
    occupation,
    occupationOther,
    monthlySalary: salary ? Number(salary) : null,
    expenseOneName,
    expenseOneAmount: expenseOneAmount ? Number(expenseOneAmount) : null,
    expenseTwoName,
    expenseTwoAmount: expenseTwoAmount ? Number(expenseTwoAmount) : null,
    hasAllowance,
    allowanceAmount: hasAllowance && allowanceAmount ? Number(allowanceAmount) : null,
    hasDebtsToManage: hasDebts,
    debtAmount: hasDebts && debtAmount ? Number(debtAmount) : null,
    debtNotes,
  };

  async function saveDraft() {
    await fetch("/api/bff/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await saveDraft();
      const completeRes = await fetch("/api/bff/onboarding", { method: "POST" });
      if (!completeRes.ok) throw new Error("Could not complete onboarding");
      const data = (await completeRes.json()) as { budgetPlanId?: string };
      if (!data.budgetPlanId) throw new Error("Budget plan was not created");
      router.replace(`/user=${encodeURIComponent(username)}/${encodeURIComponent(data.budgetPlanId)}/page=home`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete onboarding");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] px-4 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-widest text-slate-400">Welcome</p>
          <h1 className="mt-2 text-2xl font-bold">Thanks for coming on this journey</h1>
          <p className="mt-1 text-sm text-slate-300">Answer a few quick questions so we can build your first plan.</p>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        {step === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What is your main goal?</p>
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setMainGoal(g.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  mainGoal === g.id ? "border-purple-400 bg-purple-500/20" : "border-white/10 bg-slate-950/30"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What do you do for work?</p>
            <select
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
            >
              <option value="">Select occupation</option>
              {initial.occupations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {occupation === "Other" ? (
              <input
                value={occupationOther}
                onChange={(e) => setOccupationOther(e.target.value)}
                placeholder="Tell us your occupation"
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
              />
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What is your monthly salary?</p>
            <input
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 2500"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What 2 expenses do you pay every month without fail?</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={expenseOneName} onChange={(e) => setExpenseOneName(e.target.value)} placeholder="Expense 1" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <input value={expenseOneAmount} onChange={(e) => setExpenseOneAmount(e.target.value)} placeholder="Amount" inputMode="decimal" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <input value={expenseTwoName} onChange={(e) => setExpenseTwoName(e.target.value)} placeholder="Expense 2" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <input value={expenseTwoAmount} onChange={(e) => setExpenseTwoAmount(e.target.value)} placeholder="Amount" inputMode="decimal" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Do you give yourself any allowance?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasAllowance(true)} className={`rounded-lg border px-3 py-2 ${hasAllowance ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>Yes</button>
              <button type="button" onClick={() => setHasAllowance(false)} className={`rounded-lg border px-3 py-2 ${!hasAllowance ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>No</button>
            </div>
            {hasAllowance ? (
              <input
                value={allowanceAmount}
                onChange={(e) => setAllowanceAmount(e.target.value)}
                placeholder="Allowance amount"
                inputMode="decimal"
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
              />
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Any debts you want to manage?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasDebts(true)} className={`rounded-lg border px-3 py-2 ${hasDebts ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>Yes</button>
              <button type="button" onClick={() => setHasDebts(false)} className={`rounded-lg border px-3 py-2 ${!hasDebts ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>No</button>
            </div>
            {hasDebts ? (
              <>
                <input
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="Total debt amount"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                />
                <input
                  value={debtNotes}
                  onChange={(e) => setDebtNotes(e.target.value)}
                  placeholder="Debt note (optional)"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                />
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={async () => {
                await saveDraft();
                setStep((s) => Math.min(5, s + 1));
              }}
              disabled={busy}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "Creating your plan…" : "Finish and create my plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
