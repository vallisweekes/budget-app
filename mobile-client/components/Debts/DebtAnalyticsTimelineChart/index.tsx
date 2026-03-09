import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line as SvgLine, Rect, Text as SvgText } from "react-native-svg";

import { T } from "@/lib/theme";
import type { DebtAnalyticsGanttItem } from "@/types/DebtAnalyticsScreen.types";
import { payoffDateLabel } from "@/lib/helpers/debtAnalytics";

type Props = {
  items: DebtAnalyticsGanttItem[];
  maxMonths: number;
};

export default function DebtAnalyticsTimelineChart({ items, maxMonths }: Props) {
  const [containerWidth, setContainerWidth] = useState(320);
  const barHeight = 16;
  const rowHeight = 40;
  const labelWidth = 72;
  const rightPad = 54;
  const chartWidth = containerWidth - labelWidth - rightPad;
  const totalHeight = items.length * rowHeight + 28;
  const ticks = [0, Math.floor(maxMonths / 2), maxMonths];
  const toX = (month: number) => (month / maxMonths) * chartWidth;

  return (
    <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)} style={{ width: "100%", height: totalHeight }}>
      <Svg width={containerWidth} height={totalHeight}>
        {ticks.map((tick) => (
          <SvgLine
            key={tick}
            x1={labelWidth + toX(tick)}
            y1={0}
            x2={labelWidth + toX(tick)}
            y2={totalHeight - 24}
            stroke={T.border}
            strokeWidth={1}
          />
        ))}

        {items.map((item, index) => {
          const barWidth = Math.max(toX(item.months), 6);
          const barY = index * rowHeight + (rowHeight - barHeight) / 2;
          const name = (item.debt.displayTitle ?? item.debt.name).slice(0, 9)
            + ((item.debt.displayTitle ?? item.debt.name).length > 9 ? "…" : "");
          const payoff = payoffDateLabel(item.months);

          return (
            <G key={item.debt.id}>
              <SvgText x={labelWidth - 6} y={index * rowHeight + rowHeight / 2 + 4} fontSize={10} fill={T.textDim} textAnchor="end" fontWeight="700">{name}</SvgText>
              <Rect x={labelWidth} y={barY} width={chartWidth} height={barHeight} rx={barHeight / 2} fill={item.color + "18"} />
              <Rect x={labelWidth} y={barY} width={barWidth} height={barHeight} rx={barHeight / 2} fill={item.color} opacity={0.9} />
              <Circle cx={labelWidth + barWidth} cy={barY + barHeight / 2} r={barHeight / 2 + 1} fill={item.color} />
              <SvgText x={labelWidth + chartWidth + 6} y={index * rowHeight + rowHeight / 2 + 4} fontSize={9} fill={item.color} textAnchor="start" fontWeight="800">{payoff}</SvgText>
            </G>
          );
        })}

        <SvgLine x1={labelWidth} y1={totalHeight - 24} x2={labelWidth + chartWidth} y2={totalHeight - 24} stroke={T.border} strokeWidth={1} />
        {ticks.map((tick, index) => (
          <SvgText
            key={tick}
            x={labelWidth + toX(tick)}
            y={totalHeight - 10}
            fontSize={9}
            fill={T.textMuted}
            textAnchor={index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"}
            fontWeight="700"
          >
            {tick === 0 ? "Now" : payoffDateLabel(tick)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
