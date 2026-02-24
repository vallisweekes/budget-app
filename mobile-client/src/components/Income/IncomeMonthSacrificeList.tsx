import React from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";

import type { IncomeSacrificeData, IncomeSacrificeFixed } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import IncomeSacrificeEditor from "@/components/Income/IncomeSacrificeEditor";
import { s } from "@/screens/income-month/incomeMonthScreenStyles";

type Props = {
  currency: string;
  sacrifice: IncomeSacrificeData | null;
  fixedDraft: IncomeSacrificeFixed;
  customDraftById: Record<string, string>;
  sacrificeSaving: boolean;
  sacrificeCreating: boolean;
  sacrificeDeletingId: string | null;
  newSacrificeType: "allowance" | "savings" | "emergency" | "investment" | "custom";
  newSacrificeName: string;
  newSacrificeAmount: string;
  refreshing: boolean;
  onRefresh: () => void;
  onChangeFixed: (key: keyof IncomeSacrificeFixed, value: string) => void;
  onSaveFixed: () => Promise<void>;
  onChangeCustomAmount: (id: string, value: string) => void;
  onSaveCustomAmounts: () => Promise<void>;
  onDeleteCustom: (id: string) => Promise<void>;
  onSetNewType: (value: "allowance" | "savings" | "emergency" | "investment" | "custom") => void;
  onSetNewName: (value: string) => void;
  onSetNewAmount: (value: string) => void;
  onCreateCustom: () => Promise<void>;
};

export default function IncomeMonthSacrificeList(props: Props) {
  return (
    <FlatList
      data={[]}
      keyExtractor={(_, idx) => String(idx)}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={T.accent} />}
      ListHeaderComponent={
        props.sacrifice ? (
          <IncomeSacrificeEditor
            currency={props.currency}
            fixed={props.fixedDraft}
            customItems={props.sacrifice.customItems}
            customTotal={props.sacrifice.customTotal}
            totalSacrifice={props.sacrifice.totalSacrifice}
            saving={props.sacrificeSaving}
            creating={props.sacrificeCreating}
            deletingId={props.sacrificeDeletingId}
            newType={props.newSacrificeType}
            newName={props.newSacrificeName}
            newAmount={props.newSacrificeAmount}
            onChangeFixed={props.onChangeFixed}
            onSaveFixed={props.onSaveFixed}
            onChangeCustomAmount={props.onChangeCustomAmount}
            onSaveCustomAmounts={props.onSaveCustomAmounts}
            onDeleteCustom={props.onDeleteCustom}
            onSetNewType={props.onSetNewType}
            onSetNewName={props.onSetNewName}
            onSetNewAmount={props.onSetNewAmount}
            onCreateCustom={props.onCreateCustom}
          />
        ) : (
          <View style={s.center}>
            <ActivityIndicator size="small" color={T.accent} />
          </View>
        )
      }
      ListEmptyComponent={null}
      renderItem={() => null}
    />
  );
}
