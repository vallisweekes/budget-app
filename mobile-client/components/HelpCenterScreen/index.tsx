import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";

import TopHeader from "@/components/Shared/TopHeader";
import { getHelpCenterCopy, getHelpTopics } from "@/lib/constants";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function HelpCenterScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { language } = useAppTranslation();
  const copy = getHelpCenterCopy(language);
  const topics = getHelpTopics(language);

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
        centerLabel={copy.screenTitle}
        showIncomeAction={false}
        showAnalyticsAction={false}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{copy.heroEyebrow}</Text>
          <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
          <Text style={styles.heroText}>{copy.heroText}</Text>
        </View>

        <View style={styles.cardList}>
          {topics.map((topic) => (
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