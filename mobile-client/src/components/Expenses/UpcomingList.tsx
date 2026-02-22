import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { UpcomingPayment } from "@/lib/apiTypes";

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
              ? "#e25c5c"
              : u.urgency === "today"
              ? "#f4a942"
              : u.urgency === "soon"
              ? "#fcd34d"
              : "#3ec97e";
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
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#0a1e23",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  info: { flex: 1 },
  name: { color: "#fff", fontSize: 13, fontWeight: "600" },
  due: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
  amount: { fontSize: 13, fontWeight: "700" },
});
