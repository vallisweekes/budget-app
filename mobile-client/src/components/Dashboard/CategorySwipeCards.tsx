import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Dimensions, Pressable } from "react-native";
import type { DashboardCategoryItem } from "@/lib/apiTypes";

interface Props {
  categories: DashboardCategoryItem[];
  totalIncome: number;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
  onPressCategory?: (category: { id: string; name: string }) => void;
}

const W = Dimensions.get("window").width;
const CARD = 122;
const GAP = 12;
const SIDE = 16;

const ACCENT_COLORS = ["#02eff0", "#3ec97e", "#a78bfa", "#f4a942", "#38bdf8", "#e25c5c"] as const;
const STORM_RGB = { r: 15, g: 40, b: 47 } as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickAccent(seed: string): string {
  return ACCENT_COLORS[hashString(seed) % ACCENT_COLORS.length]!;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function blendRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  const tt = Math.min(1, Math.max(0, t));
  const r = Math.round(a.r * (1 - tt) + b.r * tt);
  const g = Math.round(a.g * (1 - tt) + b.g * tt);
  const bb = Math.round(a.b * (1 - tt) + b.b * tt);
  return { r, g, b: bb };
}

function tintedDarkBg(accentHex: string): string {
  const rgb = hexToRgb(accentHex);
  if (!rgb) return "rgb(15,40,47)";
  const mixed = blendRgb(STORM_RGB, rgb, 0.22);
  return `rgb(${mixed.r},${mixed.g},${mixed.b})`;
}

export default function CategorySwipeCards({ categories, totalIncome, currency, fmt, onPressCategory }: Props) {
  const [active, setActive] = useState(0);
  const data = useMemo(() => {
    const items = (categories ?? [])
      .filter((c) => (c.total ?? 0) > 0)
      .slice()
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    return items.map((c) => {
      const pct = totalIncome > 0 ? Math.round(((c.total ?? 0) / totalIncome) * 100) : 0;
      const accent = pickAccent(c.id || c.name);
      return {
        id: c.id,
        name: c.name,
        total: c.total ?? 0,
        pct,
        accent,
      };
    });
  }, [categories, totalIncome]);

  if (data.length === 0) return null;

  const snap = CARD + GAP;
  const padRight = Math.max(SIDE, W - SIDE - CARD);

  return (
    <View style={s.wrap}>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(i) => i.id || i.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: SIDE, paddingRight: padRight }}
        snapToInterval={snap}
        decelerationRate="fast"
        bounces
        onMomentumScrollEnd={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const i = Math.round(x / snap);
          setActive(Math.max(0, Math.min(data.length - 1, i)));
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressCategory?.({ id: item.id, name: item.name })}
            style={[s.card, { backgroundColor: tintedDarkBg(item.accent) }]}
          >
            <View style={s.top}>
              <View style={s.pill}>
                <Text style={s.pillTxt}>{item.pct}%</Text>
              </View>
            </View>

            <Text style={s.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={s.amount} numberOfLines={1}>
              {fmt(item.total, currency)}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      />

      {data.length > 1 ? (
        <View style={s.indicatorWrap}>
          {data.map((_, i) => (
            <View key={i} style={[s.indicatorDot, i === active ? s.indicatorDotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 6 },
  card: {
    width: CARD,
    height: CARD,
    borderRadius: 22,
    padding: 14,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  name: { color: "rgba(255,255,255,0.95)", fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  amount: { color: "rgba(255,255,255,0.80)", fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillTxt: { color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "900" },

  indicatorWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 10,
    gap: 6,
  },
  indicatorDot: {
    height: 4,
    width: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,40,47,0.18)",
  },
  indicatorDotActive: {
    width: 18,
    backgroundColor: "#0f282f",
  },
});
