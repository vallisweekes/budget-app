"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/helpers/money";

export default function PieCategories({ items }: { items: Array<{ name: string; amount: number }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = items.reduce((a, b) => a + b.amount, 0) || 1;
  const colors = ["#4f46e5", "#ef4444", "#22c55e", "#f59e0b", "#06b6d4", "#a855f7", "#fb8c50"];
  
  const segments = items
    .reduce<
      { acc: number; list: Array<{ label: string; amount: number; start: number; end: number; color: string; index: number }> }
    >(
      (state, it, i) => {
        const start = (state.acc / total) * 360;
        const nextAcc = state.acc + it.amount;
        const end = (nextAcc / total) * 360;
        return {
          acc: nextAcc,
          list: [...state.list, { label: it.name, amount: it.amount, start, end, color: colors[i % colors.length], index: i }],
        };
      },
      { acc: 0, list: [] }
    )
    .list;

  const createArc = (startAngle: number, endAngle: number) => {
    const start = startAngle - 90;
    const end = endAngle - 90;
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = 64 + 64 * Math.cos(startRad);
    const y1 = 64 + 64 * Math.sin(startRad);
    const x2 = 64 + 64 * Math.cos(endRad);
    const y2 = 64 + 64 * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M 64 64 L ${x1} ${y1} A 64 64 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="128" height="128" viewBox="0 0 128 128">
          {segments.map((s) => (
            <path
              key={s.index}
              d={createArc(s.start, s.end)}
              fill={s.color}
              className="transition-opacity cursor-pointer"
              style={{ opacity: hoveredIndex === null || hoveredIndex === s.index ? 1 : 0.3 }}
              onMouseEnter={() => setHoveredIndex(s.index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
        {hoveredIndex !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-center">
              <div className="text-xs font-medium text-white whitespace-nowrap">{segments[hoveredIndex].label}</div>
              <div className="text-sm font-bold text-white">{formatCurrency(segments[hoveredIndex].amount)}</div>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs w-full">
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
