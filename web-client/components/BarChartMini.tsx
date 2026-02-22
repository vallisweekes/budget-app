export default function BarChartMini({ data, max }: { data: Array<{ label: string; value: number }>; max?: number }) {
  const m = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-1">
          <div className="w-6 rounded bg-blue-500" style={{ height: `${Math.round((d.value / m) * 100)}%` }} />
          <div className="text-[10px] text-zinc-500">{d.label}</div>
        </div>
      ))}
    </div>
  );
}
