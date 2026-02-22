import React from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";

interface NativePlaceholderScreenProps {
  title: string;
  message: string;
  busy: boolean;
  onTestApi: () => void;
}

export default function NativePlaceholderScreen({ title, message, busy, onTestApi }: NativePlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {busy ? <ActivityIndicator color="#fff" /> : <Button title="Test API" onPress={onTestApi} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  message: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 16,
  },
});
