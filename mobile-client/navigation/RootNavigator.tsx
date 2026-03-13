import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import type {
  RootStackParamList,
  MainTabParamList,
  IncomeStackParamList,
  ExpensesStackParamList,
  DebtStackParamList,
} from "@/navigation/types";
import TopHeader from "@/components/Shared/TopHeader";
import PillTabBar from "@/components/Shared/PillTabBar";
import { T } from "@/lib/theme";
import { apiFetch } from "@/lib/api";
import type { IncomeSacrificeData, OnboardingStatusResponse, Settings } from "@/lib/apiTypes";
import { appendNotificationInboxItem, subscribeNotificationInbox } from "@/lib/notificationInbox";
import { markSkipExpensesFocusReload } from "@/lib/helpers/expensesFocusReload";

import LoginScreen from "@/components/LoginScreen";
import DashboardScreen from "@/components/DashboardScreen";
import IncomeScreen from "@/components/IncomeScreen";
import IncomeHomeScreen from "@/components/IncomeHomeScreen";
import IncomeMonthScreen from "@/components/IncomeMonthScreen";
import ExpensesScreen from "@/components/ExpensesScreen";
import CategoryExpensesScreen from "@/components/CategoryExpensesScreen";
import LoggedExpensesScreen from "@/components/LoggedExpensesScreen";
import ExpenseDetailScreen from "@/components/ExpenseDetailScreen";
import UnplannedExpenseScreen from "@/components/UnplannedExpenseScreen";
import ScanReceiptScreen from "@/components/ScanReceiptScreen";
import DebtScreen from "@/components/DebtScreen";
import DebtDetailScreen from "@/components/DebtDetailScreen";
import DebtAnalyticsScreen from "@/components/DebtAnalyticsScreen";
import SettingsScreen from "@/components/SettingsScreen";
import SettingsDebtManagementScreen from "@/components/SettingsDebtManagementScreen";
import PaymentsScreen from "@/components/PaymentsScreen";
import GoalsScreen from "@/components/GoalsScreen";
import GoalDetailScreen from "@/components/GoalDetailScreen";
import GoalsProjectionScreen from "@/components/GoalsProjectionScreen";
import AnalyticsScreen from "@/components/AnalyticsScreen";
import PrivacyPolicyScreen from "@/components/PrivacyPolicyScreen";
import SettingsIncomeSettingsScreen from "@/components/SettingsIncomeSettingsScreen";
import SettingsProfileDetailsScreen from "@/components/SettingsProfileDetailsScreen";
import SettingsStrategyScreen from "@/components/SettingsStrategyScreen";
import OnboardingScreen from "@/components/OnboardingScreen";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatIncomePeriodSpan(month: number): string {
  const safeMonth = Math.max(1, Math.min(12, month));
  const start = MONTH_NAMES_SHORT[(safeMonth - 2 + 12) % 12];
  const end = MONTH_NAMES_SHORT[(safeMonth - 1) % 12];
  return `${start} - ${end}`;
}

function IncomeMonthSwitcher({
  month,
  year,
  budgetPlanId,
  onNavigate,
}: {
  month: number;
  year: number;
  budgetPlanId: string;
  onNavigate: (nextMonth: number, nextYear: number) => void;
}) {
  const [isYearPickerVisible, setIsYearPickerVisible] = useState(false);
  const [budgetHorizonYears, setBudgetHorizonYears] = useState(10);
  const yearPickerAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const loadBudgetHorizon = async () => {
      if (!budgetPlanId) return;
      try {
        const settings = await apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(budgetPlanId)}`, {
          cacheTtlMs: 60_000,
        });
        if (cancelled) return;
        const parsed = Number(settings?.budgetHorizonYears);
        const safe = Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 10;
        setBudgetHorizonYears((prev) => (prev === safe ? prev : safe));
      } catch {
        if (cancelled) return;
        setBudgetHorizonYears((prev) => (prev === 10 ? prev : 10));
      }
    };

    void loadBudgetHorizon();

    return () => {
      cancelled = true;
    };
  }, [budgetPlanId]);

  const nowYear = new Date().getFullYear();
  const safeHorizon = Math.max(1, Math.min(30, Number.isFinite(budgetHorizonYears) ? Math.floor(budgetHorizonYears) : 10));
  const horizonYears = Array.from({ length: safeHorizon }, (_, index) => nowYear + index);
  const allowedYears = horizonYears.includes(year)
    ? horizonYears
    : [...horizonYears, year].sort((a, b) => a - b);

  const prevMonth = month - 1 < 1 ? 12 : month - 1;
  const prevYear = month - 1 < 1 ? year - 1 : year;
  const nextMonth = month + 1 > 12 ? 1 : month + 1;
  const nextYear = month + 1 > 12 ? year + 1 : year;

  const allowedYearSet = new Set(allowedYears);
  const disablePrev = !allowedYearSet.has(prevYear);
  const disableNext = !allowedYearSet.has(nextYear);

  const openYearPicker = () => {
    setIsYearPickerVisible(true);
    yearPickerAnim.setValue(0);
    Animated.spring(yearPickerAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
      mass: 0.7,
    }).start();
  };

  const closeYearPicker = (onClosed?: () => void) => {
    Animated.timing(yearPickerAnim, {
      toValue: 0,
      duration: 190,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsYearPickerVisible(false);
        onClosed?.();
      }
    });
  };

  const backdropOpacity = yearPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardTranslateY = yearPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 0],
  });

  const cardScale = yearPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  return (
    <>
      <View style={s.monthSwitchWrap}>
        <Pressable
          onPress={() => {
            if (disablePrev) return;
            onNavigate(prevMonth, prevYear);
          }}
          disabled={disablePrev}
          style={[s.monthSwitchBtn, disablePrev && s.monthSwitchBtnDisabled]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={13} color={disablePrev ? T.textMuted : T.text} />
        </Pressable>

        <Pressable
          onPress={openYearPicker}
          style={s.monthSwitchLabelBtn}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Select year"
        >
          <Text style={s.monthSwitchText}>{`${formatIncomePeriodSpan(month)} ${year}`}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (disableNext) return;
            onNavigate(nextMonth, nextYear);
          }}
          disabled={disableNext}
          style={[s.monthSwitchBtn, disableNext && s.monthSwitchBtnDisabled]}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={13} color={disableNext ? T.textMuted : T.text} />
        </Pressable>
      </View>

      <Modal
        visible={isYearPickerVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeYearPicker()}
      >
        <Pressable style={s.yearPickerBackdrop} onPress={() => closeYearPicker()}>
          <Animated.View style={[s.yearPickerBackdropShade, { opacity: backdropOpacity }]} />
          <Animated.View
            style={[
              s.yearPickerCard,
              {
                transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
              },
            ]}
          >
            <Pressable onPress={() => {}}>
              <Text style={s.yearPickerTitle}>Select year</Text>
              <View style={s.yearPickerGrid}>
                {allowedYears.map((optionYear) => {
                  const isSelected = optionYear === year;
                  return (
                    <Pressable
                      key={String(optionYear)}
                      style={[s.yearPickerItem, isSelected && s.yearPickerItemSelected]}
                      onPress={() => {
                        closeYearPicker(() => onNavigate(month, optionYear));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${optionYear}`}
                    >
                      <Text style={[s.yearPickerItemText, isSelected && s.yearPickerItemTextSelected]}>{optionYear}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const IncomeStack = createNativeStackNavigator<IncomeStackParamList>();
const ExpensesStack = createNativeStackNavigator<ExpensesStackParamList>();
const DebtStack = createNativeStackNavigator<DebtStackParamList>();
const ONBOARDING_FALLBACK: OnboardingStatusResponse = {
  required: false,
  completed: false,
  profile: null,
  occupations: [],
};

const APP_STACK_SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: T.bg },
  animation: "fade_from_bottom" as const,
};

export function IncomeStackNavigator() {
  return (
    <IncomeStack.Navigator screenOptions={APP_STACK_SCREEN_OPTIONS}>
      <IncomeStack.Screen name="IncomeHome" component={IncomeHomeScreen} />
      <IncomeStack.Screen name="IncomeGrid" component={IncomeScreen} />
      <IncomeStack.Screen name="IncomeMonth" component={IncomeMonthScreen} />
    </IncomeStack.Navigator>
  );
}

export function ExpensesStackNavigator() {
  return (
    <ExpensesStack.Navigator screenOptions={APP_STACK_SCREEN_OPTIONS}>
      <ExpensesStack.Screen name="ExpensesList" component={ExpensesScreen} />
      <ExpensesStack.Screen name="CategoryExpenses" component={CategoryExpensesScreen} />
      <ExpensesStack.Screen name="LoggedExpenses" component={LoggedExpensesScreen} />
      <ExpensesStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
      <ExpensesStack.Screen name="UnplannedExpense" component={UnplannedExpenseScreen} />
      <ExpensesStack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
    </ExpensesStack.Navigator>
  );
}

export function DebtStackNavigator() {
  return (
    <DebtStack.Navigator screenOptions={APP_STACK_SCREEN_OPTIONS}>
      <DebtStack.Screen name="DebtList" component={DebtScreen} />
      <DebtStack.Screen name="DebtDetail" component={DebtDetailScreen} />
      <DebtStack.Screen name="DebtAnalytics" component={DebtAnalyticsScreen} />
    </DebtStack.Navigator>
  );
}

function NotificationSettingsScreenAdapter(props: unknown) {
  return <SettingsScreen {...(props as any)} />;
}

function RootTopHeader({ navigation }: { navigation: any }) {
  const { signOut } = useAuth();
  const [incomePendingCount, setIncomePendingCount] = useState(0);
  const [, setPendingBudgetPlanId] = useState<string | null>(null);
  const [hasNotificationDot, setHasNotificationDot] = useState(false);
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();

  const getPendingCount = useCallback((data: IncomeSacrificeData): number => {
    const confirmed = new Set((data.confirmations ?? []).map((item) => item.targetKey));

    const amountForTarget = (targetKey: string): number => {
      if (targetKey.startsWith("fixed:")) {
        const field = targetKey.slice("fixed:".length) as keyof IncomeSacrificeData["fixed"];
        return Number(data.fixed?.[field] ?? 0);
      }
      if (targetKey.startsWith("custom:")) {
        const customId = targetKey.slice("custom:".length);
        const item = (data.customItems ?? []).find((row) => row.id === customId);
        return Number(item?.amount ?? 0);
      }
      return 0;
    };

    return (data.goalLinks ?? []).reduce((sum, link) => {
      if (confirmed.has(link.targetKey)) return sum;
      return amountForTarget(link.targetKey) > 0 ? sum + 1 : sum;
    }, 0);
  }, []);

  const buildNotificationId = useCallback((notification: { request?: { identifier?: string; content?: { title?: string | null; body?: string | null } } }) => {
    const explicit = notification?.request?.identifier;
    if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
    const title = String(notification?.request?.content?.title ?? "BudgetIn Check").trim();
    const body = String(notification?.request?.content?.body ?? "").trim();
    return `local:${title}::${body}`;
  }, []);

  const loadPendingCount = useCallback(async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const data = await apiFetch<IncomeSacrificeData>(`/api/bff/income-sacrifice?month=${month}&year=${year}`, {
        cacheTtlMs: 2_000,
      });
      const nextCount = getPendingCount(data);
      const nextPlanId = typeof data.budgetPlanId === "string" && data.budgetPlanId.trim() ? data.budgetPlanId : null;
      setIncomePendingCount((prev) => (prev === nextCount ? prev : nextCount));
      setPendingBudgetPlanId((prev) => (prev === nextPlanId ? prev : nextPlanId));
    } catch {
      setIncomePendingCount((prev) => (prev === 0 ? prev : 0));
      setPendingBudgetPlanId((prev) => (prev === null ? prev : null));
    }
  }, [getPendingCount]);

  const getDeepestRoute = (state: any): any => {
    if (!state?.routes?.length) return null;
    const route = state.routes[state.index ?? state.routes.length - 1];
    if (route?.state) return getDeepestRoute(route.state);
    return route;
  };

  const deepestRoute = getDeepestRoute(navigation.getState?.());
  const isIncomeMonth = deepestRoute?.name === "IncomeMonth";
  const isAnalytics = deepestRoute?.name === "Analytics";
  const isNotificationSettings = deepestRoute?.name === "NotificationSettings";
  const shouldShowIncomeBack = isAnalytics;
  const monthLabel = isAnalytics ? "Analytics" : undefined;
  const analyticsOverviewMode = deepestRoute?.params?.overviewMode === "month" ? "month" : "year";

  const incomeMonthInitialMode = deepestRoute?.params?.initialMode === "sacrifice" ? "sacrifice" : "income";

  const monthNum = Number(deepestRoute?.params?.month);
  const yearNum = Number(deepestRoute?.params?.year);
  const incomeMonthBudgetPlanId = typeof deepestRoute?.params?.budgetPlanId === "string"
    ? deepestRoute.params.budgetPlanId
    : "";

  const canUseMonthSwitcher = isIncomeMonth
    && Number.isFinite(monthNum)
    && monthNum >= 1
    && monthNum <= 12
    && Number.isFinite(yearNum)
    && Boolean(incomeMonthBudgetPlanId);

  const isIncomeMonthLocked = Number.isFinite(monthNum) && Number.isFinite(yearNum)
    ? (Number(yearNum) < nowYear || (Number(yearNum) === nowYear && Number(monthNum) < nowMonth))
    : false;

  const goToIncomeMonth = (nextMonth: number, nextYear: number) => {
    if (!incomeMonthBudgetPlanId) return;
    navigation.navigate("Main", {
      screen: "Income",
      params: {
        screen: "IncomeMonth",
        params: {
          month: nextMonth,
          year: nextYear,
          budgetPlanId: incomeMonthBudgetPlanId,
          initialMode: incomeMonthInitialMode,
        },
      },
    });
  };

  const incomeMonthSwitcher = canUseMonthSwitcher ? (
    <IncomeMonthSwitcher
      month={Number(monthNum)}
      year={Number(yearNum)}
      budgetPlanId={incomeMonthBudgetPlanId}
      onNavigate={goToIncomeMonth}
    />
  ) : undefined;

  const handleBack = () => {
    if (isNotificationSettings) {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate("Main", { screen: "Dashboard" });
      return;
    }

    if (isAnalytics) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Main");
  };

  const analyticsRightContent = isAnalytics ? (
    <View style={s.analyticsModeToggle}>
      <Animated.View
        pointerEvents="none"
        style={[
          s.analyticsModeThumb,
          { transform: [{ translateX: analyticsOverviewMode === "year" ? 34 : 2 }] },
        ]}
      />
      <Pressable
        onPress={() => {
          navigation.setParams({ overviewMode: "month" });
        }}
        style={s.analyticsModeBtn}
        hitSlop={10}
      >
        <Text style={[s.analyticsModeText, analyticsOverviewMode === "month" && s.analyticsModeTextActive]}>M</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          navigation.setParams({ overviewMode: "year" });
        }}
        style={s.analyticsModeBtn}
        hitSlop={10}
      >
        <Text style={[s.analyticsModeText, analyticsOverviewMode === "year" && s.analyticsModeTextActive]}>Y</Text>
      </Pressable>
    </View>
  ) : undefined;

  useEffect(() => {
    void loadPendingCount();
  }, [loadPendingCount]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationInbox((snapshot) => {
      const next = snapshot.unreadCount > 0;
      setHasNotificationDot((prev) => (prev === next ? prev : next));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const appendFromNotification = (notification: { request?: { identifier?: string; content?: { title?: string | null; body?: string | null } } }) => {
      const title = notification?.request?.content?.title ?? "BudgetIn Check";
      const body = notification?.request?.content?.body ?? "";
      void appendNotificationInboxItem({
        id: buildNotificationId(notification),
        title,
        body,
      });
    };

    void Notifications.getPresentedNotificationsAsync()
      .then((presented) => {
        presented.forEach((entry) => appendFromNotification(entry));
      })
      .catch(() => {
        // ignore
      });

    const received = Notifications.addNotificationReceivedListener((event) => {
      appendFromNotification(event);
    });

    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      appendFromNotification(event.notification);
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, [buildNotificationId]);

  const openAddIncomeFromHeader = () => {
    if (!isIncomeMonth || !incomeMonthBudgetPlanId || isIncomeMonthLocked) return;
    navigation.navigate("Main", {
      screen: "Income",
      params: {
        screen: "IncomeMonth",
        params: {
          month: Number(monthNum),
          year: Number(yearNum),
          budgetPlanId: incomeMonthBudgetPlanId,
          initialMode: "income",
          openIncomeAddAt: Date.now(),
        },
      },
    });
  };

  return (
    <TopHeader
      onSettings={() => {
        navigation.navigate("NotificationSettings", { initialTab: "notifications" });
      }}
      onIncome={() => {}}
      onAnalytics={() => navigation.navigate("Analytics")}
      onNotifications={() => {
        navigation.navigate("NotificationSettings", { initialTab: "notifications" });
      }}
      onBack={handleBack}
      centerContent={isIncomeMonth ? incomeMonthSwitcher : undefined}
      centerLabel={isIncomeMonth ? undefined : monthLabel}
      leftVariant={shouldShowIncomeBack || isNotificationSettings ? "back" : "avatar"}
      showIncomeAction={false}
      rightContent={analyticsRightContent}
      compactActionsMenu={isNotificationSettings || isIncomeMonth}
      onLogout={isNotificationSettings ? signOut : undefined}
      incomePendingCount={incomePendingCount}
      onAddIncome={isIncomeMonth && !isIncomeMonthLocked ? openAddIncomeFromHeader : undefined}
      showNotificationDot={hasNotificationDot}
    />
  );
}

const s = StyleSheet.create({
  quickActionBtn: {
    minWidth: 64,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderColor: T.accentBorder,
    borderWidth: 1,
  },
  quickActionText: {
    color: T.onAccent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  incomeYearWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: `${T.cardAlt}88`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  incomeYearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  incomeYearText: {
    color: T.text,
    fontSize: 18,
    fontWeight: "600",
    minWidth: 56,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  monthSwitchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  monthSwitchBtn: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  monthSwitchBtnDisabled: {
    opacity: 0.45,
  },
  monthSwitchText: {
    color: T.text,
    fontSize: 16,
    fontWeight: "700",
    minWidth: 118,
    paddingHorizontal: 4,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  monthSwitchLabelBtn: {
    alignItems: "center",
  },
  yearPickerBackdrop: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    position: "relative",
  },
  yearPickerBackdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  yearPickerCard: {
    width: "100%",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    paddingTop: 56,
    paddingBottom: 14,
  },
  yearPickerTitle: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  yearPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingTop: 4,
    rowGap: 8,
  },
  yearPickerItem: {
    width: "33.33%",
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  yearPickerItemSelected: {
    backgroundColor: `${T.accent}22`,
  },
  yearPickerItemText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "600",
  },
  yearPickerItemTextSelected: {
    color: T.accent,
    fontWeight: "700",
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${T.cardAlt}66`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.red,
    borderWidth: 1,
    borderColor: T.card,
  },
  headerBadgeText: {
    color: T.onAccent,
    fontSize: 9,
    fontWeight: "900",
  },
  headerActionBtnAdd: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  headerActionBtnDisabled: {
    opacity: 0.5,
  },
  headerNotificationDot: {
    position: "absolute",
    top: 5,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.red,
    borderWidth: 1,
    borderColor: T.card,
  },
  analyticsModeToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    backgroundColor: `${T.cardAlt}66`,
    width: 68,
    height: 34,
    position: "relative",
    overflow: "hidden",
  },
  analyticsModeThumb: {
    position: "absolute",
    width: 30,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.accent,
    top: 2,
  },
  analyticsModeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsModeText: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
  },
  analyticsModeTextActive: {
    color: T.onAccent,
  },
  goalsHeaderAddBtn: {
    minWidth: 78,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderColor: T.accentBorder,
    borderWidth: 1,
  },
  goalsHeaderAddText: {
    color: T.onAccent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  loggedPaymentsBtn: {
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderColor: T.accentBorder,
    borderWidth: 1,
  },
  loggedPaymentsBtnText: {
    color: T.onAccent,
    fontSize: 12,
    fontWeight: "800",
  },
  loggedPaymentsCountPill: {
    minWidth: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  loggedPaymentsCountText: {
    color: T.onAccent,
    fontSize: 10,
    fontWeight: "900",
  },
  debtAnalyticsCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    maxWidth: "100%",
  },
  debtAnalyticsCenterTitle: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center",
  },
  debtAnalyticsCenterSub: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
    textAlign: "center",
  },
});

function MainTabs() {
  const { signOut, profile } = useAuth();
  const { dashboard } = useBootstrapData();
  const incomePendingCount = 0;
  const hasNotificationDot = false;
  const hasActualDebts = (dashboard?.debts ?? []).some((debt) => Number(debt?.currentBalance ?? 0) > 0);
  const debtManagementEnabled = profile?.onboarding?.profile?.hasDebtsToManage === true;
  const showDebtsTab = hasActualDebts || debtManagementEnabled;

  return (
    <Tab.Navigator
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={({ navigation, route }) => ({
        animation: "fade",
        headerShown: true,
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        header: () => {
          const getDeepestRoute = (node: any): any => {
            const state = node?.state ?? node;
            if (!state?.routes?.length) {
              return node?.name ? node : null;
            }
            const activeRoute = state.routes[state.index ?? state.routes.length - 1];
            if (activeRoute?.state) return getDeepestRoute(activeRoute);
            return activeRoute;
          };

          const deepestRoute = getDeepestRoute(route);
          const isDebtDetail = deepestRoute?.name === "DebtDetail";
          const isExpenseDetail = deepestRoute?.name === "ExpenseDetail";
          if (isDebtDetail || isExpenseDetail) return null;

          const isCategoryExpenses = deepestRoute?.name === "CategoryExpenses";
          const isLoggedExpenses = deepestRoute?.name === "LoggedExpenses";
          const isExpensesList = deepestRoute?.name === "ExpensesList";
          const isUnplannedExpense = deepestRoute?.name === "UnplannedExpense";
          const isScanReceipt = deepestRoute?.name === "ScanReceipt";
          const isSettings = deepestRoute?.name === "Settings";
          const isDebtAnalytics = deepestRoute?.name === "DebtAnalytics";
          const isGoals = route.name === "Goals";
          const isIncomeTab = route.name === "Income";
          const nestedTarget = route?.params && typeof route.params === "object"
            ? (route.params as any)
            : null;
          const nestedIncomeMonthParams = nestedTarget?.screen === "IncomeMonth" && nestedTarget?.params
            ? nestedTarget.params
            : null;
          const activeIncomeParams = deepestRoute?.name === "IncomeMonth"
            ? deepestRoute?.params
            : nestedIncomeMonthParams;
          const isIncomeMonth = Boolean(activeIncomeParams);

          const monthNum = Number(activeIncomeParams?.month);
          const yearNum = Number(activeIncomeParams?.year);
          const incomeMonthBudgetPlanId = typeof activeIncomeParams?.budgetPlanId === "string"
            ? activeIncomeParams.budgetPlanId
            : "";
          const incomeMonthInitialMode = activeIncomeParams?.initialMode === "sacrifice" ? "sacrifice" : "income";

          const canUseIncomeMonthSwitcher = isIncomeTab
            && isIncomeMonth
            && Number.isFinite(monthNum)
            && monthNum >= 1
            && monthNum <= 12
            && Number.isFinite(yearNum)
            && Boolean(incomeMonthBudgetPlanId);

          const goToIncomeMonth = (nextMonth: number, nextYear: number) => {
            if (!incomeMonthBudgetPlanId) return;
            navigation.navigate("Income" as any, {
              screen: "IncomeMonth",
              params: {
                month: nextMonth,
                year: nextYear,
                budgetPlanId: incomeMonthBudgetPlanId,
                initialMode: incomeMonthInitialMode,
              },
            } as any);
          };

          const incomeMonthSwitcher = canUseIncomeMonthSwitcher ? (
            <IncomeMonthSwitcher
              month={Number(monthNum)}
              year={Number(yearNum)}
              budgetPlanId={incomeMonthBudgetPlanId}
              onNavigate={goToIncomeMonth}
            />
          ) : undefined;
          const categoryExpensesName = typeof deepestRoute?.params?.categoryName === "string"
            ? deepestRoute.params.categoryName
            : undefined;
          const categoryExpensesMonth = Number(deepestRoute?.params?.month);
          const categoryExpensesYear = Number(deepestRoute?.params?.year);
          const expensesListMonth = Number(deepestRoute?.params?.month);
          const expensesListYear = Number(deepestRoute?.params?.year);
          const currentPeriodMonth = Number(deepestRoute?.params?.currentPeriodMonth);
          const currentPeriodYear = Number(deepestRoute?.params?.currentPeriodYear);
          const resolvedCurrentPeriodMonth = Number.isFinite(currentPeriodMonth) && currentPeriodMonth >= 1 && currentPeriodMonth <= 12
            ? Math.floor(currentPeriodMonth)
            : new Date().getMonth() + 1;
          const resolvedCurrentPeriodYear = Number.isFinite(currentPeriodYear)
            ? Math.floor(currentPeriodYear)
            : new Date().getFullYear();
          const resolvedSelectedPeriodMonth = Number.isFinite(expensesListMonth) && expensesListMonth >= 1 && expensesListMonth <= 12
            ? Math.floor(expensesListMonth)
            : resolvedCurrentPeriodMonth;
          const resolvedSelectedPeriodYear = Number.isFinite(expensesListYear)
            ? Math.floor(expensesListYear)
            : resolvedCurrentPeriodYear;
          const isPastExpensesPeriod = isExpensesList
            && (
              resolvedSelectedPeriodYear < resolvedCurrentPeriodYear
              || (resolvedSelectedPeriodYear === resolvedCurrentPeriodYear && resolvedSelectedPeriodMonth < resolvedCurrentPeriodMonth)
            );
          const expensesListLoggedExpensesCountRaw = Number(deepestRoute?.params?.loggedExpensesCount);
          const expensesListLoggedExpensesCount = Number.isFinite(expensesListLoggedExpensesCountRaw)
            ? Math.max(0, Math.floor(expensesListLoggedExpensesCountRaw))
            : 0;
          const hasCategoryMonthYear = Number.isFinite(categoryExpensesMonth)
            && categoryExpensesMonth >= 1
            && categoryExpensesMonth <= 12
            && Number.isFinite(categoryExpensesYear);
          const expensesCenterLabel = isLoggedExpenses
            ? "Logged expense"
            : isCategoryExpenses
            ? categoryExpensesName
            : isUnplannedExpense
              ? "Log Expense · Unplanned"
              : isScanReceipt
                ? "Upload Receipt"
                : undefined;

          const debtAnalyticsDebts = Array.isArray(deepestRoute?.params?.debts)
            ? deepestRoute.params.debts
            : null;
          const debtAnalyticsCurrency = typeof deepestRoute?.params?.currency === "string"
            ? deepestRoute.params.currency
            : "£";
          const debtAnalyticsActiveCount = debtAnalyticsDebts
            ? debtAnalyticsDebts.filter((d: any) => d?.isActive && !d?.paid && Number(d?.currentBalance) > 0).length
            : 0;
          const debtAnalyticsTotal = debtAnalyticsDebts
            ? debtAnalyticsDebts.reduce((sum: number, d: any) => sum + Math.max(0, Number(d?.currentBalance ?? 0)), 0)
            : 0;
          const debtAnalyticsSubtitle = debtAnalyticsDebts
            ? `${debtAnalyticsActiveCount} active · ${debtAnalyticsCurrency}${debtAnalyticsTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })} total`
            : undefined;

          const headerCenterContent = isDebtAnalytics
            ? (
              <View style={s.debtAnalyticsCenterWrap}>
                <Text style={s.debtAnalyticsCenterTitle}>Debt Analytics</Text>
                {debtAnalyticsSubtitle ? (
                  <Text style={s.debtAnalyticsCenterSub} numberOfLines={1}>{debtAnalyticsSubtitle}</Text>
                ) : null}
              </View>
            )
            : incomeMonthSwitcher;

          const openAnalytics = () => {
            const parent = navigation.getParent();
            if (parent) {
              parent.navigate("Analytics" as never);
            }
          };

          const openNotifications = () => {
            const parent = navigation.getParent();
            if (parent) {
              (parent as any).navigate("NotificationSettings", { initialTab: "notifications" });
              return;
            }
            (navigation as any).navigate("NotificationSettings", { initialTab: "notifications" });
          };

          const categoryHeaderRightContent = isCategoryExpenses
            ? <View style={{ width: 34, height: 34 }} />
            : undefined;

          const expensesLoggedRightContent = isExpensesList && !isPastExpensesPeriod && expensesListLoggedExpensesCount > 0 ? (
            <Pressable
              onPress={() => {
                (navigation as any).navigate("Expenses" as any, {
                  screen: "LoggedExpenses",
                  params: {
                    categoryId: null,
                    categoryName: "All categories",
                    color: null,
                    icon: null,
                    month: resolvedSelectedPeriodMonth,
                    year: resolvedSelectedPeriodYear,
                    budgetPlanId: deepestRoute?.params?.budgetPlanId ?? null,
                    currency: deepestRoute?.params?.currency ?? "£",
                  },
                });
              }}
              style={s.loggedPaymentsBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Open logged expenses"
            >
              <Ionicons name="list-outline" size={14} color={T.onAccent} />
              <Text style={s.loggedPaymentsBtnText}>Logged expenses</Text>
              <View style={s.loggedPaymentsCountPill}>
                <Text style={s.loggedPaymentsCountText}>{expensesListLoggedExpensesCount}</Text>
              </View>
            </Pressable>
          ) : undefined;

          const expensesListLeftContent = isExpensesList && !isPastExpensesPeriod ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => navigation.navigate("Expenses" as any, {
                  screen: "UnplannedExpense",
                  params: {
                    month: resolvedCurrentPeriodMonth,
                    year: resolvedCurrentPeriodYear,
                  },
                } as any)}
                style={s.quickActionBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Log expense"
              >
                <Ionicons name="create-outline" size={17} color={T.onAccent} />
                <Text style={s.quickActionText}>Log</Text>
              </Pressable>
            </View>
          ) : undefined;

          const goalsRightContent = isGoals ? (
            <Pressable
              onPress={() => (navigation as any).navigate("Goals", { openAddToken: Date.now() })}
              style={s.goalsHeaderAddBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Add goal"
            >
              <Ionicons name="add" size={18} color={T.onAccent} />
              <Text style={s.goalsHeaderAddText}>Goal</Text>
            </Pressable>
          ) : undefined;

          const settingsBackHandler = () => {
            const currentSettingsSubTab = typeof deepestRoute?.params?.subTab === "string"
              ? deepestRoute.params.subTab
              : "details";
            if (currentSettingsSubTab !== "details") {
              navigation.navigate("Settings", { subTab: "details" });
              return;
            }
            navigation.navigate("Dashboard");
          };

          const headerBackHandler = isLoggedExpenses
            ? () => {
              if (deepestRoute?.params?.categoryId) {
                navigation.navigate(
                  "Expenses" as any,
                  {
                    screen: "CategoryExpenses",
                    params: {
                      categoryId: deepestRoute?.params?.categoryId,
                      categoryName: deepestRoute?.params?.categoryName,
                      color: deepestRoute?.params?.color ?? null,
                      icon: deepestRoute?.params?.icon ?? null,
                      month: Number(deepestRoute?.params?.month),
                      year: Number(deepestRoute?.params?.year),
                      budgetPlanId: deepestRoute?.params?.budgetPlanId ?? null,
                      currency: deepestRoute?.params?.currency,
                      skipFocusReloadAt: Date.now(),
                    },
                  } as any
                );
                return;
              }
              navigation.navigate(
                "Expenses" as any,
                {
                  screen: "ExpensesList",
                  params: {
                    month: Number(deepestRoute?.params?.month),
                    year: Number(deepestRoute?.params?.year),
                    budgetPlanId: deepestRoute?.params?.budgetPlanId ?? null,
                    currency: deepestRoute?.params?.currency,
                  },
                } as any
              );
            }
            : isCategoryExpenses
              ? () => {
                markSkipExpensesFocusReload();
                navigation.navigate(
                  "Expenses" as any,
                  {
                    screen: "ExpensesList",
                    params: hasCategoryMonthYear
                      ? {
                          month: categoryExpensesMonth,
                          year: categoryExpensesYear,
                          skipFocusReloadAt: Date.now(),
                        }
                      : {
                          skipFocusReloadAt: Date.now(),
                        },
                  } as any
                );
              }
              : isSettings
                ? settingsBackHandler
                : isDebtAnalytics
                  ? () => navigation.navigate("Debts" as any, { screen: "DebtList" } as any)
                  : isUnplannedExpense || isScanReceipt
                    ? () => navigation.navigate("Expenses" as any, { screen: "ExpensesList" } as any)
                    : undefined;

          return (
            <TopHeader
              onSettings={() => navigation.navigate("Settings")}
              onIncome={() => {}}
              onAnalytics={openAnalytics}
              onNotifications={openNotifications}
              leftVariant={isSettings || isCategoryExpenses || isLoggedExpenses || isUnplannedExpense || isScanReceipt || isDebtAnalytics ? "back" : "avatar"}
              onBack={headerBackHandler}
              centerLabel={isGoals ? "Goals" : expensesCenterLabel}
              centerContent={headerCenterContent}
              leftContent={expensesListLeftContent}
              rightContent={(isLoggedExpenses ? undefined : categoryHeaderRightContent ?? expensesLoggedRightContent) ?? goalsRightContent}
              showIncomeAction={false}
              compactActionsMenu={isSettings}
              showAnalyticsAction={!isSettings}
              showNotificationAction={!isSettings}
              onLogout={isSettings ? signOut : undefined}
              incomePendingCount={incomePendingCount}
              showNotificationDot={hasNotificationDot}
              onAddIncome={undefined}
            />
          );
        },
        sceneContainerStyle: { backgroundColor: T.bg },
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.textDim,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          tabBarLabel: "Home",
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      {showDebtsTab ? (
        <Tab.Screen
          name="Debts"
          component={DebtStackNavigator}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="card-outline" size={size} color={color} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name="Income"
        component={IncomeStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
          tabBarLabel: "Income",
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { token, isLoading } = useAuth();
  const {
    dashboard,
    settings: bootstrapSettings,
    isLoading: bootstrapLoading,
  } = useBootstrapData();
  const [onboardingState, setOnboardingState] = useState<OnboardingStatusResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [openBudgetSettingsAfterOnboarding, setOpenBudgetSettingsAfterOnboarding] = useState(false);
  const lastOnboardingTokenRef = useRef<string | null>(null);
  const hasBootstrapSetup = Boolean(dashboard?.budgetPlanId) || Boolean(bootstrapSettings?.id);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      lastOnboardingTokenRef.current = null;
      setOnboardingState((prev) => (prev === null ? prev : null));
      setOnboardingLoading((prev) => (prev ? false : prev));
      setOpenBudgetSettingsAfterOnboarding((prev) => (prev ? false : prev));
      return;
    }

    if (bootstrapLoading && !hasBootstrapSetup && onboardingState === null) {
      setOnboardingLoading((prev) => (prev ? prev : true));
      return;
    }

    if (hasBootstrapSetup) {
      lastOnboardingTokenRef.current = token;
      setOnboardingLoading((prev) => (prev ? false : prev));
      setOnboardingState((prev) => {
        if (prev?.required === false) return prev;
        return ONBOARDING_FALLBACK;
      });
      return;
    }

    if (lastOnboardingTokenRef.current === token && onboardingState !== null) {
      return;
    }

    lastOnboardingTokenRef.current = token;

    setOnboardingLoading((prev) => (prev ? prev : true));

    void (async () => {
      try {
        const data = await apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", {
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
        });
        if (!cancelled) {
          setOnboardingState((prev) => {
            if (
              prev?.required === data.required
              && prev?.completed === data.completed
              && prev?.profile === data.profile
              && prev?.occupations === data.occupations
            ) {
              return prev;
            }
            return data;
          });
        }
      } catch {
        if (!cancelled) {
          setOnboardingState((prev) => (prev === ONBOARDING_FALLBACK ? prev : ONBOARDING_FALLBACK));
        }
      } finally {
        if (!cancelled) setOnboardingLoading((prev) => (prev ? false : prev));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapLoading, hasBootstrapSetup, onboardingState, token]);

  const completeOnboardingAndHydrate = useCallback(async () => {
    setCompletingOnboarding(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await Promise.all([
            apiFetch<Settings>("/api/bff/settings", { cacheTtlMs: 0, skipOnUnauthorized: true }),
            apiFetch(`/api/bff/expenses/summary?month=${month}&year=${year}&scope=pay_period`, {
              cacheTtlMs: 0,
              skipOnUnauthorized: true,
            }),
            apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", { cacheTtlMs: 0, skipOnUnauthorized: true }),
          ]);
          break;
        } catch {
          if (attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }

      try {
        const latest = await apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", {
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
        });
        setOnboardingState((prev) => {
          if (
            prev?.required === latest.required
            && prev?.completed === latest.completed
            && prev?.profile === latest.profile
            && prev?.occupations === latest.occupations
          ) {
            return prev;
          }
          return latest;
        });
      } catch {
        setOnboardingState((prev) => (prev === ONBOARDING_FALLBACK ? prev : ONBOARDING_FALLBACK));
      }

    } finally {
      setCompletingOnboarding(false);
    }
  }, []);

  if (isLoading || (token && (onboardingLoading || completingOnboarding))) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.accent} />
        {completingOnboarding ? (
          <Text style={{ marginTop: 10, color: T.textDim, fontSize: 14, fontWeight: "600" }}>Setting up your plan…</Text>
        ) : null}
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={APP_STACK_SCREEN_OPTIONS}>
      {token ? (
        onboardingState?.required ? (
          <Stack.Screen name="Onboarding">
            {() => (
              <OnboardingScreen
                initial={onboardingState}
                onCompleted={() => {
                    setOpenBudgetSettingsAfterOnboarding(true);
                  void completeOnboardingAndHydrate();
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              initialParams={openBudgetSettingsAfterOnboarding
                ? { screen: "Settings", params: { initialTab: "budget" } }
                : undefined}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreenAdapter}
              options={({ navigation }) => ({
                headerShown: true,
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                header: () => <RootTopHeader navigation={navigation} />,
              })}
            />
            <Stack.Screen name="Payments" component={PaymentsScreen} />
            <Stack.Screen
              name="Analytics"
              component={AnalyticsScreen}
              options={({ navigation }) => ({
                headerShown: true,
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                header: () => <RootTopHeader navigation={navigation} />,
              })}
            />
            <Stack.Screen name="GoalsProjection" component={GoalsProjectionScreen} />
            <Stack.Screen
              name="GoalDetail"
              component={GoalDetailScreen}
              options={({ navigation, route }) => ({
                headerShown: true,
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                header: () => (
                  <TopHeader
                    onSettings={() => {}}
                    onIncome={() => {}}
                    onAnalytics={() => {}}
                    onNotifications={() => {}}
                    onBack={() => navigation.goBack()}
                    leftVariant="back"
                    centerLabel={typeof route.params?.goalTitle === "string" && route.params.goalTitle.trim() ? route.params.goalTitle : "Goal"}
                    showIncomeAction={false}
                    rightContent={<View style={{ width: 34, height: 34 }} />}
                  />
                ),
              })}
            />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="SettingsProfileDetails" component={SettingsProfileDetailsScreen} />
            <Stack.Screen name="SettingsDebtManagement" component={SettingsDebtManagementScreen} />
            <Stack.Screen name="SettingsIncomeSettings" component={SettingsIncomeSettingsScreen} />
            <Stack.Screen name="SettingsStrategy" component={SettingsStrategyScreen} />
          </>
        )
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
