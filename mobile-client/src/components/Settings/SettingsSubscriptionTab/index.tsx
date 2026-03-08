import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

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
        <Text style={styles.eyebrow}>Current plan</Text>
        <Text style={styles.currentTitle}>{subscription.current.planLabel}</Text>
        <Text style={styles.currentText}>{subscription.current.billingLabel}</Text>
        {subscription.current.manageLabel ? <Text style={styles.currentHint}>{subscription.current.manageLabel}</Text> : null}
        <Text style={styles.currentHint}>{subscription.launchState.message}</Text>
      </View>

      {subscription.offers.map((offer) => (
        <View key={offer.id} style={[styles.offerCard, offer.highlight && styles.offerCardHighlight]}>
          <View style={styles.offerTitleRow}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            {offer.highlight ? <View style={styles.badge}><Text style={styles.badgeText}>Recommended</Text></View> : null}
          </View>
          <Text style={styles.price}>{offer.priceLabel}</Text>
          <Text style={styles.billing}>{offer.billingLabel}</Text>
          {offer.bullets.map((bullet) => <Text key={bullet} style={styles.bullet}>• {bullet}</Text>)}
          <Pressable disabled style={styles.disabledBtn}>
            <Text style={styles.disabledBtnText}>Coming soon</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}