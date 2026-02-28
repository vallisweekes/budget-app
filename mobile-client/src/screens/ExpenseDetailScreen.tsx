import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Polyline } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import type { ExpensesStackParamList } from "@/navigation/types";
import type { Expense, ExpenseFrequencyPoint, ExpenseFrequencyPointStatus, ExpenseFrequencyResponse } from "@/lib/apiTypes";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";
import EditExpenseSheet from "@/components/Expenses/EditExpenseSheet";

const EXPENSE_HERO_BLUE = "#2a0a9e";

type MonthPoint = {
  key: string;
  month: number;
  year: number;
  label: string;
  ratio: number; // 0..1
  present: boolean;
  status: ExpenseFrequencyPointStatus;
};

function monthYearLabel(month: number, year: number): string {
  return `${monthLabel(month)} ${year}`;
}

function buildExpenseTips(params: {
  displayName: string;
  currency: string;
  amountNum: number;
  remainingNum: number;
  isPaid: boolean;
  dueDays: number | null;
  isDirectDebit: boolean;
  month: number;
  year: number;
  points: MonthPoint[];
  subtitle: string;
  missedBefore: boolean;
  debt: ExpenseFrequencyResponse["debt"] | undefined;
  indicator: { label: string } | null;
}): string[] {
  const {
    displayName,
    currency,
    amountNum,
    remainingNum,
    isPaid,
    dueDays,
    isDirectDebit,
    month,
    year,
    points,
    subtitle,
    missedBefore,
    debt,
    indicator,
  } = params;

  const tips: string[] = [];

  const current = { month, year };
  const history = points.filter((p) => compareMonthYear({ month: p.month, year: p.year }, current) <= 0);
  const future = points.filter((p) => compareMonthYear({ month: p.month, year: p.year }, current) > 0);
  const nextMonth = future[0] ? { month: future[0].month, year: future[0].year } : null;

  const counts = history.reduce(
    (acc, p) => {
      acc.total += 1;
      if (p.status === "paid") acc.paid += 1;
      else if (p.status === "partial") acc.partial += 1;
      else if (p.status === "unpaid") acc.unpaid += 1;
      else if (p.status === "missed") acc.missed += 1;
      return acc;
    },
    { total: 0, paid: 0, partial: 0, unpaid: 0, missed: 0 }
  );

  const currentPoint = points.find((p) => p.month === month && p.year === year) ?? null;

  if (counts.total > 0) {
    const quality = indicator?.label ? ` (${indicator.label})` : "";
    tips.push(
      `${subtitle}${quality}: last ${counts.total} months — ${counts.paid} paid, ${counts.partial} partial, ${counts.unpaid} unpaid, ${counts.missed} missed.`
    );
  } else {
    tips.push(`${displayName}: add a couple of months of history to unlock better tips.`);
  }

  if (isPaid) {
    tips.push(`Fully paid for ${monthYearLabel(month, year)}. If you want it to feel easier next time, start next month early: ${fmt(amountNum / 4, currency)} per week.`);
  } else {
    tips.push(`You’re ${fmt(remainingNum, currency)} away from fully paid.`);
  }

  if (!isPaid && remainingNum > 0.005) {
    if (dueDays == null) {
      tips.push("Add a due date to get better reminders + a smarter payment spread.");
    } else if (dueDays < 0) {
      tips.push("It’s overdue — recording even a small payment can prevent this becoming a missed month.");
    } else if (dueDays <= 7) {
      const perDay = remainingNum / Math.max(1, dueDays);
      tips.push(`Due soon (${dueDays} days). A reasonable spread is about ${fmt(perDay, currency)} per day until it’s cleared.`);
    } else {
      const weeks = Math.max(1, Math.min(4, Math.ceil(Math.min(dueDays, 28) / 7)));
      const perWeek = remainingNum / weeks;
      tips.push(`You’ve got ${dueDays} days. A simple spread: ${fmt(perWeek, currency)} per week for ${weeks} week${weeks === 1 ? "" : "s"}.`);
    }
  }

  if (!isDirectDebit) {
    tips.push(
      missedBefore
        ? "You’ve missed this in prior months — consider Direct Debit / Standing Order so it doesn’t depend on memory."
        : "If this repeats monthly, enabling Direct Debit can reduce the mental load."
    );
  } else {
    tips.push("Direct Debit is enabled — double-check the due date so it’s always funded in time.");
  }

  if (currentPoint && !isPaid) {
    if (currentPoint.status === "partial") {
      tips.push(`This month is part-paid so far — topping up now avoids a last-minute scramble.`);
    } else if (currentPoint.status === "unpaid") {
      tips.push(`This month looks unpaid so far — even a small chip-in keeps it out of “missed”.`);
    }
  }

  if (debt?.hasDebt && !debt.cleared) {
    const activeCount = debt.activeCount ?? 0;
    const activeBalance = typeof debt.activeBalance === "number" ? debt.activeBalance : null;
    const monthHint = nextMonth ? monthYearLabel(nextMonth.month, nextMonth.year) : "next month";
    tips.push(
      `Linked debt: ${activeCount} active. After this bill is covered, ${monthHint} is a good target to overpay the debt${activeBalance && activeBalance > 0.005 ? ` (about ${fmt(activeBalance, currency)} remaining).` : "."}`
    );
  } else if (debt?.hasDebt && debt.cleared) {
    tips.push("Good news — linked debt looks cleared. You can keep payments consistent to avoid it building back up.");
  }

  // Keep it stable and short; avoid empty strings.
  return tips.map((t) => t.trim()).filter(Boolean);
}

function monthLabel(month: number): string {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[Math.max(1, Math.min(12, month)) - 1] ?? "";
}

function nextNMonths(fromMonth: number, fromYear: number, n: number): Array<{ month: number; year: number }> {
  const out: Array<{ month: number; year: number }> = [];
  let m = fromMonth;
  let y = fromYear;
  for (let i = 0; i < n; i += 1) {
    out.push({ month: m, year: y });
    m += 1;
    if (m >= 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function compareMonthYear(a: { month: number; year: number }, b: { month: number; year: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function statusLabel(status: ExpenseFrequencyPointStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Part";
    case "unpaid":
      return "Unpaid";
    case "missed":
      return "Missed";
    case "upcoming":
      return "Next";
    default:
      return "";
  }
}

function indicatorLabel(kind: "good" | "moderate" | "bad"): string {
  return kind === "good" ? "Good" : kind === "bad" ? "Bad" : "Moderate";
}

function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  try {
    return `${getApiBaseUrl()}${raw}`;
  } catch {
    return null;
  }
}

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpenseDetail">;

type LoadState = {
  expense: Expense | null;
  categoryExpenses: Expense[];
};

function formatDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function isoLikeToDMY(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatUpdatedLabel(lastPaymentAt: string | null | undefined): string {
  if (!lastPaymentAt) return "No payment made";
  const raw = String(lastPaymentAt);
  const direct = isoLikeToDMY(raw);
  if (direct) return direct;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "No payment made";
  return formatDMY(d);
}

function formatDueDateLabel(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return "No due date";
  const raw = String(isoOrYmd);
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "No due date";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dueDateColor(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return T.textMuted;
  const raw = String(isoOrYmd);
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return T.textMuted;
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return T.red;
  if (days <= 5) return T.orange;
  return T.green;
}

export default function ExpenseDetailScreen({ route, navigation }: Props) {
  const { height, width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const { expenseId, expenseName, categoryId, categoryName, color, month, year, budgetPlanId, currency } =
    route.params;

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<LoadState>({ expense: null, categoryExpenses: [] });

  const [paySheetOpen, setPaySheetOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [paying, setPaying] = React.useState(false);

  const [editSheetOpen, setEditSheetOpen] = React.useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [logoFailed, setLogoFailed] = React.useState(false);

  const [frequency, setFrequency] = React.useState<ExpenseFrequencyResponse | null>(null);
  const [frequencyLoading, setFrequencyLoading] = React.useState(false);

  const [tipIndex, setTipIndex] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}${qp}`);
      const list = Array.isArray(all) ? all : [];
      const found = list.find((e) => e.id === expenseId) ?? null;
      const effectiveCategoryId = found?.categoryId ?? categoryId;
      const inCategory = list.filter((e) => e.categoryId === effectiveCategoryId);
      setData({ expense: found, categoryExpenses: inCategory });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData({ expense: null, categoryExpenses: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, expenseId, month, year]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const expense = data.expense;

  React.useEffect(() => {
    setLogoFailed(false);
  }, [expense?.id, expense?.logoUrl]);

  const amountNum = expense ? Number(expense.amount) : 0;
  const paidNum = expense ? Number(expense.paidAmount) : 0;
  const remainingNum = Math.max(0, amountNum - paidNum);
  const isPaid = amountNum <= 0 ? true : paidNum >= amountNum - 0.005;

  const dueDays = React.useMemo(() => {
    const raw = expense?.dueDate;
    if (!raw) return null;
    const iso = String(raw).length >= 10 ? String(raw).slice(0, 10) : String(raw);
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return Math.round((d.getTime() - Date.now()) / 86_400_000);
  }, [expense?.dueDate]);

  const updatedLabel = expense ? formatUpdatedLabel(expense.lastPaymentAt) : "";

  const displayName = String((expense?.name || expenseName) ?? "");

  const logoUri = React.useMemo(() => resolveLogoUri(expense?.logoUrl), [expense?.logoUrl]);
  const showLogo = Boolean(logoUri) && !logoFailed;

  const monthsForFuture = React.useMemo(() => nextNMonths(month, year, 6), [month, year]);

  React.useEffect(() => {
    if (!expense) {
      setFrequency(null);
      setFrequencyLoading(false);
      return;
    }
    let cancelled = false;
    setFrequencyLoading(true);
    void (async () => {
      try {
        const res = await apiFetch<ExpenseFrequencyResponse>(`/api/bff/expenses/${expense.id}/frequency?months=6`);
        if (cancelled) return;
        if (!res || typeof res !== "object" || !Array.isArray((res as any).points)) {
          setFrequency(null);
          return;
        }
        setFrequency(res);
      } catch {
        if (cancelled) return;
        setFrequency(null);
      } finally {
        if (cancelled) return;
        setFrequencyLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expense]);

  const missedBefore = React.useMemo(() => {
    const points = frequency?.points ?? [];
    const current = { month, year };
    return points.some((p) => {
      const isPastOrCurrent = compareMonthYear({ month: p.month, year: p.year }, current) <= 0;
      if (!isPastOrCurrent) return false;
      return p.status === "missed" || p.status === "unpaid" || p.status === "partial";
    });
  }, [frequency?.points, month, year]);

  const freqDisplay = React.useMemo(() => {
    if (frequency?.points?.length) {
      const points = (frequency.points as ExpenseFrequencyPoint[]).map((p) => ({
        key: p.key,
        month: p.month,
        year: p.year,
        label: p.label,
        ratio: Number(p.ratio) || 0,
        present: Boolean(p.present),
        status: p.status,
      }));
      return { subtitle: frequency.subtitle || "Payment frequency", points };
    }

    const points: MonthPoint[] = monthsForFuture.map(({ month: m, year: y }) => ({
      key: `${y}-${String(m).padStart(2, "0")}`,
      month: m,
      year: y,
      label: monthLabel(m),
      ratio: 0,
      present: false,
      status: "upcoming",
    }));
    return { subtitle: "Next 6 months", points };
  }, [frequency, monthsForFuture]);

  const freqIndicator = React.useMemo(() => {
    const points = freqDisplay.points;
    const current = { month, year };
    const historyOnly = points.filter((p) => compareMonthYear({ month: p.month, year: p.year }, current) <= 0);
    if (!historyOnly.length) return null;

    const hasMissed = historyOnly.some((p) => p.status === "missed");
    const hasProblems = historyOnly.some((p) => p.status === "missed" || p.status === "unpaid" || p.status === "partial");
    const debtsCleared = frequency?.debt?.cleared ?? true;

    const kind: "good" | "moderate" | "bad" = hasMissed && !debtsCleared ? "bad" : hasProblems ? "moderate" : "good";
    const color = kind === "good" ? T.green : kind === "bad" ? T.red : T.orange;

    return { kind, label: indicatorLabel(kind), color };
  }, [freqDisplay.points, frequency?.debt?.cleared, month, year]);

  const tips = React.useMemo(() => {
    return buildExpenseTips({
      displayName,
      currency,
      amountNum,
      remainingNum,
      isPaid,
      dueDays: dueDays ?? null,
      isDirectDebit: Boolean(expense?.isDirectDebit),
      month,
      year,
      points: freqDisplay.points,
      subtitle: freqDisplay.subtitle,
      missedBefore,
      debt: frequency?.debt,
      indicator: freqIndicator ? { label: freqIndicator.label } : null,
    });
  }, [amountNum, currency, displayName, dueDays, expense?.isDirectDebit, freqDisplay.points, freqDisplay.subtitle, freqIndicator, frequency?.debt, isPaid, missedBefore, month, remainingNum, year]);

  React.useEffect(() => {
    setTipIndex(0);
  }, [expense?.id, tips.length]);

  React.useEffect(() => {
    if (tips.length <= 1) return;
    const id = setInterval(() => {
      setTipIndex((prev) => (tips.length ? (prev + 1) % tips.length : 0));
    }, 20_000);
    return () => clearInterval(id);
  }, [tips.length]);

  const spark = React.useMemo(() => {
    const points = freqDisplay.points;
    const n = points.length;
    const w = Math.max(220, Math.round(width - 56));
    const h = 54;
    const pad = 6;

    const lastKnownIndex = (() => {
      let idx = -1;
      for (let i = 0; i < n; i += 1) {
        if (points[i]?.present) idx = i;
      }
      return idx;
    })();

    const toXY = (i: number): { x: number; y: number } => {
      const p = points[i];
      const ratio = p ? Math.max(0, Math.min(1, Number(p.ratio) || 0)) : 0;
      const x = n <= 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1);
      const y = pad + (1 - ratio) * (h - pad * 2);
      return { x, y };
    };

    const poly = lastKnownIndex >= 0 ? Array.from({ length: lastKnownIndex + 1 }, (_, i) => toXY(i)) : [];
    const polylinePoints = poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    return { w, h, pad, toXY, lastKnownIndex, polylinePoints };
  }, [freqDisplay.points, width]);

  const handlePay = React.useCallback(async () => {
    if (!expense || paying) return;

    const delta = Number.parseFloat(String(payAmount ?? ""));
    if (!Number.isFinite(delta) || delta <= 0) return;

    const nextPaid = Math.min(amountNum, paidNum + delta);
    const nextIsPaid = nextPaid >= amountNum - 0.005;

    setPaying(true);
    try {
      const body: Record<string, unknown> = {
        paidAmount: nextPaid,
        paid: nextIsPaid,
      };
      if (nextIsPaid && expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }

      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body,
      });

      setPaySheetOpen(false);
      setPayAmount("");
      await load();
    } finally {
      setPaying(false);
    }
  }, [amountNum, expense, load, paidNum, payAmount, paying]);

  const handleMarkPaid = React.useCallback(async () => {
    if (!expense || paying) return;

    setPaying(true);
    try {
      const body: Record<string, unknown> = {
        paidAmount: amountNum,
        paid: true,
      };
      if (expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }

      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body,
      });

      setPaySheetOpen(false);
      setPayAmount("");
      await load();
    } finally {
      setPaying(false);
    }
  }, [amountNum, expense, load, paying]);

  const confirmDelete = React.useCallback(async () => {
    if (!expense || deleting) return;

    setDeleting(true);
    try {
      await apiFetch(`/api/bff/expenses/${expense.id}`, { method: "DELETE" });
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  }, [deleting, expense, navigation]);

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : error || !expense ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error ?? "Expense not found"}</Text>
          <Pressable
            onPress={() => {
              setRefreshing(true);
              void load();
            }}
            style={s.retryBtn}
          >
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            style={{ backgroundColor: EXPENSE_HERO_BLUE }}
            contentContainerStyle={[s.scroll, { paddingBottom: 120 + tabBarHeight + 12 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load();
                }}
                tintColor={T.accent}
              />
            }
          >
            <View style={s.hero}>
              <View style={s.brandCircle}>
                {showLogo ? (
                  <Image
                    source={{ uri: logoUri as string }}
                    style={s.brandLogo}
                    resizeMode="contain"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <Text style={s.brandLetter}>
                    {(displayName.trim()?.[0] ?? "?").toUpperCase()}
                  </Text>
                )}
              </View>

              <Text style={s.heroName} numberOfLines={2}>
                {displayName}
              </Text>

              <Text style={s.heroAmount}>{fmt(amountNum, currency)}</Text>
              <Text style={s.heroUpdated}>Updated: {updatedLabel}</Text>

              <View
                style={[
                  s.heroDueBadge,
                  {
                    borderColor: `${dueDateColor(expense.dueDate)}66`,
                    backgroundColor: `${dueDateColor(expense.dueDate)}22`,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                <Text style={s.heroDueTxt}>{formatDueDateLabel(expense.dueDate)}</Text>
              </View>

              <View style={s.heroCards}>
                <View style={s.heroCard}>
                  <Text style={s.heroCardLbl}>Paid</Text>
                  <Text style={[s.heroCardVal, { color: T.green }]}>{fmt(paidNum, currency)}</Text>
                </View>
                <View style={s.heroCard}>
                  <Text style={s.heroCardLbl}>Remaining</Text>
                  <Text style={[s.heroCardVal, { color: T.orange }]}>{fmt(remainingNum, currency)}</Text>
                </View>
              </View>

              <View style={[s.quickRow, height <= 740 && { marginTop: 18 }]}>
                {!isPaid ? (
                  <>
                    <Pressable
                      style={[s.quickBtn, s.quickBtnPrimary, paying && s.quickDisabled]}
                      onPress={handleMarkPaid}
                      disabled={paying}
                    >
                      <Text style={s.quickPrimaryTxt}>Pay in full</Text>
                    </Pressable>
                    <Pressable
                      style={[s.quickBtn, s.quickBtnSecondary, paying && s.quickDisabled]}
                      onPress={() => {
                        setPayAmount("");
                        setPaySheetOpen(true);
                      }}
                      disabled={paying}
                    >
                      <Text style={s.quickSecondaryTxt}>Record payment</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            {isPaid ? (
              <View style={s.freqCard}>
                <View style={s.freqHeadRow}>
                  <Text style={s.freqTitle}>Payment frequency</Text>
                  <View style={s.freqHeadRight}>
                    {freqIndicator ? (
                      <Text style={[s.freqIndicatorTxt, { color: freqIndicator.color }]}>{freqIndicator.label}</Text>
                    ) : null}
                    {frequencyLoading ? <ActivityIndicator size="small" color={T.accent} /> : null}
                  </View>
                </View>
                <Text style={s.freqSub}>{freqDisplay.subtitle}</Text>

                <View style={s.sparkWrap}>
                  <Svg width={spark.w} height={spark.h}>
                    {spark.lastKnownIndex >= 1 ? (
                      <Polyline
                        points={spark.polylinePoints}
                        fill="none"
                        stroke={T.accent}
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : null}

                    {freqDisplay.points.map((p, i) => {
                      const { x, y } = spark.toXY(i);
                      const ratio = Math.max(0, Math.min(1, Number(p.ratio) || 0));

                      const dot = (() => {
                        switch (p.status) {
                          case "paid":
                            return { fill: T.green, stroke: "rgba(255,255,255,0.55)" };
                          case "partial":
                            return { fill: T.orange, stroke: "rgba(255,255,255,0.55)" };
                          case "unpaid":
                            return { fill: T.red, stroke: "rgba(255,255,255,0.55)" };
                          case "missed":
                            return { fill: "rgba(255,255,255,0.06)", stroke: T.red };
                          case "upcoming":
                            return { fill: T.border, stroke: "rgba(255,255,255,0.18)" };
                          default:
                            return { fill: p.present ? (ratio >= 0.999 ? T.green : ratio > 0 ? T.orange : T.red) : T.border, stroke: "rgba(255,255,255,0.18)" };
                        }
                      })();

                      const dotFill = dot.fill;
                      const dotStroke = dot.stroke;
                      return (
                        <Circle
                          key={p.key}
                          cx={x}
                          cy={y}
                          r={p.present ? 4 : p.status === "missed" ? 3.75 : 3.5}
                          fill={dotFill}
                          stroke={dotStroke}
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </Svg>

                  <View style={s.sparkLabels}>
                    {freqDisplay.points.map((p) => (
                      <Text key={`${p.key}-lbl`} style={s.sparkLbl}>
                        {p.label}
                      </Text>
                    ))}
                  </View>

                  <View style={s.sparkStatuses}>
                    {freqDisplay.points.map((p) => {
                      const c =
                        p.status === "paid"
                          ? T.green
                          : p.status === "partial"
                            ? T.orange
                            : p.status === "unpaid" || p.status === "missed"
                              ? T.red
                              : T.textMuted;
                      return (
                        <Text key={`${p.key}-st`} style={[s.sparkStatus, { color: c }]}>
                          {statusLabel(p.status)}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={s.aiCard}>
              <View style={s.aiTitleRow}>
                <Ionicons name="bulb-outline" size={16} color={T.orange} />
                <Text style={s.aiTitle}>AI tips</Text>
              </View>
              <Text style={s.aiText}>{tips[Math.max(0, Math.min(tips.length - 1, tipIndex))] ?? ""}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {expense ? (
        <View style={[s.bottomActionsWrap, { paddingBottom: tabBarHeight + 8 }]}>
          <View style={s.bottomActionsRow}>
            {!isPaid ? (
              <Pressable style={s.bottomActionBtn} onPress={() => setEditSheetOpen(true)}>
                <Text style={[s.bottomActionTxt, { color: EXPENSE_HERO_BLUE }]}>Edit</Text>
              </Pressable>
            ) : null}
            <Pressable style={[s.bottomActionBtn, isPaid && { flex: 1 }]} onPress={() => setDeleteConfirmOpen(true)}>
              <Text style={[s.bottomActionTxt, { color: T.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PaymentSheet
        visible={paySheetOpen}
        currency={currency}
        payAmount={payAmount}
        paying={paying}
        onChangeAmount={setPayAmount}
        onClose={() => {
          if (paying) return;
          setPaySheetOpen(false);
        }}
        onSave={handlePay}
        onMarkPaid={handleMarkPaid}
      />

      <EditExpenseSheet
        visible={editSheetOpen}
        expense={expense}
        budgetPlanId={budgetPlanId}
        currency={currency}
        onClose={() => setEditSheetOpen(false)}
        onSaved={() => {
          void load();
        }}
      />

      <DeleteConfirmSheet
        visible={deleteConfirmOpen}
        title="Delete Expense"
        description={`Are you sure you want to delete "${expense?.name ?? expenseName}"? This cannot be undone.`}
        isBusy={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteConfirmOpen(false);
        }}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EXPENSE_HERO_BLUE },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: EXPENSE_HERO_BLUE,
  },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },

  scroll: { paddingHorizontal: 14, paddingTop: 0, gap: 14 },

  hero: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: 0,
    marginHorizontal: -14,
    gap: 6,
    backgroundColor: EXPENSE_HERO_BLUE,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  brandCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  brandLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  brandLetter: {
    color: EXPENSE_HERO_BLUE,
    fontSize: 18,
    fontWeight: "900",
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(110,231,160,0.12)",
    borderWidth: 1,
    borderColor: "rgba(110,231,160,0.26)",
  },
  heroBadgeTxt: { color: "#6ee7a0", fontSize: 11, fontWeight: "800" },
  heroAmount: { color: "#ffffff", fontSize: 48, fontWeight: "900", letterSpacing: -1, marginBottom: 4 },
  heroAmountEditWrap: { width: "100%", paddingHorizontal: 8, marginBottom: 4 },
  heroAmountInput: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    paddingVertical: 0,
  },
  heroName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  heroNameInput: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  heroUpdated: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "500", marginBottom: 18 },
  heroDueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  heroDueTxt: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  heroCards: { flexDirection: "row", gap: 10, justifyContent: "center" },
  heroCard: {
    width: 140,
    height: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCardLbl: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", marginBottom: 5 },
  heroCardVal: { fontSize: 16, fontWeight: "900" },

  quickRow: { marginTop: 28, width: "100%", flexDirection: "row", gap: 10 },
  quickBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  quickBtnPrimary: { backgroundColor: "#ffffff" },
  quickBtnSecondary: { borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.1)" },
  quickPrimaryTxt: { color: EXPENSE_HERO_BLUE, fontSize: 15, fontWeight: "900" },
  quickSecondaryTxt: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  quickDisabled: { opacity: 0.55 },

  aiCard: {
    backgroundColor: T.cardAlt,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  aiTitle: { color: T.text, fontSize: 13, fontWeight: "900", letterSpacing: 0.2 },
  aiText: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  freqCard: {
    backgroundColor: T.cardAlt,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  freqHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  freqHeadRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  freqIndicatorTxt: { fontSize: 12, fontWeight: "900", letterSpacing: 0.2 },
  freqTitle: { color: T.text, fontSize: 13, fontWeight: "900", letterSpacing: 0.2 },
  freqSub: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 4, marginBottom: 10 },
  sparkWrap: { width: "100%", alignItems: "center" },
  sparkLabels: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  sparkLbl: { color: T.textMuted, fontSize: 11, fontWeight: "800" },
  sparkStatuses: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  sparkStatus: { fontSize: 10, fontWeight: "900" },
  freqBarsRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  freqBarCol: { alignItems: "center", justifyContent: "flex-end", flex: 1 },
  freqBarTrack: {
    height: 36,
    width: "100%",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  freqBarFill: { width: "100%", borderRadius: 10 },
  freqBarLbl: { color: T.textMuted, fontSize: 11, fontWeight: "800", marginTop: 6 },

  // (toggle section removed)

  bottomActionsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: EXPENSE_HERO_BLUE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.18)",
  },
  bottomActionsRow: { flexDirection: "row", gap: 12 },
  bottomActionBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomActionTxt: { fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },

  dateModalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  dateModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  dateModalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingBottom: 16,
    overflow: "hidden",
  },
  dateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  dateModalCancelTxt: { color: T.textDim, fontSize: 14, fontWeight: "800" },
  dateModalClearTxt: { color: T.red, fontSize: 14, fontWeight: "800" },
  dateModalDoneTxt: { color: T.accent, fontSize: 14, fontWeight: "900" },
});
