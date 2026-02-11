export default function PieCategories({ items }: { items: Array<{ name: string; amount: number }> }) {
  const total = items.reduce((a, b) => a + b.amount, 0) || 1;
  let acc = 0;
  const colors = ["#4f46e5", "#ef4444", "#22c55e", "#f59e0b", "#06b6d4", "#a855f7", "#fb8c50"];
  const segments = items.map((it, i) => {
    const start = acc / total * 360;
    acc += it.amount;
    const end = acc / total * 360;
    return { label: it.name, start, end, color: colors[i % colors.length] };
  });
  const bg = segments.map(s => `${s.color} ${s.start.toFixed(2)}deg ${s.end.toFixed(2)}deg`).join(", ");
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(${bg})` }} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {segments.slice(0, 8).map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded" style={{ background: s.color }} />
            <span className="truncate">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
