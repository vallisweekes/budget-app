import React from "react";
import { Text, View } from "react-native";

import { fmt } from "@/lib/formatting";
import { loggedExpensesStyles as s } from "@/screens/loggedExpenses/styles";

type Props = {
  currency: string;
  itemCount: number;
  periodLabel: string;
  screenKicker: string;
  topHeaderOffset: number;
  total: number;
};

export default function LoggedExpensesHero(props: Props) {
  return (
    <>
      <View style={[s.purpleHero, { paddingTop: props.topHeaderOffset + 22 }]}>
        <Text style={s.purpleHeroLabel}>{props.periodLabel}</Text>
        <Text style={s.purpleHeroAmount}>{fmt(props.total, props.currency)}</Text>
        <Text style={s.purpleHeroMeta}>{props.itemCount} logged expense{props.itemCount === 1 ? "" : "s"}</Text>
      </View>

      <View style={s.sectionHeadingWrap}>
        <Text style={s.sectionHeading}>{props.screenKicker}</Text>
      </View>
    </>
  );
}
