/**
 * CategoryExpensesScreen
 *
 * Decluttered list of expenses for a category.
 * - No inline payment fields
 * - No paid toggle, edit, delete actions on cards
 * - Tap card to navigate to ExpenseDetail
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";
import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";

type Props = NativeStackScreenProps<ExpensesStackParamList, "CategoryExpenses">;

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  featured: boolean;
};

function CategoryIcon({ name, color }: { name: string | null; color: string }) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;
  return (
    <View style={[iconStyles.iconWrap, { backgroundColor: withOpacity(color, 0.2) }]}>
      {Icon ? (
        <Icon size={18} color={color} strokeWidth={2} />
      ) : (
        <View style={[iconStyles.iconDot, { backgroundColor: color }]} />
      )}
    </View>
  );
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

function shouldUseLogoForName(name: string): boolean {
  const cleaned = String(name ?? "").trim().toLowerCase();
  if (!cleaned) return false;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 2) return false;

  const genericTerms = new Set([
    "work",
    "travel",
    "barber",
    "barbers",
    "rent",
    "housing",
    "utilities",
    "childcare",
    "groceries",
    "grocery",
    "food",
    "fuel",
    "transport",
    "allowance",
    "savings",
    "emergency",
    "income",
    "debt",
    "payment",
    "loan",
    "mortgage",
  ]);

  const hasGenericTerm = tokens.some((t) => genericTerms.has(t));
  if (hasGenericTerm) return false;

  return /[a-z]/i.test(cleaned);
}

function dueDaysColor(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return T.red;
  if (days <= 3) return "#f97316";
  if (days <= 7) return T.orange;
  return T.green;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CategoryExpensesScreen({ route, navigation }: Props) {
  const topHeaderOffset = useTopHeaderOffset();
  const { categoryId, categoryName, color, icon, month, year, budgetPlanId, currency } = route.params;
  const categoryColor = useMemo(() => resolveCategoryColor(color), [color]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});

  const loadCategories = useCallback(async () => {
    try {
      const qp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const cats = await apiFetch<Category[]>(`/api/bff/categories${qp}`);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [budgetPlanId]);

  const loadIncome = useCallback(async () => {
    try {
      const qp = new URLSearchParams({ month: String(month), year: String(year) });
      if (budgetPlanId) qp.set("budgetPlanId", budgetPlanId);
      const items = await apiFetch<Array<{ amount: string | number }>>(`/api/bff/income?${qp}`);
      if (Array.isArray(items)) {
        setTotalIncome(items.reduce((s, i) => s + Number(i.amount), 0));
      }
    } catch {
      // non-critical
    }
  }, [budgetPlanId, month, year]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(
        `/api/bff/expenses?month=${month}&year=${year}&refreshLogos=1${qp}`
      );
      setExpenses(Array.isArray(all) ? all.filter((e) => e.categoryId === categoryId) : []);
      setLogoFailed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, month, year]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    setLoading(true);
    setExpenses([]);
    void load();
    void loadCategories();
    void loadIncome();
  }, [load, loadCategories, loadIncome]);

  const plannedTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const paidTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.paidAmount), 0), [expenses]);
  const remainingTotal = useMemo(() => Math.max(plannedTotal - paidTotal, 0), [plannedTotal, paidTotal]);
  const pctPaid = useMemo(
    () => (plannedTotal > 0 ? Math.round((paidTotal / plannedTotal) * 100) : 0),
    [paidTotal, plannedTotal]
  );

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => {
      const amount = Number(item.amount);
      const paidAmount = Number(item.paidAmount);
      const ratio = amount > 0 ? Math.min(paidAmount / amount, 1) : item.paid ? 1 : 0;
      const dueColor = item.dueDate ? dueDaysColor(item.dueDate) : null;

      const logoUri =
        item.logoUrl && shouldUseLogoForName(item.name) && !logoFailed[item.id]
          ? resolveLogoUri(item.logoUrl)
          : null;

      const statusColor = item.paid ? T.green : T.orange;

      return (
        <Pressable
          style={rowStyles.card}
          onPress={() =>
            navigation.navigate("ExpenseDetail", {
              expenseId: item.id,
              expenseName: item.name,
              categoryId,
              categoryName,
              color,
              month,
              year,
              budgetPlanId,
              currency,
            })
          }
        >
          <View style={rowStyles.row1}>
            <View style={rowStyles.logoWrap}>
              {logoUri ? (
                <Image
                  source={{ uri: logoUri }}
                  style={rowStyles.logoImg}
                  onError={() => setLogoFailed((p) => ({ ...p, [item.id]: true }))}
                />
              ) : (
                <Text style={rowStyles.logoFallback}>
                  {String(item.name ?? "?").trim()[0]?.toUpperCase() ?? "?"}
                </Text>
              )}
            </View>

            <View style={rowStyles.nameCol}>
              <Text style={rowStyles.name} numberOfLines={1}>
                {item.name}
              </Text>

              <View style={rowStyles.badgeRow}>
                {item.dueDate ? (
                  <View
                    style={[
                      rowStyles.badge,
                      {
                        borderColor: dueColor ?? T.border,
                        backgroundColor: dueColor ? withOpacity(dueColor, 0.14) : "transparent",
                      },
                    ]}
                  >
                    <Text style={[rowStyles.badgeTxt, { color: dueColor ?? T.textDim }]}>
                      Due {formatDueDate(item.dueDate)}
                    </Text>
                  </View>
                ) : null}

                {item.isAllocation ? (
                  <View
                    style={[
                      rowStyles.badge,
                      { borderColor: T.border, backgroundColor: withOpacity(T.accent, 0.08) },
                    ]}
                  >
                    <Text style={[rowStyles.badgeTxt, { color: T.textDim }]}>Allocation</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={rowStyles.rightCol}>
              <View
                style={[
                  rowStyles.statusTag,
                  { borderColor: statusColor, backgroundColor: withOpacity(statusColor, 0.16) },
                ]}
              >
                <Text style={[rowStyles.statusTagTxt, { color: statusColor }]}>
                  {item.paid ? "Paid" : "Unpaid"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.iconMuted} />
            </View>
          </View>

          <View style={rowStyles.row2}>
            <Text style={rowStyles.amount}>{fmt(amount, currency)}</Text>
            <Text style={rowStyles.paidSub}>
              {item.paid ? "Paid" : paidAmount > 0 ? `${fmt(paidAmount, currency)} paid` : "Not paid"}
            </Text>
          </View>

          <View style={rowStyles.progressBg}>
            <View
              style={[
                rowStyles.progressFill,
                { width: `${Math.round(ratio * 100)}%`, backgroundColor: categoryColor },
              ]}
            />
          </View>
        </Pressable>
      );
    },
    [
      budgetPlanId,
      categoryColor,
      categoryId,
      categoryName,
      color,
      currency,
      logoFailed,
      month,
      navigation,
      year,
    ]
  );

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <CategoryIcon name={icon} color={categoryColor} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {categoryName}
            </Text>
            <Text style={styles.sub}>
              {new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLbl}>Planned</Text>
          <Text style={styles.statVal}>{fmt(plannedTotal, currency)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLbl}>Paid</Text>
          <Text style={styles.statVal}>{fmt(paidTotal, currency)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLbl}>Remaining</Text>
          <Text style={styles.statVal}>{fmt(remainingTotal, currency)}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>Category Progress</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeTxt}>{pctPaid}% paid</Text>
          </View>
        </View>

        <Text style={styles.heroAmount}>{fmt(remainingTotal, currency)}</Text>
        <Text style={styles.heroUpdated}>Income this month: {fmt(totalIncome, currency)}</Text>

        <View style={styles.heroCards}>
          <View style={styles.heroCard}>
            <Text style={styles.heroCardLbl}>Planned</Text>
            <Text style={[styles.heroCardVal, { color: "#ffffff" }]}>{fmt(plannedTotal, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroCardLbl}>Paid</Text>
            <Text style={[styles.heroCardVal, { color: "#6ee7a0" }]}>{fmt(paidTotal, currency)}</Text>
          </View>
        </View>

        <Pressable style={styles.addExpenseBtn} onPress={() => setAddSheetOpen(true)}>
          <Ionicons name="add" size={18} color={T.onAccent} />
          <Text style={styles.addExpenseBtnTxt}>Add expense</Text>
        </Pressable>
      </View>

      {loading && expenses.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.accent} />
          <Text style={styles.emptyTxt}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errTxt}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              setRefreshing(true);
              void load();
            }}
          >
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={rowStyles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={T.textDim}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTxt}>No expenses yet.</Text>
            </View>
          }
        />
      )}

      <AddExpenseSheet
        visible={addSheetOpen}
        month={month}
        year={year}
        budgetPlanId={budgetPlanId}
        initialCategoryId={categoryId}
        headerTitle={`Add ${categoryName} Expense`}
        currency={currency}
        categories={categories.map((cat) => ({
          categoryId: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          total: 0,
          paidTotal: 0,
          paidCount: 0,
          totalCount: 0,
        }))}
        onAdded={() => {
          setAddSheetOpen(false);
          void load();
          void loadIncome();
        }}
        onClose={() => setAddSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const iconStyles = StyleSheet.create({
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerText: { flex: 1 },
  title: { color: T.text, fontSize: 16, fontWeight: "900" },
  sub: { color: T.textDim, fontSize: 12, marginTop: 1, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: T.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 14 },
  statLbl: { color: T.textDim, fontSize: 10, fontWeight: "700", marginBottom: 2 },
  statVal: { color: T.text, fontSize: 14, fontWeight: "900" },
  hero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 10,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  heroLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heroBadge: {
    backgroundColor: "rgba(100,220,140,0.25)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(100,220,140,0.45)",
  },
  heroBadgeTxt: { color: "#6ee7a0", fontSize: 11, fontWeight: "800" },
  heroAmount: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroUpdated: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 18,
  },
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
  addExpenseBtn: {
    marginTop: 14,
    backgroundColor: T.accent,
    borderRadius: 18,
    height: 36,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addExpenseBtnTxt: { color: T.onAccent, fontSize: 13, fontWeight: "800" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  errTxt: { color: T.red, fontSize: 13, textAlign: "center" },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt: { color: T.onAccent, fontWeight: "700", fontSize: 13 },
  emptyTxt: { color: T.textDim, fontSize: 14, fontWeight: "600" },
});

const rowStyles = StyleSheet.create({
  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32 },
  card: {
    backgroundColor: T.cardAlt,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 14,
    marginBottom: 10,
  },
  row1: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%", borderRadius: 999 },
  logoFallback: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  nameCol: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 11, fontWeight: "600" },
  rightCol: { alignItems: "flex-end", gap: 6, paddingLeft: 8 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusTagTxt: { fontSize: 12, fontWeight: "800" },
  row2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 6,
  },
  amount: { color: T.text, fontSize: 15, fontWeight: "900" },
  paidSub: { color: T.textDim, fontSize: 12, fontWeight: "600" },
  progressBg: { height: 7, borderRadius: 4, backgroundColor: T.border, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 4 },
});
