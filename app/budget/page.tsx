"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateBudget, BudgetResult } from "./actions";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import DonutProgress from "@/components/DonutProgress";
import BarChartMini from "@/components/BarChartMini";
import CategoryGrid from "@/components/CategoryGrid";
import categoriesData from "@/data/categories.json";
import { MONTHS } from "@/lib/budget/engine";

function Currency({ value }: { value: number }) {
  return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function BudgetPage() {
  const initial: BudgetResult = { subtotal: 0, perMonthTotals: {}, categories: [] };
  const [state, action, pending] = useActionState(calculateBudget, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<number | null>(null);

  const triggerCalc = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      if (formRef.current) formRef.current.requestSubmit();
    }, 250);
  }, []);

  useEffect(() => {
    // Perform initial calculation with default values
    triggerCalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthlyAvg = useMemo(() => {
    const totals = Object.values(state.perMonthTotals || {});
    if (!totals.length) return 0;
    return totals.reduce((a, b) => a + b, 0) / totals.length;
  }, [state.perMonthTotals]);

  const [rows, setRows] = useState(1);
  const [month, setMonth] = useState<typeof MONTHS[number]>("JANUARY");
  const catKeys = [
    { key: "rent", label: "Rent" },
    { key: "mortgage", label: "Mortgage" },
    { key: "councilTax", label: "Council Tax" },
    { key: "ee", label: "EE" },
    { key: "sky", label: "SKY" },
    { key: "electricity", label: "Electricity" },
    { key: "water", label: "Thames Water" },
  ] as const;

  type MonthMap = Record<(typeof MONTHS)[number], number>;
  type Values = Record<(typeof catKeys)[number]["key"], MonthMap>;
  const makeMonths = (n: number): MonthMap => MONTHS.reduce((acc, m) => { acc[m] = n; return acc; }, {} as MonthMap);
  const [values, setValues] = useState<Values>({
    rent: makeMonths(1110),
    mortgage: makeMonths(825),
    councilTax: makeMonths(170),
    ee: makeMonths(0),
    sky: makeMonths(0),
    electricity: makeMonths(0),
    water: makeMonths(0),
  });

  return (
    <div className="flex">
      <Sidebar />
      <div className="mx-auto w-full max-w-6xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Budget Dashboard</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Card title="Year Subtotal"><div className="mt-1 text-2xl font-semibold">£{(state.subtotal || 0).toLocaleString()}</div></Card>
          <Card title="Monthly Average"><div className="mt-1 text-2xl font-semibold">£{monthlyAvg.toFixed(0)}</div></Card>
          <Card title="Categories"><div className="mt-1 text-2xl font-semibold">{state.categories.length}</div></Card>
        </div>

        {/* Chart + Budget donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card title="Monthly totals">
            <BarChartMini
              data={MONTHS.map((m) => ({ label: m.slice(0, 3), value: state.perMonthTotals[m] || 0 }))}
            />
          </Card>
          <Card title="Budget">
            <div className="flex items-center justify-between">
              <DonutProgress value={state.subtotal || 0} max={(state.subtotal || 1)} />
              <div className="text-sm">
                <div className="font-medium">£{(state.subtotal || 0).toLocaleString()}</div>
                <div className="text-zinc-500">Spent</div>
                <div className="mt-2">£{(state.subtotal || 0).toLocaleString()} Monthly Limit</div>
                <div className="text-zinc-500">£0 Remaining</div>
              </div>
            </div>
          </Card>
          <Card title="Biggest expenses">
            <CategoryGrid
              items={state.categories.map((c) => {
                const matched = (categoriesData as any[]).find((x) => String(x.name).toLowerCase() === c.name.toLowerCase());
                return { name: c.name, amount: c.yearTotal, icon: matched?.icon };
              })}
            />
          </Card>
        </div>

        <form id="expenses" ref={formRef} action={action} className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <label className="col-span-2">
          <span className="block text-sm font-medium">Year Label</span>
          <input name="yearLabel" defaultValue="2026 - 2027" className="mt-1 w-full rounded border p-2" onInput={triggerCalc} />
        </label>

        <label>
          <span className="block text-sm font-medium">Rent (monthly)</span>
          <input name="rent" type="number" step="1" defaultValue={1110} className="mt-1 w-full rounded border p-2" onInput={triggerCalc} />
        </label>
        <label>
          <span className="block text-sm font-medium">Mortgage (monthly)</span>
          <input name="mortgage" type="number" step="1" defaultValue={825} className="mt-1 w-full rounded border p-2" onInput={triggerCalc} />
        </label>
        <label>
          <span className="block text-sm font-medium">Council Tax (monthly)</span>
          <input name="councilTax" type="number" step="1" defaultValue={170} className="mt-1 w-full rounded border p-2" onInput={triggerCalc} />
        </label>

        <div className="col-span-2 flex items-end gap-3">
          <div className="flex-1">
            <span className="block text-sm font-medium">Month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value as any)} className="mt-1 w-full rounded border p-2">
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-zinc-600">Editing values for selected month</div>
        </div>

        {catKeys.map((c) => (
          <label key={c.key} className="col-span-1">
            <span className="block text-sm font-medium">{c.label}</span>
            <input
              type="number"
              step="1"
              className="mt-1 w-full rounded border p-2"
              value={values[c.key][month]}
              onChange={(e) => {
                const v = Number(e.target.value || 0);
                setValues((prev) => ({ ...prev, [c.key]: { ...prev[c.key], [month]: v } }));
                triggerCalc();
              }}
            />
          </label>
        ))}

        {/* Hidden full 12-month payload for server action */}
        {catKeys.map((c) => (
          <div key={`hidden-${c.key}`} className="hidden">
            {MONTHS.map((m) => (
              <input key={m} name={`${c.key}[${m}]`} defaultValue={values[c.key][m]} />
            ))}
          </div>
        ))}

        <div className="col-span-2">
          <div className="mt-4 text-sm font-medium">Custom Expenses</div>
          <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input name="catName[]" placeholder="Name (e.g., Gym)" className="rounded border p-2" onInput={triggerCalc} />
                <input name="catAmount[]" type="number" step="1" placeholder="Monthly amount" className="rounded border p-2" onInput={triggerCalc} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded border px-3 py-1" onClick={() => setRows((r) => r + 1)}>+ Add Row</button>
            {rows > 1 && (
              <button type="button" className="rounded border px-3 py-1" onClick={() => setRows((r) => Math.max(1, r - 1))}>- Remove Row</button>
            )}
          </div>
        </div>

        <div className="col-span-2 text-sm text-zinc-600">{pending ? "Calculating…" : "Values update automatically."}</div>
      </form>

      <div className="mt-6" id="analysis">
        <h2 className="text-xl font-semibold">Results</h2>
        <div className="mt-2">Year Subtotal: <Currency value={state.subtotal || 0} /></div>

        {state.categories.length > 0 && (
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2 text-left">Category</th>
                <th className="border p-2 text-right">Year Total</th>
              </tr>
            </thead>
            <tbody>
              {state.categories.map((c) => (
                <tr key={c.name}>
                  <td className="border p-2">{c.name}</td>
                  <td className="border p-2 text-right"><Currency value={c.yearTotal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {Object.keys(state.perMonthTotals).length > 0 && (
          <table className="mt-4 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border p-2 text-left">Month</th>
                <th className="border p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(state.perMonthTotals).map(([m, v]) => (
                <tr key={m}>
                  <td className="border p-2">{m}</td>
                  <td className="border p-2 text-right"><Currency value={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
}
