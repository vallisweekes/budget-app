import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import { styles as s } from "@/components/Expenses/AddExpenseSheet/styles";

export default function AddExpenseSheetToggles({
  isDirectDebit,
  setIsDirectDebit,
  distributeMonths,
  setDistributeMonths,
  distributeYears,
  setDistributeYears,
}: {
  isDirectDebit: boolean;
  setIsDirectDebit: (updater: (v: boolean) => boolean) => void;
  distributeMonths: boolean;
  setDistributeMonths: (updater: (v: boolean) => boolean) => void;
  distributeYears: boolean;
  setDistributeYears: (updater: (v: boolean) => boolean) => void;
}) {
  const { t } = useAppTranslation();

  return (
    <>
      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>{t("expenses.toggleDirectDebit")}</Text>
          <Text style={s.toggleSub}>{t("expenses.toggleDirectDebitSub")}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsDirectDebit((v) => !v)}
          style={[s.toggle, isDirectDebit && s.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[s.toggleThumb, isDirectDebit && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>{t("expenses.toggleDistributeMonths")}</Text>
          <Text style={s.toggleSub}>{t("expenses.toggleDistributeMonthsSub")}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setDistributeMonths((v) => {
              const next = !v;
              // Turning months off must also turn years off
              if (!next) setDistributeYears(() => false);
              return next;
            });
          }}
          style={[s.toggle, distributeMonths && s.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[s.toggleThumb, distributeMonths && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>{t("expenses.toggleDistributeYears")}</Text>
          <Text style={s.toggleSub}>{t("expenses.toggleDistributeYearsSub")}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setDistributeYears((v) => {
              const next = !v;
              // Turning years on must also turn months on
              if (next) setDistributeMonths(() => true);
              return next;
            });
          }}
          style={[s.toggle, distributeYears && s.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[s.toggleThumb, distributeYears && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>
    </>
  );
}
