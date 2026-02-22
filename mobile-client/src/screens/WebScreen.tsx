import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface WebScreenProps {
  baseUrl: string;
  path: string;
}

export default function WebScreen({ baseUrl, path }: WebScreenProps) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!baseUrl) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Missing EXPO_PUBLIC_API_BASE_URL</Text>
      </View>
    );
  }

  const uri = `${baseUrl}${normalizedPath}`;

  return (
    <WebView
      source={{ uri }}
      style={styles.webview}
      originWhitelist={["*"]}
      startInLoadingState
      allowsBackForwardNavigationGestures
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  text: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
  },
});
