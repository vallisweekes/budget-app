import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { s } from "@/components/Expenses/AddExpenseSheet.styles";

export default function AddExpenseSheetToggles({
  paid,
  setPaid,
  isAllocation,
  setIsAllocation,
  isDirectDebit,
  setIsDirectDebit,
  distributeMonths,
  setDistributeMonths,
  distributeYears,
  setDistributeYears,
}: {
  paid: boolean;
  setPaid: (updater: (v: boolean) => boolean) => void;
  isAllocation: boolean;
  setIsAllocation: (updater: (v: boolean) => boolean) => void;
  isDirectDebit: boolean;
  setIsDirectDebit: (updater: (v: boolean) => boolean) => void;
  distributeMonths: boolean;
  setDistributeMonths: (updater: (v: boolean) => boolean) => void;
  distributeYears: boolean;
  setDistributeYears: (updater: (v: boolean) => boolean) => void;
}) {
  return (
    <>
      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>Mark as paid</Text>
          <Text style={s.toggleSub}>Expense is already settled</Text>
        </View>
        <TouchableOpacity onPress={() => setPaid((v) => !v)} style={[s.toggle, paid && s.toggleOn]} activeOpacity={0.8}>
          <View style={[s.toggleThumb, paid && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>Allocation payment</Text>
          <Text style={s.toggleSub}>For envelopes like groceries — never becomes a debt</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsAllocation((v) => !v)}
          style={[s.toggle, isAllocation && s.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[s.toggleThumb, isAllocation && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>Direct Debit / Standing Order</Text>
          <Text style={s.toggleSub}>Automatically collected each month</Text>
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
          <Text style={s.toggleTitle}>Distribute remaining months</Text>
          <Text style={s.toggleSub}>Add to every month from now through December</Text>
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
          <Text style={s.toggleTitle}>Distribute across all years</Text>
          <Text style={s.toggleSub}>Repeat for every year remaining in the budget horizon</Text>
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
