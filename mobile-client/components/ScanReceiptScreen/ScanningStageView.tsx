import React from "react";
import { View, Text, ActivityIndicator, Animated, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { s } from "@/components/ScanReceiptScreen/style";
import { T } from "@/lib/theme";

type Props = {
  topOffset: number;
  previewUri: string | null;
  shimmerOpacity: Animated.AnimatedInterpolation<string | number>;
};

export function ScanningStageView({ topOffset, previewUri, shimmerOpacity }: Props) {
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={[s.scanningWrap, { paddingTop: topOffset + 20 }]}>
        {previewUri ? <Image source={{ uri: previewUri }} style={s.previewImg} resizeMode="cover" /> : null}
        <View style={s.scanningOverlay}>
          <Animated.View style={[s.scanningIcon, { opacity: shimmerOpacity }]}>
            <Ionicons name="scan-outline" size={52} color={T.accent} />
          </Animated.View>
          <Text style={s.scanningTitle}>Reading your receipt...</Text>
          <Text style={s.scanningSubtitle}>AI is extracting the details</Text>
          <ActivityIndicator size="small" color={T.accent} style={{ marginTop: 16 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}
