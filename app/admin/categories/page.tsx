import { getCategories } from "@/lib/categories/store";
import { addCategory } from "./actions";
import { getAllExpenses } from "@/lib/expenses/store";
import { listBudgetDataPlanIds } from "@/lib/storage/listBudgetDataPlanIds";
import CategoryIcon from "@/components/CategoryIcon";
import DeleteCategoryButton from "./DeleteCategoryButton";
import SelectDropdown from "@/components/SelectDropdown";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const list = await getCategories();
  const planIds = await listBudgetDataPlanIds();
  const expensesByPlan = await Promise.all(planIds.map((planId) => getAllExpenses(planId)));

  const categoryHasExpenses = new Map<string, number>();
  expensesByPlan.forEach((expenses) => {
    Object.values(expenses).forEach((monthExpenses) => {
      monthExpenses.forEach((expense) => {
        if (expense.categoryId) {
          categoryHasExpenses.set(
            expense.categoryId,
            (categoryHasExpenses.get(expense.categoryId) || 0) + 1
          );
        }
      });
    });
  });

  const categoryColorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    yellow: "from-yellow-500 to-yellow-600",
    purple: "from-purple-500 to-purple-600",
    orange: "from-orange-500 to-orange-600",
    green: "from-green-500 to-green-600",
    indigo: "from-indigo-500 to-indigo-600",
    pink: "from-pink-500 to-pink-600",
    cyan: "from-cyan-500 to-cyan-600",
    red: "from-red-500 to-red-600",
    teal: "from-teal-500 to-teal-600",
    slate: "from-slate-500 to-slate-600",
    amber: "from-amber-500 to-amber-600",
    emerald: "from-emerald-500 to-emerald-600",
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Categories</h1>
          <p className="text-slate-400 text-lg">Create and manage your expense categories</p>
        </div>

        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 mb-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Add Category</h2>
              <p className="text-slate-400 text-sm">Add new categories for your expense tracking</p>
            </div>
          </div>
          <form action={addCategory} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <label className="md:col-span-5">
              <span className="block text-sm font-medium text-slate-300 mb-2">Category Name</span>
              <input
                name="name"
                placeholder="e.g., Groceries, Hobbies"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </label>
            <label className="md:col-span-4">
              <span className="block text-sm font-medium text-slate-300 mb-2">Icon Name</span>
              <input
                name="icon"
                placeholder="e.g., ShoppingCart"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </label>
            <label className="md:col-span-2">
              <span className="block text-sm font-medium text-slate-300 mb-2">Visibility</span>
              <SelectDropdown
                name="featured"
                defaultValue="true"
                options={[
                  { value: "true", label: "Featured" },
                  { value: "false", label: "Hidden" },
                ]}
                buttonClassName="bg-slate-900/60 focus:ring-purple-500"
              />
            </label>
            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
              >
                <span className="hidden md:inline">+</span>
                <span className="md:hidden">Add Category</span>
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">All Categories</h2>
              <p className="text-slate-400 text-sm">{list.length} categories configured</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {list.map((c) => {
              const gradient = categoryColorMap[c.color || "slate"] || "from-slate-500 to-slate-600";
              const expenseCount = categoryHasExpenses.get(c.id) || 0;
              const hasExpenses = expenseCount > 0;

              return (
                <div
                  key={c.id}
                  className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-6 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-14 h-14 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                    >
                      <CategoryIcon iconName={c.icon ?? "Circle"} size={28} className="text-white" />
                    </div>
                    <DeleteCategoryButton
                      categoryId={c.id}
                      categoryName={c.name}
                      hasExpenses={hasExpenses}
                      expenseCount={expenseCount}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white mb-1">{c.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          c.featured
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {c.featured ? "Featured" : "Hidden"}
                      </span>
                      {hasExpenses && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {expenseCount} expense{expenseCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
