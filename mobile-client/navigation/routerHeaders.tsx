import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { IncomeSacrificeData, Settings } from "@/lib/apiTypes";
import { appendNotificationInboxItem, subscribeNotificationInbox } from "@/lib/notificationInbox";
import TopHeader from "@/components/Shared/TopHeader";
import { T } from "@/lib/theme";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatIncomePeriodSpan(month: number): string {
  const safeMonth = Math.max(1, Math.min(12, month));
  const start = MONTH_NAMES_SHORT[(safeMonth - 2 + 12) % 12];
  const end = MONTH_NAMES_SHORT[(safeMonth - 1) % 12];
  return `${start} - ${end}`;
}

export function IncomeMonthSwitcher({
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
      <View style={styles.monthSwitchWrap}>
        <Pressable onPress={() => { if (!disablePrev) onNavigate(prevMonth, prevYear); }} disabled={disablePrev} style={[styles.monthSwitchBtn, disablePrev && styles.monthSwitchBtnDisabled]} hitSlop={8}>
          <Ionicons name="chevron-back" size={13} color={disablePrev ? T.textMuted : T.text} />
        </Pressable>
        <Pressable onPress={openYearPicker} style={styles.monthSwitchLabelBtn} hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }} accessibilityRole="button" accessibilityLabel="Select year">
          <Text style={styles.monthSwitchText}>{`${formatIncomePeriodSpan(month)} ${year}`}</Text>
        </Pressable>
        <Pressable onPress={() => { if (!disableNext) onNavigate(nextMonth, nextYear); }} disabled={disableNext} style={[styles.monthSwitchBtn, disableNext && styles.monthSwitchBtnDisabled]} hitSlop={8}>
          <Ionicons name="chevron-forward" size={13} color={disableNext ? T.textMuted : T.text} />
        </Pressable>
      </View>
      <Modal visible={isYearPickerVisible} transparent animationType="none" onRequestClose={() => closeYearPicker()}>
        <Pressable style={styles.yearPickerBackdrop} onPress={() => closeYearPicker()}>
          <Animated.View style={[styles.yearPickerBackdropShade, { opacity: backdropOpacity }]} />
          <Animated.View style={[styles.yearPickerCard, { transform: [{ translateY: cardTranslateY }, { scale: cardScale }] }]}>
            <Pressable onPress={() => {}}>
              <Text style={styles.yearPickerTitle}>Select year</Text>
              <View style={styles.yearPickerGrid}>
                {allowedYears.map((optionYear) => {
                  const isSelected = optionYear === year;
                  return (
                    <Pressable
                      key={String(optionYear)}
                      style={[styles.yearPickerItem, isSelected && styles.yearPickerItemSelected]}
                      onPress={() => closeYearPicker(() => onNavigate(month, optionYear))}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${optionYear}`}
                    >
                      <Text style={[styles.yearPickerItemText, isSelected && styles.yearPickerItemTextSelected]}>{optionYear}</Text>
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

export function RootTopHeader({ navigation }: { navigation: any }) {
  const { signOut } = useAuth();
  const [incomePendingCount, setIncomePendingCount] = useState(0);
  const [pendingBudgetPlanId, setPendingBudgetPlanId] = useState<string | null>(null);
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
    try {
      const data = await apiFetch<IncomeSacrificeData>(`/api/bff/income-sacrifice?month=${nowMonth}&year=${nowYear}`, { cacheTtlMs: 2_000 });
      const nextCount = getPendingCount(data);
      const nextPlanId = typeof data.budgetPlanId === "string" && data.budgetPlanId.trim() ? data.budgetPlanId : null;
      setIncomePendingCount((prev) => (prev === nextCount ? prev : nextCount));
      setPendingBudgetPlanId((prev) => (prev === nextPlanId ? prev : nextPlanId));
    } catch {
      setIncomePendingCount((prev) => (prev === 0 ? prev : 0));
      setPendingBudgetPlanId((prev) => (prev === null ? prev : null));
    }
  }, [getPendingCount, nowMonth, nowYear]);

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
  const incomeMonthBudgetPlanId = typeof deepestRoute?.params?.budgetPlanId === "string" ? deepestRoute.params.budgetPlanId : "";
  const canUseMonthSwitcher = isIncomeMonth && Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12 && Number.isFinite(yearNum) && Boolean(incomeMonthBudgetPlanId);
  const isIncomeMonthLocked = Number.isFinite(monthNum) && Number.isFinite(yearNum)
    ? (Number(yearNum) < nowYear || (Number(yearNum) === nowYear && Number(monthNum) < nowMonth))
    : false;

  const goToIncomeMonth = (nextMonth: number, nextYear: number) => {
    if (!incomeMonthBudgetPlanId) return;
    navigation.navigate("Income", {
      screen: "IncomeMonth",
      params: {
        month: nextMonth,
        year: nextYear,
        budgetPlanId: incomeMonthBudgetPlanId,
        initialMode: incomeMonthInitialMode,
      },
    });
  };

  const incomeMonthSwitcher = canUseMonthSwitcher ? (
    <IncomeMonthSwitcher month={Number(monthNum)} year={Number(yearNum)} budgetPlanId={incomeMonthBudgetPlanId} onNavigate={goToIncomeMonth} />
  ) : undefined;

  const handleBack = () => {
    if (isNotificationSettings) {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate("Dashboard");
      return;
    }
    if (isAnalytics) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Dashboard");
  };

  const analyticsRightContent = isAnalytics ? (
    <View style={styles.analyticsModeToggle}>
      <Animated.View pointerEvents="none" style={[styles.analyticsModeThumb, { transform: [{ translateX: analyticsOverviewMode === "year" ? 34 : 2 }] }]} />
      <Pressable onPress={() => navigation.setParams({ overviewMode: "month" })} style={styles.analyticsModeBtn} hitSlop={10}>
        <Text style={[styles.analyticsModeText, analyticsOverviewMode === "month" && styles.analyticsModeTextActive]}>M</Text>
      </Pressable>
      <Pressable onPress={() => navigation.setParams({ overviewMode: "year" })} style={styles.analyticsModeBtn} hitSlop={10}>
        <Text style={[styles.analyticsModeText, analyticsOverviewMode === "year" && styles.analyticsModeTextActive]}>Y</Text>
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
      void appendNotificationInboxItem({ id: buildNotificationId(notification), title, body });
    };

    void Notifications.getPresentedNotificationsAsync().then((presented) => { presented.forEach((entry) => appendFromNotification(entry)); }).catch(() => {});

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
    navigation.navigate("Income", {
      screen: "IncomeMonth",
      params: {
        month: Number(monthNum),
        year: Number(yearNum),
        budgetPlanId: incomeMonthBudgetPlanId,
        initialMode: "income",
        openIncomeAddAt: Date.now(),
      },
    });
  };

  return (
    <TopHeader
      onSettings={() => navigation.navigate("NotificationSettings", { initialTab: "notifications" })}
      onIncome={() => {}}
      onAnalytics={() => navigation.navigate("Analytics")}
      onNotifications={() => navigation.navigate("NotificationSettings", { initialTab: "notifications" })}
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

export const APP_STACK_SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: T.bg },
  animation: "fade_from_bottom" as const,
};

const styles = StyleSheet.create({
  monthSwitchWrap: { flexDirection: "row", alignItems: "center", gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  monthSwitchBtn: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  monthSwitchBtnDisabled: { opacity: 0.45 },
  monthSwitchText: { color: T.text, fontSize: 15, fontWeight: "700", minWidth: 118, paddingHorizontal: 1, textAlign: "center", letterSpacing: 0.1 },
  monthSwitchLabelBtn: { alignItems: "center" },
  yearPickerBackdrop: { flex: 1, alignItems: "stretch", justifyContent: "flex-start", position: "relative" },
  yearPickerBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },
  yearPickerCard: { width: "100%", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: T.border, backgroundColor: T.card, paddingTop: 56, paddingBottom: 14 },
  yearPickerTitle: { color: T.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.2, textAlign: "center", paddingTop: 10, paddingBottom: 6 },
  yearPickerGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingTop: 4, rowGap: 8 },
  yearPickerItem: { width: "33.33%", minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  yearPickerItemSelected: { backgroundColor: `${T.accent}22` },
  yearPickerItemText: { color: T.text, fontSize: 14, fontWeight: "600" },
  yearPickerItemTextSelected: { color: T.accent, fontWeight: "700" },
  analyticsModeToggle: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: T.border, borderRadius: 999, backgroundColor: `${T.cardAlt}66`, width: 68, height: 34, position: "relative", overflow: "hidden" },
  analyticsModeThumb: { position: "absolute", width: 30, height: 28, borderRadius: 14, backgroundColor: T.accent, top: 2 },
  analyticsModeBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  analyticsModeText: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  analyticsModeTextActive: { color: T.onAccent },
});