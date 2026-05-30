import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SectionList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Goal } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useAppTranslation } from "@/hooks";
import { fmt } from "@/lib/formatting";
import { translateGoalDescription, translateGoalTitle } from "@/lib/i18n";
import { asMoneyNumber, resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { useTopHeaderOffset } from "@/hooks";
import type { MainTabScreenProps } from "@/navigation/types";
import { getMobileApiErrorMessage, useCreateGoalMutation, useGetGoalsQuery } from "@/store/api";
import { T } from "@/lib/theme";
import { s } from "@/components/GoalsScreen/style";
import MoneyInput from "@/components/Shared/MoneyInput";
import NumericInput from "@/components/Shared/NumericInput";

export default function GoalsScreen({ navigation, route }: MainTabScreenProps<"Goals">) {
  const listRef = useRef<SectionList<Goal>>(null);
  useScrollToTop(listRef);
  const topHeaderOffset = useTopHeaderOffset();
  const listTopInset = Math.max(24, topHeaderOffset - 36);

  const {
    dashboard,
    settings,
    isLoading: bootstrapLoading,
    refreshSettings,
  } = useBootstrapData();
  const { t } = useAppTranslation(settings?.language);

  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetAmount, setNewTargetAmount] = useState("");
  const [newCurrentAmount, setNewCurrentAmount] = useState("");
  const [newTargetYear, setNewTargetYear] = useState("");
  const lastOpenAddTokenRef = useRef<number | null>(null);
  const [createGoal] = useCreateGoalMutation();

  const budgetPlanId = settings?.id ?? dashboard?.budgetPlanId;
  const goalsQuery = useGetGoalsQuery(
    { budgetPlanId: budgetPlanId ?? "" },
    {
      skip: !budgetPlanId,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );
  const goals = goalsQuery.data ?? [];

  const loading = Boolean((!settings && bootstrapLoading) || (!goalsQuery.data && goalsQuery.isLoading));
  const refreshing = Boolean(goalsQuery.data && goalsQuery.isFetching);
  const error = goalsQuery.error ? getMobileApiErrorMessage(goalsQuery.error, t("goals.error.loadFailed")) : null;

  const parseAmount = (raw: string): number | undefined => {
    const t = String(raw ?? "").trim().replace(/,/g, "");
    if (!t) return undefined;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    if (n < 0) return undefined;
    return Math.round(n * 100) / 100;
  };

  const parseYear = (raw: string): number | null | undefined => {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    const y = Math.floor(n);
    if (y < 1900 || y > 3000) return undefined;
    return y;
  };

  const openAdd = useCallback(() => {
    setNewTitle("");
    setNewTargetAmount("");
    setNewCurrentAmount("");
    setNewTargetYear("");
    setAddOpen(true);
  }, []);

  const submitAdd = async () => {
    if (!budgetPlanId) return;
    const title = newTitle.trim();
    if (!title) {
      Alert.alert(t("goals.alert.titleRequiredTitle"), t("goals.alert.titleRequiredMessage"));
      return;
    }

    const targetAmount = parseAmount(newTargetAmount);
    const currentAmount = parseAmount(newCurrentAmount);
    const targetYear = parseYear(newTargetYear);
    if (targetYear === undefined) {
      Alert.alert(t("goals.alert.invalidTargetYearTitle"), t("goals.alert.invalidTargetYearAddMessage"));
      return;
    }

    setAdding(true);
    try {
      await createGoal({
        budgetPlanId,
        title,
        targetAmount,
        currentAmount,
        targetYear,
      }).unwrap();
      setAddOpen(false);
    } catch (err: unknown) {
      Alert.alert(t("goals.error.addFailed"), getMobileApiErrorMessage(err, "Unknown error"));
    } finally {
      setAdding(false);
    }
  };

  const sections = useMemo(() => {
    const byYear = new Map<string, { title: string; year: number | null; data: Goal[] }>();

    for (const goal of goals) {
      const y = typeof goal.targetYear === "number" ? goal.targetYear : null;
      const key = y === null ? "none" : String(y);
      const title = y === null ? t("goals.section.noTargetYear") : t("goals.section.yearGoals", { year: y });
      const existing = byYear.get(key);
      if (existing) existing.data.push(goal);
      else byYear.set(key, { title, year: y, data: [goal] });
    }

    const list = Array.from(byYear.values());
    list.sort((a, b) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return -1;
      if (b.year === null) return 1;
      return a.year - b.year;
    });

    return list;
  }, [goals, t]);

  useEffect(() => {
    const token = Number(route?.params?.openAddToken);
    if (!Number.isFinite(token)) return;
    if (lastOpenAddTokenRef.current === token) return;
    lastOpenAddTokenRef.current = token;
    openAdd();
  }, [openAdd, route?.params?.openAddToken]);

  if (loading) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.info}>{t("goals.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={46} color={T.textDim} />
          <Text style={s.error}>{error}</Text>
          <Pressable onPress={() => void goalsQuery.refetch()} style={s.retryBtn}>
            <Text style={s.retryTxt}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={s.safe} edges={[]}>
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          if (!adding) setAddOpen(false);
        }}
      >
        <View style={s.modalOverlay}>
          <Pressable style={s.modalDismissArea} onPress={() => (!adding ? setAddOpen(false) : null)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalCardWrap}>
            <View style={s.modalCard}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>{t("goals.modal.addTitle")}</Text>

              <Text style={s.inputLabel}>{t("goals.field.name")}</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={t("goals.field.namePlaceholder")}
                placeholderTextColor={T.textMuted}
                style={s.input}
                editable={!adding}
              />

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>{t("goals.field.targetAmount")}</Text>
                  <MoneyInput
                    currency={settings?.currency}
                    value={newTargetAmount}
                    onChangeValue={setNewTargetAmount}
                    placeholder={t("goals.field.targetAmountPlaceholder")}
                    editable={!adding}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>{t("goals.field.currentAmount")}</Text>
                  <MoneyInput
                    currency={settings?.currency}
                    value={newCurrentAmount}
                    onChangeValue={setNewCurrentAmount}
                    placeholder={t("goals.field.currentAmountPlaceholder")}
                    editable={!adding}
                  />
                </View>
              </View>

              <Text style={s.inputLabel}>{t("goals.field.targetYearOptional")}</Text>
              <NumericInput
                value={newTargetYear}
                onChangeText={setNewTargetYear}
                placeholder={t("goals.field.targetYearPlaceholder")}
                placeholderTextColor={T.textMuted}
                style={s.input}
                keyboardType="number-pad"
                editable={!adding}
              />

              <View style={s.modalBtns}>
                <Pressable
                  onPress={() => setAddOpen(false)}
                  disabled={adding}
                  style={[s.modalBtn, s.modalBtnGhost, adding && s.disabled]}
                >
                  <Text style={s.modalBtnGhostText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  onPress={submitAdd}
                  disabled={adding}
                  style={[s.modalBtn, s.modalBtnPrimary, adding && s.disabled]}
                >
                  {adding ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.modalBtnPrimaryText}>{t("common.add")}</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        stickyHeaderHiddenOnScroll={false}
        style={{ marginTop: listTopInset }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshSettings({ force: true });
              void goalsQuery.refetch();
            }}
            tintColor={T.accent}
          />
        }
        contentContainerStyle={s.list}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const target = asMoneyNumber((item as any).targetAmount);
          const category = String((item as any).category ?? "").trim().toLowerCase();
          const current = resolveGoalCurrentAmount(category, (item as any).currentAmount, settings);
          const showProgress = Number.isFinite(target) && target > 0;
          const progress = showProgress && Number.isFinite(current) ? Math.max(0, Math.min(1, current / target)) : 0;
          const translatedTitle = translateGoalTitle(item.title, settings?.language);
          const translatedDescription = translateGoalDescription(item.description, settings?.language);

          return (
            <Pressable
              onPress={() => navigation.navigate("GoalDetail", { goalId: item.id, goalTitle: translatedTitle })}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            >
              <View style={s.cardTop}>
                <View style={[s.pill, item.targetYear ? null : s.pillWarn]}>
                  <Text style={[s.pillText, item.targetYear ? null : s.pillWarnText]}>
                    {item.targetYear ? t("goals.card.targetYear", { year: item.targetYear }) : t("goals.card.setTargetYear")}
                  </Text>
                </View>

                <View style={s.chevronWrap}>
                  <Ionicons name="chevron-forward" size={20} color={T.iconMuted} />
                </View>
              </View>

              <Text style={s.cardTitle} numberOfLines={2}>
                {translatedTitle}
              </Text>

              {translatedDescription ? (
                <Text style={s.cardDesc} numberOfLines={3}>
                  {translatedDescription}
                </Text>
              ) : null}

              {showProgress ? (
                <View style={{ marginTop: 10 }}>
                  <View style={s.progressRow}>
                    <Text style={s.progressLabel}>{t("goals.card.progress")}</Text>
                    <Text style={s.progressValue}>
                      {fmt(current, settings?.currency ?? undefined)} / {fmt(target, settings?.currency ?? undefined)}
                    </Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  <Text style={s.progressPct}>{t("goals.card.complete", { percent: (progress * 100).toFixed(1) })}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>{t("goals.empty")}</Text>}
      />
    </SafeAreaView>
  );
}
