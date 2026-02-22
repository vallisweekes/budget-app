export default function CategoryGrid({ items }: { items: Array<{ name: string; amount: number; icon?: string }> }) {
  const top = [...items].sort((a, b) => b.amount - a.amount).slice(0, 6);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {top.map((c) => (
        <div
          key={c.name}
          className="rounded-2xl border bg-white p-3 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex flex-col items-center">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center text-2xl mb-2"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,213,170,0.6) 0%, rgba(255,138,76,0.6) 100%)",
              }}
            >
              <span>{c.icon || "🔖"}</span>
            </div>
            <div className="text-sm font-medium text-zinc-900 truncate text-center">{c.name}</div>
            <div className="text-xs text-zinc-500 mt-1">£{c.amount.toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
