import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsSubscriptionTabProps } from "@/types/components/settings/SettingsSubscriptionTab.types";

export default function SettingsSubscriptionTab({ subscription, loading, error, onRetry }: SettingsSubscriptionTabProps) {
  if (loading && !subscription) {
    return <View style={styles.body}><ActivityIndicator size="small" color={T.accent} /></View>;
  }

  if (error && !subscription) {
    return (
      <View style={styles.body}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onRetry} style={styles.retryBtn}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View>
    );
  }

  if (!subscription) return null;

  return (
    <View style={styles.body}>
      <View style={styles.currentCard}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.currentCardGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.currentCardGlowSecondary]} />
        <View style={styles.currentBadge}>
          <Ionicons name="sparkles" size={12} color={T.accent} />
          <Text style={styles.currentBadgeText}>Launch access</Text>
        </View>
        <Text style={styles.eyebrow}>Current plan</Text>
        <Text style={styles.currentTitle}>{subscription.current.planLabel}</Text>
        <Text style={styles.currentText}>{subscription.current.billingLabel}</Text>
        {subscription.current.manageLabel ? <Text style={styles.currentHint}>{subscription.current.manageLabel}</Text> : null}
        <Text style={styles.currentHint}>{subscription.launchState.message}</Text>
      </View>

      {subscription.offers.map((offer) => (
        <View key={offer.id} style={[styles.offerCard, offer.highlight && styles.offerCardHighlight]}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.offerCardGlowPrimary, offer.highlight && styles.offerCardGlowHighlight]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.offerCardGlowSecondary, offer.highlight && styles.offerCardGlowHighlightSecondary]} />
          <View style={styles.offerTitleRow}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            {offer.highlight ? (
              <View style={styles.badge}>
                <Ionicons name="star" size={11} color={T.accent} />
                <Text style={styles.badgeText}>Recommended</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.price}>{offer.priceLabel}</Text>
          <Text style={styles.billing}>{offer.billingLabel}</Text>
          <View style={styles.bulletList}>
            {offer.bullets.map((bullet, index) => (
              <View key={`${offer.id}-${index}`} style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <Ionicons name="checkmark" size={11} color={T.accent} />
                </View>
                <Text style={styles.bullet}>{bullet}</Text>
              </View>
            ))}
          </View>
          <Pressable disabled style={[styles.disabledBtn, offer.highlight && styles.disabledBtnHighlight]}>
            <Text style={styles.disabledBtnText}>Coming soon</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}