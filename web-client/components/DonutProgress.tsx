export default function DonutProgress({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 1));
  const deg = pct * 360;
  return (
    <div className="flex items-center justify-center">
      <div
        className="rounded-full w-32 h-32 grid place-items-center"
        style={{
          background: `conic-gradient(#fb8c50 ${deg}deg, #eee 0deg)`,
        }}
      >
        <div className="rounded-full w-24 h-24 bg-white grid place-items-center text-sm">
          <div className="text-zinc-900 font-semibold">£{value.toLocaleString()}</div>
          <div className="text-xs text-zinc-500">Spent</div>
        </div>
      </div>
    </div>
  );
}
