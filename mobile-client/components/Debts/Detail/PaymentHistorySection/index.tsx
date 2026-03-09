import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DebtPayment } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { styles } from "./styles";

type Props = {
  payments: DebtPayment[];
  currency: string;
  open: boolean;
  onToggle: () => void;
};

export default function PaymentHistorySection({ payments, currency, open, onToggle }: Props) {
  return (
    <View style={styles.sectionCard}>
      <Pressable style={styles.histHeader} onPress={onToggle}>
        <View style={styles.histHeaderLeft}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <View style={styles.histCountBadge}><Text style={styles.histCountText}>{payments.length}</Text></View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={T.textDim} />
      </Pressable>

      {open ? (
        payments.length === 0 ? (
          <Text style={styles.emptyHistory}>No payments recorded yet.</Text>
        ) : (
          payments.map((payment, index) => (
            <View key={payment.id} style={[styles.payHistRow, index > 0 && styles.payHistBorder]}>
              <View style={styles.payHistLeft}>
                <Text style={styles.payHistDate} numberOfLines={1} ellipsizeMode="tail">
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
						<Text style={styles.payHistSource} numberOfLines={1} ellipsizeMode="tail">
							{notes}
						</Text>
					);
				})()}
              </View>
              <Text style={styles.payHistAmt} numberOfLines={1} ellipsizeMode="clip">
                - {fmt(parseFloat(payment.amount), currency)}
              </Text>
            </View>
          ))
        )
      ) : null}
    </View>
  );
}
