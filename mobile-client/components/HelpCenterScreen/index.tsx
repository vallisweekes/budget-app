import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";

import TopHeader from "@/components/Shared/TopHeader";
import { HELP_TOPICS } from "@/lib/constants";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function HelpCenterScreen() {
  const navigation = useNavigation();
  const router = useRouter();

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    router.replace("/(tabs)/dashboard");
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <TopHeader
        onSettings={() => {}}
        onIncome={() => {}}
        onAnalytics={() => {}}
        onNotifications={() => {}}
        variant="default"
        leftVariant="back"
        onBack={handleBack}
        centerLabel="Help"
        showIncomeAction={false}
        showAnalyticsAction={false}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Budget In Check Guide</Text>
          <Text style={styles.heroTitle}>Choose an area to understand how it works.</Text>
          <Text style={styles.heroText}>
            These guides explain the main parts of the app so users can quickly understand what each section is for and where to go next.
          </Text>
        </View>

        <View style={styles.cardList}>
          {HELP_TOPICS.map((topic) => (
            <Pressable
              key={topic.key}
              onPress={() => router.push({ pathname: "/help-topic", params: { topic: topic.key } })}
              style={styles.topicCard}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${topic.accentColor}22`, borderColor: `${topic.accentColor}44` }]}>
                <Ionicons name={topic.icon} size={20} color={topic.accentColor} />
              </View>

              <View style={styles.topicCopy}>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                <Text style={styles.topicDescription}>{topic.description}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={T.textDim} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}