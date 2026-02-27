import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DebtPayment } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";

type Props = {
  payments: DebtPayment[];
  currency: string;
  open: boolean;
  onToggle: () => void;
};

export default function PaymentHistorySection({ payments, currency, open, onToggle }: Props) {
  return (
    <View style={s.sectionCard}>
      <Pressable style={s.histHeader} onPress={onToggle}>
        <View style={s.histHeaderLeft}>
          <Text style={s.sectionTitle}>Payment History</Text>
          <View style={s.histCountBadge}><Text style={s.histCountText}>{payments.length}</Text></View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={T.textDim} />
      </Pressable>

      {open ? (
        payments.length === 0 ? (
          <Text style={s.emptyHistory}>No payments recorded yet.</Text>
        ) : (
          payments.map((payment, index) => (
            <View key={payment.id} style={[s.payHistRow, index > 0 && s.payHistBorder]}>
              <View style={s.payHistLeft}>
                <Text style={s.payHistDate} numberOfLines={1} ellipsizeMode="tail">
                  {new Date(payment.paidAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </Text>
                {(() => {
					const notes = typeof payment.notes === "string" ? payment.notes.trim() : "";
					if (!notes) return null;
					if (/^month:\d{4}-\d{2}$/.test(notes)) return null;
					return (
						<Text style={s.payHistSource} numberOfLines={1} ellipsizeMode="tail">
							{notes}
						</Text>
					);
				})()}
              </View>
              <Text style={s.payHistAmt} numberOfLines={1} ellipsizeMode="clip">
                - {fmt(parseFloat(payment.amount), currency)}
              </Text>
            </View>
          ))
        )
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  sectionCard: {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  histHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  histHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  histCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  histCountText: { color: T.textDim, fontSize: 10, fontWeight: "800" },
  payHistRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  payHistBorder: { borderTopWidth: 1, borderTopColor: T.border },
  payHistLeft: { flex: 1, paddingRight: 12 },
  payHistDate: { color: T.text, fontSize: 13, fontWeight: "800" },
  payHistSource: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  payHistAmt: { color: T.green, fontSize: 14, fontWeight: "800", flexShrink: 0, textAlign: "right" },
  emptyHistory: { color: T.textDim, fontSize: 13, textAlign: "center", paddingVertical: 16, fontWeight: "600" },
});
