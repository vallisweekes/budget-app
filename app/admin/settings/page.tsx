import { getSettings } from "../../../lib/settings/store";
import { getAllIncome } from "../../../lib/income/store";
import { MONTHS, MonthKey } from "../../../lib/budget/engine";
import { saveSettingsAction, addIncomeAction } from "./actions";
import Card from "../../../components/Card";
import IncomeManager from "./IncomeManager";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const income = await getAllIncome();
  const defaultMonth: MonthKey = "JANUARY";
  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400 text-lg">Manage your financial preferences and income sources</p>
        </div>

        {/* Quick Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Pay Date Card */}
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Pay Date</h2>
            </div>
            <form action={saveSettingsAction} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-400 mb-2 block">Day of Month</span>
                <input
                  name="payDate"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={settings.payDate}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
              >
                Save Pay Date
              </button>
            </form>
          </div>

          {/* Monthly Allowance Card */}
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Allowance</h2>
            </div>
            <form action={saveSettingsAction} className="space-y-4">
              <input type="hidden" name="payDate" value={settings.payDate} />
              <input type="hidden" name="savingsBalance" value={settings.savingsBalance || 0} />
              <label className="block">
                <span className="text-sm font-medium text-slate-400 mb-2 block">Monthly Amount (£)</span>
                <input
                  name="monthlyAllowance"
                  type="number"
                  step="0.01"
                  defaultValue={settings.monthlyAllowance || 0}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
              >
                Save Allowance
              </button>
            </form>
          </div>

          {/* Savings Balance Card */}
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Savings</h2>
            </div>
            <form action={saveSettingsAction} className="space-y-4">
              <input type="hidden" name="payDate" value={settings.payDate} />
              <input type="hidden" name="monthlyAllowance" value={settings.monthlyAllowance || 0} />
              <label className="block">
                <span className="text-sm font-medium text-slate-400 mb-2 block">Current Balance (£)</span>
                <input
                  name="savingsBalance"
                  type="number"
                  step="0.01"
                  defaultValue={settings.savingsBalance || 0}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
              >
                Save Balance
              </button>
            </form>
          </div>
        </div>

        {/* Income Management Section */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 mb-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Add Income</h2>
              <p className="text-slate-400 text-sm">Add a new income source for any month</p>
            </div>
          </div>
          <form action={addIncomeAction} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <label className="md:col-span-3">
              <span className="block text-sm font-medium text-slate-300 mb-2">Month</span>
              <select
                name="month"
                defaultValue={defaultMonth}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all cursor-pointer"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="md:col-span-5">
              <span className="block text-sm font-medium text-slate-300 mb-2">Income Name</span>
              <input
                name="name"
                placeholder="e.g., Salary, Freelance Work"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </label>
            <label className="md:col-span-3">
              <span className="block text-sm font-medium text-slate-300 mb-2">Amount (£)</span>
              <input
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </label>
            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
              >
                <span className="hidden md:inline">+</span>
                <span className="md:hidden">Add Income</span>
              </button>
            </div>
          </form>
        </div>

        {/* Monthly Income Grid */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Monthly Income</h2>
              <p className="text-slate-400 text-sm">Manage income sources for each month</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {MONTHS.map((m) => (
              <div key={m} className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-5 hover:border-white/20 transition-all">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full"></span>
                  {m}
                </h3>
                <IncomeManager month={m as MonthKey} incomeItems={income[m]} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
