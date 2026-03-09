import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/navigation/types";

import type { PaymentDetailSheetItem } from "./PaymentDetailSheet.types";

export type PaymentsScreenNavigation = NativeStackNavigationProp<RootStackParamList, "Payments">;

export type PaymentsScreenOpenItem = PaymentDetailSheetItem;