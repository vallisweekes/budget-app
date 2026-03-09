import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { IncomeStackParamList } from "@/navigation/types";

export type IncomeMonthScreenProps = NativeStackScreenProps<IncomeStackParamList, "IncomeMonth">;

export type MonthRef = {
  month: number;
  year: number;
};

export type IncomeMutationMeta =
  | {
      type: "add";
      month: number;
      year: number;
      distributeMonths: boolean;
      distributeYears: boolean;
    }
  | {
      type: "edit" | "delete";
      month: number;
      year: number;
    };