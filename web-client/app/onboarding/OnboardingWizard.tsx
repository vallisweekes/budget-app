"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, Receipt, Sparkles, TrendingUp, CheckCircle2 } from "lucide-react";

import MoneyInput from "@/components/Shared/MoneyInput";

type OnboardingProfile = {
  mainGoal: "improve_savings" | "manage_debts" | "track_spending" | "build_budget" | null;
  mainGoals?: Array<"improve_savings" | "manage_debts" | "track_spending" | "build_budget">;
  occupation: string | null;
  occupationOther: string | null;
  monthlySalary: string | number | null;
  expenseOneName: string | null;
  expenseOneAmount: string | number | null;
  expenseTwoName: string | null;
  expenseTwoAmount: string | number | null;
  expenseThreeName: string | null;
  expenseThreeAmount: string | number | null;
  expenseFourName: string | null;
  expenseFourAmount: string | number | null;
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
  const [settings, setSettings] = useState<{ currency: string; country: string; language: string }>({
    currency: "GBP",
    country: "GB",
    language: "en",
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/bff/settings", { signal: controller.signal });
        if (!res.ok) return;
        const body = (await res.json()) as any;
        const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "GBP";
        const country = typeof body?.country === "string" && body.country.trim() ? body.country.trim() : "GB";
        const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "en";
        setSettings({ currency, country, language });
      } catch {
        // ignore
      }
    })();
    return () => controller.abort();
  }, []);

  const initialGoals = useMemo(() => {
    const fromProfile = initial.profile?.mainGoals;
    const cleaned = Array.isArray(fromProfile) ? fromProfile.filter(Boolean) : [];
    if (cleaned.length) return Array.from(new Set(cleaned));
    const single = initial.profile?.mainGoal ?? null;
    return single ? [single] : [];
  }, [initial.profile?.mainGoal, initial.profile?.mainGoals]);

  const [mainGoals, setMainGoals] = useState<Array<"improve_savings" | "manage_debts" | "track_spending" | "build_budget">>(
    initialGoals.length ? initialGoals : ["improve_savings"]
  );
  const [occupation, setOccupation] = useState(initial.profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(initial.profile?.occupationOther ?? "");
  const [salary, setSalary] = useState(String(initial.profile?.monthlySalary ?? ""));
  const [expenseOneName, setExpenseOneName] = useState(initial.profile?.expenseOneName ?? "");
  const [expenseOneAmount, setExpenseOneAmount] = useState(String(initial.profile?.expenseOneAmount ?? ""));
  const [expenseTwoName, setExpenseTwoName] = useState(initial.profile?.expenseTwoName ?? "");
  const [expenseTwoAmount, setExpenseTwoAmount] = useState(String(initial.profile?.expenseTwoAmount ?? ""));
  const [expenseThreeName, setExpenseThreeName] = useState(initial.profile?.expenseThreeName ?? "");
  const [expenseThreeAmount, setExpenseThreeAmount] = useState(String(initial.profile?.expenseThreeAmount ?? ""));
  const [expenseFourName, setExpenseFourName] = useState(initial.profile?.expenseFourName ?? "");
  const [expenseFourAmount, setExpenseFourAmount] = useState(String(initial.profile?.expenseFourAmount ?? ""));
  const [hasAllowance, setHasAllowance] = useState<boolean>(Boolean(initial.profile?.hasAllowance));
  const [allowanceAmount, setAllowanceAmount] = useState(String(initial.profile?.allowanceAmount ?? ""));
  const [hasDebts, setHasDebts] = useState<boolean>(Boolean(initial.profile?.hasDebtsToManage));
  const [debtAmount, setDebtAmount] = useState(String(initial.profile?.debtAmount ?? ""));
  const [debtNotes, setDebtNotes] = useState(initial.profile?.debtNotes ?? "");

  const goals = useMemo(
    () => [
      { id: "build_budget" as const, label: "Set up my monthly budget", Icon: CalendarDays, iconClass: "text-amber-300" },
      { id: "track_spending" as const, label: "Keep an eye on my spending", Icon: Receipt, iconClass: "text-purple-300" },
      { id: "improve_savings" as const, label: "Build my savings", Icon: TrendingUp, iconClass: "text-emerald-300" },
      { id: "manage_debts" as const, label: "Get on top of my debts", Icon: CreditCard, iconClass: "text-rose-300" },
    ],
    []
  );

  const payload = {
    mainGoal: mainGoals[0] ?? null,
    mainGoals,
    occupation,
    occupationOther,
    monthlySalary: salary ? Number(salary) : null,
    expenseOneName,
    expenseOneAmount: expenseOneAmount ? Number(expenseOneAmount) : null,
    expenseTwoName,
    expenseTwoAmount: expenseTwoAmount ? Number(expenseTwoAmount) : null,
    expenseThreeName,
    expenseThreeAmount: expenseThreeAmount ? Number(expenseThreeAmount) : null,
    expenseFourName,
    expenseFourAmount: expenseFourAmount ? Number(expenseFourAmount) : null,
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
          <h1 className="mt-2 text-2xl font-bold">Welcome {username}</h1>
          <p className="mt-1 text-sm text-slate-300">Quick setup, then you’re in.</p>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        {step === 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <p>What do you want help with most right now?</p>
            </div>
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  setMainGoals((prev) => {
                    const has = prev.includes(g.id);
                    if (has) {
                      const next = prev.filter((x) => x !== g.id);
                      return next.length ? next : prev;
                    }
                    return [...prev, g.id];
                  })
                }
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  mainGoals.includes(g.id) ? "border-purple-300 bg-purple-500/20" : "border-white/10 bg-slate-950/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <g.Icon className={`h-4 w-4 ${g.iconClass}`} />
                    <span className="font-medium">{g.label}</span>
                  </div>
                  {mainGoals.includes(g.id) ? <CheckCircle2 className="h-4 w-4 text-white" /> : null}
                </div>
              </button>
            ))}
            <p className="text-xs text-slate-300">You can pick more than one.</p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What kind of work do you do?</p>
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
            <p className="text-sm text-slate-300">About how much do you bring in each month?</p>
            <MoneyInput
              value={salary}
              onChangeValue={setSalary}
              currencyCode={settings.currency}
              language={settings.language}
              country={settings.country}
              placeholder="0.00"
              className="w-full"
              ariaLabel="Monthly income"
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What are the 4 bills you pay every month?</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={expenseOneName} onChange={(e) => setExpenseOneName(e.target.value)} placeholder="Rent, mortgage" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <MoneyInput value={expenseOneAmount} onChangeValue={setExpenseOneAmount} currencyCode={settings.currency} language={settings.language} country={settings.country} placeholder="0.00" ariaLabel="Bill 1 amount" className="w-full" inputClassName="text-base" />
              <input value={expenseTwoName} onChange={(e) => setExpenseTwoName(e.target.value)} placeholder="Electricity, water" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <MoneyInput value={expenseTwoAmount} onChangeValue={setExpenseTwoAmount} currencyCode={settings.currency} language={settings.language} country={settings.country} placeholder="0.00" ariaLabel="Bill 2 amount" className="w-full" inputClassName="text-base" />
              <input value={expenseThreeName} onChange={(e) => setExpenseThreeName(e.target.value)} placeholder="Phone bill" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <MoneyInput value={expenseThreeAmount} onChangeValue={setExpenseThreeAmount} currencyCode={settings.currency} language={settings.language} country={settings.country} placeholder="0.00" ariaLabel="Bill 3 amount" className="w-full" inputClassName="text-base" />
              <input value={expenseFourName} onChange={(e) => setExpenseFourName(e.target.value)} placeholder="Subscription" className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2" />
              <MoneyInput value={expenseFourAmount} onChangeValue={setExpenseFourAmount} currencyCode={settings.currency} language={settings.language} country={settings.country} placeholder="0.00" ariaLabel="Bill 4 amount" className="w-full" inputClassName="text-base" />
            </div>

            <div className="rounded-xl border border-white/10 border-l-4 border-l-purple-400 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200">
              These are your regular monthly bills. If you know the company name, enter it (it helps keep things accurate).
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Do you set aside spending money for yourself?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasAllowance(true)} className={`rounded-lg border px-3 py-2 ${hasAllowance ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>Yes</button>
              <button type="button" onClick={() => setHasAllowance(false)} className={`rounded-lg border px-3 py-2 ${!hasAllowance ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>No</button>
            </div>
            {hasAllowance ? (
              <MoneyInput
                value={allowanceAmount}
                onChangeValue={setAllowanceAmount}
                currencyCode={settings.currency}
                language={settings.language}
                country={settings.country}
                placeholder="0.00"
                className="w-full"
                ariaLabel="Allowance amount"
              />
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Do you have any debts you want to pay down?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasDebts(true)} className={`rounded-lg border px-3 py-2 ${hasDebts ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>Yes</button>
              <button type="button" onClick={() => setHasDebts(false)} className={`rounded-lg border px-3 py-2 ${!hasDebts ? "border-purple-400 bg-purple-500/20" : "border-white/10"}`}>No</button>
            </div>
            {hasDebts ? (
              <>
                <MoneyInput
                  value={debtAmount}
                  onChangeValue={setDebtAmount}
                  currencyCode={settings.currency}
                  language={settings.language}
                  country={settings.country}
                  placeholder="0.00"
                  className="w-full"
                  ariaLabel="Debt amount"
                />
                <input
                  value={debtNotes}
                  onChange={(e) => setDebtNotes(e.target.value)}
                  placeholder="Any notes? (optional)"
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
