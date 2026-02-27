import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { DebtSummaryData, DebtSummaryItem, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import type { DebtStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import Svg, { G, Path, Defs, LinearGradient, Stop, Circle, Line as SvgLine, Text as SvgText, Rect } from "react-native-svg";

type Nav = NativeStackNavigationProp<DebtStackParamList, "DebtList">;

const TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  store_card: "Store Card",
  loan: "Loan",
  mortgage: "Mortgage",
  hire_purchase: "Hire Purchase",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  credit_card: "#e25c5c",
  store_card: "#f4a942",
  loan: "#a78bfa",
  mortgage: "#38bdf8",
  hire_purchase: "#f4a942",
  other: "#64748b",
};

function DebtCard({
  debt,
  currency,
  onPress,
}: {
  debt: DebtSummaryItem;
  currency: string;
  onPress: () => void;
}) {
  const accentColor = TYPE_COLORS[debt.type] ?? T.accent;
  const progressPct =
    debt.initialBalance > 0
      ? Math.min(100, ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100)
      : 100;
  const isPaid = debt.paid || debt.currentBalance <= 0;
  const dueThisMonth = Math.max(0, debt.dueThisMonth ?? debt.computedMonthlyPayment ?? 0);
  const paidThisMonth = Math.max(0, debt.paidThisMonth ?? 0);
  const isPaymentMonthPaid = Boolean(debt.isPaymentMonthPaid) || (dueThisMonth > 0 && paidThisMonth >= dueThisMonth);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.cardPressed]}>
      <View style={[s.cardAccent, { backgroundColor: accentColor }]} />
      <View style={s.cardBody}>
        {/* Top row */}
        <View style={s.cardTop}>
          <View style={s.cardLeft}>
            <Text style={s.cardName} numberOfLines={1}>{debt.displayTitle ?? debt.name}</Text>
            <Text style={[s.cardType, { color: accentColor }]}>
              {debt.displaySubtitle ?? TYPE_LABELS[debt.type] ?? debt.type}
            </Text>
          </View>
          <View style={s.cardRight}>
            <Text style={[s.cardBalance, isPaid && s.cardBalancePaid]}>
              {isPaid ? "Paid off" : fmt(debt.currentBalance, currency)}
            </Text>
            {!isPaid && debt.computedMonthlyPayment > 0 && (
              <Text style={s.cardMonthly}>
                {fmt(debt.computedMonthlyPayment, currency)}/mo
              </Text>
            )}
          </View>
        </View>

        {/* Progress bar */}
        {!isPaid && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <View
                style={[
                  s.progressFill,
                  { width: `${progressPct}%` as `${number}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
            <Text style={s.progressPct}>{progressPct.toFixed(0)}% paid</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.cardFooter}>
          {!isPaid && dueThisMonth > 0 && (
            <Text style={s.cardMetaStrong}>
              {isPaymentMonthPaid ? "Paid this month" : "Due this month"} {fmt(isPaymentMonthPaid ? paidThisMonth : dueThisMonth, currency)}
            </Text>
          )}
          {debt.interestRate != null && debt.interestRate > 0 && (
            <Text style={s.cardMeta}>{debt.interestRate}% APR</Text>
          )}
          {debt.dueDay != null && !isPaid && (
            <Text style={s.cardMeta}>Due day {debt.dueDay}</Text>
          )}
          {isPaid && (
            <View style={s.paidBadge}>
              <Ionicons name="checkmark-circle" size={12} color={T.green} />
              <Text style={s.paidBadgeText}>Fully paid</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text style={s.cardChevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function DebtScreen() {
  const navigation = useNavigation<Nav>();
  const topHeaderOffset = useTopHeaderOffset();
  const insets = useSafeAreaInsets();

  const [summary, setSummary] = useState<DebtSummaryData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBalance, setAddBalance] = useState("");
  const [addMonthlyPayment, setAddMonthlyPayment] = useState("");
  const [addCreditLimit, setAddCreditLimit] = useState("");
  const [addInterestRate, setAddInterestRate] = useState("");
  const [addInstallmentMonths, setAddInstallmentMonths] = useState("");
  const [addType, setAddType] = useState("loan");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [chartWidth, setChartWidth] = useState(320);
  const [selectedProjectionMonth, setSelectedProjectionMonth] = useState<number | null>(null);
  const [paidHistoryOpen, setPaidHistoryOpen] = useState(false);

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, sets] = await Promise.all([
        apiFetch<DebtSummaryData>("/api/bff/debt-summary"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setSummary(s);
      setSettings(sets);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load debts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isCreditCardType = addType === "credit_card";
  const isLoanStyleType = addType === "loan" || addType === "mortgage";

  const handleAdd = async () => {
    const name = addName.trim();
    const balance = parseFloat(addBalance);
    const monthlyPayment = parseFloat(addMonthlyPayment);
    const creditLimit = addCreditLimit.trim() ? parseFloat(addCreditLimit) : null;
    const interestRate = addInterestRate.trim() ? parseFloat(addInterestRate) : null;
    const installmentMonths = addInstallmentMonths.trim() ? Number.parseInt(addInstallmentMonths, 10) : null;
    if (!name) { Alert.alert("Missing name", "Enter a debt name."); return; }
    if (isNaN(balance) || balance <= 0) { Alert.alert("Invalid amount", "Enter a valid balance."); return; }
    if (isNaN(monthlyPayment) || monthlyPayment < 0) {
      Alert.alert("Invalid monthly payment", "Enter a valid monthly payment (0 or more).");
      return;
    }
    if (creditLimit != null && (!Number.isFinite(creditLimit) || creditLimit <= 0)) {
      Alert.alert("Invalid credit limit", "Enter a valid credit limit.");
      return;
    }
    if (interestRate != null && (!Number.isFinite(interestRate) || interestRate < 0)) {
      Alert.alert("Invalid interest", "Enter a valid interest rate (APR). ");
      return;
    }
    if (installmentMonths != null && (!Number.isFinite(installmentMonths) || installmentMonths <= 0)) {
      Alert.alert("Invalid term", "Enter how many months to pay over.");
      return;
    }
    try {
      setSaving(true);
      await apiFetch("/api/bff/debts", {
        method: "POST",
        body: {
          name,
          initialBalance: balance,
          currentBalance: balance,
          amount: monthlyPayment,
          type: addType,
          budgetPlanId: settings?.id ?? "",
          creditLimit: isCreditCardType ? creditLimit : null,
          interestRate,
          installmentMonths,
        },
      });
      setAddName("");
      setAddBalance("");
      setAddMonthlyPayment("");
      setAddCreditLimit("");
      setAddInterestRate("");
      setAddInstallmentMonths("");
      setShowAddForm(false);
      await load();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add debt");
    } finally {
      setSaving(false);
    }
  };

  const visibleDebts = (summary?.debts ?? []).filter((d) =>
    filter === "active" ? d.isActive && !d.paid : true,
  );
  const paidDebts = (summary?.debts ?? [])
    .filter((d) => d.paid || d.currentBalance <= 0 || Boolean(d.lastPaidAt))
    .sort((a, b) => {
      const aTime = a.lastPaidAt ? new Date(a.lastPaidAt).getTime() : 0;
      const bTime = b.lastPaidAt ? new Date(b.lastPaidAt).getTime() : 0;
      return bTime - aTime;
    });
  const formatPaidDate = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: topHeaderOffset }]}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: topHeaderOffset }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={s.safe} edges={[]}>
      <FlatList
        data={visibleDebts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.scroll, { paddingTop: topHeaderOffset }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
        }
        ListHeaderComponent={
          <>
            {/* Hero stat cards + chart */}
            {(() => {
              const activeDebts = (summary?.debts ?? []).filter(d => d.isActive && !d.paid);
              const total = summary?.totalDebtBalance ?? 0;
              const monthly = summary?.totalMonthlyDebtPayments ?? 0;
              const highestAPR = activeDebts
                .filter(d => d.interestRate != null && d.interestRate > 0)
                .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

              const estimateDebtMonths = (d: DebtSummaryItem) => {
                if (d.paid || d.currentBalance <= 0) return 0;
                const rate = d.interestRate ? d.interestRate / 100 / 12 : 0;
                const pmt = d.computedMonthlyPayment > 0
                  ? d.computedMonthlyPayment
                  : (monthly > 0 ? (monthly / Math.max(activeDebts.length, 1)) : 0);
                if (pmt <= 0) return null;

                let b = d.currentBalance;
                for (let m = 1; m <= 360; m++) {
                  b = rate > 0 ? b * (1 + rate) - pmt : b - pmt;
                  if (b <= 0) return m;
                }
                return null;
              };

              // Build composite projection: simulate each debt independently then sum
              const projectedDebtMonths = activeDebts
                .map(estimateDebtMonths)
                .filter((m): m is number => m != null);
              const baseMaxMonths = projectedDebtMonths.length > 0 ? Math.max(...projectedDebtMonths) : 0;
              const MAX_M = Math.min(Math.max(baseMaxMonths + 2, 60), 360);
              const projection: number[] = [];
              for (let m = 0; m <= MAX_M; m++) {
                let sum = 0;
                for (const d of activeDebts) {
                  if (d.paid || d.currentBalance <= 0) continue;
                  const rate = d.interestRate ? d.interestRate / 100 / 12 : 0;
                  const pmt = d.computedMonthlyPayment > 0 ? d.computedMonthlyPayment : (monthly / Math.max(activeDebts.length, 1));
                  let b = d.currentBalance;
                  for (let i = 0; i < m; i++) {
                    if (b <= 0) break;
                    b = rate > 0 ? b * (1 + rate) - pmt : b - pmt;
                    b = Math.max(0, b);
                  }
                  sum += b;
                }
                projection.push(Math.max(0, sum));
                if (sum <= 0) break;
              }
              const months = projection.length - 1;
              const canProjectPayoff = projection.length > 0 && projection[projection.length - 1] <= 0;
              const monthsToClear = canProjectPayoff ? months : null;

              // SVG chart constants
              const CH = 180;
              const PL = 0; const PR = 0; const PT = 44; const PB = 32;

              const toX = (i: number) => PL + (i / Math.max(1, months)) * (chartWidth - PL - PR);
              const toY = (v: number) => PT + (1 - (total > 0 ? v / total : 0)) * (CH - PT - PB);

              // Smooth cubic bezier path
              const smoothPath = (() => {
                if (projection.length < 2) return "";
                const pts = projection.map((v, i) => ({ x: toX(i), y: toY(v) }));
                let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
                for (let i = 1; i < pts.length; i++) {
                  const prev = pts[i - 1];
                  const curr = pts[i];
                  const cpX = (prev.x + curr.x) / 2;
                  d += ` C${cpX.toFixed(1)},${prev.y.toFixed(1)} ${cpX.toFixed(1)},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
                }
                return d;
              })();
              const lastPt = projection.length > 0 ? { x: toX(months), y: toY(0) } : null;
              const areaPath = smoothPath + (lastPt ? ` L${lastPt.x.toFixed(1)},${(CH - PB).toFixed(1)} L${toX(0).toFixed(1)},${(CH - PB).toFixed(1)} Z` : "");

              const milestoneMonths = [6, 12, 24].filter((m) => m > 0 && m < months);
              const selectedMonth =
                selectedProjectionMonth != null && selectedProjectionMonth >= 1 && selectedProjectionMonth <= months
                  ? selectedProjectionMonth
                  : Math.max(1, Math.floor(months * 0.28));

              // Tooltip anchor defaults to ~25% through payoff, or selected milestone
              const tipIdx = selectedMonth;
              const tipX = toX(tipIdx);
              const tipY = toY(projection[tipIdx] ?? total);
              const tipVal = fmt(projection[tipIdx] ?? total, currency);
              const tipPillW = Math.max(80, tipVal.length * 9 + 20);
              const tipPillH = 28;
              const tipPillX = Math.min(Math.max(tipX - tipPillW / 2, 4), chartWidth - tipPillW - 4);
              const tipPillY = tipY - tipPillH - 10;
              const tipLineX = tipX;
              const tipLineY1 = tipY - 10;
              const tipLineY2 = tipPillY + tipPillH;

              // Axis labels
              const payoffDate = new Date();
              payoffDate.setMonth(payoffDate.getMonth() + months);
              const payoffLabel = months > 0 ? payoffDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : "";
              const monthLabel = (m: number) => (m === 12 ? "1y" : m === 24 ? "2y" : `${m}m`);

              return (
                <>
                  {/* Two big hero cards */}
                  <View style={s.heroRow}>
                    <View style={[s.heroCard, { borderColor: T.red + "44" }]}>
                      <Text style={s.heroLabel}>TOTAL DEBT</Text>
                      <Text style={[s.heroValue, { color: T.red }]}>{fmt(total, currency)}</Text>
                      <Text style={s.heroSub}>{activeDebts.length} active {activeDebts.length === 1 ? "debt" : "debts"}</Text>
                    </View>
                    <View style={[s.heroCard, { borderColor: T.orange + "44" }]}>
                      <Text style={s.heroLabel}>MONTHLY</Text>
                      <Text style={[s.heroValue, { color: T.orange }]}>{fmt(monthly, currency)}</Text>
                      <Text style={s.heroSub}>
                        {monthsToClear != null ? `~${monthsToClear} mo to clear` : "No payoff projected"}
                      </Text>
                    </View>
                  </View>

                  {/* Revolut-style payoff projection chart */}
                  {months > 1 && (
                    <View style={s.chartCard}>
                      <View style={s.chartHeader}>
                        <View>
                          <Text style={s.chartTitle}>Debt Payoff Projection</Text>
                          <Text style={s.chartSub}>
                            {monthsToClear != null ? `Debt-free by ${payoffLabel}` : "No payoff projected"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Pressable
                            onPress={() => navigation.navigate("DebtAnalytics", {
                              debts: activeDebts,
                              totalMonthly: monthly,
                              currency,
                            })}
                            style={s.analyticsBtn}
                          >
                            <Text style={s.analyticsBtnTxt}>Analytics</Text>
                            <Ionicons name="chevron-forward" size={12} color={T.accent} />
                          </Pressable>
                          <View style={s.chartBadge}>
                            <Text style={s.chartBadgeTxt}>{months}mo</Text>
                          </View>
                        </View>
                      </View>

                      <View
                          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
                        style={{ height: CH, width: "100%" }}
                      >
                        <Svg width={chartWidth} height={CH}>
                          <Defs>
                            <LinearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                              <Stop offset="0" stopColor={T.accent} stopOpacity="0.22" />
                              <Stop offset="1" stopColor={T.accent} stopOpacity="0.0" />
                            </LinearGradient>
                          </Defs>
                          {/* Gradient fill */}
                          <Path d={areaPath} fill="url(#debtGrad)" />
                          {/* Main line — thin & smooth */}
                          <Path
                            d={smoothPath}
                            stroke={T.accent}
                            strokeWidth={1.5}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Vertical connector from dot to pill */}
                          <SvgLine
                            x1={tipLineX} y1={tipLineY2}
                            x2={tipLineX} y2={tipLineY1}
                            stroke={T.accent} strokeWidth={1} strokeDasharray="2,2" strokeOpacity="0.5"
                          />
                          {/* Tooltip pill */}
                          <Rect
                            x={tipPillX} y={tipPillY}
                            width={tipPillW} height={tipPillH}
                            rx={8} fill={T.text}
                          />
                          <SvgText
                            x={tipPillX + tipPillW / 2} y={tipPillY + 18}
                            fontSize={12} fill={T.bg}
                            textAnchor="middle" fontWeight="800"
                          >{tipVal}</SvgText>
                          {/* Dot on line at tooltip */}
                          <Circle cx={tipX} cy={tipY} r={5} fill={T.card} stroke={T.accent} strokeWidth={2} />
                          <Circle cx={tipX} cy={tipY} r={2.5} fill={T.accent} />
                          {/* Milestone points (6m / 1y / 2y) */}
                          {milestoneMonths.map((m) => (
                            <G key={`m-${m}`}>
                              <SvgLine
                                x1={toX(m)}
                                y1={CH - PB}
                                x2={toX(m)}
                                y2={CH - PB - 5}
                                stroke={T.border}
                                strokeWidth={1}
                              />
                              <Circle
                                cx={toX(m)}
                                cy={toY(projection[m] ?? 0)}
                                r={selectedMonth === m ? 3.8 : 3}
                                fill={selectedMonth === m ? T.accent : T.accentDim}
                                stroke={T.accent}
                                strokeWidth={1}
                              />
                            </G>
                          ))}
                          {/* End dot (green = debt free) */}
                          <Circle cx={toX(months)} cy={toY(0)} r={4} fill={T.green} />
                          {/* Baseline */}
                          <SvgLine
                            x1={toX(0)} y1={CH - PB}
                            x2={toX(months)} y2={CH - PB}
                            stroke={T.border} strokeWidth={1}
                          />
                          {/* Axis labels */}
                          <SvgText x={toX(0) + 2} y={CH - 10} fontSize={10} fill={T.textMuted} textAnchor="start" fontWeight="600">Now</SvgText>
                          {milestoneMonths.map((m) => (
                            <SvgText key={`lbl-${m}`} x={toX(m)} y={CH - 10} fontSize={10} fill={T.textMuted} textAnchor="middle" fontWeight="600">
                              {monthLabel(m)}
                            </SvgText>
                          ))}
                          <SvgText x={toX(months) - 2} y={CH - 10} fontSize={10} fill={T.green} textAnchor="end" fontWeight="700">{payoffLabel}</SvgText>
                        </Svg>
                      </View>

                      {milestoneMonths.length > 0 && (
                        <View style={s.milestoneRow}>
                          <Text style={s.milestoneLabel}>Tap point:</Text>
                          {milestoneMonths.map((m) => (
                            <Pressable
                              key={`chip-${m}`}
                              onPress={() => setSelectedProjectionMonth(m)}
                              style={[s.milestoneChip, selectedMonth === m && s.milestoneChipActive]}
                            >
                              <Text style={[s.milestoneChipText, selectedMonth === m && s.milestoneChipTextActive]}>
                                {m === 12 ? "1 year" : m === 24 ? "2 years" : `${m} months`}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}

                      {/* Insight chips */}
                      <View style={s.chipRow}>
                        {highestAPR && (
                          <View style={[s.chip, { borderColor: T.red + "55" }]}>
                            <Ionicons name="flame-outline" size={13} color={T.red} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.chipLabel}>HIGHEST APR</Text>
                              <Text style={s.chipValue} numberOfLines={1}>
                                {highestAPR.displayTitle ?? highestAPR.name} · {highestAPR.interestRate}%
                              </Text>
                            </View>
                          </View>
                        )}
                        <View style={[s.chip, { borderColor: T.green + "55" }]}>
                          <Ionicons name="time-outline" size={13} color={T.green} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.chipLabel}>SELECTED POINT</Text>
                            <Text style={s.chipValue}>{fmt(projection[selectedMonth] ?? 0, currency)} at {selectedMonth}mo</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              );
            })()}

            {/* Filter + Add header */}
            <View style={s.listHeader}>
              <View style={s.filterRow}>
                <Pressable
                  onPress={() => setFilter("active")}
                  style={[s.filterBtn, filter === "active" && s.filterBtnActive]}
                >
                  <Text style={[s.filterTxt, filter === "active" && s.filterTxtActive]}>Active</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFilter("all")}
                  style={[s.filterBtn, filter === "all" && s.filterBtnActive]}
                >
                  <Text style={[s.filterTxt, filter === "all" && s.filterTxtActive]}>All</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setShowAddForm(true)} style={s.addBtn}>
                <Ionicons name="add" size={18} color={T.onAccent} />
                <Text style={s.addBtnTxt}>Debt</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <DebtCard
            debt={item}
            currency={currency}
            onPress={() => navigation.navigate("DebtDetail", { debtId: item.id, debtName: item.displayTitle ?? item.name })}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="card-outline" size={52} color={T.iconMuted} />
            <Text style={s.emptyTitle}>No active debts</Text>
            <Text style={s.emptySubtitle}>Tap "Add Debt" to track a debt</Text>
          </View>
        }
        ListFooterComponent={
          <>
            <View style={s.historyCard}>
              <Pressable style={s.historyHeader} onPress={() => setPaidHistoryOpen((v) => !v)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons name="checkmark-done-circle-outline" size={15} color={T.green} />
                  <Text style={s.historyHeading}>Paid History</Text>
                  <Text style={s.historyCount}>({paidDebts.length})</Text>
                </View>
                <Ionicons
                  name={paidHistoryOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={T.textMuted}
                />
              </Pressable>

              {paidHistoryOpen && paidDebts.length === 0 && (
                <Text style={s.historyEmpty}>No paid debts yet.</Text>
              )}

              {paidHistoryOpen && paidDebts.map((debt, i) => (
                <View key={debt.id} style={[s.historyRow, i > 0 && s.tipBorder]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.historyTitle} numberOfLines={1}>{debt.displayTitle ?? debt.name}</Text>
                    <Text style={s.historyDetail} numberOfLines={1}>{debt.displaySubtitle ?? TYPE_LABELS[debt.type] ?? debt.type}</Text>
                    <Text style={s.historyDate} numberOfLines={1}>
                      {`${debt.paid || debt.currentBalance <= 0 ? "Paid" : "Last payment"} ${formatPaidDate(debt.lastPaidAt) ?? "date unavailable"}`}
                    </Text>
                  </View>
                  <Text style={s.historyAmount}>
                    {fmt(debt.paid || debt.currentBalance <= 0 ? debt.initialBalance : debt.paidAmount, currency)}
                  </Text>
                </View>
              ))}
            </View>

            {(summary?.tips ?? []).length > 0 ? (
              <View style={s.tipsCard}>
                <View style={s.tipsHeader}>
                  <Ionicons name="bulb-outline" size={15} color={T.orange} />
                  <Text style={s.tipsHeading}>Tips</Text>
                </View>
                {summary!.tips.map((tip, i) => (
                  <View key={i} style={[s.tipRow, i > 0 && s.tipBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tipTitle}>{tip.title}</Text>
                      <Text style={s.tipDetail}>{tip.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        }
      />

      <Modal
        visible={showAddForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddForm(false)}
      >
        <KeyboardAvoidingView
          style={s.sheetOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddForm(false)} />
          <View
            style={[
              s.sheet,
              {
                paddingTop: Math.max(10, insets.top + 8),
                paddingBottom: Math.max(22, insets.bottom + 10),
              },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Add Debt</Text>
              <Pressable onPress={() => setShowAddForm(false)} hitSlop={10} style={s.sheetCloseBtn}>
                <Ionicons name="close" size={18} color={T.textDim} />
              </Pressable>
            </View>

            <ScrollView
              style={s.sheetFormScroll}
              contentContainerStyle={s.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.addForm}>
                <TextInput
                  style={s.input}
                  placeholder="Name (e.g. Car loan)"
                  placeholderTextColor={T.textMuted}
                  value={addName}
                  onChangeText={setAddName}
                  autoFocus
                />
                <TextInput
                  style={s.input}
                  placeholder={isLoanStyleType ? "Loan amount" : "Current balance"}
                  placeholderTextColor={T.textMuted}
                  value={addBalance}
                  onChangeText={setAddBalance}
                  keyboardType="decimal-pad"
                />
                {isCreditCardType ? (
                  <TextInput
                    style={s.input}
                    placeholder="Credit limit"
                    placeholderTextColor={T.textMuted}
                    value={addCreditLimit}
                    onChangeText={setAddCreditLimit}
                    keyboardType="decimal-pad"
                  />
                ) : null}
                <TextInput
                  style={s.input}
                  placeholder="Monthly payment"
                  placeholderTextColor={T.textMuted}
                  value={addMonthlyPayment}
                  onChangeText={setAddMonthlyPayment}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={s.input}
                  placeholder="Interest APR % (optional)"
                  placeholderTextColor={T.textMuted}
                  value={addInterestRate}
                  onChangeText={setAddInterestRate}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={s.input}
                  placeholder="Pay over months (optional)"
                  placeholderTextColor={T.textMuted}
                  value={addInstallmentMonths}
                  onChangeText={setAddInstallmentMonths}
                  keyboardType="number-pad"
                />
                <View style={s.typeRow}>
                  {Object.keys(TYPE_LABELS).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setAddType(t)}
                      style={[s.typeBtn, addType === t && { backgroundColor: TYPE_COLORS[t] + "33", borderColor: TYPE_COLORS[t] }]}
                    >
                      <Text style={[s.typeBtnTxt, addType === t && { color: TYPE_COLORS[t] }]}> 
                        {TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
            <Pressable onPress={handleAdd} disabled={saving} style={[s.saveBtn, saving && s.disabled]}>
              {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Add Debt</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { paddingBottom: 140 },

  // Hero stat cards
  heroRow: { flexDirection: "row", gap: 10, padding: 14, paddingBottom: 0 },
  heroCard: {
    flex: 1,
    padding: 16,
    gap: 2,
    ...cardBase,
    borderWidth: 1,
  },
  heroLabel: { color: T.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  heroValue: { fontSize: 22, fontWeight: "900", marginTop: 4 },
  heroSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },

  // Analytics chart card
  chartCard: { margin: 14, marginBottom: 0, padding: 14, gap: 12, ...cardBase },
  chartHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  chartTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  chartSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  chartBadge: { backgroundColor: T.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.accentFaint },
  chartBadgeTxt: { color: T.accent, fontSize: 12, fontWeight: "800" },
  analyticsBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: T.accentDim, borderWidth: 1, borderColor: T.accentFaint },
  analyticsBtnTxt: { color: T.accent, fontSize: 11, fontWeight: "800" },
  milestoneRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  milestoneLabel: { color: T.textMuted, fontSize: 11, fontWeight: "700", marginRight: 2 },
  milestoneChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  milestoneChipActive: { borderColor: T.accent, backgroundColor: T.accentDim },
  milestoneChipText: { color: T.textDim, fontSize: 11, fontWeight: "700" },
  milestoneChipTextActive: { color: T.accent },

  // Insight chips
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 12, backgroundColor: T.cardAlt,
    borderWidth: 1,
  },
  chipLabel: { color: T.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  chipValue: { color: T.text, fontSize: 11, fontWeight: "800", marginTop: 1 },

  historyCard: { margin: 14, marginTop: 6, padding: 14, ...cardBase },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  historyHeading: { color: T.text, fontSize: 13, fontWeight: "900" },
  historyCount: { color: T.textMuted, fontSize: 12, fontWeight: "700" },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  historyTitle: { color: T.text, fontSize: 13, fontWeight: "800" },
  historyDetail: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  historyDate: { color: T.textMuted, fontSize: 11, marginTop: 2, fontWeight: "600" },
  historyAmount: { color: T.green, fontSize: 13, fontWeight: "900" },
  historyEmpty: { color: T.textDim, fontSize: 12, fontWeight: "600", fontStyle: "italic", paddingTop: 2 },

  tipsCard: { margin: 14, marginTop: 6, padding: 14, ...cardBase },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  tipsHeading: { color: T.text, fontSize: 13, fontWeight: "900" },
  tipRow: { flexDirection: "row", paddingVertical: 6 },
  tipBorder: { borderTopWidth: 1, borderTopColor: T.border, marginTop: 6 },
  tipTitle: { color: T.text, fontSize: 13, fontWeight: "900" },
  tipDetail: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },

  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  filterRow: { flexDirection: "row", gap: 6 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
  },
  filterBtnActive: { backgroundColor: T.accentDim, borderColor: T.accent },
  filterTxt: { color: T.textDim, fontSize: 13, fontWeight: "800" },
  filterTxtActive: { color: T.text },
  addBtn: {
    backgroundColor: T.accent,
    borderRadius: 18,
    height: 36,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnTxt: { color: T.onAccent, fontSize: 13, fontWeight: "800" },

  addForm: {
    margin: 0,
    padding: 0,
    gap: 10,
  },
  addFormTitle: { color: T.text, fontWeight: "900", fontSize: 15 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
  },
  typeBtnTxt: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },

  // Debt card
  card: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginBottom: 10,
    overflow: "hidden",
    ...cardElevated,
  },
  cardPressed: { opacity: 0.75 },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end" },
  cardName: { color: T.text, fontSize: 15, fontWeight: "900" },
  cardType: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  cardBalance: { color: T.text, fontSize: 17, fontWeight: "900" },
  cardBalancePaid: { color: T.green },
  cardMonthly: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  progressWrap: { gap: 4 },
  progressBg: { height: 7, backgroundColor: T.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPct: { color: T.textDim, fontSize: 11, fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardMetaStrong: { color: T.accent, fontSize: 12, fontWeight: "800" },
  cardMeta: { color: T.textDim, fontSize: 12, fontWeight: "600" },
  paidBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  paidBadgeText: { color: T.green, fontSize: 12, fontWeight: "600" },
  cardChevron: { color: T.textMuted, fontSize: 20 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: T.text, fontSize: 16, fontWeight: "800" },
  emptySubtitle: { color: T.textDim, fontSize: 13 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },

  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    backgroundColor: T.card,
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 10,
  },
  sheetScrollContent: {
    paddingBottom: 6,
  },
  sheetFormScroll: {
    flex: 1,
    minHeight: 0,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: T.border,
    marginBottom: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: T.text, fontWeight: "900", fontSize: 15 },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
});
