import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { IncomeStackParamList } from "@/navigation/types";

export type IncomeScreenNavigation = NativeStackNavigationProp<IncomeStackParamList, "IncomeGrid">;

export type IncomeScreenRoute = RouteProp<IncomeStackParamList, "IncomeGrid">;