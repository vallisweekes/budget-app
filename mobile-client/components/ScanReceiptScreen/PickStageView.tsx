import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { s } from "@/components/ScanReceiptScreen/style";
import { T } from "@/lib/theme";

type Props = {
  topOffset: number;
  scanError: string | null;
  onLaunchCamera: () => void;
  onLaunchGallery: () => void;
};

export function PickStageView({ topOffset, scanError, onLaunchCamera, onLaunchGallery }: Props) {
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={[s.pickWrap, { paddingTop: topOffset + 12 }]}>
        <View style={s.heroIconWrap}>
          <Ionicons name="receipt-outline" size={64} color={T.accent} />
        </View>
        <Text style={s.heroTitle}>Snap your receipt</Text>
        <Text style={s.heroSub}>AI reads the receipt and fills in the amount, merchant, and date - you just confirm.</Text>

        {scanError ? (
          <View style={s.errorWrap}>
            <Ionicons name="warning-outline" size={15} color={T.red} />
            <Text style={s.errorText}>{scanError}</Text>
          </View>
        ) : null}

        <Pressable style={s.pickOptionCamera} onPress={onLaunchCamera}>
          <View style={s.pickOptionIcon}>
            <Ionicons name="camera" size={24} color={T.onAccent} />
          </View>
          <View style={s.pickOptionText}>
            <Text style={s.pickOptionTitle}>Take a photo</Text>
            <Text style={s.pickOptionSub}>Use your camera to scan a receipt</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.textDim} />
        </Pressable>

        <Pressable style={s.pickOptionGallery} onPress={onLaunchGallery}>
          <View style={[s.pickOptionIcon, s.pickOptionIconSecondary]}>
            <Ionicons name="images" size={24} color={T.accent} />
          </View>
          <View style={s.pickOptionText}>
            <Text style={[s.pickOptionTitle, { color: T.text }]}>Choose from library</Text>
            <Text style={[s.pickOptionSub, { color: T.textDim }]}>Import an existing receipt photo</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.textDim} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
