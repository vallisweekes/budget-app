import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { UpcomingPayment } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { CARD_RADIUS, cardBase, textLabel } from "@/lib/ui";

interface Props {
  payments: UpcomingPayment[];
  currency: string;
  fmt: (v: number, c: string) => string;
}

export default function UpcomingList({ payments, currency, fmt }: Props) {
  if (payments.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Upcoming this month</Text>
      <View style={s.card}>
        {payments.map((u) => {
          const color =
            u.urgency === "overdue"
              ? T.red
              : u.urgency === "today"
              ? T.orange
              : u.urgency === "soon"
              ? T.accent
              : T.green;
          return (
            <View key={u.id} style={s.row}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>
                  {u.name}
                </Text>
                <Text style={s.due}>
                  Due{" "}
                  {u.dueDate
                    ? new Date(u.dueDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </Text>
              </View>
              <Text style={[s.amount, { color }]}>{fmt(u.amount, currency)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 16 },
  title: {
    ...textLabel,
    fontWeight: "800",
    marginBottom: 8,
  },
  card: {
    ...cardBase,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  info: { flex: 1 },
  name: { color: T.text, fontSize: 13, fontWeight: "800" },
  due: { color: T.textDim, fontSize: 11, marginTop: 2, fontWeight: "600" },
  amount: { fontSize: 13, fontWeight: "700" },
});
