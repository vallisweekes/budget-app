import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";

import TopHeader from "@/components/Shared/TopHeader";
import { getHelpCenterCopy, getHelpTopic } from "@/lib/constants";
import { useAppTranslation } from "@/hooks";

import { styles } from "./style";

export default function HelpTopicScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { language } = useAppTranslation();
  const params = useLocalSearchParams<{ topic?: string }>();
  const topic = getHelpTopic(typeof params.topic === "string" ? params.topic : null, language);
  const copy = getHelpCenterCopy(language);

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    router.replace("/help");
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
        centerLabel={topic?.title ?? copy.screenTitle}
        showIncomeAction={false}
        showAnalyticsAction={false}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {topic ? (
          <>
            <View style={styles.heroCard}>
              <View style={[styles.heroIconWrap, { backgroundColor: `${topic.accentColor}22`, borderColor: `${topic.accentColor}44` }]}>
                <Ionicons name={topic.icon} size={22} color={topic.accentColor} />
              </View>
              <Text style={styles.heroTitle}>{topic.title}</Text>
              <Text style={styles.heroText}>{topic.description}</Text>
            </View>

            {topic.sections.map((section) => (
              <View key={section.title} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
                {section.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{copy.topicNotFoundTitle}</Text>
            <Text style={styles.emptyText}>{copy.topicNotFoundText}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}