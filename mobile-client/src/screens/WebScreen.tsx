import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface WebScreenProps {
  baseUrl: string;
  path: string;
}

export default function WebScreen({ baseUrl, path }: WebScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Web view placeholder</Text>
      <Text style={styles.text}>URL: {baseUrl + path}</Text>
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
  text: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
  },
});
