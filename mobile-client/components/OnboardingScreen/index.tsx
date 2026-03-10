import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useOnboardingScreenController } from "@/hooks";
import OnboardingStepContent from "@/components/OnboardingScreen/OnboardingStepContent";
import { onboardingStyles as styles } from "@/components/OnboardingScreen/style";
import type { OnboardingScreenProps } from "@/types/OnboardingScreen.types";

export default function OnboardingScreen(props: OnboardingScreenProps) {
  const controller = useOnboardingScreenController(props);
  const totalSteps = 6;
  const progressStep = controller.step + 1;
  const progressRatio = Math.max(0, Math.min(1, progressStep / totalSteps));
  const showProgress = controller.step > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.topBar, { top: controller.insets.top + 10 }]}> 
        <View style={styles.topBarSide}>
          {showProgress ? (
            <Pressable
              onPress={controller.onGoBackStep}
              disabled={controller.saving}
              style={[styles.floatingBackBtn, controller.saving && styles.disabled]}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color="#ffffff" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.topBarCenter} pointerEvents="none">
          {showProgress ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.topBarSide, styles.topBarSideRight]}>
          <Pressable
            onPress={controller.onSignOut}
            disabled={controller.saving}
            style={[styles.floatingLogoutBtn, controller.saving && styles.disabled]}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <Text style={styles.floatingLogoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.gestureWrap} {...controller.stepPanHandlers}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View>
            {controller.step === 0 ? (
              <View style={styles.header}>
                <Text style={[styles.welcome, controller.fontsLoaded && styles.welcomeScript]}>Welcome</Text>
                {controller.displayName ? <Text style={styles.welcomeName}>{controller.displayName}</Text> : null}
                <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
                  Quick setup, then you’re in.
                </Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <OnboardingStepContent controller={controller} />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}