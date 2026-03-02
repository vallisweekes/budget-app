import React from "react";
import { View, Text } from "react-native";
import type { UpcomingPayment } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { CARD_RADIUS, cardBase, textLabel } from "@/lib/ui";
import { styles } from "./styles";
import type { UpcomingListProps } from "@/types";
export default function UpcomingList({ payments, currency, fmt }: UpcomingListProps) {
  if (payments.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Upcoming this month</Text>
      <View style={styles.card}>
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
            <View key={u.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {u.name}
                </Text>
                <Text style={styles.due}>
                  Due{" "}
                  {u.dueDate
                    ? new Date(u.dueDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </Text>
              </View>
              <Text style={[styles.amount, { color }]}>{fmt(u.amount, currency)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
