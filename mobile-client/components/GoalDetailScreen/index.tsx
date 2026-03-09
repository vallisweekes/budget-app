import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";

import { useGoalDetailScreenController } from "@/lib/hooks/useGoalDetailScreenController";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import type { RootStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";

import GoalDetailFooter from "./GoalDetailFooter";
import GoalDetailForm from "./GoalDetailForm";
import GoalDetailHero from "./GoalDetailHero";
import GoalDetailHomeToggle from "./GoalDetailHomeToggle";
import { styles } from "./style";

type GoalDetailRoute = RouteProp<RootStackParamList, "GoalDetail">;

export default function GoalDetailScreen() {
  const { params } = useRoute<GoalDetailRoute>();
  const topHeaderOffset = useTopHeaderOffset();
  const {
    currentAmountNumber,
    deleteConfirmOpen,
    deleting,
    description,
    error,
    goal,
    handleDelete,
    handleSave,
    isDirty,
    load,
    loading,
    progress,
    refreshing,
    saving,
    setDeleteConfirmOpen,
    setDescription,
    setShowOnHome,
    setTargetAmount,
    setTargetYear,
    setTitle,
    settings,
    showOnHome,
    targetAmount,
    targetAmountNumber,
    targetYear,
    title,
  } = useGoalDetailScreenController(params);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={styles.info}>Loading goal…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !goal) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={46} color={T.textDim} />
          <Text style={styles.error}>{error ?? "Goal not found"}</Text>
          <Pressable onPress={() => void load({ force: true })} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topHeaderOffset + 10 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ force: true })} tintColor={T.accent} />}
        >
          <GoalDetailHero
            title={goal.title}
            currentAmount={typeof currentAmountNumber === "number" ? currentAmountNumber : 0}
            targetAmount={typeof targetAmountNumber === "number" ? targetAmountNumber : 0}
            currency={settings?.currency}
            progress={progress}
          />

          <GoalDetailForm
            title={title}
            description={description}
            targetAmount={targetAmount}
            targetYear={targetYear}
            currentAmount={currentAmountNumber}
            currency={settings?.currency}
            disabled={saving || deleting}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onTargetAmountChange={setTargetAmount}
            onTargetYearChange={setTargetYear}
          />

          <GoalDetailHomeToggle
            showOnHome={showOnHome}
            disabled={saving || deleting}
            onPress={() => setShowOnHome((prev) => !prev)}
          />
        </ScrollView>

        <GoalDetailFooter
          isDirty={isDirty}
          saving={saving}
          deleting={deleting}
          onDelete={() => setDeleteConfirmOpen(true)}
          onSave={() => void handleSave()}
        />
      </KeyboardAvoidingView>

      <DeleteConfirmSheet
        visible={deleteConfirmOpen}
        title="Delete Goal"
        description={`Are you sure you want to delete "${goal.title}"? This cannot be undone.`}
        isBusy={deleting}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </SafeAreaView>
  );
}